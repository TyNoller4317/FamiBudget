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

export default function Login() {
  const { register, handleSubmit, formState: { errors, isSubmitting }, setError } = useForm();
  const { login } = useAuth();
  const navigate = useNavigate();

  const onSubmit = async (data) => {
    try {
      const res = await api.post('/auth/login', data);
      login(res.data.token, res.data.user);
      navigate('/');
    } catch (err) {
      const msg = err.response?.data?.message || 'Login failed. Please check your credentials.';
      setError('root', { message: msg });
    }
  };

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
          <div className="auth-title">Welcome back</div>
          <div className="auth-subtitle">Sign in to your household account</div>

          <form onSubmit={handleSubmit(onSubmit)}>
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
                placeholder="••••••••"
                autoComplete="current-password"
                {...register('password', { required: 'Password is required' })}
              />
              {errors.password && <div className="auth-field-error">{errors.password.message}</div>}
            </div>

            {errors.root && <div className="auth-error-box">{errors.root.message}</div>}

            <button type="submit" className="auth-submit" disabled={isSubmitting}>
              {isSubmitting ? 'Signing in…' : 'Sign In'}
            </button>
          </form>

          <div className="auth-footer">
            No account yet? <Link to="/register">Create one free</Link>
          </div>
        </div>
      </div>
    </div>
  );
}
