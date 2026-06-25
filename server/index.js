require('dotenv').config();
const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');

const app = express();

app.use(cors());
app.use(express.json());

// Routes
app.use('/api/auth', require('./routes/auth'));
app.use('/api/transactions', require('./routes/transactions'));
app.use('/api/goals', require('./routes/goals'));
app.use('/api', require('./routes/summary'));
const budgetRoutes = require('./routes/budgets');
app.use('/api/budgets', budgetRoutes);
const investmentRoutes = require('./routes/investments');
app.use('/api/investments', investmentRoutes);
app.use('/api/recurring', require('./routes/recurring'));

const PORT = process.env.PORT || 5000;
const MONGO_URI = process.env.MONGO_URI || 'mongodb://localhost:27017/famibudget';

// Generate all missed recurring transactions (backfill + catch-up)
async function generateRecurring() {
  const Transaction = require('./models/Transaction');
  try {
    const today = new Date();
    today.setHours(23, 59, 59, 999);
    const recurring = await Transaction.find({ isRecurring: true });
    let total = 0;
    for (const tx of recurring) {
      let last = tx.lastGenerated ? new Date(tx.lastGenerated) : new Date(tx.date);
      last.setHours(0, 0, 0, 0);
      let days;
      switch (tx.recurringInterval) {
        case 'weekly':   days = 7;   break;
        case 'biweekly': days = 14;  break;
        case 'monthly':  days = 30;  break;
        case 'yearly':   days = 365; break;
        default: continue;
      }
      // Loop to backfill ALL missed occurrences
      while (true) {
        const nextDue = new Date(last);
        nextDue.setDate(nextDue.getDate() + days);
        if (nextDue > today) break;
        await Transaction.create({
          householdId: tx.householdId, createdBy: tx.createdBy,
          type: tx.type, amount: tx.amount, category: tx.category,
          description: tx.description, date: nextDue,
          isRecurring: true, recurringInterval: tx.recurringInterval,
          ownedBy: tx.ownedBy,
        });
        tx.lastGenerated = nextDue;
        last = nextDue;
        total++;
      }
      if (tx.isModified()) await tx.save();
    }
    if (total > 0) console.log(`Recurring: generated ${total} transaction(s)`);
  } catch (err) {
    console.error('Recurring generation error:', err);
  }
}

function scheduleRecurringGeneration() {
  generateRecurring(); // run immediately on startup to backfill
  setInterval(generateRecurring, 1000 * 60 * 60 * 6); // then every 6 hours
}

mongoose
  .connect(MONGO_URI)
  .then(() => {
    console.log('MongoDB connected');
    scheduleRecurringGeneration();
    app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
  })
  .catch((err) => {
    console.error('MongoDB connection error:', err);
    process.exit(1);
  });
