import { useState, useEffect, useCallback } from 'react';
import api from '../api/axios';
import QuickAdd from '../components/QuickAdd';

const AVATAR_COLORS = ['#042F34', '#1a9e6e', '#5a7a80', '#FFC933', '#16232B'];

function avatarColor(userId) {
  if (!userId) return AVATAR_COLORS[0];
  let hash = 0;
  const s = String(userId);
  for (let i = 0; i < s.length; i++) hash = (hash * 31 + s.charCodeAt(i)) | 0;
  return AVATAR_COLORS[Math.abs(hash) % AVATAR_COLORS.length];
}

function currentMonthStr() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
}

function formatMonth(m) {
  const [year, month] = m.split('-');
  const d = new Date(parseInt(year), parseInt(month) - 1, 1);
  return d.toLocaleString('default', { month: 'long', year: 'numeric' });
}

function prevMonth(m) {
  const [y, mo] = m.split('-').map(Number);
  const d = new Date(y, mo - 2, 1);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
}

function nextMonth(m) {
  const [y, mo] = m.split('-').map(Number);
  const d = new Date(y, mo, 1);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
}

function fmt(n) {
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(n || 0);
}

function EditModal({ txn, onClose, onSaved }) {
  const [type, setType] = useState(txn.type || 'expense');
  const [amount, setAmount] = useState(String(txn.amount || ''));
  const [category, setCategory] = useState(txn.category || 'Food');
  const [description, setDescription] = useState(txn.description || '');
  const [date, setDate] = useState(txn.date ? txn.date.slice(0, 10) : new Date().toISOString().slice(0, 10));
  const [saving, setSaving] = useState(false);

  const CATEGORIES = ['Housing', 'Food', 'Transport', 'Utilities', 'Entertainment', 'Healthcare', 'Shopping', 'Savings', 'Income', 'Other'];

  const handleSave = async () => {
    setSaving(true);
    try {
      await api.put(`/transactions/${txn._id || txn.id}`, { type, amount: parseFloat(amount), category, description, date });
      onSaved();
      onClose();
    } catch (err) {
      console.error(err);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="sheet-overlay" onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="sheet" style={{ borderRadius: '24px', width: '480px', margin: 'auto' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
          <span style={{ fontWeight: 600, fontSize: '1.125rem' }}>Edit Transaction</span>
          <button onClick={onClose} style={{ background: 'none', border: 'none', fontSize: '1.25rem', cursor: 'pointer', color: 'var(--muted)' }}>✕</button>
        </div>
        <div className="type-toggle">
          <button className={type === 'expense' ? 'active' : ''} onClick={() => setType('expense')}>Expense</button>
          <button className={type === 'income' ? 'active' : ''} onClick={() => setType('income')}>Income</button>
        </div>
        <input className="amount-input" type="number" value={amount} onChange={e => setAmount(e.target.value)} min="0" step="0.01" />
        <div className="form-group">
          <label>Category</label>
          <select value={category} onChange={e => setCategory(e.target.value)}>
            {CATEGORIES.map(c => <option key={c}>{c}</option>)}
          </select>
        </div>
        <div className="form-group">
          <label>Description</label>
          <input type="text" value={description} onChange={e => setDescription(e.target.value)} />
        </div>
        <div className="form-group">
          <label>Date</label>
          <input type="date" value={date} onChange={e => setDate(e.target.value)} />
        </div>
        <button className="btn-primary" style={{ width: '100%' }} onClick={handleSave} disabled={saving}>
          {saving ? 'Saving...' : 'Save'}
        </button>
      </div>
    </div>
  );
}

export default function Transactions() {
  const [month, setMonth] = useState(currentMonthStr);
  const [transactions, setTransactions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [editTxn, setEditTxn] = useState(null);

  const fetchTransactions = useCallback(async () => {
    setLoading(true);
    try {
      const [y, mo] = month.split('-').map(Number);
      const start = new Date(y, mo - 1, 1).toISOString().slice(0, 10);
      const end = new Date(y, mo, 0).toISOString().slice(0, 10);
      const res = await api.get(`/transactions?startDate=${start}&endDate=${end}`);
      setTransactions(res.data.transactions || res.data || []);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  }, [month]);

  useEffect(() => { fetchTransactions(); }, [fetchTransactions]);

  const handleDelete = async (id) => {
    if (!window.confirm('Delete this transaction?')) return;
    try {
      await api.delete(`/transactions/${id}`);
      fetchTransactions();
    } catch (err) {
      console.error(err);
    }
  };

  return (
    <div className="page-content">
      <div className="month-nav">
        <button onClick={() => setMonth(prevMonth(month))}>‹</button>
        <h2>{formatMonth(month)}</h2>
        <button onClick={() => setMonth(nextMonth(month))}>›</button>
      </div>

      {loading ? (
        <div style={{ textAlign: 'center', color: 'var(--muted)', padding: '2rem' }}>Loading...</div>
      ) : transactions.length === 0 ? (
        <div className="card" style={{ textAlign: 'center', color: 'var(--muted)', padding: '2rem' }}>
          No transactions this month.
        </div>
      ) : (
        <div className="txn-list">
          {transactions.map(txn => {
            const initial = (txn.createdByName || txn.description || txn.category || '?')[0].toUpperCase();
            const color = avatarColor(txn.createdBy || txn.userId);
            const dateStr = txn.date ? new Date(txn.date).toLocaleDateString('en-US', { month: 'numeric', day: 'numeric' }) : '';
            return (
              <div className="txn-row" key={txn._id || txn.id}>
                <div className="txn-avatar" style={{ background: color + '22', color }}>
                  {initial}
                </div>
                <div className="txn-info">
                  <div className="txn-desc">{txn.description || txn.category}</div>
                  <div className="txn-meta">{txn.category} · {dateStr} · Added by {txn.createdByName || 'You'}</div>
                </div>
                <div className={`txn-amount ${txn.type}`}>
                  {txn.type === 'income' ? '+' : '-'}{fmt(txn.amount)}
                </div>
                <button
                  onClick={() => setEditTxn(txn)}
                  style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: '1rem', color: 'var(--muted)', padding: '0.25rem' }}
                  title="Edit"
                >✏️</button>
                <button
                  onClick={() => handleDelete(txn._id || txn.id)}
                  className="btn-danger"
                  title="Delete"
                >🗑</button>
              </div>
            );
          })}
        </div>
      )}

      {editTxn && (
        <EditModal
          txn={editTxn}
          onClose={() => setEditTxn(null)}
          onSaved={fetchTransactions}
        />
      )}

      <QuickAdd onSave={fetchTransactions} />
    </div>
  );
}
