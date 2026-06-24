import { useState, useEffect } from 'react';
import api from '../api/axios';
import { useAuth } from '../context/AuthContext';
import { useForm } from 'react-hook-form';
import './Investments.css';
import { LineChart, Line, XAxis, YAxis, Tooltip, Legend, ResponsiveContainer } from 'recharts';

// ── Shared helpers ────────────────────────────────────────────────────────────
function fmt(n) {
  return Number(n || 0).toLocaleString('en-US', { style: 'currency', currency: 'USD' });
}

function fmtPct(n) {
  return (Number(n || 0)).toFixed(2) + '%';
}

// ── Growth Projection helper ──────────────────────────────────────────────────
function buildProjection(accounts) {
  const months = [];
  const now = new Date();
  for (let i = 0; i < 12; i++) {
    const d = new Date(now.getFullYear(), now.getMonth() + i, 1);
    months.push(d.toLocaleString('default', { month: 'short' }));
  }
  return months.map((label, i) => {
    const point = { month: label };
    accounts.forEach(acc => {
      const rate = acc.interestRate || (acc.accountType === 'retirement' ? 7 : 0);
      const balance = acc.manualValue || 0;
      point[acc.name] = Math.round(balance * Math.pow(1 + rate / 100 / 12, i));
    });
    return point;
  });
}

const CHART_COLORS = ['#1a9e6e', '#FFC933', '#042F34', '#B5F2DB', '#5a7a80', '#2ec4b6'];

// ── Progress Ring (Goals) ─────────────────────────────────────────────────────
function ProgressRing({ pct, size = 100, stroke = 8, color }) {
  const r = (size - stroke) / 2;
  const circ = 2 * Math.PI * r;
  const offset = circ * (1 - Math.min(pct, 100) / 100);
  const ringColor = color || (pct >= 100 ? 'var(--success)' : 'var(--primary)');
  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} className="progress-ring">
      <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="var(--border)" strokeWidth={stroke} />
      <circle
        cx={size / 2} cy={size / 2} r={r} fill="none"
        stroke={ringColor} strokeWidth={stroke}
        strokeDasharray={circ} strokeDashoffset={offset}
        strokeLinecap="round"
        transform={`rotate(-90 ${size / 2} ${size / 2})`}
      />
      <text x={size / 2} y={size / 2 + 5} textAnchor="middle" fontSize="14" fontWeight="700" fill="var(--text)">
        {Math.round(pct)}%
      </text>
    </svg>
  );
}

// ── Investments Tab ───────────────────────────────────────────────────────────
const emptyStockForm = { ticker: '', name: '', shares: '', costBasis: '', notes: '' };
const emptyRetirementForm = { name: '', manualValue: '', notes: '' };
const emptySavingsForm = { name: '', manualValue: '', interestRate: '', notes: '' };
const emptyLiabilityForm = { name: '', manualValue: '', interestRate: '', notes: '' };

function getEmptyForm(type) {
  if (type === 'stock') return { ...emptyStockForm };
  if (type === 'retirement') return { ...emptyRetirementForm };
  if (type === 'liability') return { ...emptyLiabilityForm };
  return { ...emptySavingsForm };
}

function mostRecentUpdate(investments) {
  const dates = investments.map(i => i.lastPriceUpdate).filter(Boolean).map(d => new Date(d));
  if (!dates.length) return null;
  return new Date(Math.max(...dates));
}

function InvestmentsTab() {
  const { user } = useAuth();
  const [investments, setInvestments] = useState([]);
  const [members, setMembers] = useState([]);
  const [ownerFilter, setOwnerFilter] = useState('all');
  const [formOwner, setFormOwner] = useState(user?.id || 'joint');
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [formType, setFormType] = useState('stock');
  const [editTarget, setEditTarget] = useState(null);
  const [form, setForm] = useState(getEmptyForm('stock'));
  const [saving, setSaving] = useState(false);
  const [showProjectionChart, setShowProjectionChart] = useState(true);

  useEffect(() => {
    api.get('/auth/me').then(res => setMembers(res.data.members || [])).catch(() => {});
  }, []);

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
      const updatedStocks = res.data;
      setInvestments(prev =>
        prev.map(inv => {
          const updated = updatedStocks.find(s => s._id === inv._id);
          return updated ? updated : inv;
        })
      );
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
    setFormOwner(user?.id || 'joint');
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
      // savings and liability both use manualValue + interestRate + name + notes
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
      const payload = { accountType: formType, ...form, ownedBy: formOwner };
      if (formType === 'stock') {
        payload.shares = parseFloat(form.shares) || 0;
        payload.costBasis = parseFloat(form.costBasis) || 0;
        payload.ticker = form.ticker.toUpperCase();
      } else {
        payload.manualValue = parseFloat(form.manualValue) || 0;
        if (formType === 'savings' || formType === 'liability') {
          payload.interestRate = parseFloat(form.interestRate) || 0;
        }
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

  const partner = members.find(m => m._id !== user?.id);

  const ownerLabel = (ownedBy) => {
    if (ownedBy === 'joint') return { label: 'Joint', color: '#5a7a80' };
    if (ownedBy === user?.id) return { label: 'Me', color: 'var(--primary)' };
    if (partner && ownedBy === partner._id) return { label: partner.name.split(' ')[0], color: '#1a9e6e' };
    return null;
  };

  const visibleInvestments = ownerFilter === 'all' ? investments
    : ownerFilter === 'joint' ? investments.filter(i => i.ownedBy === 'joint')
    : investments.filter(i => i.ownedBy === ownerFilter);

  const stocks = visibleInvestments.filter(i => i.accountType === 'stock');
  const retirements = visibleInvestments.filter(i => i.accountType === 'retirement');
  const savings = visibleInvestments.filter(i => i.accountType === 'savings');
  const liabilities = visibleInvestments.filter(i => i.accountType === 'liability');

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
  liabilities.forEach(l => { totalValue -= (l.manualValue || 0); });

  const totalGain = totalValue - totalCost;
  const totalGainPct = totalCost > 0 ? (totalGain / totalCost * 100) : 0;
  const lastUpdated = mostRecentUpdate(investments);
  const gainPositive = totalGain >= 0;
  const hasLiabilities = liabilities.length > 0;

  if (loading) return <div style={{ color: 'var(--muted)', padding: '2rem 0' }}>Loading…</div>;

  return (
    <>
      {/* Portfolio Summary */}
      <div className="card portfolio-summary">
        <div>
          <div className="portfolio-value">{fmt(totalValue)}</div>
          {hasLiabilities ? (
            <div className="portfolio-gain" style={{ color: 'var(--muted)' }}>Net Worth (Est.)</div>
          ) : (
            <div className={`portfolio-gain ${gainPositive ? 'positive' : 'negative'}`}>
              {gainPositive ? '+' : ''}{fmt(totalGain)} ({gainPositive ? '+' : ''}{fmtPct(totalGainPct)})
            </div>
          )}
          <div className="portfolio-updated">
            Last updated: {lastUpdated ? lastUpdated.toLocaleString() : 'never'}
          </div>
        </div>
        <button className="btn-ghost refresh-btn" onClick={handleRefreshPrices} disabled={refreshing}>
          <span className={refreshing ? 'spinning' : ''}>↻</span>
          {refreshing ? 'Refreshing…' : 'Refresh Prices'}
        </button>
      </div>

      {/* Owner filter */}
      <div className="tab-switcher" style={{ margin: '1rem 0' }}>
        <button className={`tab-pill${ownerFilter === 'all' ? ' active' : ''}`} onClick={() => setOwnerFilter('all')}>All</button>
        <button className={`tab-pill${ownerFilter === user?.id ? ' active' : ''}`} onClick={() => setOwnerFilter(user?.id)}>Mine</button>
        {partner && (
          <button className={`tab-pill${ownerFilter === partner._id ? ' active' : ''}`} onClick={() => setOwnerFilter(partner._id)}>
            {partner.name.split(' ')[0]}
          </button>
        )}
        <button className={`tab-pill${ownerFilter === 'joint' ? ' active' : ''}`} onClick={() => setOwnerFilter('joint')}>Joint</button>
      </div>

      {/* Stocks & ETFs */}
      <div className="section-header">
        <h2>Stocks &amp; ETFs</h2>
        <button className="btn-primary btn-sm" onClick={() => openAdd('stock')}>+ Stock</button>
      </div>

      {stocks.length === 0 ? (
        <div className="card empty-state">No stocks added yet.</div>
      ) : (
        <>
          <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
            <table className="inv-table">
              <thead>
                <tr>
                  <th>Ticker</th><th>Name</th><th>Shares</th><th>Cost/Share</th>
                  <th>Price</th><th>Value</th><th>Gain $</th><th>Gain %</th><th></th>
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
                      <td>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                          {s.name}
                          {ownerLabel(s.ownedBy) && (
                            <span style={{ fontSize: '0.65rem', fontWeight: 700, padding: '0.1rem 0.4rem', borderRadius: '99px', background: ownerLabel(s.ownedBy).color + '22', color: ownerLabel(s.ownedBy).color, whiteSpace: 'nowrap' }}>
                              {ownerLabel(s.ownedBy).label}
                            </span>
                          )}
                        </div>
                      </td>
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
        <button className="btn-primary btn-sm" onClick={() => openAdd('retirement')}>+ Retirement</button>
      </div>
      {retirements.length === 0 ? (
        <div className="card empty-state">No retirement accounts added.</div>
      ) : (
        <div className="inv-card-list">
          {retirements.map(r => (
            <div key={r._id || r.id} className="card inv-card">
              <div>
                <div style={{ fontWeight: 600, marginBottom: '0.25rem', display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                  {r.name}
                  {ownerLabel(r.ownedBy) && <span style={{ fontSize: '0.65rem', fontWeight: 700, padding: '0.1rem 0.4rem', borderRadius: '99px', background: ownerLabel(r.ownedBy).color + '22', color: ownerLabel(r.ownedBy).color }}>{ownerLabel(r.ownedBy).label}</span>}
                </div>
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
        <button className="btn-primary btn-sm" onClick={() => openAdd('savings')}>+ Savings</button>
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
                  <div style={{ fontWeight: 600, marginBottom: '0.25rem', display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                    {s.name}
                    {ownerLabel(s.ownedBy) && <span style={{ fontSize: '0.65rem', fontWeight: 700, padding: '0.1rem 0.4rem', borderRadius: '99px', background: ownerLabel(s.ownedBy).color + '22', color: ownerLabel(s.ownedBy).color }}>{ownerLabel(s.ownedBy).label}</span>}
                  </div>
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

      {/* Growth Projection Chart */}
      {(() => {
        const projectionAccounts = [...retirements, ...savings].filter(a => (a.manualValue || 0) > 0);
        if (projectionAccounts.length === 0) return null;
        const data = buildProjection(projectionAccounts);
        return (
          <div className="chart-card">
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: showProjectionChart ? '0.75rem' : 0 }}>
              <div className="chart-title" style={{ marginBottom: 0 }}>Growth Projection (12 Months)</div>
              <button
                onClick={() => setShowProjectionChart(v => !v)}
                style={{ background: 'none', border: '1px solid var(--border)', borderRadius: 8, padding: '0.2rem 0.6rem', fontSize: '0.8rem', cursor: 'pointer', color: 'var(--muted)' }}
              >
                {showProjectionChart ? '▲ Hide' : '▼ Show'}
              </button>
            </div>
            {showProjectionChart && (
              <ResponsiveContainer width="100%" height={220}>
                <LineChart data={data}>
                  <XAxis dataKey="month" />
                  <YAxis hide />
                  <Tooltip formatter={n => '$' + Number(n).toLocaleString('en-US', { maximumFractionDigits: 0 })} />
                  <Legend />
                  {projectionAccounts.map((acc, idx) => (
                    <Line
                      key={acc._id || acc.id || acc.name}
                      type="monotone"
                      dataKey={acc.name}
                      stroke={CHART_COLORS[idx % CHART_COLORS.length]}
                      dot={false}
                      strokeWidth={2}
                    />
                  ))}
                </LineChart>
              </ResponsiveContainer>
            )}
          </div>
        );
      })()}

      {/* Liabilities */}
      <div className="section-header">
        <h2>Liabilities</h2>
        <button className="btn-primary btn-sm" onClick={() => openAdd('liability')}>+ Liability</button>
      </div>
      {liabilities.length === 0 ? (
        <div className="card empty-state">No liabilities tracked.</div>
      ) : (
        <div className="inv-card-list">
          {liabilities.map(l => {
            const monthlyInterest = (l.manualValue || 0) * (l.interestRate || 0) / 100 / 12;
            return (
              <div key={l._id || l.id} className="card inv-card">
                <div>
                  <div style={{ fontWeight: 600, marginBottom: '0.25rem', display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                    {l.name}
                    {ownerLabel(l.ownedBy) && <span style={{ fontSize: '0.65rem', fontWeight: 700, padding: '0.1rem 0.4rem', borderRadius: '99px', background: ownerLabel(l.ownedBy).color + '22', color: ownerLabel(l.ownedBy).color }}>{ownerLabel(l.ownedBy).label}</span>}
                  </div>
                  <div style={{ fontSize: '1.125rem', fontWeight: 700, color: 'var(--danger)' }}>{fmt(l.manualValue)}</div>
                  {l.interestRate > 0 && (
                    <div style={{ fontSize: '0.8rem', color: 'var(--muted)', marginTop: '0.25rem' }}>
                      APR: {l.interestRate}% &bull; <span style={{ color: 'var(--danger)' }}>Est. monthly interest: {fmt(monthlyInterest)}</span>
                    </div>
                  )}
                  {l.notes && <div style={{ fontSize: '0.8rem', color: 'var(--muted)', marginTop: '0.25rem' }}>{l.notes}</div>}
                </div>
                <div style={{ display: 'flex', gap: '0.5rem' }}>
                  <button className="icon-btn" onClick={() => openEdit(l)}>✏️</button>
                  <button className="icon-btn" onClick={() => handleDelete(l._id || l.id)}>🗑️</button>
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
                {editTarget ? 'Edit' : 'Add'} {formType === 'stock' ? 'Stock / ETF' : formType === 'retirement' ? 'Retirement Account' : formType === 'liability' ? 'Liability' : 'Savings Account'}
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

            {formType === 'liability' && (
              <>
                <div className="form-group">
                  <label>Account Name (e.g. Chase Sapphire Credit Card)</label>
                  <input type="text" value={form.name} onChange={e => setField('name', e.target.value)} placeholder="Chase Sapphire Credit Card" required />
                </div>
                <div className="form-group">
                  <label>Current Balance Owed</label>
                  <input type="number" value={form.manualValue} onChange={e => setField('manualValue', e.target.value)} placeholder="2500.00" step="0.01" min="0" />
                </div>
                <div className="form-group">
                  <label>Interest Rate (APR %)</label>
                  <input type="number" value={form.interestRate} onChange={e => setField('interestRate', e.target.value)} placeholder="24.99" step="0.01" min="0" />
                </div>
                <div className="form-group">
                  <label>Notes (optional)</label>
                  <input type="text" value={form.notes} onChange={e => setField('notes', e.target.value)} placeholder="e.g. Paid in full monthly" />
                </div>
              </>
            )}

            {/* Owner picker */}
            {!editTarget && (
              <div style={{ margin: '0.75rem 0' }}>
                <div style={{ fontSize: '0.8rem', color: 'var(--muted)', marginBottom: '0.4rem' }}>Who owns this?</div>
                <div className="owner-picker-row">
                  {members.map(m => (
                    <button key={m._id} type="button"
                      className={`owner-btn${formOwner === m._id ? ' active' : ''}`}
                      onClick={() => setFormOwner(m._id)}
                    >
                      {m._id === user?.id ? 'Me' : m.name.split(' ')[0]}
                    </button>
                  ))}
                  <button type="button"
                    className={`owner-btn${formOwner === 'joint' ? ' active' : ''}`}
                    onClick={() => setFormOwner('joint')}
                  >Joint</button>
                </div>
              </div>
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
    </>
  );
}

// ── Goals Tab ─────────────────────────────────────────────────────────────────
function GoalsTab() {
  const [goals, setGoals] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editGoal, setEditGoal] = useState(null);
  const [contributeGoal, setContributeGoal] = useState(null);
  const [contributeAmount, setContributeAmount] = useState('');
  const [formGoalType, setFormGoalType] = useState('savings');
  const { register, handleSubmit, reset, setValue, formState: { isSubmitting } } = useForm();

  const fetchGoals = async () => {
    setLoading(true);
    try {
      const res = await api.get('/goals');
      setGoals(res.data.map(g => ({ ...g, goalType: g.goalType || 'savings' })));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchGoals(); }, []);

  const onSubmit = async (data) => {
    try {
      const amount = Number(data.targetAmount);
      if (editGoal) {
        await api.put(`/goals/${editGoal._id}`, { ...data, targetAmount: amount, goalType: formGoalType });
      } else {
        const payload = {
          ...data,
          targetAmount: amount,
          goalType: formGoalType,
          currentAmount: formGoalType === 'debt' ? amount : 0,
        };
        await api.post('/goals', payload);
      }
      reset(); setShowForm(false); setEditGoal(null); setFormGoalType('savings'); fetchGoals();
    } catch {
      alert('Error saving goal');
    }
  };

  const handleEdit = (g) => {
    setEditGoal(g); setShowForm(true);
    setFormGoalType(g.goalType || 'savings');
    setValue('name', g.name); setValue('targetAmount', g.targetAmount);
    setValue('deadline', g.deadline ? g.deadline.split('T')[0] : '');
    setValue('notes', g.notes);
  };

  const handleDelete = async (id) => {
    if (!confirm('Delete this goal?')) return;
    await api.delete(`/goals/${id}`); fetchGoals();
  };

  const handleContribute = async (g) => {
    const amount = parseFloat(contributeAmount);
    if (!amount || amount <= 0) { alert('Enter a valid amount'); return; }
    let newAmount;
    if (g.goalType === 'debt') {
      newAmount = Math.max(0, (g.currentAmount || 0) - amount);
    } else {
      newAmount = (g.currentAmount || 0) + amount;
    }
    await api.put(`/goals/${g._id}`, { currentAmount: newAmount });
    setContributeGoal(null); setContributeAmount(''); fetchGoals();
  };

  return (
    <>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
        <h2 style={{ fontSize: '1.25rem', fontWeight: 600 }}>Shared Goals</h2>
        <button
          className="btn-primary"
          style={{ padding: '0.5rem 1rem', fontSize: '0.9rem' }}
          onClick={() => { setShowForm(!showForm); setEditGoal(null); reset(); setFormGoalType('savings'); }}
        >
          {showForm ? 'Cancel' : '+ Add Goal'}
        </button>
      </div>

      {showForm && (
        <div className="card" style={{ marginBottom: '1rem' }}>
          <div style={{ fontWeight: 600, marginBottom: '0.75rem' }}>{editGoal ? 'Edit Goal' : 'New Goal'}</div>
          <form onSubmit={handleSubmit(onSubmit)}>
            {/* Goal Type Toggle */}
            <div className="form-group">
              <label>Goal Type</label>
              <div style={{ display: 'flex', gap: '0.5rem' }}>
                <button
                  type="button"
                  onClick={() => setFormGoalType('savings')}
                  style={{
                    flex: 1,
                    padding: '0.5rem',
                    borderRadius: '999px',
                    border: '2px solid',
                    borderColor: formGoalType === 'savings' ? 'var(--primary)' : 'var(--border)',
                    background: formGoalType === 'savings' ? 'var(--primary)' : 'transparent',
                    color: formGoalType === 'savings' ? '#fff' : 'var(--text)',
                    cursor: 'pointer',
                    fontWeight: 600,
                    fontSize: '0.875rem',
                  }}
                >
                  Savings Goal 💰
                </button>
                <button
                  type="button"
                  onClick={() => setFormGoalType('debt')}
                  style={{
                    flex: 1,
                    padding: '0.5rem',
                    borderRadius: '999px',
                    border: '2px solid',
                    borderColor: formGoalType === 'debt' ? 'var(--danger)' : 'var(--border)',
                    background: formGoalType === 'debt' ? 'var(--danger)' : 'transparent',
                    color: formGoalType === 'debt' ? '#fff' : 'var(--text)',
                    cursor: 'pointer',
                    fontWeight: 600,
                    fontSize: '0.875rem',
                  }}
                >
                  Debt Paydown 💳
                </button>
              </div>
            </div>

            <div className="form-group">
              <label>Goal name</label>
              <input placeholder="e.g. Emergency Fund" {...register('name', { required: true })} />
            </div>
            <div className="form-group">
              <label>{formGoalType === 'debt' ? 'Starting Balance (total debt)' : 'Target amount ($)'}</label>
              <input type="number" step="0.01" placeholder="0.00" {...register('targetAmount', { required: true })} />
            </div>
            <div className="form-group">
              <label>Deadline (optional)</label>
              <input type="date" {...register('deadline')} />
            </div>
            <div className="form-group">
              <label>Notes (optional)</label>
              <input placeholder="Any notes..." {...register('notes')} />
            </div>
            <button type="submit" className="btn-primary" disabled={isSubmitting}>
              {isSubmitting ? 'Saving...' : 'Save Goal'}
            </button>
          </form>
        </div>
      )}

      {loading ? (
        <div style={{ textAlign: 'center', color: 'var(--muted)', padding: '2rem' }}>Loading...</div>
      ) : goals.length === 0 ? (
        <div className="card" style={{ textAlign: 'center', color: 'var(--muted)', padding: '2rem' }}>
          No goals yet. Create your first shared goal!
        </div>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))', gap: '1rem' }}>
          {goals.map(g => {
            const isDebt = g.goalType === 'debt';
            const pct = isDebt
              ? (g.targetAmount > 0 ? Math.min(100, ((g.targetAmount - g.currentAmount) / g.targetAmount) * 100) : 0)
              : (g.targetAmount > 0 ? Math.min(100, (g.currentAmount / g.targetAmount) * 100) : 0);
            const ringColor = pct >= 100 ? 'var(--success)' : (isDebt ? 'var(--danger)' : 'var(--primary)');
            return (
              <div key={g._id} className="card" style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                    <span style={{ fontWeight: 600, fontSize: '1rem' }}>{g.name}</span>
                    {isDebt && (
                      <span style={{
                        fontSize: '0.65rem',
                        fontWeight: 700,
                        color: 'var(--danger)',
                        border: '1px solid var(--danger)',
                        borderRadius: '4px',
                        padding: '0 4px',
                        lineHeight: '1.4',
                      }}>DEBT</span>
                    )}
                  </div>
                  <div style={{ display: 'flex', gap: '0.25rem' }}>
                    <button
                      onClick={() => handleEdit(g)}
                      style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: '1rem', color: 'var(--muted)' }}
                      title="Edit"
                    >✏️</button>
                    <button
                      className="btn-danger"
                      onClick={() => handleDelete(g._id)}
                      style={{ padding: '0.2rem 0.4rem', fontSize: '0.75rem' }}
                      title="Delete"
                    >🗑</button>
                  </div>
                </div>
                <ProgressRing pct={pct} color={ringColor} />
                <div style={{ textAlign: 'center', fontSize: '0.875rem', color: 'var(--muted)' }}>
                  {isDebt ? (
                    <>Remaining: {fmt(g.currentAmount)} / {fmt(g.targetAmount)}</>
                  ) : (
                    <>Saved: {fmt(g.currentAmount)} / {fmt(g.targetAmount)}</>
                  )}
                </div>
                {g.deadline && (
                  <div style={{ fontSize: '0.75rem', color: 'var(--muted)', textAlign: 'center' }}>
                    Deadline: {new Date(g.deadline).toLocaleDateString()}
                  </div>
                )}
                {g.notes && (
                  <div style={{ fontSize: '0.8rem', color: 'var(--muted)' }}>{g.notes}</div>
                )}
                {contributeGoal?._id === g._id ? (
                  <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center', marginTop: '0.25rem' }}>
                    <input
                      type="number" step="0.01" placeholder="Amount"
                      value={contributeAmount} onChange={e => setContributeAmount(e.target.value)}
                      style={{ flex: 1 }}
                    />
                    <button className="btn-primary" style={{ padding: '0.5rem 0.75rem', fontSize: '0.875rem', whiteSpace: 'nowrap' }} onClick={() => handleContribute(g)}>
                      {isDebt ? 'Pay' : 'Add'}
                    </button>
                    <button className="btn-ghost" style={{ padding: '0.5rem 0.75rem', fontSize: '0.875rem' }} onClick={() => setContributeGoal(null)}>Cancel</button>
                  </div>
                ) : (
                  <button className="btn-ghost" style={{ marginTop: '0.25rem' }} onClick={() => { setContributeGoal(g); setContributeAmount(''); }}>
                    {isDebt ? 'Make Payment 💳' : '+ Contribute'}
                  </button>
                )}
              </div>
            );
          })}
        </div>
      )}
    </>
  );
}

// ── Wealth Page ───────────────────────────────────────────────────────────────
export default function Wealth() {
  const [activeTab, setActiveTab] = useState('investments');

  return (
    <div className="page-content">
      <div className="tab-switcher">
        {[
          { key: 'investments', label: 'Investments' },
          { key: 'goals', label: 'Goals' },
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

      {activeTab === 'investments' && <InvestmentsTab />}
      {activeTab === 'goals' && <GoalsTab />}
    </div>
  );
}
