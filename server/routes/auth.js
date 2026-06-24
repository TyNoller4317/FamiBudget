const express = require('express');
const router = express.Router();
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { body, validationResult } = require('express-validator');
const User = require('../models/User');

const signToken = (user) =>
  jwt.sign(
    { id: user._id, householdId: user.householdId },
    process.env.JWT_SECRET || 'changeme',
    { expiresIn: '7d' }
  );

// POST /api/auth/register
router.post(
  '/register',
  [
    body('name').trim().notEmpty().withMessage('Name is required'),
    body('email').isEmail().withMessage('Valid email required'),
    body('password').isLength({ min: 6 }).withMessage('Password must be at least 6 characters'),
  ],
  async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) return res.status(400).json({ errors: errors.array() });

    try {
      const { name, email, password, inviteCode } = req.body;

      const existing = await User.findOne({ email });
      if (existing) return res.status(409).json({ message: 'Email already in use' });

      const salt = await bcrypt.genSalt(10);
      const passwordHash = await bcrypt.hash(password, salt);

      const householdId = inviteCode && inviteCode.trim() ? inviteCode.trim() : require('crypto').randomUUID();

      const user = await User.create({ name, email, passwordHash, householdId });

      const token = signToken(user);
      res.status(201).json({
        token,
        user: { id: user._id, name: user.name, email: user.email, householdId: user.householdId },
      });
    } catch (err) {
      console.error(err);
      res.status(500).json({ message: 'Server error' });
    }
  }
);

// POST /api/auth/login
router.post(
  '/login',
  [
    body('email').isEmail().withMessage('Valid email required'),
    body('password').notEmpty().withMessage('Password is required'),
  ],
  async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) return res.status(400).json({ errors: errors.array() });

    try {
      const { email, password } = req.body;
      const user = await User.findOne({ email });
      if (!user) return res.status(401).json({ message: 'Invalid credentials' });

      const match = await user.comparePassword(password);
      if (!match) return res.status(401).json({ message: 'Invalid credentials' });

      const token = signToken(user);
      res.json({
        token,
        user: { id: user._id, name: user.name, email: user.email, householdId: user.householdId },
      });
    } catch (err) {
      console.error(err);
      res.status(500).json({ message: 'Server error' });
    }
  }
);

// GET /api/auth/me — current user profile + household members
router.get('/me', async (req, res) => {
  const authHeader = req.headers.authorization;
  if (!authHeader) return res.status(401).json({ message: 'No token' });
  try {
    const token = authHeader.split(' ')[1];
    const decoded = jwt.verify(token, process.env.JWT_SECRET || 'changeme');
    const user = await User.findById(decoded.id).select('-passwordHash');
    if (!user) return res.status(404).json({ message: 'User not found' });
    const members = await User.find({ householdId: user.householdId }).select('name email createdAt');
    res.json({
      user: { id: user._id, name: user.name, email: user.email, householdId: user.householdId, createdAt: user.createdAt },
      members,
    });
  } catch (err) {
    res.status(401).json({ message: 'Invalid token' });
  }
});

// PUT /api/auth/me — update name
router.put('/me', async (req, res) => {
  const authHeader = req.headers.authorization;
  if (!authHeader) return res.status(401).json({ message: 'No token' });
  try {
    const token = authHeader.split(' ')[1];
    const decoded = jwt.verify(token, process.env.JWT_SECRET || 'changeme');
    const { name } = req.body;
    const user = await User.findByIdAndUpdate(decoded.id, { name }, { new: true }).select('-passwordHash');
    res.json({ id: user._id, name: user.name, email: user.email, householdId: user.householdId });
  } catch (err) {
    res.status(401).json({ message: 'Invalid token' });
  }
});

module.exports = router;
