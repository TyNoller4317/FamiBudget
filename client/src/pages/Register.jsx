import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { useNavigate, Link } from 'react-router-dom';
import api from '../api/axios';
import { useAuth } from '../context/AuthContext';
import './Auth.css';

const FEATURES = [
  { icon: '💳', text: 'Track every transaction together in one place' },
  { icon: '📊', text: 'Budget by category with real-time progress' },
  { icon: '📈', text: 'Watch your net worth grow over time' },
  { icon: '👨‍👩‍👧', text: 'Built for two — see who spent what' },
];

export default function Register() {
  const { register, handleSubmit, formState: { errors, isSubmitting }, setError } = useForm();
  const { login } = useAuth();
  const navigate = useNavigate();
  const [householdId, setHouseholdId] = useState('');
  const [copied, setCopied] = useState(false);

  const onSubmit = async (data) => {
    try {
      const res = await api.post('/auth/register', data);
      setHouseholdId(res.data.user.householdId);
      login(res.data.token, res.data.user);
      setTimeout(() => navigate('/'), 4000);
    } catch (err) {
      const msg = err.response?.data?.message || err.response?.data?.errors?.[0]?.msg || 'Registration failed.';
      setError('root', { message: msg });
    }
  };

  const handleCopy = () => {
    navigator.clipboard.writeText(householdId);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  if (householdId) {
    return (
      <div className="auth-page">
        <div className="auth-brand">
          <div className="auth-brand-logo">FamiBudget</div>
          <div className="auth-brand-tagline">The budget app built for two.</div>
          <div className="auth-brand-features">
            {FEATURES.map(f => (
              <div className="auth-feature" key={f.text}>
                <div className="auth-feature-icon">{f.icon}</div>
                <div className="auth-feature-text">{f.text}</div>
              </div>
            ))}
          </div>
        </div>
        <div className="auth-form-panel">
          <div className="auth-card">
            <div className="auth-success">
              <div className="auth-success-icon">✓</div>
              <h2>You're all set!</h2>
              <p>Share your family code with your partner so they can join your household when they register.</p>
              <div className="auth-code-box">
                <div className="auth-code-text">{householdId}</div>
                <button className="auth-code-copy" onClick={handleCopy}>
                  {copied ? '✓ Copied' : 'Copy'}
                </button>
              </div>
              <div className="auth-redirect">Taking you to your dashboard…</div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="auth-page">
      {/* Brand panel */}
      <div className="auth-brand">
        <div className="auth-brand-logo">FamiBudget</div>
        <div className="auth-brand-tagline">The budget app built for two.</div>
        <div className="auth-brand-features">
          {FEATURES.map(f => (
            <div className="auth-feature" key={f.text}>
              <div className="auth-feature-icon">{f.icon}</div>
              <div className="auth-feature-text">{f.text}</div>
            </div>
          ))}
        </div>
      </div>

      {/* Form panel */}
      <div className="auth-form-panel">
        <div className="auth-card">
          <div className="auth-mobile-logo">FamiBudget</div>
          <div className="auth-title">Create account</div>
          <div className="auth-subtitle">Start managing your finances together</div>

          <form onSubmit={handleSubmit(onSubmit)}>
            <div className="auth-field">
              <label>Your Name</label>
              <input
                placeholder="First and last name"
                autoComplete="name"
                {...register('name', { required: 'Name is required' })}
              />
              {errors.name && <div className="auth-field-error">{errors.name.message}</div>}
            </div>

            <div className="auth-field">
              <label>Email</label>
              <input
                type="email"
                placeholder="you@example.com"
                autoComplete="email"
                {...register('email', { required: 'Email is required' })}
              />
              {errors.email && <div className="auth-field-error">{errors.email.message}</div>}
            </div>

            <div className="auth-field">
              <label>Password</label>
              <input
                type="password"
                placeholder="At least 6 characters"
                autoComplete="new-password"
                {...register('password', {
                  required: 'Password is required',
                  minLength: { value: 6, message: 'Must be at least 6 characters' },
                })}
              />
              {errors.password && <div className="auth-field-error">{errors.password.message}</div>}
            </div>

            <div className="auth-field">
              <label>Family Code <span style={{ fontWeight: 400, textTransform: 'none', letterSpacing: 0, color: 'var(--muted)' }}>(optional)</span></label>
              <input
                placeholder="Paste your partner's code to join their household"
                autoComplete="off"
                {...register('inviteCode')}
              />
              <div className="auth-hint">Leave blank to create a new household.</div>
            </div>

            {errors.root && <div className="auth-error-box">{errors.root.message}</div>}

            <button type="submit" className="auth-submit" disabled={isSubmitting}>
              {isSubmitting ? 'Creating account…' : 'Create Account'}
            </button>
          </form>

          <div className="auth-footer">
            Already have an account? <Link to="/login">Sign in</Link>
          </div>
        </div>
      </div>
    </div>
  );
}
