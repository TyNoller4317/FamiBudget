import { useState, useEffect, useCallback } from 'react';
import api from '../api/axios';
import { useAuth } from '../context/AuthContext';
import QuickAdd from '../components/QuickAdd';

const CATEGORIES = ['Housing', 'Food', 'Transport', 'Utilities', 'Entertainment', 'Education', 'Shopping', 'Savings', 'Income', 'Other'];
const CATEGORY_EMOJI = {
  Housing: '🏠', Food: '🍔', Transport: '🚗', Utilities: '⚡',
  Entertainment: '🎬', Education: '📚', Shopping: '🛍️',
  Savings: '💰', Income: '💵', Other: '📦',
};
const INTERVALS = [
  { value: 'weekly', label: 'Weekly' },
  { value: 'biweekly', label: 'Every 2 Weeks' },
  { value: 'monthly', label: 'Monthly' },
  { value: 'yearly', label: 'Yearly' },
];

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

const AVATAR_COLORS = ['#042F34', '#1a9e6e', '#5a7a80', '#FFC933', '#16232B'];
function avatarColor(userId) {
  if (!userId) return AVATAR_COLORS[0];
  let hash = 0;
  const s = String(userId);
  for (let i = 0; i < s.length; i++) hash = (hash * 31 + s.charCodeAt(i)) | 0;
  return AVATAR_COLORS[Math.abs(hash) % AVATAR_COLORS.length];
}

// ── Edit Modal ──────────────────────────────────────────────────────────────
function EditModal({ txn, onClose, onSaved }) {
  const [type, setType] = useState(txn.type || 'expense');
  const [amount, setAmount] = useState(String(txn.amount || ''));
  const [category, setCategory] = useState(txn.category || 'Food');
  const [description, setDescription] = useState(txn.description || '');
  const [date, setDate] = useState(txn.date ? txn.date.slice(0, 10) : new Date().toISOString().slice(0, 10));
  const [saving, setSaving] = useState(false);

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

// ── Transactions Tab ─────────────────────────────────────────────────────────
function TransactionsTab({ month, onRefresh }) {
  const { user } = useAuth();
  const [transactions, setTransactions] = useState([]);
  const [members, setMembers] = useState([]);
  const [ownerFilter, setOwnerFilter] = useState('all');
  const [loading, setLoading] = useState(true);
  const [editTxn, setEditTxn] = useState(null);

  useEffect(() => {
    api.get('/auth/me').then(res => setMembers(res.data.members || [])).catch(() => {});
  }, []);

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

  const partner = members.find(m => m._id !== user?.id);

  const ownerLabel = (ownedBy) => {
    if (ownedBy === 'joint') return { label: 'Joint', color: '#5a7a80' };
    if (ownedBy === user?.id) return { label: 'Me', color: 'var(--primary)' };
    if (partner && ownedBy === partner._id) return { label: partner.name.split(' ')[0], color: '#1a9e6e' };
    return null;
  };

  const filtered = ownerFilter === 'all' ? transactions
    : ownerFilter === 'joint' ? transactions.filter(t => t.ownedBy === 'joint')
    : transactions.filter(t => t.ownedBy === ownerFilter);

  if (loading) return <div style={{ textAlign: 'center', color: 'var(--muted)', padding: '2rem' }}>Loading...</div>;

  return (
    <>
      {/* Owner filter */}
      <div className="tab-switcher" style={{ marginBottom: '1rem' }}>
        <button className={`tab-pill${ownerFilter === 'all' ? ' active' : ''}`} onClick={() => setOwnerFilter('all')}>All</button>
        <button className={`tab-pill${ownerFilter === user?.id ? ' active' : ''}`} onClick={() => setOwnerFilter(user?.id)}>Mine</button>
        {partner && (
          <button className={`tab-pill${ownerFilter === partner._id ? ' active' : ''}`} onClick={() => setOwnerFilter(partner._id)}>
            {partner.name.split(' ')[0]}
          </button>
        )}
        <button className={`tab-pill${ownerFilter === 'joint' ? ' active' : ''}`} onClick={() => setOwnerFilter('joint')}>Joint</button>
      </div>

      {filtered.length === 0 ? (
        <div className="card" style={{ textAlign: 'center', color: 'var(--muted)', padding: '2rem' }}>
          No transactions this month.
        </div>
      ) : (
        <div className="txn-list">
          {filtered.map(txn => {
            const emoji = CATEGORY_EMOJI[txn.category] || '📦';
            const dateStr = txn.date ? new Date(txn.date).toLocaleDateString('en-US', { month: 'numeric', day: 'numeric' }) : '';
            const owner = ownerLabel(txn.ownedBy);
            return (
              <div className="txn-row" key={txn._id || txn.id}>
                <div className="txn-avatar" style={{ background: 'var(--bg)', fontSize: '1.4rem' }}>{emoji}</div>
                <div className="txn-info">
                  <div className="txn-desc" style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                    {txn.description || txn.category}
                    {owner && (
                      <span style={{
                        fontSize: '0.65rem', fontWeight: 700, padding: '0.1rem 0.4rem',
                        borderRadius: '99px', background: owner.color + '22', color: owner.color,
                        whiteSpace: 'nowrap',
                      }}>{owner.label}</span>
                    )}
                  </div>
                  <div className="txn-meta">{txn.category} · {dateStr}</div>
                </div>
                <div className={`txn-amount ${txn.type}`}>
                  {txn.type === 'income' ? '+' : '-'}{fmt(txn.amount)}
                </div>
                <button
                  onClick={() => setEditTxn(txn)}
                  style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: '1rem', color: 'var(--muted)', padding: '0.25rem' }}
                  title="Edit"
                >✏️</button>
                <button onClick={() => handleDelete(txn._id || txn.id)} className="btn-danger" title="Delete">🗑</button>
              </div>
            );
          })}
        </div>
      )}
      {editTxn && (
        <EditModal txn={editTxn} onClose={() => setEditTxn(null)} onSaved={fetchTransactions} />
      )}
      <QuickAdd onSave={fetchTransactions} />
    </>
  );
}

// ── Budget Tab ───────────────────────────────────────────────────────────────
function BudgetTab({ month }) {
  const [budgets, setBudgets] = useState([]);
  const [summary, setSummary] = useState(null);
  const [editingId, setEditingId] = useState(null);
  const [editLimit, setEditLimit] = useState('');
  const [showAdd, setShowAdd] = useState(false);
  const [newCategory, setNewCategory] = useState(CATEGORIES[0]);
  const [newLimit, setNewLimit] = useState('');
  const [newRecurring, setNewRecurring] = useState(false);
  const [editRecurring, setEditRecurring] = useState(false);
  const [loading, setLoading] = useState(true);

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const [budgetsRes, summaryRes] = await Promise.all([
        api.get(`/budgets?month=${month}`),
        api.get(`/summary?month=${month}`),
      ]);
      setBudgets(budgetsRes.data || []);
      setSummary(summaryRes.data);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  }, [month]);

  useEffect(() => { fetchData(); }, [fetchData]);

  const spendingByCategory = summary?.spendingByCategory || [];

  const allCategories = (() => {
    const map = {};
    spendingByCategory.forEach(s => {
      map[s.category] = { category: s.category, spent: s.total || 0, budget: null };
    });
    budgets.forEach(b => {
      const cat = b.category;
      if (map[cat]) {
        map[cat].budget = b;
      } else {
        map[cat] = { category: cat, spent: 0, budget: b };
      }
    });
    return Object.values(map).sort((a, b) => a.category.localeCompare(b.category));
  })();

  const handleSaveLimit = async (budget, categoryName) => {
    const limit = parseFloat(editLimit);
    if (isNaN(limit)) return;
    try {
      if (budget?._id && !budget?._isRecurringFallback) {
        await api.put(`/budgets/${budget._id}`, { monthlyLimit: limit, category: categoryName, month, recurring: editRecurring });
      } else {
        await api.post('/budgets', { category: categoryName, monthlyLimit: limit, month, recurring: editRecurring });
      }
      setEditingId(null);
      setEditLimit('');
      fetchData();
    } catch (err) {
      console.error(err);
    }
  };

  const handleDelete = async (id) => {
    if (!window.confirm('Remove this budget?')) return;
    try {
      await api.delete(`/budgets/${id}`);
      fetchData();
    } catch (err) {
      console.error(err);
    }
  };

  const handleAddBudget = async () => {
    const limit = parseFloat(newLimit);
    if (isNaN(limit) || limit <= 0) return;
    try {
      await api.post('/budgets', { category: newCategory, monthlyLimit: limit, month, recurring: newRecurring });
      setShowAdd(false);
      setNewCategory(CATEGORIES[0]);
      setNewLimit('');
      setNewRecurring(false);
      fetchData();
    } catch (err) {
      console.error(err);
    }
  };

  if (loading) return <div style={{ textAlign: 'center', color: 'var(--muted)', padding: '2rem' }}>Loading...</div>;

  return (
    <>
      <div className="card">
        <div className="budget-bars">
          {allCategories.map(row => {
            const limit = row.budget?.monthlyLimit || 0;
            const spent = row.spent;
            const pct = limit > 0 ? Math.min((spent / limit) * 100, 100) : 0;
            const over = limit > 0 && spent > limit;
            const id = row.budget?._id || row.budget?.id;
            const isEditing = editingId === row.category;
            return (
              <div key={row.category} style={{ paddingBottom: '0.75rem', borderBottom: '1px solid var(--border)' }}>
                <div className="budget-bar-header" style={{ marginBottom: '0.25rem' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                    <span style={{ fontWeight: 500 }}>{row.category}</span>
                    {row.budget?.recurring && (
                      <span style={{ fontSize: '0.65rem', fontWeight: 700, color: 'var(--primary)', border: '1px solid var(--primary)', borderRadius: 4, padding: '0 4px', lineHeight: '1.4' }}>RECURRING</span>
                    )}
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                    <span>{fmt(spent)}{limit > 0 ? ` / ${fmt(limit)}` : ' / no limit'}</span>
                    <button
                      onClick={() => { setEditingId(row.category); setEditLimit(limit > 0 ? String(limit) : ''); setEditRecurring(row.budget?.recurring || false); }}
                      style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--muted)', fontSize: '0.875rem' }}
                      title="Set limit"
                    >✏️</button>
                    {id && !row.budget?._isRecurringFallback && (
                      <button
                        className="btn-danger"
                        onClick={() => handleDelete(id)}
                        style={{ padding: '0.2rem 0.4rem', fontSize: '0.75rem' }}
                        title="Remove budget"
                      >🗑</button>
                    )}
                  </div>
                </div>
                {isEditing && (
                  <div style={{ marginBottom: '0.5rem' }}>
                    <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center', marginBottom: '0.4rem' }}>
                      <input
                        type="number"
                        placeholder="Monthly limit"
                        value={editLimit}
                        onChange={e => setEditLimit(e.target.value)}
                        style={{ maxWidth: 160 }}
                        min="0"
                        step="0.01"
                      />
                      <button className="btn-primary" style={{ padding: '0.5rem 0.75rem', fontSize: '0.875rem' }} onClick={() => handleSaveLimit(row.budget, row.category)}>Save</button>
                      <button className="btn-ghost" style={{ padding: '0.5rem 0.75rem', fontSize: '0.875rem' }} onClick={() => setEditingId(null)}>Cancel</button>
                    </div>
                    <label style={{ fontSize: '0.8rem', color: 'var(--muted)', display: 'flex', alignItems: 'center', gap: '0.4rem', cursor: 'pointer' }}>
                      <input type="checkbox" checked={editRecurring} onChange={e => setEditRecurring(e.target.checked)} style={{ width: 'auto' }} />
                      Repeat every month automatically
                    </label>
                  </div>
                )}
                {limit > 0 && (
                  <div className="budget-bar-track">
                    <div className={`budget-bar-fill${over ? ' over' : ''}`} style={{ width: `${pct}%` }} />
                  </div>
                )}
              </div>
            );
          })}
          {allCategories.length === 0 && (
            <div style={{ textAlign: 'center', color: 'var(--muted)', padding: '1rem' }}>
              No spending data or budgets for this month.
            </div>
          )}
        </div>
      </div>

      <div style={{ marginTop: '1rem' }}>
        {showAdd ? (
          <div className="card">
            <div style={{ fontWeight: 600, marginBottom: '0.75rem' }}>Add Budget</div>
            <div className="form-group">
              <label>Category</label>
              <select value={newCategory} onChange={e => setNewCategory(e.target.value)}>
                {CATEGORIES.map(c => <option key={c}>{c}</option>)}
              </select>
            </div>
            <div className="form-group">
              <label>Monthly Limit ($)</label>
              <input type="number" placeholder="0.00" value={newLimit} onChange={e => setNewLimit(e.target.value)} min="0" step="0.01" />
            </div>
            <label style={{ fontSize: '0.875rem', color: 'var(--muted)', display: 'flex', alignItems: 'center', gap: '0.5rem', cursor: 'pointer', marginBottom: '1rem' }}>
              <input type="checkbox" checked={newRecurring} onChange={e => setNewRecurring(e.target.checked)} style={{ width: 'auto' }} />
              Repeat every month automatically
            </label>
            <div style={{ display: 'flex', gap: '0.5rem' }}>
              <button className="btn-primary" onClick={handleAddBudget}>Add</button>
              <button className="btn-ghost" onClick={() => setShowAdd(false)}>Cancel</button>
            </div>
          </div>
        ) : (
          <button className="btn-ghost" onClick={() => setShowAdd(true)} style={{ width: '100%' }}>
            + Add Budget
          </button>
        )}
      </div>
    </>
  );
}

// ── Recurring Tab ────────────────────────────────────────────────────────────
function RecurringTab() {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ description: '', amount: '', category: CATEGORIES[0], recurringInterval: 'monthly', date: '', type: 'expense' });
  const [saving, setSaving] = useState(false);

  const fetchItems = async () => {
    setLoading(true);
    try {
      const res = await api.get('/transactions');
      const data = res.data.transactions || res.data || [];
      setItems(data.filter(t => t.isRecurring));
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchItems(); }, []);

  const setField = (key, val) => setForm(f => ({ ...f, [key]: val }));

  const handleAdd = async () => {
    if (!form.description || !form.amount) return;
    setSaving(true);
    try {
      await api.post('/transactions', {
        description: form.description,
        amount: Number(form.amount),
        category: form.category,
        recurringInterval: form.recurringInterval,
        date: form.date || new Date().toISOString().slice(0, 10),
        type: form.type,
        isRecurring: true,
      });
      setShowForm(false);
      setForm({ description: '', amount: '', category: CATEGORIES[0], recurringInterval: 'monthly', date: '', type: 'expense' });
      fetchItems();
    } catch (err) {
      console.error(err);
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id) => {
    if (!window.confirm('Delete this recurring item?')) return;
    try {
      await api.delete(`/transactions/${id}`);
      fetchItems();
    } catch (err) {
      console.error(err);
    }
  };

  const income = items.filter(i => i.type === 'income');
  const expenses = items.filter(i => i.type === 'expense');

  return (
    <>
      {showForm ? (
        <div className="add-recurring-form">
          <div style={{ fontWeight: 600, marginBottom: '0.75rem' }}>New Recurring Item</div>
          <div className="type-toggle" style={{ marginBottom: '1rem' }}>
            <button className={form.type === 'expense' ? 'active' : ''} onClick={() => setField('type', 'expense')} type="button">Bill / Expense</button>
            <button className={form.type === 'income' ? 'active' : ''} onClick={() => setField('type', 'income')} type="button">Income (Paycheck)</button>
          </div>
          <div className="form-row">
            <div className="form-group">
              <label>{form.type === 'income' ? 'Description (e.g. Paycheck)' : 'Description (e.g. Netflix)'}</label>
              <input type="text" placeholder={form.type === 'income' ? 'Paycheck' : 'Netflix'} value={form.description} onChange={e => setField('description', e.target.value)} />
            </div>
            <div className="form-group">
              <label>Amount ($)</label>
              <input type="number" placeholder="0.00" step="0.01" min="0" value={form.amount} onChange={e => setField('amount', e.target.value)} />
            </div>
          </div>
          <div className="form-row">
            <div className="form-group">
              <label>Category</label>
              <select value={form.category} onChange={e => setField('category', e.target.value)}>
                {CATEGORIES.map(c => <option key={c}>{c}</option>)}
              </select>
            </div>
            <div className="form-group">
              <label>Frequency</label>
              <select value={form.recurringInterval} onChange={e => setField('recurringInterval', e.target.value)}>
                {INTERVALS.map(i => <option key={i.value} value={i.value}>{i.label}</option>)}
              </select>
            </div>
          </div>
          <div className="form-group">
            <label>Next date</label>
            <input type="date" value={form.date} onChange={e => setField('date', e.target.value)} />
          </div>
          <div style={{ display: 'flex', gap: '0.5rem' }}>
            <button className="btn-primary" onClick={handleAdd} disabled={saving}>{saving ? 'Saving...' : 'Save'}</button>
            <button className="btn-ghost" onClick={() => setShowForm(false)}>Cancel</button>
          </div>
        </div>
      ) : (
        <button className="btn-ghost" onClick={() => setShowForm(true)} style={{ width: '100%', marginBottom: '1rem' }}>
          + Add Recurring Item
        </button>
      )}

      {loading ? (
        <div style={{ textAlign: 'center', color: 'var(--muted)', padding: '2rem' }}>Loading...</div>
      ) : items.length === 0 ? (
        <div className="card" style={{ textAlign: 'center', color: 'var(--muted)', padding: '2rem' }}>
          No recurring items yet.
        </div>
      ) : (
        <>
          {income.length > 0 && (
            <>
              <div className="section-title" style={{ color: 'var(--success)' }}>💵 Recurring Income</div>
              {income.map(b => (
                <div className="recurring-card" key={b._id || b.id}>
                  <div className="recurring-info">
                    <div className="recurring-name">{b.description}</div>
                    <div className="recurring-meta">
                      {b.category} · {b.date ? new Date(b.date).toLocaleDateString() : '—'}
                      <span className="interval-badge" style={{ marginLeft: '0.5rem' }}>{INTERVALS.find(i => i.value === b.recurringInterval)?.label || b.recurringInterval}</span>
                    </div>
                  </div>
                  <div className="recurring-amount" style={{ color: 'var(--success)' }}>+{fmt(b.amount)}</div>
                  <button onClick={() => handleDelete(b._id || b.id)} className="btn-danger" style={{ padding: '0.4rem 0.6rem' }}>🗑</button>
                </div>
              ))}
            </>
          )}
          {expenses.length > 0 && (
            <>
              <div className="section-title">🔁 Recurring Bills</div>
              {expenses.map(b => (
                <div className="recurring-card" key={b._id || b.id}>
                  <div className="recurring-info">
                    <div className="recurring-name">{b.description}</div>
                    <div className="recurring-meta">
                      {b.category} · {b.date ? new Date(b.date).toLocaleDateString() : '—'}
                      <span className="interval-badge" style={{ marginLeft: '0.5rem' }}>{INTERVALS.find(i => i.value === b.recurringInterval)?.label || b.recurringInterval}</span>
                    </div>
                  </div>
                  <div className="recurring-amount">-{fmt(b.amount)}</div>
                  <button onClick={() => handleDelete(b._id || b.id)} className="btn-danger" style={{ padding: '0.4rem 0.6rem' }}>🗑</button>
                </div>
              ))}
            </>
          )}
        </>
      )}
    </>
  );
}

// ── Activity Page ────────────────────────────────────────────────────────────
export default function Activity() {
  const [activeTab, setActiveTab] = useState('transactions');
  const [month, setMonth] = useState(currentMonthStr);

  return (
    <div className="page-content">
      {/* Tab switcher */}
      <div className="tab-switcher">
        {[
          { key: 'transactions', label: 'Transactions' },
          { key: 'budget', label: 'Budget' },
          { key: 'recurring', label: 'Recurring' },
        ].map(t => (
          <button
            key={t.key}
            className={`tab-pill${activeTab === t.key ? ' active' : ''}`}
            onClick={() => setActiveTab(t.key)}
          >
            {t.label}
          </button>
        ))}
      </div>

      {/* Month nav (not for Recurring) */}
      {activeTab !== 'recurring' && (
        <div className="month-nav">
          <button onClick={() => setMonth(prevMonth(month))}>‹</button>
          <h2>{formatMonth(month)}</h2>
          <button onClick={() => setMonth(nextMonth(month))}>›</button>
        </div>
      )}

      {activeTab === 'transactions' && <TransactionsTab month={month} />}
      {activeTab === 'budget' && <BudgetTab month={month} />}
      {activeTab === 'recurring' && <RecurringTab />}
    </div>
  );
}
