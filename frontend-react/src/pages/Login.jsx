import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import '../css/style.css';
import '../css/auth.css';
import { loginUser, autoDetectAndLogin, loginWithGoogle } from '../hooks/useAuth.js';
import { getBackendBaseUrl, setBackendBaseUrl } from '../utils/apiConfig.js';
import {
  Wallet,
  Lock,
  User,
  Eye,
  EyeOff,
  AlertCircle,
  ArrowRight,
  CheckCircle2,
  Sparkles
} from '../components/Icons.jsx';

export default function Login() {
  const [form, setForm] = useState({ loginId: '', password: '' });
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [googleLoading, setGoogleLoading] = useState(false);
  const [error, setError] = useState('');
  const [autoChecking, setAutoChecking] = useState(true);
  const [autoDetectedUser, setAutoDetectedUser] = useState(null);
  const [rememberedAccount, setRememberedAccount] = useState(null);
  const [showServerModal, setShowServerModal] = useState(false);
  const [serverUrlInput, setServerUrlInput] = useState('');
  const [testStatus, setTestStatus] = useState(null);
  const [testingServer, setTestingServer] = useState(false);
  const navigate = useNavigate();

  useEffect(() => {
    document.title = 'Login - RupeeRise';

    // 1. Check if token already present
    if (localStorage.getItem('token')) {
      navigate('/dashboard');
      return;
    }

    // 2. Check for remembered account to pre-fill
    const savedAccountStr = localStorage.getItem('remembered_account');
    if (savedAccountStr) {
      try {
        const saved = JSON.parse(savedAccountStr);
        setRememberedAccount(saved);
        if (saved.loginId || saved.email) {
          setForm(prev => ({ ...prev, loginId: saved.loginId || saved.email }));
        }
      } catch (e) {
        console.warn('Could not parse remembered account', e);
      }
    }

    // 3. Automatic Account Detection: Seamlessly check Firebase Auth active session
    let isMounted = true;
    autoDetectAndLogin().then((res) => {
      if (!isMounted) return;
      if (res && res.success) {
        setAutoDetectedUser(res.profile || res.user);
        setTimeout(() => {
          if (isMounted) navigate('/dashboard');
        }, 800);
      } else {
        setAutoChecking(false);
      }
    }).catch(() => {
      if (isMounted) setAutoChecking(false);
    });

    return () => {
      isMounted = false;
    };
  }, [navigate]);

  const set = (k) => (e) => setForm({ ...form, [k]: e.target.value });

  const submit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      await loginUser(form.loginId.trim(), form.password);
      navigate('/dashboard');
    } catch (err) {
      setError(err.message || 'Login failed, please check your credentials.');
    } finally {
      setLoading(false);
    }
  };

  const handleGoogleSignIn = async () => {
    setError('');
    setGoogleLoading(true);
    try {
      await loginWithGoogle();
      navigate('/dashboard');
    } catch (err) {
      if (err.code !== 'auth/popup-closed-by-user') {
        setError(err.message || 'Google Sign-In failed. Please try again or use email/password.');
      }
    } finally {
      setGoogleLoading(false);
    }
  };

  const openServerModal = () => {
    setServerUrlInput(getBackendBaseUrl() || 'https://smart-expense-tracker-1-g5b4.onrender.com');
    setTestStatus(null);
    setShowServerModal(true);
  };

  const handleTestServer = async () => {
    setTestingServer(true);
    setTestStatus(null);
    const target = (serverUrlInput || '').trim().replace(/\/+$/, '');
    if (!target) {
      setTestStatus({ type: 'error', message: 'Please enter a server URL' });
      setTestingServer(false);
      return;
    }
    try {
      const res = await fetch(`${target}/api/auth/profile`);
      if (res.status === 401 || res.ok) {
        setTestStatus({ type: 'success', message: '✅ Server reachable & responding!' });
      } else {
        setTestStatus({ type: 'warning', message: `Server responded with HTTP ${res.status}` });
      }
    } catch {
      setTestStatus({
        type: 'error',
        message: '❌ Could not reach server. Verify PC & phone are on the same Wi-Fi, or check IP.'
      });
    } finally {
      setTestingServer(false);
    }
  };

  const handleSaveServer = () => {
    setBackendBaseUrl(serverUrlInput);
    setShowServerModal(false);
    setError('');
  };

  // If active user is auto-detected, show smooth instant login indicator
  if (autoDetectedUser) {
    return (
      <div className="auth-container">
        <div className="auth-card" style={{ textAlign: 'center', padding: '48px 24px' }}>
          <div
            style={{
              width: 68,
              height: 68,
              borderRadius: '50%',
              background: 'linear-gradient(135deg, #355E3B 0%, #3D8B50 100%)',
              color: '#ffffff',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              margin: '0 auto 16px auto',
              boxShadow: '0 8px 24px rgba(53, 94, 59, 0.25)'
            }}
          >
            <CheckCircle2 size={36} color="#ffffff" />
          </div>
          <h2 style={{ fontSize: '1.4rem', fontWeight: 800, margin: '0 0 6px 0', color: 'var(--color-forest, #1F3328)' }}>
            Welcome Back!
          </h2>
          <p style={{ color: 'var(--color-primary, #355E3B)', fontWeight: 600, fontSize: '0.95rem', margin: '0 0 16px 0' }}>
            Account detected: {autoDetectedUser.name || autoDetectedUser.email}
          </p>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 10, color: 'var(--text-muted)' }}>
            <div className="loading-spinner" style={{ width: 18, height: 18, borderWidth: 2 }} />
            <span style={{ fontSize: '0.85rem' }}>Logging you in automatically...</span>
          </div>
        </div>
      </div>
    );
  }

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
              boxShadow: '0 8px 24px rgba(53, 94, 59, 0.2)',
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
          <h2 style={{ fontSize: '1.6rem', fontWeight: 800, margin: 0, color: 'var(--color-forest)' }}>
            Rupee<span style={{ color: 'var(--color-primary)' }}>Rise</span>
          </h2>
          <p style={{ margin: '4px 0 0 0', color: 'var(--text-muted)', fontSize: '0.85rem' }}>
            Track Smarter. Save Better. Rise Higher.
          </p>
        </div>

        {/* Auto-detected remembered account banner */}
        {rememberedAccount && !autoChecking && (
          <div
            style={{
              padding: '10px 14px',
              borderRadius: 12,
              background: 'rgba(53, 94, 59, 0.08)',
              border: '1px solid rgba(53, 94, 59, 0.2)',
              marginBottom: 16,
              display: 'flex',
              alignItems: 'center',
              gap: 12
            }}
          >
            <div
              style={{
                width: 38,
                height: 38,
                borderRadius: '50%',
                background: 'var(--color-primary, #355E3B)',
                color: '#ffffff',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontWeight: 700,
                fontSize: '1rem',
                flexShrink: 0
              }}
            >
              {rememberedAccount.name ? rememberedAccount.name.charAt(0).toUpperCase() : 'U'}
            </div>
            <div style={{ flex: 1, textAlign: 'left', minWidth: 0 }}>
              <div style={{ fontSize: '0.86rem', fontWeight: 600, color: 'var(--color-forest, #1F3328)' }}>
                {rememberedAccount.name || 'Saved Account'}
              </div>
              <div
                style={{
                  fontSize: '0.74rem',
                  color: 'var(--text-muted, #5f7566)',
                  textOverflow: 'ellipsis',
                  overflow: 'hidden',
                  whiteSpace: 'nowrap'
                }}
              >
                {rememberedAccount.email || rememberedAccount.loginId}
              </div>
            </div>
            <span
              className="badge badge-success"
              style={{ fontSize: '0.68rem', padding: '3px 8px', borderRadius: 999 }}
            >
              Auto-Detected
            </span>
          </div>
        )}

        {/* Google 1-Click Auto Account Sign-In Button */}
        <button
          type="button"
          className="btn btn-secondary"
          disabled={googleLoading || loading}
          onClick={handleGoogleSignIn}
          style={{
            width: '100%',
            justifyContent: 'center',
            gap: 10,
            background: '#ffffff',
            border: '1px solid var(--border-color, #d1e2cb)',
            color: 'var(--color-forest, #1F3328)',
            fontSize: '0.88rem',
            fontWeight: 600,
            padding: '11px 16px',
            borderRadius: 12,
            boxShadow: '0 2px 8px rgba(0,0,0,0.04)',
            marginBottom: 16
          }}
        >
          {googleLoading ? (
            <>
              <div className="loading-spinner" style={{ width: 16, height: 16, borderWidth: 2 }} />
              <span>Detecting Google Account...</span>
            </>
          ) : (
            <>
              <svg width="18" height="18" viewBox="0 0 24 24">
                <path fill="#4285F4" d="M23.745 12.27c0-.7-.06-1.4-.19-2.07H12v4.51h6.6c-.29 1.52-1.14 2.8-2.4 3.66v3.05h3.88c2.27-2.09 3.665-5.17 3.665-9.15z"/>
                <path fill="#34A853" d="M12 24c3.24 0 5.95-1.08 7.93-2.91l-3.88-3.05c-1.08.72-2.45 1.16-4.05 1.16-3.12 0-5.77-2.1-6.72-4.93H1.24v3.15C3.26 21.36 7.33 24 12 24z"/>
                <path fill="#FBBC05" d="M5.28 14.27c-.25-.72-.38-1.49-.38-2.27s.13-1.55.38-2.27V6.58H1.24C.45 8.16 0 9.98 0 12s.45 3.84 1.24 5.42l4.04-3.15z"/>
                <path fill="#EA4335" d="M12 4.75c1.77 0 3.35.61 4.6 1.8l3.42-3.42C17.95 1.19 15.24 0 12 0 7.33 0 3.26 2.64 1.24 6.58l4.04 3.15c.95-2.83 3.6-4.98 6.72-4.98z"/>
              </svg>
              <span>Auto Sign In with Google</span>
            </>
          )}
        </button>

        <div style={{ display: 'flex', alignItems: 'center', margin: '0 0 16px 0', gap: 10 }}>
          <div style={{ flex: 1, height: 1, background: 'var(--border-color, #d1e2cb)' }} />
          <span style={{ fontSize: '0.72rem', color: 'var(--text-muted, #5f7566)', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
            or with credentials
          </span>
          <div style={{ flex: 1, height: 1, background: 'var(--border-color, #d1e2cb)' }} />
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
                autoFocus={!rememberedAccount}
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
                autoFocus={Boolean(rememberedAccount)}
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
            disabled={loading || googleLoading}
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

        <div style={{ marginTop: 14, textAlign: 'center' }}>
          <button
            type="button"
            onClick={openServerModal}
            style={{
              background: 'rgba(53, 94, 59, 0.08)',
              border: '1px solid rgba(53, 94, 59, 0.2)',
              color: 'var(--color-primary, #355E3B)',
              fontSize: '0.82rem',
              fontWeight: 600,
              padding: '6px 14px',
              borderRadius: 20,
              cursor: 'pointer',
              display: 'inline-flex',
              alignItems: 'center',
              gap: 6
            }}
          >
            <span>⚙️ Server Connection</span>
          </button>
        </div>

        {/* Server Connection Modal */}
        {showServerModal && (
          <div
            style={{
              position: 'fixed',
              top: 0,
              left: 0,
              right: 0,
              bottom: 0,
              background: 'rgba(0, 0, 0, 0.55)',
              backdropFilter: 'blur(4px)',
              zIndex: 9999,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              padding: 16
            }}
          >
            <div
              style={{
                background: '#ffffff',
                borderRadius: 16,
                padding: '24px 20px',
                width: '100%',
                maxWidth: 420,
                boxShadow: '0 20px 40px rgba(0,0,0,0.25)',
                position: 'relative'
              }}
            >
              <h3 style={{ margin: '0 0 6px 0', fontSize: '1.2rem', color: '#1F3328', fontWeight: 800 }}>
                ⚙️ Backend Server
              </h3>
              <p style={{ margin: '0 0 16px 0', fontSize: '0.85rem', color: '#556B5D', lineHeight: 1.4 }}>
                Enter the URL where your Node.js backend is running. For local Wi-Fi testing, use your PC&apos;s IP. For production, use your Render/Cloud URL.
              </p>

              <div style={{ marginBottom: 14 }}>
                <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 700, marginBottom: 6, color: '#355E3B' }}>
                  Backend Server URL
                </label>
                <input
                  type="text"
                  value={serverUrlInput}
                  onChange={(e) => setServerUrlInput(e.target.value)}
                  placeholder="e.g. https://smart-expense-tracker-1-g5b4.onrender.com"
                  style={{
                    width: '100%',
                    padding: '10px 12px',
                    borderRadius: 8,
                    border: '1.5px solid #C4D7C2',
                    fontSize: '0.9rem',
                    outline: 'none',
                    boxSizing: 'border-box'
                  }}
                />
              </div>

              {testStatus && (
                <div
                  style={{
                    padding: '8px 12px',
                    borderRadius: 8,
                    fontSize: '0.82rem',
                    marginBottom: 14,
                    background: testStatus.type === 'success' ? '#EAF8DE' : '#FDE8E8',
                    color: testStatus.type === 'success' ? '#1F6B2C' : '#991B1B',
                    border: `1px solid ${testStatus.type === 'success' ? '#B8E6A6' : '#FCA5A5'}`
                  }}
                >
                  {testStatus.message}
                </div>
              )}

              <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end', marginTop: 18 }}>
                <button
                  type="button"
                  onClick={handleTestServer}
                  disabled={testingServer}
                  style={{
                    padding: '8px 14px',
                    borderRadius: 8,
                    border: '1px solid #C4D7C2',
                    background: '#F4FBF1',
                    color: '#355E3B',
                    fontWeight: 600,
                    fontSize: '0.85rem',
                    cursor: 'pointer'
                  }}
                >
                  {testingServer ? 'Testing...' : 'Test Connection'}
                </button>
                <button
                  type="button"
                  onClick={() => setShowServerModal(false)}
                  style={{
                    padding: '8px 14px',
                    borderRadius: 8,
                    border: '1px solid #D0D0D0',
                    background: '#FFFFFF',
                    color: '#555',
                    fontSize: '0.85rem',
                    cursor: 'pointer'
                  }}
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={handleSaveServer}
                  style={{
                    padding: '8px 16px',
                    borderRadius: 8,
                    border: 'none',
                    background: '#355E3B',
                    color: '#FFFFFF',
                    fontWeight: 700,
                    fontSize: '0.85rem',
                    cursor: 'pointer'
                  }}
                >
                  Save & Connect
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
