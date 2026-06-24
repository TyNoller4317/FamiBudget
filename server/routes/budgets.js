const express = require('express');
const router = express.Router();
const auth = require('../middleware/auth');
const Budget = require('../models/Budget');

router.use(auth);

function currentMonth() {
  const now = new Date();
  const mm = String(now.getMonth() + 1).padStart(2, '0');
  return `${now.getFullYear()}-${mm}`;
}

// GET /api/budgets?month=YYYY-MM
// Returns month-specific budgets + recurring budgets for uncovered categories
router.get('/', async (req, res) => {
  try {
    const { householdId } = req.user;
    const month = req.query.month || currentMonth();

    const monthBudgets = await Budget.find({ householdId, month });
    const coveredCategories = monthBudgets.map(b => b.category);

    // Recurring budgets from any month that aren't overridden this month
    const recurringBudgets = await Budget.find({
      householdId,
      recurring: true,
      category: { $nin: coveredCategories },
    });

    // Surface recurring budgets as if they belong to the requested month
    const merged = [
      ...monthBudgets,
      ...recurringBudgets.map(b => ({
        ...b.toObject(),
        month,
        _isRecurringFallback: true,
      })),
    ].sort((a, b) => a.category.localeCompare(b.category));

    res.json(merged);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Server error' });
  }
});

// POST /api/budgets
router.post('/', async (req, res) => {
  try {
    const { householdId } = req.user;
    const { category, monthlyLimit, month, recurring } = req.body;
    if (!category || monthlyLimit == null || !month) {
      return res.status(400).json({ message: 'category, monthlyLimit, and month are required' });
    }
    const budget = await Budget.findOneAndUpdate(
      { householdId, category, month },
      { householdId, category, monthlyLimit, month, recurring: !!recurring },
      { upsert: true, new: true, setDefaultsOnInsert: true }
    );
    res.status(200).json(budget);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Server error' });
  }
});

// PUT /api/budgets/:id
router.put('/:id', async (req, res) => {
  try {
    const { householdId } = req.user;
    const { monthlyLimit, category, month, recurring } = req.body;
    const budget = await Budget.findOne({ _id: req.params.id, householdId });
    if (!budget) return res.status(404).json({ message: 'Budget not found' });
    if (monthlyLimit != null) budget.monthlyLimit = monthlyLimit;
    if (category) budget.category = category;
    if (month) budget.month = month;
    if (recurring != null) budget.recurring = !!recurring;
    await budget.save();
    res.json(budget);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Server error' });
  }
});

// DELETE /api/budgets/:id
router.delete('/:id', async (req, res) => {
  try {
    const { householdId } = req.user;
    const budget = await Budget.findOneAndDelete({ _id: req.params.id, householdId });
    if (!budget) return res.status(404).json({ message: 'Budget not found' });
    res.json({ message: 'Deleted' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Server error' });
  }
});

module.exports = router;
