const mongoose = require('mongoose');
const BudgetSchema = new mongoose.Schema({
  householdId: { type: String, required: true, index: true },
  category: { type: String, required: true, trim: true },
  monthlyLimit: { type: Number, required: true },
  month: { type: String, required: true }, // 'YYYY-MM'
  recurring: { type: Boolean, default: false },
  createdAt: { type: Date, default: Date.now }
});
BudgetSchema.index({ householdId: 1, category: 1, month: 1 }, { unique: true });
module.exports = mongoose.model('Budget', BudgetSchema);
