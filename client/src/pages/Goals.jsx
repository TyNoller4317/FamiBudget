import { useEffect, useState } from 'react';
import api from '../api/axios';
import { useForm } from 'react-hook-form';

function fmt(n) {
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(n || 0);
}

function ProgressRing({ pct, size = 100, stroke = 8 }) {
  const r = (size - stroke) / 2;
  const circ = 2 * Math.PI * r;
  const offset = circ * (1 - Math.min(pct, 100) / 100);
  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} className="progress-ring">
      <circle cx={size/2} cy={size/2} r={r} fill="none" stroke="var(--border)" strokeWidth={stroke} />
      <circle
        cx={size/2} cy={size/2} r={r} fill="none"
        stroke={pct >= 100 ? 'var(--success)' : 'var(--primary)'} strokeWidth={stroke}
        strokeDasharray={circ} strokeDashoffset={offset}
        strokeLinecap="round"
        transform={`rotate(-90 ${size/2} ${size/2})`}
      />
      <text x={size/2} y={size/2 + 5} textAnchor="middle" fontSize="14" fontWeight="700" fill="var(--text)">
        {Math.round(pct)}%
      </text>
    </svg>
  );
}

export default function Goals() {
  const [goals, setGoals] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editGoal, setEditGoal] = useState(null);
  const [contributeGoal, setContributeGoal] = useState(null);
  const [contributeAmount, setContributeAmount] = useState('');
  const { register, handleSubmit, reset, setValue, formState: { isSubmitting } } = useForm();

  const fetchGoals = async () => {
    setLoading(true);
    try { const res = await api.get('/goals'); setGoals(res.data); }
    finally { setLoading(false); }
  };

  useEffect(() => { fetchGoals(); }, []);

  const onSubmit = async (data) => {
    try {
      if (editGoal) {
        await api.put(`/goals/${editGoal._id}`, { ...data, targetAmount: Number(data.targetAmount) });
      } else {
        await api.post('/goals', { ...data, targetAmount: Number(data.targetAmount) });
      }
      reset(); setShowForm(false); setEditGoal(null); fetchGoals();
    } catch { alert('Error saving goal'); }
  };

  const handleEdit = (g) => {
    setEditGoal(g); setShowForm(true);
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
    await api.put(`/goals/${g._id}`, { currentAmount: (g.currentAmount || 0) + amount });
    setContributeGoal(null); setContributeAmount(''); fetchGoals();
  };

  return (
    <div className="page-content">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
        <h2 style={{ fontSize: '1.25rem', fontWeight: 600 }}>Shared Goals</h2>
        <button
          className="btn-primary"
          style={{ padding: '0.5rem 1rem', fontSize: '0.9rem' }}
          onClick={() => { setShowForm(!showForm); setEditGoal(null); reset(); }}
        >
          {showForm ? 'Cancel' : '+ Add Goal'}
        </button>
      </div>

      {showForm && (
        <div className="card" style={{ marginBottom: '1rem' }}>
          <div style={{ fontWeight: 600, marginBottom: '0.75rem' }}>{editGoal ? 'Edit Goal' : 'New Goal'}</div>
          <form onSubmit={handleSubmit(onSubmit)}>
            <div className="form-group">
              <label>Goal name</label>
              <input placeholder="e.g. Emergency Fund" {...register('name', { required: true })} />
            </div>
            <div className="form-group">
              <label>Target amount ($)</label>
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
            const pct = g.targetAmount > 0 ? Math.min(100, (g.currentAmount / g.targetAmount) * 100) : 0;
            return (
              <div key={g._id} className="card" style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                  <span style={{ fontWeight: 600, fontSize: '1rem' }}>{g.name}</span>
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

                <ProgressRing pct={pct} />

                <div style={{ textAlign: 'center', fontSize: '0.875rem', color: 'var(--muted)' }}>
                  {fmt(g.currentAmount)} / {fmt(g.targetAmount)}
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
                      type="number"
                      step="0.01"
                      placeholder="Amount"
                      value={contributeAmount}
                      onChange={e => setContributeAmount(e.target.value)}
                      style={{ flex: 1 }}
                    />
                    <button
                      className="btn-primary"
                      style={{ padding: '0.5rem 0.75rem', fontSize: '0.875rem', whiteSpace: 'nowrap' }}
                      onClick={() => handleContribute(g)}
                    >Add</button>
                    <button
                      className="btn-ghost"
                      style={{ padding: '0.5rem 0.75rem', fontSize: '0.875rem' }}
                      onClick={() => setContributeGoal(null)}
                    >Cancel</button>
                  </div>
                ) : (
                  <button
                    className="btn-ghost"
                    style={{ marginTop: '0.25rem' }}
                    onClick={() => { setContributeGoal(g); setContributeAmount(''); }}
                  >
                    + Contribute
                  </button>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
