import { useState, useEffect, useCallback } from 'react';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer } from 'recharts';
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

function formatMonth(m) {
  const [year, month] = m.split('-');
  const d = new Date(parseInt(year), parseInt(month) - 1, 1);
  return d.toLocaleString('default', { month: 'long', year: 'numeric' });
}

function currentMonthStr() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
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

function ProgressRing({ pct, size = 80, stroke = 6 }) {
  const r = (size - stroke) / 2;
  const circ = 2 * Math.PI * r;
  const offset = circ * (1 - Math.min(pct, 100) / 100);
  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} className="progress-ring">
      <circle cx={size/2} cy={size/2} r={r} fill="none" stroke="var(--border)" strokeWidth={stroke} />
      <circle
        cx={size/2} cy={size/2} r={r} fill="none"
        stroke="var(--primary)" strokeWidth={stroke}
        strokeDasharray={circ} strokeDashoffset={offset}
        strokeLinecap="round"
        transform={`rotate(-90 ${size/2} ${size/2})`}
      />
      <text x={size/2} y={size/2 + 5} textAnchor="middle" fontSize="13" fontWeight="700" fill="var(--text)">
        {Math.round(pct)}%
      </text>
    </svg>
  );
}

export default function Dashboard() {
  const [month, setMonth] = useState(currentMonthStr);
  const [summary, setSummary] = useState(null);
  const [transactions, setTransactions] = useState([]);
  const [goals, setGoals] = useState([]);
  const [loading, setLoading] = useState(true);

  const fetchAll = useCallback(async () => {
    setLoading(true);
    try {
      const [sumRes, txRes, goalsRes] = await Promise.all([
        api.get(`/summary?month=${month}`),
        api.get(`/transactions?month=${month}&limit=5`),
        api.get('/goals'),
      ]);
      setSummary(sumRes.data);
      setTransactions((txRes.data.transactions || txRes.data || []).slice(0, 5));
      setGoals(goalsRes.data || []);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  }, [month]);

  useEffect(() => { fetchAll(); }, [fetchAll]);

  const spendingByCategory = summary?.spendingByCategory || [];
  const budgetCategories = spendingByCategory.filter(c => c.budget || c.monthlyLimit);

  return (
    <div className="page-content">
      <div className="month-nav">
        <button onClick={() => setMonth(prevMonth(month))}>‹</button>
        <h2>{formatMonth(month)}</h2>
        <button onClick={() => setMonth(nextMonth(month))}>›</button>
      </div>

      <div className="summary-cards">
        <div className="summary-card net">
          <div className="card-label">Net Balance</div>
          <div className="card-value">{fmt((summary?.totalIncome || 0) - (summary?.totalExpenses || 0))}</div>
        </div>
        <div className="summary-card income">
          <div className="card-label">Income</div>
          <div className="card-value">{fmt(summary?.totalIncome)}</div>
        </div>
        <div className="summary-card expense">
          <div className="card-label">Expenses</div>
          <div className="card-value">{fmt(summary?.totalExpenses)}</div>
        </div>
      </div>

      {budgetCategories.length > 0 && (
        <>
          <div className="section-title">Budget</div>
          <div className="card">
            <div className="budget-bars">
              {budgetCategories.map(cat => {
                const limit = cat.budget || cat.monthlyLimit || 0;
                const spent = cat.total || 0;
                const pct = limit > 0 ? Math.min((spent / limit) * 100, 100) : 0;
                const over = spent > limit;
                return (
                  <div className="budget-bar-row" key={cat.category}>
                    <div className="budget-bar-header">
                      <span>{cat.category}</span>
                      <span>{fmt(spent)} / {fmt(limit)}</span>
                    </div>
                    <div className="budget-bar-track">
                      <div className={`budget-bar-fill${over ? ' over' : ''}`} style={{ width: `${pct}%` }} />
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </>
      )}

      {spendingByCategory.length > 0 && (
        <>
          <div className="section-title">Spending by Category</div>
          <div className="card">
            <ResponsiveContainer width="100%" height={200}>
              <BarChart data={spendingByCategory} layout="vertical" margin={{ left: 20, right: 20 }}>
                <XAxis type="number" tick={{ fontSize: 12 }} tickFormatter={v => `$${v}`} />
                <YAxis type="category" dataKey="category" tick={{ fontSize: 12 }} width={90} />
                <Tooltip formatter={v => fmt(v)} />
                <Bar dataKey="total" fill="var(--primary)" radius={[0, 6, 6, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </>
      )}

      {transactions.length > 0 && (
        <>
          <div className="section-title">Recent Transactions</div>
          <div className="txn-list">
            {transactions.map(txn => {
              const initial = (txn.createdByName || txn.description || txn.category || '?')[0].toUpperCase();
              const color = avatarColor(txn.createdBy || txn.userId);
              const date = txn.date ? new Date(txn.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }) : '';
              return (
                <div className="txn-row" key={txn._id || txn.id}>
                  <div className="txn-avatar" style={{ background: color + '22', color }}>
                    {initial}
                  </div>
                  <div className="txn-info">
                    <div className="txn-desc">{txn.description || txn.category}</div>
                    <div className="txn-meta">{txn.category} · {txn.createdByName || 'You'}</div>
                  </div>
                  <div className={`txn-amount ${txn.type}`}>
                    {txn.type === 'income' ? '+' : '-'}{fmt(txn.amount)}
                  </div>
                </div>
              );
            })}
          </div>
        </>
      )}

      {goals.length > 0 && (
        <>
          <div className="section-title">Goals</div>
          <div className="goals-strip">
            {goals.map(goal => {
              const pct = goal.targetAmount > 0 ? (goal.currentAmount / goal.targetAmount) * 100 : 0;
              return (
                <div className="goal-card" key={goal._id || goal.id}>
                  <div style={{ fontWeight: 600, fontSize: '0.9rem', marginBottom: '0.25rem' }}>{goal.name}</div>
                  <ProgressRing pct={pct} />
                  <div style={{ textAlign: 'center', fontSize: '0.75rem', color: 'var(--muted)', marginTop: '0.25rem' }}>
                    {fmt(goal.currentAmount)} / {fmt(goal.targetAmount)}
                  </div>
                </div>
              );
            })}
          </div>
        </>
      )}

      <QuickAdd onSave={fetchAll} />
    </div>
  );
}
