const mongoose = require('mongoose');
const InvestmentSchema = new mongoose.Schema({
  householdId: { type: String, required: true, index: true },
  name: { type: String, required: true, trim: true },
  ticker: { type: String, trim: true, uppercase: true }, // null for retirement/savings
  accountType: { type: String, enum: ['stock', 'retirement', 'savings', 'liability'], required: true },
  shares: { type: Number }, // for stocks only
  costBasis: { type: Number }, // per share for stocks, total for others
  currentPrice: { type: Number }, // cached price for stocks
  manualValue: { type: Number }, // for retirement/savings accounts
  interestRate: { type: Number }, // for savings accounts (APY %)
  lastPriceUpdate: { type: Date },
  notes: { type: String, trim: true },
  ownedBy: { type: String, default: 'joint' },
  createdAt: { type: Date, default: Date.now }
});
module.exports = mongoose.model('Investment', InvestmentSchema);
