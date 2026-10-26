import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import '../css/style.css';
import '../css/auth.css';
import { registerUser } from '../hooks/useAuth.js';
import {
  Wallet,
  Lock,
  User,
  Mail,
  Phone,
  Eye,
  EyeOff,
  Shield,
  AlertCircle,
  ArrowRight
} from '../components/Icons.jsx';

export default function Register() {
  const [form, setForm] = useState({
    name: '',
    email: '',
    mobileNumber: '',
    password: '',
    role: 'user'
  });
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const navigate = useNavigate();

  useEffect(() => {
    document.title = 'Register - RupeeRise';
    if (localStorage.getItem('token')) {
      navigate('/dashboard');
    }
  }, [navigate]);

  const set = (k) => (e) => setForm({ ...form, [k]: e.target.value });

  const submit = async (e) => {
    e.preventDefault();
    setError('');

    if (form.password.length < 6) {
      setError('Password must be at least 6 characters long.');
      return;
    }

    setLoading(true);
    try {
      await registerUser(
        form.name.trim(),
        form.email.trim(),
        form.mobileNumber.trim(),
        form.password
      );
      navigate('/dashboard');
    } catch (err) {
      setError(err.message || 'Registration failed, please try again.');
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
            <label className="form-label">Full Name</label>
            <input
              type="text"
              className="form-control"
              placeholder="e.g. Rahul Sharma"
              required
              value={form.name}
              onChange={set('name')}
              autoFocus
            />
          </div>

          <div className="form-group">
            <label className="form-label">Email Address</label>
            <input
              type="email"
              className="form-control"
              placeholder="rahul@example.com"
              required
              value={form.email}
              onChange={set('email')}
            />
          </div>

          <div className="form-group">
            <label className="form-label">Mobile Number</label>
            <input
              type="tel"
              className="form-control"
              placeholder="9876543210"
              required
              value={form.mobileNumber}
              onChange={set('mobileNumber')}
            />
          </div>

          <div className="form-group">
            <label className="form-label">Password (Min. 6 characters)</label>
            <div style={{ position: 'relative' }}>
              <input
                type={showPassword ? 'text' : 'password'}
                className="form-control"
                placeholder="Choose a strong password"
                required
                minLength="6"
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
                <span>Creating Account...</span>
              </>
            ) : (
              <>
                <span>Complete Registration</span>
                <ArrowRight size={18} />
              </>
            )}
          </button>
        </form>

        <div className="auth-links">
          <p>
            Already have an account? <Link to="/login">Sign In</Link>
          </p>
        </div>
      </div>
    </div>
  );
}
