const mongoose = require('mongoose');

const TransactionSchema = new mongoose.Schema({
  householdId: { type: String, required: true, index: true },
  createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  type: { type: String, enum: ['income', 'expense'], required: true },
  amount: { type: Number, required: true },
  category: { type: String, required: true, trim: true },
  description: { type: String, trim: true },
  date: { type: Date, default: Date.now },
  isRecurring: { type: Boolean, default: false },
  recurringInterval: { type: String, enum: ['weekly', 'biweekly', 'monthly', 'yearly'], default: undefined },
  ownedBy: { type: String, default: 'joint' },
  lastGenerated: { type: Date, default: null },
  createdAt: { type: Date, default: Date.now },
});

module.exports = mongoose.model('Transaction', TransactionSchema);
