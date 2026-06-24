import { useState, useEffect, useCallback } from 'react';
import api from '../api/axios';

const CATEGORIES = [
  'Housing', 'Food', 'Transport', 'Utilities', 'Entertainment',
  'Healthcare', 'Shopping', 'Savings', 'Income', 'Other',
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

export default function Budget() {
  const [month, setMonth] = useState(currentMonthStr);
  const [budgets, setBudgets] = useState([]);
  const [summary, setSummary] = useState(null);
  const [editingId, setEditingId] = useState(null);
  const [editLimit, setEditLimit] = useState('');
  const [showAdd, setShowAdd] = useState(false);
  const [newCategory, setNewCategory] = useState(CATEGORIES[0]);
  const [newLimit, setNewLimit] = useState('');
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
    return Object.values(map);
  })();

  const handleSaveLimit = async (budget) => {
    const limit = parseFloat(editLimit);
    if (isNaN(limit)) return;
    try {
      if (budget?._id || budget?.id) {
        await api.put(`/budgets/${budget._id || budget.id}`, { monthlyLimit: limit, category: budget.category, month });
      } else {
        await api.post('/budgets', { category: budget.category, monthlyLimit: limit, month });
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
      await api.post('/budgets', { category: newCategory, monthlyLimit: limit, month });
      setShowAdd(false);
      setNewCategory(CATEGORIES[0]);
      setNewLimit('');
      fetchData();
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
      ) : (
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
                    <span style={{ fontWeight: 500 }}>{row.category}</span>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                      <span>{fmt(spent)}{limit > 0 ? ` / ${fmt(limit)}` : ' / no limit'}</span>
                      <button
                        onClick={() => { setEditingId(row.category); setEditLimit(limit > 0 ? String(limit) : ''); }}
                        style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--muted)', fontSize: '0.875rem' }}
                        title="Set limit"
                      >✏️</button>
                      {id && (
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
                    <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '0.5rem', alignItems: 'center' }}>
                      <input
                        type="number"
                        placeholder="Monthly limit"
                        value={editLimit}
                        onChange={e => setEditLimit(e.target.value)}
                        style={{ maxWidth: 160 }}
                        min="0"
                        step="0.01"
                      />
                      <button className="btn-primary" style={{ padding: '0.5rem 0.75rem', fontSize: '0.875rem' }} onClick={() => handleSaveLimit(row.budget)}>Save</button>
                      <button className="btn-ghost" style={{ padding: '0.5rem 0.75rem', fontSize: '0.875rem' }} onClick={() => setEditingId(null)}>Cancel</button>
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
          </div>

          {allCategories.length === 0 && (
            <div style={{ textAlign: 'center', color: 'var(--muted)', padding: '1rem' }}>
              No spending data or budgets for this month.
            </div>
          )}
        </div>
      )}

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
    </div>
  );
}
