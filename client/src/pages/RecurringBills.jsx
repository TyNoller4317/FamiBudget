import { useEffect, useState } from 'react';
import api from '../api/axios';
import { useForm } from 'react-hook-form';

const CATEGORIES = ['Housing', 'Food', 'Transport', 'Utilities', 'Entertainment', 'Healthcare', 'Shopping', 'Other'];

export default function RecurringBills() {
  const [bills, setBills] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const { register, handleSubmit, reset, formState: { isSubmitting } } = useForm();

  const fetchBills = async () => {
    setLoading(true);
    try {
      const res = await api.get('/transactions', { params: { type: 'expense' } });
      setBills(res.data.filter(t => t.isRecurring));
    } finally { setLoading(false); }
  };

  useEffect(() => { fetchBills(); }, []);

  const onSubmit = async (data) => {
    try {
      await api.post('/transactions', {
        ...data,
        type: 'expense',
        amount: Number(data.amount),
        isRecurring: true,
      });
      reset(); setShowForm(false); fetchBills();
    } catch { alert('Error saving bill'); }
  };

  const handleDelete = async (id) => {
    if (!confirm('Delete this recurring bill?')) return;
    await api.delete(`/transactions/${id}`); fetchBills();
  };

  return (
    <div className="page-content">
      <div className="page-header">
        <h2>Recurring Bills</h2>
        <button className="btn-primary-sm" onClick={() => setShowForm(!showForm)}>
          {showForm ? 'Cancel' : '+ Add Recurring Bill'}
        </button>
      </div>

      {showForm && (
        <div className="card form-card">
          <h3>New Recurring Bill</h3>
          <form onSubmit={handleSubmit(onSubmit)} className="inline-form">
            <input placeholder="Description" {...register('description', { required: true })} />
            <input type="number" step="0.01" placeholder="Amount" {...register('amount', { required: true })} />
            <select {...register('category', { required: true })}><option value="">Category</option>{CATEGORIES.map(c => <option key={c}>{c}</option>)}</select>
            <select {...register('recurringInterval', { required: true })}><option value="">Interval</option><option value="weekly">Weekly</option><option value="monthly">Monthly</option><option value="yearly">Yearly</option></select>
            <input type="date" {...register('date')} />
            <button type="submit" className="btn-primary-sm" disabled={isSubmitting}>{isSubmitting ? 'Saving...' : 'Save'}</button>
          </form>
        </div>
      )}

      {loading ? <p>Loading...</p> : (
        <div className="card">
          <table className="data-table">
            <thead><tr><th>Description</th><th>Category</th><th>Amount</th><th>Interval</th><th>Next Date</th><th>Actions</th></tr></thead>
            <tbody>
              {bills.length === 0 && <tr><td colSpan="6" style={{textAlign:'center',color:'#9ca3af'}}>No recurring bills. Add one!</td></tr>}
              {bills.map(b => (
                <tr key={b._id}>
                  <td>{b.description}</td>
                  <td>{b.category}</td>
                  <td className="text-red">${Number(b.amount).toFixed(2)}</td>
                  <td><span className="badge badge-blue">{b.recurringInterval}</span></td>
                  <td>{b.date ? new Date(b.date).toLocaleDateString() : '—'}</td>
                  <td><button className="btn-icon btn-danger" onClick={() => handleDelete(b._id)}>Del</button></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
