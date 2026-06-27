const express = require('express');
const router = express.Router();
const auth = require('../middleware/auth');
const Transaction = require('../models/Transaction');

router.use(auth);

// GET /api/transactions
router.get('/', async (req, res) => {
  try {
    const { type, category, startDate, endDate, month, scope, limit } = req.query;
    const filter = { householdId: req.user.householdId };
    if (scope === 'user') filter.createdBy = new (require('mongoose').Types.ObjectId)(req.user.id);
    if (type) filter.type = type;
    if (category) filter.category = category;
    if (month) {
      const [y, m] = month.split('-').map(Number);
      filter.date = { $gte: new Date(y, m - 1, 1), $lte: new Date(y, m, 0, 23, 59, 59, 999) };
    } else if (startDate || endDate) {
      filter.date = {};
      if (startDate) filter.date.$gte = new Date(startDate);
      if (endDate) {
        const end = new Date(endDate);
        end.setHours(23, 59, 59, 999);
        filter.date.$lte = end;
      }
    }
    let query = Transaction.find(filter).sort({ date: -1, createdAt: -1 }).populate('createdBy', 'name');
    if (limit) query = query.limit(parseInt(limit));
    const transactions = await query;
    res.json(transactions.map((t) => ({
      ...t.toObject(),
      createdByName: t.createdBy?.name || 'Unknown',
    })));
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Server error' });
  }
});

// POST /api/transactions
router.post('/', async (req, res) => {
  try {
    const { type, amount, category, description, date, isRecurring, recurringInterval, ownedBy } = req.body;
    const tx = await Transaction.create({
      householdId: req.user.householdId,
      createdBy: req.user.id,
      type,
      amount,
      category,
      description,
      date: date || Date.now(),
      isRecurring: isRecurring || false,
      recurringInterval: isRecurring ? recurringInterval : undefined,
      ownedBy: ownedBy || req.user.id,
    });
    res.status(201).json(tx);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Server error' });
  }
});

// PUT /api/transactions/:id
router.put('/:id', async (req, res) => {
  try {
    const tx = await Transaction.findOne({ _id: req.params.id, householdId: req.user.householdId });
    if (!tx) return res.status(404).json({ message: 'Transaction not found' });
    const fields = ['type', 'amount', 'category', 'description', 'date', 'isRecurring', 'recurringInterval', 'ownedBy'];
    fields.forEach((f) => { if (req.body[f] !== undefined) tx[f] = req.body[f]; });
    await tx.save();
    res.json(tx);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Server error' });
  }
});

// DELETE /api/transactions/:id
router.delete('/:id', async (req, res) => {
  try {
    const tx = await Transaction.findOneAndDelete({ _id: req.params.id, householdId: req.user.householdId });
    if (!tx) return res.status(404).json({ message: 'Transaction not found' });
    res.json({ message: 'Deleted' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Server error' });
  }
});

module.exports = router;
