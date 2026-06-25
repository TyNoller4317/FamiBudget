import { useState, useEffect, useRef } from 'react';
import api from '../api/axios';
import { useAuth } from '../context/AuthContext';
import './QuickAdd.css';

const CATEGORIES = [
  { emoji: '🏠', label: 'Housing' },
  { emoji: '🍔', label: 'Food' },
  { emoji: '🚗', label: 'Transport' },
  { emoji: '⚡', label: 'Utilities' },
  { emoji: '🎬', label: 'Entertainment' },
  { emoji: '📚', label: 'Education' },
  { emoji: '🛍️', label: 'Shopping' },
  { emoji: '💰', label: 'Savings' },
  { emoji: '💵', label: 'Income' },
  { emoji: '📦', label: 'Other' },
];

const INTERVALS = [
  { value: 'weekly', label: 'Weekly' },
  { value: 'biweekly', label: 'Every 2 Weeks' },
  { value: 'monthly', label: 'Monthly' },
  { value: 'yearly', label: 'Yearly' },
];

function todayStr() {
  return new Date().toISOString().slice(0, 10);
}

export default function QuickAdd({ onSave, prefill = null }) {
  const { user } = useAuth();
  const [open, setOpen] = useState(false);
  const [type, setType] = useState(prefill?.type || 'expense');
  const [amount, setAmount] = useState(prefill?.amount ? String(prefill.amount) : '');
  const [category, setCategory] = useState(prefill?.category || '');
  const [description, setDescription] = useState(prefill?.description || '');
  const [date, setDate] = useState(prefill?.date ? prefill.date.slice(0, 10) : todayStr());
  const [isRecurring, setIsRecurring] = useState(false);
  const [recurringInterval, setRecurringInterval] = useState('monthly');
  const [ownedBy, setOwnedBy] = useState(user?.id || 'joint');
  const [members, setMembers] = useState([]);
  const [saving, setSaving] = useState(false);
  const amountRef = useRef(null);

  useEffect(() => {
    api.get('/auth/me').then(res => {
      setMembers(res.data.members || []);
    }).catch(() => {});
  }, []);

  useEffect(() => {
    if (open && amountRef.current) {
      setTimeout(() => amountRef.current?.focus(), 100);
    }
  }, [open]);

  const resetForm = () => {
    setType('expense');
    setAmount('');
    setCategory('');
    setDescription('');
    setDate(todayStr());
    setIsRecurring(false);
    setRecurringInterval('monthly');
    setOwnedBy(user?.id || 'joint');
  };

  const handleOpen = () => setOpen(true);
  const handleClose = () => { setOpen(false); resetForm(); };

  const handleSave = async () => {
    if (!amount || isNaN(parseFloat(amount)) || !category) return;
    setSaving(true);
    try {
      const payload = {
        type,
        amount: parseFloat(amount),
        category,
        description,
        date,
        isRecurring,
        recurringInterval: isRecurring ? recurringInterval : undefined,
        ownedBy,
      };
      if (prefill?.id) {
        await api.put(`/transactions/${prefill.id}`, payload);
      } else {
        await api.post('/transactions', payload);
      }
      handleClose();
      if (onSave) onSave();
    } catch (err) {
      console.error(err);
    } finally {
      setSaving(false);
    }
  };

  const canSave = amount && !isNaN(parseFloat(amount)) && parseFloat(amount) > 0 && category;

  return (
    <>
      <button className="fab" onClick={handleOpen} aria-label="Add transaction">＋</button>

      {open && (
        <div className="sheet-overlay" onClick={e => e.target === e.currentTarget && handleClose()}>
          <div className="sheet">
            <div className="sheet-handle" />

            <div className="sheet-header">
              <span className="sheet-title">{prefill?.id ? 'Edit Transaction' : 'Add Transaction'}</span>
              <button className="sheet-close" onClick={handleClose} aria-label="Close">✕</button>
            </div>

            <div className="type-toggle">
              <button className={type === 'expense' ? 'active' : ''} onClick={() => setType('expense')}>Expense</button>
              <button className={type === 'income' ? 'active' : ''} onClick={() => setType('income')}>Income</button>
            </div>

            <div className="amount-row">
              <input
                ref={amountRef}
                className="amount-input"
                type="text"
                inputMode="decimal"
                placeholder="$0.00"
                value={amount}
                onChange={e => setAmount(e.target.value)}
              />
            </div>

            <div className="category-grid">
              {CATEGORIES.map(cat => (
                <button
                  key={cat.label}
                  className={`cat-tile${category === cat.label ? ' selected' : ''}`}
                  onClick={() => setCategory(cat.label)}
                  type="button"
                >
                  <span className="cat-emoji">{cat.emoji}</span>
                  <span>{cat.label}</span>
                </button>
              ))}
            </div>

            <div className="form-group">
              <input
                type="text"
                placeholder="Note (optional)"
                value={description}
                onChange={e => setDescription(e.target.value)}
                className="subtle-input"
              />
            </div>

            <div className="form-group">
              <input
                type="date"
                value={date}
                onChange={e => setDate(e.target.value)}
                className="subtle-input"
              />
            </div>

            <div className="recurring-toggle-row">
              <label className="recurring-toggle-label">
                <input
                  type="checkbox"
                  checked={isRecurring}
                  onChange={e => setIsRecurring(e.target.checked)}
                  style={{ width: 'auto', marginRight: '0.5rem' }}
                />
                {type === 'income' ? 'Recurring income (e.g. paycheck)' : 'Recurring bill'}
              </label>
              {isRecurring && (
                <select
                  value={recurringInterval}
                  onChange={e => setRecurringInterval(e.target.value)}
                  style={{ marginTop: '0.5rem' }}
                >
                  {INTERVALS.map(i => (
                    <option key={i.value} value={i.value}>{i.label}</option>
                  ))}
                </select>
              )}
            </div>

            <div className="owner-picker">
              <div className="owner-picker-label">Who is this for?</div>
              <div className="owner-picker-row">
                {members.map(m => (
                  <button
                    key={m._id}
                    type="button"
                    className={`owner-btn${ownedBy === m._id ? ' active' : ''}`}
                    onClick={() => setOwnedBy(m._id)}
                  >
                    {m._id === user?.id ? 'Me' : m.name.split(' ')[0]}
                  </button>
                ))}
                <button
                  type="button"
                  className={`owner-btn${ownedBy === 'joint' ? ' active' : ''}`}
                  onClick={() => setOwnedBy('joint')}
                >
                  Joint
                </button>
              </div>
            </div>

            <button
              className="btn-primary"
              style={{ width: '100%', marginTop: '1rem' }}
              onClick={handleSave}
              disabled={saving || !canSave}
            >
              {saving ? 'Saving…' : 'Save'}
            </button>
          </div>
        </div>
      )}
    </>
  );
}
