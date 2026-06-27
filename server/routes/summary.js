const express = require('express');
const router = express.Router();
const { Types: { ObjectId } } = require('mongoose');
const auth = require('../middleware/auth');
const Transaction = require('../models/Transaction');
const Goal = require('../models/Goal');
const Budget = require('../models/Budget');

function currentMonth() {
  const now = new Date();
  const mm = String(now.getMonth() + 1).padStart(2, '0');
  return `${now.getFullYear()}-${mm}`;
}

function monthToDateRange(month) {
  // month is 'YYYY-MM'
  const [year, mon] = month.split('-').map(Number);
  const startDate = new Date(year, mon - 1, 1);
  const endDate = new Date(year, mon, 0, 23, 59, 59, 999); // last day of month
  return { startDate, endDate };
}

// GET /api/summary
router.get('/summary', auth, async (req, res) => {
  try {
    const { householdId, id: userId } = req.user;
    const month = req.query.month || currentMonth();
    const { startDate, endDate } = monthToDateRange(month);
    const scope = req.query.scope; // 'user' = only my transactions, omit = household

    const dateFilter = { date: { $gte: startDate, $lte: endDate } };
    const baseMatch = scope === 'user'
      ? { householdId, createdBy: new ObjectId(userId) }
      : { householdId };

    // All-time match (up through end of current month) for running balance
    const allTimeMatch = { ...baseMatch, date: { $lte: endDate } };

    const [incomeAgg, expenseAgg, categoryAgg, goals, budgets, allIncomeAgg, allExpenseAgg] = await Promise.all([
      Transaction.aggregate([
        { $match: { ...baseMatch, type: 'income', ...dateFilter } },
        { $group: { _id: null, total: { $sum: '$amount' } } },
      ]),
      Transaction.aggregate([
        { $match: { ...baseMatch, type: 'expense', ...dateFilter } },
        { $group: { _id: null, total: { $sum: '$amount' } } },
      ]),
      Transaction.aggregate([
        { $match: { ...baseMatch, type: 'expense', ...dateFilter } },
        { $group: { _id: '$category', total: { $sum: '$amount' } } },
        { $sort: { total: -1 } },
      ]),
      Goal.find({ householdId }),
      Budget.find({ householdId, month }),
      Transaction.aggregate([
        { $match: { ...allTimeMatch, type: 'income' } },
        { $group: { _id: null, total: { $sum: '$amount' } } },
      ]),
      Transaction.aggregate([
        { $match: { ...allTimeMatch, type: 'expense' } },
        { $group: { _id: null, total: { $sum: '$amount' } } },
      ]),
    ]);

    const totalIncome = incomeAgg[0]?.total || 0;
    const totalExpenses = expenseAgg[0]?.total || 0;
    const net = totalIncome - totalExpenses;
    const runningBalance = (allIncomeAgg[0]?.total || 0) - (allExpenseAgg[0]?.total || 0);

    // Build a map of category -> monthlyLimit from budgets
    const budgetMap = {};
    budgets.forEach((b) => { budgetMap[b.category] = b.monthlyLimit; });

    const spendingByCategory = categoryAgg.map((c) => ({
      category: c._id,
      total: c.total,
      budget: budgetMap[c._id] != null ? budgetMap[c._id] : null,
    }));

    const goalProgress = goals.map((g) => ({
      id: g._id,
      name: g.name,
      targetAmount: g.targetAmount,
      currentAmount: g.currentAmount,
      percentage: g.targetAmount > 0 ? Math.min(100, Math.round((g.currentAmount / g.targetAmount) * 100)) : 0,
      deadline: g.deadline,
    }));

    res.json({ month, totalIncome, totalExpenses, net, runningBalance, spendingByCategory, goalProgress, budgets: budgets.map(b => ({ _id: b._id, category: b.category, monthlyLimit: b.monthlyLimit, month: b.month })) });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Server error' });
  }
});

// GET /api/history — last 6 months of income/expense/cumulative net
router.get('/history', auth, async (req, res) => {
  try {
    const { householdId } = req.user;

    // Build list of last 6 months (oldest first)
    const months = [];
    const now = new Date();
    for (let i = 5; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const mm = String(d.getMonth() + 1).padStart(2, '0');
      const monthStr = `${d.getFullYear()}-${mm}`;
      const label = d.toLocaleString('default', { month: 'short' });
      months.push({ month: monthStr, label });
    }

    // For each month query income + expenses in parallel
    const results = await Promise.all(
      months.map(async ({ month, label }) => {
        const { startDate, endDate } = monthToDateRange(month);
        const dateFilter = { date: { $gte: startDate, $lte: endDate } };
        const [incAgg, expAgg] = await Promise.all([
          Transaction.aggregate([
            { $match: { householdId, type: 'income', ...dateFilter } },
            { $group: { _id: null, total: { $sum: '$amount' } } },
          ]),
          Transaction.aggregate([
            { $match: { householdId, type: 'expense', ...dateFilter } },
            { $group: { _id: null, total: { $sum: '$amount' } } },
          ]),
        ]);
        return { month, label, income: incAgg[0]?.total || 0, expenses: expAgg[0]?.total || 0 };
      })
    );

    // Compute cumulative net (running total)
    let cumulative = 0;
    const history = results.map(r => {
      cumulative += r.income - r.expenses;
      return { ...r, net: cumulative };
    });

    res.json(history);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Server error' });
  }
});

module.exports = router;
