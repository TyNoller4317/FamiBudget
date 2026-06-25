const mongoose = require('mongoose');

const GoalSchema = new mongoose.Schema({
  householdId: { type: String, required: true, index: true },
  name: { type: String, required: true, trim: true },
  targetAmount: { type: Number, required: true },
  currentAmount: { type: Number, default: 0 },
  goalType: { type: String, enum: ['savings', 'debt'], default: 'savings' },
  deadline: { type: Date },
  notes: { type: String, trim: true },
  linkedLiabilityId: { type: String, default: null },
  lastPaymentAmount: { type: Number, default: null },
  lastPaymentDate: { type: Date, default: null },
  createdAt: { type: Date, default: Date.now },
});

module.exports = mongoose.model('Goal', GoalSchema);
