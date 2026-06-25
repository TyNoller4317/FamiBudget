import { useState, useEffect, useCallback } from 'react';
import {
  BarChart, Bar, LineChart, Line, PieChart, Pie, Cell,
  XAxis, YAxis, Tooltip, Legend, ResponsiveContainer,
} from 'recharts';
import api from '../api/axios';
import QuickAdd from '../components/QuickAdd';

const AVATAR_COLORS = ['#042F34', '#1a9e6e', '#5a7a80', '#FFC933', '#16232B'];
const CHART_COLORS = ['#1a9e6e', '#FFC933', '#042F34', '#B5F2DB', '#5a7a80', '#2ec4b6', '#16232B', '#a8dadc'];
const CATEGORY_EMOJI = {
  Housing: '🏠', Food: '🍔', Transport: '🚗', Utilities: '⚡',
  Entertainment: '🎬', Education: '📚', Shopping: '🛍️',
  Savings: '💰', Income: '💵', Other: '📦',
};

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

function ProgressRing({ pct, size = 64, stroke = 6 }) {
  const r = (size - stroke) / 2;
  const circ = 2 * Math.PI * r;
  const offset = circ * (1 - Math.min(pct, 100) / 100);
  const color = pct >= 100 ? 'var(--danger)' : 'var(--primary)';
  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} className="progress-ring">
      <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="var(--border)" strokeWidth={stroke} />
      <circle
        cx={size / 2} cy={size / 2} r={r} fill="none"
        stroke={color} strokeWidth={stroke}
        strokeDasharray={circ} strokeDashoffset={offset}
        strokeLinecap="round"
        transform={`rotate(-90 ${size / 2} ${size / 2})`}
      />
      <text x={size / 2} y={size / 2 + 4} textAnchor="middle" fontSize="11" fontWeight="700" fill="var(--text)">
        {Math.round(pct)}%
      </text>
    </svg>
  );
}

export default function Overview() {
  const [month, setMonth] = useState(currentMonthStr);
  const [summary, setSummary] = useState(null);
  const [history, setHistory] = useState([]);
  const [transactions, setTransactions] = useState([]);
  const [investments, setInvestments] = useState([]);
  const [allTransactions, setAllTransactions] = useState([]);
  const [goals, setGoals] = useState([]);
  const [loading, setLoading] = useState(true);
  const [recsCollapsed, setRecsCollapsed] = useState(false);

  const fetchAll = useCallback(async () => {
    setLoading(true);
    try {
      const [sumRes, histRes, txRes, invRes, allTxRes, goalsRes] = await Promise.all([
        api.get(`/summary?month=${month}`),
        api.get('/history'),
        api.get(`/transactions?month=${month}&limit=5`),
        api.get('/investments'),
        api.get('/transactions?limit=200'),
        api.get('/goals'),
      ]);
      setSummary(sumRes.data);
      setHistory(histRes.data || []);
      setTransactions((txRes.data.transactions || txRes.data || []).slice(0, 5));
      setInvestments(invRes.data || []);
      setAllTransactions(allTxRes.data.transactions || allTxRes.data || []);
      setGoals(goalsRes.data || []);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  }, [month]);

  useEffect(() => { fetchAll(); }, [fetchAll]);

  const spendingByCategory = summary?.spendingByCategory || [];
  const budgets = summary?.budgets || [];

  // Build budget map from budgets array in summary response
  const budgetMap = {};
  budgets.forEach(b => { budgetMap[b.category] = b.monthlyLimit; });

  // Budget rings: categories that have a budget set, sorted alphabetically
  const ringCategories = spendingByCategory
    .filter(c => budgetMap[c.category] != null)
    .sort((a, b) => a.category.localeCompare(b.category));

  // Real net worth = investment assets - liabilities
  const invNetWorth = (() => {
    let total = 0;
    investments.forEach(inv => {
      if (inv.accountType === 'stock') {
        total += inv.shares * (inv.currentPrice || inv.costBasis || 0);
      } else if (inv.accountType === 'liability') {
        total -= inv.manualValue || 0;
      } else {
        total += inv.manualValue || 0;
      }
    });
    return total;
  })();
  const hasInvestments = investments.length > 0;

  // ── Smart Recommendations ────────────────────────────────────────────────────
  const recommendations = (() => {
    const recs = [];

    // Monthly recurring expenses total
    const recurringExpenses = allTransactions
      .filter(t => t.isRecurring && t.type === 'expense')
      .reduce((s, t) => {
        let monthly = t.amount;
        if (t.recurringInterval === 'weekly') monthly = t.amount * 4.33;
        if (t.recurringInterval === 'biweekly') monthly = t.amount * 2.17;
        if (t.recurringInterval === 'yearly') monthly = t.amount / 12;
        return s + monthly;
      }, 0);

    // 1. Emergency fund check
    const savingsTotal = investments
      .filter(i => i.accountType === 'savings')
      .reduce((s, i) => s + (i.manualValue || 0), 0);
    const hasEmergencyGoal = goals.some(g => g.name.toLowerCase().includes('emergency'));

    if (recurringExpenses > 0 && !hasEmergencyGoal) {
      const target3x = recurringExpenses * 3;
      const target5x = recurringExpenses * 5;
      if (savingsTotal < target3x) {
        recs.push({
          icon: '🚨',
          title: 'Build an Emergency Fund',
          body: `Your recurring bills total ${fmt(recurringExpenses)}/mo. You should have ${fmt(target3x)}–${fmt(target5x)} saved (3–5 months). You currently have ${fmt(savingsTotal)} in savings.`,
          color: 'var(--danger)',
          bg: 'var(--danger-light)',
        });
      }
    }

    // 2. Spending > 90% of income
    const income = summary?.totalIncome || 0;
    const expenses = summary?.totalExpenses || 0;
    if (income > 0 && expenses / income > 0.9) {
      recs.push({
        icon: '⚠️',
        title: 'High Spending Alert',
        body: `You're spending ${Math.round((expenses / income) * 100)}% of your income this month. Try to keep spending under 90% to build savings.`,
        color: '#b45309',
        bg: '#fef3c7',
      });
    }

    // 3. No retirement account
    const hasRetirement = investments.some(i => i.accountType === 'retirement');
    if (!hasRetirement) {
      recs.push({
        icon: '📈',
        title: 'Start a Retirement Account',
        body: 'You have no retirement accounts tracked. Consider opening a 401(k) or IRA and adding it to your Wealth page to track your long-term growth.',
        color: 'var(--primary)',
        bg: 'var(--success-light)',
      });
    }

    // 4. Over budget on any category
    const overBudget = (summary?.spendingByCategory || []).filter(c => budgetMap[c.category] && c.total > budgetMap[c.category]);
    overBudget.forEach(c => {
      const over = c.total - budgetMap[c.category];
      recs.push({
        icon: '🚫',
        title: `Over Budget: ${c.category}`,
        body: `You've spent ${fmt(c.total)} on ${c.category} this month — ${fmt(over)} over your ${fmt(budgetMap[c.category])} limit.`,
        color: 'var(--danger)',
        bg: 'var(--danger-light, #fde)',
      });
    });

    // 5. No budget set for top spending category
    const topCategory = (summary?.spendingByCategory || []).find(c => !budgetMap[c.category]);
    if (topCategory) {
      recs.push({
        icon: '💡',
        title: `Set a Budget for ${topCategory.category}`,
        body: `You spent ${fmt(topCategory.total)} on ${topCategory.category} this month but have no budget set. Head to Activity → Budget to set a limit.`,
        color: 'var(--primary)',
        bg: '#e8f4fd',
      });
    }

    return recs;
  })();

  return (
    <div className="page-content">
      {/* Smart Recommendations — collapsible, at top */}
      {recommendations.length > 0 && (
        <div style={{ marginBottom: '1rem' }}>
          <div
            onClick={() => setRecsCollapsed(p => !p)}
            style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', cursor: 'pointer', marginBottom: recsCollapsed ? 0 : '0.75rem' }}
          >
            <div className="section-title" style={{ margin: 0 }}>
              Recommendations <span style={{ fontSize: '0.75rem', color: 'var(--danger)', fontWeight: 700, background: 'var(--danger-light,#fde)', borderRadius: '99px', padding: '2px 8px', marginLeft: '0.4rem' }}>{recommendations.length}</span>
            </div>
            <span style={{ fontSize: '0.8rem', color: 'var(--muted)' }}>{recsCollapsed ? '▼' : '▲'}</span>
          </div>
          {!recsCollapsed && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
              {recommendations.map((rec, i) => (
                <div key={i} style={{
                  background: rec.bg,
                  border: `1px solid ${rec.color}33`,
                  borderLeft: `4px solid ${rec.color}`,
                  borderRadius: 'var(--radius-lg)',
                  padding: '1rem 1.25rem',
                }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.25rem' }}>
                    <span style={{ fontSize: '1.1rem' }}>{rec.icon}</span>
                    <span style={{ fontWeight: 700, fontSize: '0.9rem', color: rec.color }}>{rec.title}</span>
                  </div>
                  <div style={{ fontSize: '0.85rem', color: 'var(--text)', lineHeight: 1.5 }}>{rec.body}</div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Month selector */}
      <div className="month-nav">
        <button onClick={() => setMonth(prevMonth(month))}>‹</button>
        <h2>{formatMonth(month)}</h2>
        <button onClick={() => setMonth(nextMonth(month))}>›</button>
      </div>

      {/* Summary cards */}
      <div className="summary-cards">
        <div className="summary-card net">
          <div className="card-label">{hasInvestments ? 'Net Worth' : 'Net Balance'}</div>
          <div className="card-value">{fmt(hasInvestments ? invNetWorth : (summary?.totalIncome || 0) - (summary?.totalExpenses || 0))}</div>
          {hasInvestments && <div style={{ fontSize: '0.75rem', color: 'var(--muted)', marginTop: '0.25rem' }}>Assets − Liabilities</div>}
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

      {/* Income vs Expenses bar chart */}
      {history.length > 0 && (
        <div className="chart-card">
          <div className="chart-title">Income vs Expenses — 6 Months</div>
          <ResponsiveContainer width="100%" height={220}>
            <BarChart data={history} margin={{ top: 4, right: 8, left: 8, bottom: 4 }}>
              <XAxis dataKey="label" tick={{ fontSize: 12 }} />
              <YAxis hide />
              <Tooltip formatter={(v) => fmt(v)} />
              <Legend />
              <Bar dataKey="income" name="Income" fill="#1a9e6e" radius={[4, 4, 0, 0]} />
              <Bar dataKey="expenses" name="Expenses" fill="#d94f4f" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}

      {/* Spending donut + Budget rings side by side */}
      <div className="charts-row">
        {/* Spending donut */}
        <div className="chart-card" style={{ marginBottom: 0 }}>
          <div className="chart-title">Spending</div>
          {spendingByCategory.length === 0 ? (
            <div style={{ textAlign: 'center', color: 'var(--muted)', padding: '2rem 0' }}>No spending data this month.</div>
          ) : (
            <ResponsiveContainer width="100%" height={220}>
              <PieChart>
                <Pie
                  data={spendingByCategory}
                  dataKey="total"
                  nameKey="category"
                  innerRadius={60}
                  outerRadius={90}
                  paddingAngle={2}
                >
                  {spendingByCategory.map((entry, i) => (
                    <Cell key={entry.category} fill={CHART_COLORS[i % CHART_COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip formatter={(v) => fmt(v)} />
                <Legend iconSize={10} wrapperStyle={{ fontSize: '0.75rem' }} />
              </PieChart>
            </ResponsiveContainer>
          )}
        </div>

        {/* Budget rings */}
        <div className="chart-card" style={{ marginBottom: 0 }}>
          <div className="chart-title">Budget</div>
          {ringCategories.length === 0 ? (
            <div style={{ color: 'var(--muted)', fontSize: '0.875rem' }}>
              No budgets set — add them in Activity.
            </div>
          ) : (
            <div className="budget-rings">
              {ringCategories.map(cat => {
                const limit = budgetMap[cat.category] || 0;
                const spent = cat.total || 0;
                const pct = limit > 0 ? (spent / limit) * 100 : 0;
                return (
                  <div className="budget-ring-item" key={cat.category}>
                    <ProgressRing pct={pct} size={64} stroke={6} />
                    <div className="budget-ring-label">{cat.category}</div>
                    <div className="budget-ring-sub">{fmt(spent)} / {fmt(limit)}</div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {/* Net Worth trend line chart */}
      {history.length > 0 && (
        <div className="chart-card">
          <div className="chart-title">Net Worth Trend</div>
          <ResponsiveContainer width="100%" height={160}>
            <LineChart
              data={history.map(h => ({ ...h, netWorth: h.net + invNetWorth }))}
              margin={{ top: 4, right: 8, left: 8, bottom: 4 }}
            >
              <XAxis dataKey="label" tick={{ fontSize: 12 }} />
              <YAxis hide />
              <Tooltip formatter={(v) => fmt(v)} />
              <Line
                type="monotone"
                dataKey="netWorth"
                name="Net Worth"
                stroke="var(--primary)"
                strokeWidth={2}
                dot={false}
              />
            </LineChart>
          </ResponsiveContainer>
        </div>
      )}

      {/* Recent Transactions */}
      {transactions.length > 0 && (
        <>
          <div className="section-title">Recent Transactions</div>
          <div className="txn-list">
            {transactions.map(txn => {
              const emoji = CATEGORY_EMOJI[txn.category] || '📦';
              const date = txn.date ? new Date(txn.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }) : '';
              return (
                <div className="txn-row" key={txn._id || txn.id}>
                  <div className="txn-avatar" style={{ background: 'var(--bg)', fontSize: '1.4rem' }}>
                    {emoji}
                  </div>
                  <div className="txn-info">
                    <div className="txn-desc">{txn.description || txn.category}</div>
                    <div className="txn-meta">{txn.category} · {date} · {txn.createdByName || 'You'}</div>
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

      <QuickAdd onSave={fetchAll} />
    </div>
  );
}
