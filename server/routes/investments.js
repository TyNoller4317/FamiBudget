const express = require('express');
const router = express.Router();
const https = require('https');
const auth = require('../middleware/auth');
const Investment = require('../models/Investment');
const Goal = require('../models/Goal');

function fetchPrice(ticker) {
  return new Promise((resolve, reject) => {
    const url = `https://query1.finance.yahoo.com/v8/finance/chart/${ticker}?interval=1d&range=1d`;
    https.get(url, { headers: { 'User-Agent': 'Mozilla/5.0' } }, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        try {
          const json = JSON.parse(data);
          const price = json.chart.result[0].meta.regularMarketPrice;
          resolve(price);
        } catch (e) { reject(e); }
      });
    }).on('error', reject);
  });
}

// GET / — all investments for household
router.get('/', auth, async (req, res) => {
  try {
    const investments = await Investment.find({ householdId: req.user.householdId })
      .sort({ accountType: 1, name: 1 });
    res.json(investments);
  } catch (err) {
    res.status(500).json({ message: 'Server error', error: err.message });
  }
});

// POST / — create investment
router.post('/', auth, async (req, res) => {
  try {
    const { name, ticker, accountType, shares, costBasis, manualValue, interestRate, notes, ownedBy } = req.body;
    const investment = new Investment({
      householdId: req.user.householdId,
      name,
      ticker,
      accountType,
      shares,
      costBasis,
      manualValue,
      interestRate,
      notes,
      ownedBy: ownedBy || req.user.id,
    });
    await investment.save();

    // Auto-create a debt payoff goal when a liability is added
    if (accountType === 'liability') {
      const existingGoal = await Goal.findOne({ linkedLiabilityId: String(investment._id) });
      if (!existingGoal) {
        await Goal.create({
          householdId: req.user.householdId,
          name: `Pay off ${name}`,
          targetAmount: parseFloat(manualValue) || 0,
          currentAmount: parseFloat(manualValue) || 0,
          goalType: 'debt',
          linkedLiabilityId: String(investment._id),
          notes: `Auto-created from liability: ${name}`,
        });
      }
    }

    res.status(201).json(investment);
  } catch (err) {
    res.status(400).json({ message: 'Validation error', error: err.message });
  }
});

// PUT /:id — update investment
router.get('/:id', auth, async (req, res) => {
  try {
    const investment = await Investment.findOne({ _id: req.params.id, householdId: req.user.householdId });
    if (!investment) return res.status(404).json({ message: 'Investment not found' });
    res.json(investment);
  } catch (err) {
    res.status(500).json({ message: 'Server error', error: err.message });
  }
});

router.put('/:id', auth, async (req, res) => {
  try {
    const investment = await Investment.findOneAndUpdate(
      { _id: req.params.id, householdId: req.user.householdId },
      { $set: req.body },
      { new: true, runValidators: true }
    );
    if (!investment) return res.status(404).json({ message: 'Investment not found' });
    res.json(investment);
  } catch (err) {
    res.status(400).json({ message: 'Update error', error: err.message });
  }
});

// DELETE /:id — delete investment
router.delete('/:id', auth, async (req, res) => {
  try {
    const investment = await Investment.findOneAndDelete({
      _id: req.params.id,
      householdId: req.user.householdId
    });
    if (!investment) return res.status(404).json({ message: 'Investment not found' });
    res.json({ message: 'Investment deleted' });
  } catch (err) {
    res.status(500).json({ message: 'Server error', error: err.message });
  }
});

// GET /prices — fetch and cache current prices for all stock positions
router.get('/prices', auth, async (req, res) => {
  try {
    const stocks = await Investment.find({
      householdId: req.user.householdId,
      accountType: 'stock',
      ticker: { $exists: true, $ne: null }
    });

    if (stocks.length === 0) return res.json([]);

    const results = await Promise.all(
      stocks.map(async (investment) => {
        try {
          const price = await fetchPrice(investment.ticker);
          investment.currentPrice = price;
          investment.lastPriceUpdate = new Date();
          await investment.save();
          return investment;
        } catch (err) {
          // Skip failed tickers, return as-is
          return investment;
        }
      })
    );

    res.json(results);
  } catch (err) {
    res.status(500).json({ message: 'Server error', error: err.message });
  }
});

module.exports = router;
