const express = require('express');
const router = express.Router();
const auth = require('../middleware/auth');
const Goal = require('../models/Goal');

router.use(auth);

// GET /api/goals
router.get('/', async (req, res) => {
  try {
    const goals = await Goal.find({ householdId: req.user.householdId }).sort({ createdAt: -1 });
    res.json(goals);
  } catch (err) {
    res.status(500).json({ message: 'Server error' });
  }
});

// POST /api/goals
router.post('/', async (req, res) => {
  try {
    const { name, targetAmount, currentAmount, goalType, deadline, notes } = req.body;
    const goal = await Goal.create({
      householdId: req.user.householdId,
      name,
      targetAmount,
      currentAmount: currentAmount !== undefined ? currentAmount : 0,
      goalType: goalType || 'savings',
      deadline,
      notes,
    });
    res.status(201).json(goal);
  } catch (err) {
    res.status(500).json({ message: 'Server error' });
  }
});

// PUT /api/goals/:id
router.put('/:id', async (req, res) => {
  try {
    const goal = await Goal.findOne({ _id: req.params.id, householdId: req.user.householdId });
    if (!goal) return res.status(404).json({ message: 'Goal not found' });
    const fields = ['name', 'targetAmount', 'currentAmount', 'goalType', 'deadline', 'notes'];
    fields.forEach((f) => { if (req.body[f] !== undefined) goal[f] = req.body[f]; });
    await goal.save();
    res.json(goal);
  } catch (err) {
    res.status(500).json({ message: 'Server error' });
  }
});

// DELETE /api/goals/:id
router.delete('/:id', async (req, res) => {
  try {
    const goal = await Goal.findOneAndDelete({ _id: req.params.id, householdId: req.user.householdId });
    if (!goal) return res.status(404).json({ message: 'Goal not found' });
    res.json({ message: 'Deleted' });
  } catch (err) {
    res.status(500).json({ message: 'Server error' });
  }
});

module.exports = router;
