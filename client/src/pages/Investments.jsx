import { useState, useEffect } from 'react';
import api from '../api/axios';
import './Investments.css';

const emptyStockForm = { ticker: '', name: '', shares: '', costBasis: '', notes: '' };
const emptyRetirementForm = { name: '', manualValue: '', notes: '' };
const emptySavingsForm = { name: '', manualValue: '', interestRate: '', notes: '' };

function getEmptyForm(type) {
  if (type === 'stock') return { ...emptyStockForm };
  if (type === 'retirement') return { ...emptyRetirementForm };
  return { ...emptySavingsForm };
}

function fmt(n) {
  return Number(n || 0).toLocaleString('en-US', { style: 'currency', currency: 'USD' });
}

function fmtPct(n) {
  return (Number(n || 0)).toFixed(2) + '%';
}

function mostRecentUpdate(investments) {
  const dates = investments
    .map(i => i.lastPriceUpdate)
    .filter(Boolean)
    .map(d => new Date(d));
  if (!dates.length) return null;
  return new Date(Math.max(...dates));
}

export default function Investments() {
  const [investments, setInvestments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [formType, setFormType] = useState('stock');
  const [editTarget, setEditTarget] = useState(null);
  const [form, setForm] = useState(getEmptyForm('stock'));
  const [saving, setSaving] = useState(false);

  const fetchInvestments = async () => {
    try {
      const res = await api.get('/investments');
      setInvestments(res.data);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchInvestments(); }, []);

  const handleRefreshPrices = async () => {
    setRefreshing(true);
    try {
      const res = await api.get('/investments/prices');
      setInvestments(res.data);
    } catch (err) {
      console.error(err);
    } finally {
      setRefreshing(false);
    }
  };

  const openAdd = (type) => {
    setFormType(type);
    setEditTarget(null);
    setForm(getEmptyForm(type));
    setShowForm(true);
  };

  const openEdit = (inv) => {
    const type = inv.accountType;
    setFormType(type);
    setEditTarget(inv);
    if (type === 'stock') {
      setForm({ ticker: inv.ticker || '', name: inv.name || '', shares: inv.shares ? String(inv.shares) : '', costBasis: inv.costBasis ? String(inv.costBasis) : '', notes: inv.notes || '' });
    } else if (type === 'retirement') {
      setForm({ name: inv.name || '', manualValue: inv.manualValue ? String(inv.manualValue) : '', notes: inv.notes || '' });
    } else {
      setForm({ name: inv.name || '', manualValue: inv.manualValue ? String(inv.manualValue) : '', interestRate: inv.interestRate ? String(inv.interestRate) : '', notes: inv.notes || '' });
    }
    setShowForm(true);
  };

  const handleDelete = async (id) => {
    if (!window.confirm('Delete this investment?')) return;
    try {
      await api.delete(`/investments/${id}`);
      fetchInvestments();
    } catch (err) {
      console.error(err);
    }
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      const payload = { accountType: formType, ...form };
      if (formType === 'stock') {
        payload.shares = parseFloat(form.shares) || 0;
        payload.costBasis = parseFloat(form.costBasis) || 0;
        payload.ticker = form.ticker.toUpperCase();
      } else {
        payload.manualValue = parseFloat(form.manualValue) || 0;
        if (formType === 'savings') payload.interestRate = parseFloat(form.interestRate) || 0;
      }
      if (editTarget) {
        await api.put(`/investments/${editTarget._id || editTarget.id}`, payload);
      } else {
        await api.post('/investments', payload);
      }
      setShowForm(false);
      fetchInvestments();
    } catch (err) {
      console.error(err);
    } finally {
      setSaving(false);
    }
  };

  const setField = (key, val) => setForm(f => ({ ...f, [key]: val }));

  // Derived values
  const stocks = investments.filter(i => i.accountType === 'stock');
  const retirements = investments.filter(i => i.accountType === 'retirement');
  const savings = investments.filter(i => i.accountType === 'savings');

  let totalValue = 0;
  let totalCost = 0;
  stocks.forEach(s => {
    const val = s.shares * (s.currentPrice || s.costBasis || 0);
    const cost = s.shares * (s.costBasis || 0);
    totalValue += val;
    totalCost += cost;
  });
  retirements.forEach(r => { totalValue += r.manualValue || 0; totalCost += r.manualValue || 0; });
  savings.forEach(s => { totalValue += s.manualValue || 0; totalCost += s.manualValue || 0; });

  const totalGain = totalValue - totalCost;
  const totalGainPct = totalCost > 0 ? (totalGain / totalCost * 100) : 0;
  const lastUpdated = mostRecentUpdate(investments);
  const gainPositive = totalGain >= 0;

  if (loading) return <div className="page-content"><p style={{ color: 'var(--muted)' }}>Loading…</p></div>;

  return (
    <div className="page-content">
      <h2 className="section-title" style={{ fontSize: '1.5rem', marginTop: 0 }}>Investments</h2>

      {/* Portfolio Summary */}
      <div className="card portfolio-summary">
        <div>
          <div className="portfolio-value">{fmt(totalValue)}</div>
          <div className={`portfolio-gain ${gainPositive ? 'positive' : 'negative'}`}>
            {gainPositive ? '+' : ''}{fmt(totalGain)} ({gainPositive ? '+' : ''}{fmtPct(totalGainPct)})
          </div>
          <div className="portfolio-updated">
            Last updated: {lastUpdated ? lastUpdated.toLocaleString() : 'never'}
          </div>
        </div>
        <button className="btn-ghost refresh-btn" onClick={handleRefreshPrices} disabled={refreshing}>
          <span className={refreshing ? 'spinning' : ''}>↻</span>
          {refreshing ? 'Refreshing…' : 'Refresh Prices'}
        </button>
      </div>

      {/* Stocks & ETFs */}
      <div className="section-header">
        <h2>Stocks &amp; ETFs</h2>
        <button className="btn-primary btn-sm" onClick={() => openAdd('stock')}>+ Add Stock</button>
      </div>

      {stocks.length === 0 ? (
        <div className="card empty-state">No stocks added yet.</div>
      ) : (
        <>
          {/* Desktop table */}
          <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
            <table className="inv-table">
              <thead>
                <tr>
                  <th>Ticker</th>
                  <th>Name</th>
                  <th>Shares</th>
                  <th>Cost/Share</th>
                  <th>Price</th>
                  <th>Value</th>
                  <th>Gain $</th>
                  <th>Gain %</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {stocks.map(s => {
                  const hasPrice = !!s.currentPrice;
                  const val = hasPrice ? s.shares * s.currentPrice : null;
                  const cost = s.shares * (s.costBasis || 0);
                  const gain = val != null ? val - cost : null;
                  const gainPct = cost > 0 && gain != null ? (gain / cost * 100) : null;
                  return (
                    <tr key={s._id || s.id}>
                      <td><span className="ticker-badge">{s.ticker}</span></td>
                      <td>{s.name}</td>
                      <td>{Number(s.shares).toLocaleString()}</td>
                      <td>{fmt(s.costBasis)}</td>
                      <td>{hasPrice ? fmt(s.currentPrice) : '—'}</td>
                      <td>{val != null ? fmt(val) : fmt(cost)}</td>
                      <td className={gain != null ? (gain >= 0 ? 'gain-positive' : 'gain-negative') : ''}>
                        {gain != null ? (gain >= 0 ? '+' : '') + fmt(gain) : '—'}
                      </td>
                      <td className={gainPct != null ? (gainPct >= 0 ? 'gain-positive' : 'gain-negative') : ''}>
                        {gainPct != null ? (gainPct >= 0 ? '+' : '') + fmtPct(gainPct) : '—'}
                      </td>
                      <td>
                        <button className="icon-btn" onClick={() => openEdit(s)} title="Edit">✏️</button>
                        <button className="icon-btn" onClick={() => handleDelete(s._id || s.id)} title="Delete">🗑️</button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {/* Mobile cards */}
          <div className="inv-card-list">
            {stocks.map(s => {
              const hasPrice = !!s.currentPrice;
              const val = hasPrice ? s.shares * s.currentPrice : null;
              const cost = s.shares * (s.costBasis || 0);
              const gain = val != null ? val - cost : null;
              const gainPct = cost > 0 && gain != null ? (gain / cost * 100) : null;
              return (
                <div key={s._id || s.id} className="card inv-card">
                  <div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.25rem' }}>
                      <span className="ticker-badge">{s.ticker}</span>
                      <span style={{ fontWeight: 600 }}>{s.name}</span>
                    </div>
                    <div style={{ fontSize: '0.85rem', color: 'var(--muted)' }}>
                      {Number(s.shares).toLocaleString()} shares @ {fmt(s.costBasis)} cost
                    </div>
                    <div style={{ marginTop: '0.25rem' }}>
                      <strong>{val != null ? fmt(val) : fmt(cost)}</strong>
                      {gain != null && (
                        <span className={gain >= 0 ? 'gain-positive' : 'gain-negative'} style={{ marginLeft: '0.5rem', fontSize: '0.85rem' }}>
                          {gain >= 0 ? '+' : ''}{fmt(gain)} ({gainPct >= 0 ? '+' : ''}{fmtPct(gainPct)})
                        </span>
                      )}
                    </div>
                  </div>
                  <div style={{ display: 'flex', gap: '0.5rem' }}>
                    <button className="icon-btn" onClick={() => openEdit(s)}>✏️</button>
                    <button className="icon-btn" onClick={() => handleDelete(s._id || s.id)}>🗑️</button>
                  </div>
                </div>
              );
            })}
          </div>
        </>
      )}

      {/* Retirement Accounts */}
      <div className="section-header">
        <h2>Retirement Accounts</h2>
        <button className="btn-primary btn-sm" onClick={() => openAdd('retirement')}>+ Add Account</button>
      </div>

      {retirements.length === 0 ? (
        <div className="card empty-state">No retirement accounts added.</div>
      ) : (
        <div className="inv-card-list">
          {retirements.map(r => (
            <div key={r._id || r.id} className="card inv-card">
              <div>
                <div style={{ fontWeight: 600, marginBottom: '0.25rem' }}>{r.name}</div>
                <div style={{ fontSize: '1.125rem', fontWeight: 700 }}>{fmt(r.manualValue)}</div>
                {r.notes && <div style={{ fontSize: '0.8rem', color: 'var(--muted)', marginTop: '0.25rem' }}>{r.notes}</div>}
              </div>
              <div style={{ display: 'flex', gap: '0.5rem' }}>
                <button className="icon-btn" onClick={() => openEdit(r)}>✏️</button>
                <button className="icon-btn" onClick={() => handleDelete(r._id || r.id)}>🗑️</button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Savings Accounts */}
      <div className="section-header">
        <h2>Savings Accounts</h2>
        <button className="btn-primary btn-sm" onClick={() => openAdd('savings')}>+ Add Savings</button>
      </div>

      {savings.length === 0 ? (
        <div className="card empty-state">No savings accounts added.</div>
      ) : (
        <div className="inv-card-list">
          {savings.map(s => {
            const monthly = (s.manualValue || 0) * (s.interestRate || 0) / 100 / 12;
            return (
              <div key={s._id || s.id} className="card inv-card">
                <div>
                  <div style={{ fontWeight: 600, marginBottom: '0.25rem' }}>{s.name}</div>
                  <div style={{ fontSize: '1.125rem', fontWeight: 700 }}>{fmt(s.manualValue)}</div>
                  <div style={{ fontSize: '0.8rem', color: 'var(--muted)', marginTop: '0.25rem' }}>
                    APY: {s.interestRate || 0}% &bull; Est. monthly interest: {fmt(monthly)}
                  </div>
                  {s.notes && <div style={{ fontSize: '0.8rem', color: 'var(--muted)' }}>{s.notes}</div>}
                </div>
                <div style={{ display: 'flex', gap: '0.5rem' }}>
                  <button className="icon-btn" onClick={() => openEdit(s)}>✏️</button>
                  <button className="icon-btn" onClick={() => handleDelete(s._id || s.id)}>🗑️</button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Add/Edit Modal */}
      {showForm && (
        <div className="inv-modal-overlay" onClick={e => e.target === e.currentTarget && setShowForm(false)}>
          <div className="inv-modal">
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.25rem' }}>
              <h3 style={{ margin: 0 }}>
                {editTarget ? 'Edit' : 'Add'} {formType === 'stock' ? 'Stock / ETF' : formType === 'retirement' ? 'Retirement Account' : 'Savings Account'}
              </h3>
              <button onClick={() => setShowForm(false)} style={{ background: 'none', border: 'none', fontSize: '1.25rem', cursor: 'pointer', color: 'var(--muted)' }}>✕</button>
            </div>

            {formType === 'stock' && (
              <>
                <div className="form-group">
                  <label>Ticker Symbol (e.g. AAPL)</label>
                  <input type="text" value={form.ticker} onChange={e => setField('ticker', e.target.value.toUpperCase())} placeholder="AAPL" required />
                </div>
                <div className="form-group">
                  <label>Company / Fund Name</label>
                  <input type="text" value={form.name} onChange={e => setField('name', e.target.value)} placeholder="Apple Inc." required />
                </div>
                <div className="form-group">
                  <label>Shares</label>
                  <input type="number" value={form.shares} onChange={e => setField('shares', e.target.value)} placeholder="10" step="0.001" min="0" required />
                </div>
                <div className="form-group">
                  <label>Cost Basis per Share</label>
                  <input type="number" value={form.costBasis} onChange={e => setField('costBasis', e.target.value)} placeholder="150.00" step="0.01" min="0" required />
                </div>
                <div className="form-group">
                  <label>Notes (optional)</label>
                  <input type="text" value={form.notes} onChange={e => setField('notes', e.target.value)} placeholder="e.g. Taxable brokerage" />
                </div>
              </>
            )}

            {formType === 'retirement' && (
              <>
                <div className="form-group">
                  <label>Account Name (e.g. 401k - Fidelity)</label>
                  <input type="text" value={form.name} onChange={e => setField('name', e.target.value)} placeholder="401k - Fidelity" required />
                </div>
                <div className="form-group">
                  <label>Current Balance</label>
                  <input type="number" value={form.manualValue} onChange={e => setField('manualValue', e.target.value)} placeholder="50000" step="0.01" min="0" />
                </div>
                <div className="form-group">
                  <label>Notes (optional)</label>
                  <input type="text" value={form.notes} onChange={e => setField('notes', e.target.value)} placeholder="e.g. Traditional pre-tax" />
                </div>
              </>
            )}

            {formType === 'savings' && (
              <>
                <div className="form-group">
                  <label>Account Name (e.g. HYSA - Marcus)</label>
                  <input type="text" value={form.name} onChange={e => setField('name', e.target.value)} placeholder="HYSA - Marcus" required />
                </div>
                <div className="form-group">
                  <label>Current Balance</label>
                  <input type="number" value={form.manualValue} onChange={e => setField('manualValue', e.target.value)} placeholder="10000" step="0.01" min="0" />
                </div>
                <div className="form-group">
                  <label>APY %</label>
                  <input type="number" value={form.interestRate} onChange={e => setField('interestRate', e.target.value)} placeholder="4.50" step="0.01" min="0" />
                </div>
                <div className="form-group">
                  <label>Notes (optional)</label>
                  <input type="text" value={form.notes} onChange={e => setField('notes', e.target.value)} placeholder="e.g. Emergency fund" />
                </div>
              </>
            )}

            <div style={{ display: 'flex', gap: '0.75rem', marginTop: '1rem' }}>
              <button className="btn-ghost" style={{ flex: 1 }} onClick={() => setShowForm(false)}>Cancel</button>
              <button className="btn-primary" style={{ flex: 1 }} onClick={handleSave} disabled={saving}>
                {saving ? 'Saving…' : editTarget ? 'Save Changes' : 'Add'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
