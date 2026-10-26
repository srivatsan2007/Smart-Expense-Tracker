import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import '../css/style.css';
import '../css/auth.css';
import { loginUser } from '../hooks/useAuth.js';
import {
  Wallet,
  Lock,
  User,
  Eye,
  EyeOff,
  AlertCircle,
  ArrowRight
} from '../components/Icons.jsx';

export default function Login() {
  const [form, setForm] = useState({ loginId: '', password: '' });
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const navigate = useNavigate();

  useEffect(() => {
    document.title = 'Login - RupeeRise';
    if (localStorage.getItem('token')) {
      navigate('/dashboard');
    }
  }, [navigate]);

  const set = (k) => (e) => setForm({ ...form, [k]: e.target.value });

  const submit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      const profile = await loginUser(form.loginId.trim(), form.password);
      if (profile && profile.role === 'admin') {
        navigate('/admin');
      } else {
        navigate('/dashboard');
      }
    } catch (err) {
      setError(err.message || 'Login failed, please check your credentials.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="auth-container">
      <div className="auth-card">
        <div className="auth-header">
          <div
            style={{
              width: 72,
              height: 72,
              borderRadius: 20,
              overflow: 'hidden',
              margin: '0 auto 14px auto',
              background: '#ffffff',
              padding: 4,
              boxShadow: '0 8px 24px rgba(16, 185, 129, 0.25)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <img
              src="/images/rupeerise-logo.png"
              alt="RupeeRise"
              style={{ width: '100%', height: '100%', objectFit: 'contain' }}
            />
          </div>
          <h2 style={{ fontSize: '1.6rem', fontWeight: 800, margin: 0 }}>
            Rupee<span style={{ color: 'var(--success-color)' }}>Rise</span>
          </h2>
          <p style={{ margin: '4px 0 0 0', color: 'var(--text-muted)', fontSize: '0.85rem' }}>
            Track Smarter. Save Better. Rise Higher.
          </p>
        </div>

        {error && (
          <div className="error-msg">
            <AlertCircle size={18} style={{ flexShrink: 0 }} />
            <span>{error}</span>
          </div>
        )}

        <form className="auth-form" onSubmit={submit}>
          <div className="form-group">
            <label className="form-label" htmlFor="loginId">
              Email or Mobile Number
            </label>
            <div style={{ position: 'relative' }}>
              <input
                type="text"
                id="loginId"
                className="form-control"
                required
                placeholder="name@example.com or 9876543210"
                value={form.loginId}
                onChange={set('loginId')}
                autoFocus
              />
            </div>
          </div>

          <div className="form-group">
            <label className="form-label" htmlFor="password">
              Password
            </label>
            <div style={{ position: 'relative' }}>
              <input
                type={showPassword ? 'text' : 'password'}
                id="password"
                className="form-control"
                placeholder="Enter your password"
                required
                value={form.password}
                onChange={set('password')}
                style={{ paddingRight: 40 }}
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                tabIndex="-1"
                style={{
                  position: 'absolute',
                  right: 12,
                  top: '50%',
                  transform: 'translateY(-50%)',
                  background: 'transparent',
                  border: 'none',
                  color: 'var(--text-muted)',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center'
                }}
              >
                {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
              </button>
            </div>
          </div>

          <button
            type="submit"
            className="btn btn-primary"
            disabled={loading}
            style={{ justifyContent: 'center', gap: 8 }}
          >
            {loading ? (
              <>
                <div className="loading-spinner" style={{ width: 18, height: 18, borderWidth: 2 }} />
                <span>Signing In...</span>
              </>
            ) : (
              <>
                <span>Sign In to Dashboard</span>
                <ArrowRight size={18} />
              </>
            )}
          </button>
        </form>

        <div className="auth-links">
          <p>
            Don&apos;t have an account yet?{' '}
            <Link to="/register">Create an account</Link>
          </p>
        </div>
      </div>
    </div>
  );
}
