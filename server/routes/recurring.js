const express = require('express');
const router = express.Router();
const auth = require('../middleware/auth');
const Transaction = require('../models/Transaction');

// POST /api/recurring/generate — called daily by cron, or manually
// Finds all recurring transactions and generates new ones if due
router.post('/generate', auth, async (req, res) => {
  try {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const recurring = await Transaction.find({
      householdId: req.user.householdId,
      isRecurring: true,
    });

    const generated = [];

    for (const tx of recurring) {
      let last = tx.lastGenerated ? new Date(tx.lastGenerated) : new Date(tx.date);
      last.setHours(0, 0, 0, 0);

      let intervalDays;
      switch (tx.recurringInterval) {
        case 'weekly':    intervalDays = 7;   break;
        case 'biweekly':  intervalDays = 14;  break;
        case 'monthly':   intervalDays = 30;  break;
        case 'yearly':    intervalDays = 365; break;
        default: continue;
      }

      // Backfill all missed occurrences
      while (true) {
        const nextDue = new Date(last);
        nextDue.setDate(nextDue.getDate() + intervalDays);
        if (nextDue > today) break;

        const newTx = await Transaction.create({
          householdId: tx.householdId,
          createdBy: tx.createdBy,
          type: tx.type,
          amount: tx.amount,
          category: tx.category,
          description: tx.description,
          date: nextDue,
          isRecurring: true,
          recurringInterval: tx.recurringInterval,
          ownedBy: tx.ownedBy,
        });

        tx.lastGenerated = nextDue;
        last = nextDue;
        generated.push(newTx);
      }
      if (tx.isModified()) await tx.save();
    }

    res.json({ generated: generated.length, transactions: generated });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Server error' });
  }
});

// GET /api/recurring — list all recurring templates
router.get('/', auth, async (req, res) => {
  try {
    const recurring = await Transaction.find({
      householdId: req.user.householdId,
      isRecurring: true,
    }).sort({ date: -1 }).populate('createdBy', 'name');
    res.json(recurring);
  } catch (err) {
    res.status(500).json({ message: 'Server error' });
  }
});

module.exports = router;
