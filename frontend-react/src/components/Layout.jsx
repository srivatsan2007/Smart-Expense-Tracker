import { useEffect, useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { useRequireAuth, logoutUser } from '../hooks/useAuth.js';
import Calculator from './Calculator.jsx';
import ToastContainer from './Toast.jsx';
import {
  LayoutDashboard,
  Receipt,
  CalendarCheck,
  Wallet,
  Target,
  FileText,
  Settings as SettingsIcon,
  LogOut,
  Moon,
  Sun,
  Menu,
  X,
  User,
} from './Icons.jsx';
import '../css/style.css';
import '../css/dashboard.css';
import '../css/responsive.css';
import '../css/calculator.css';

const NAV_ITEMS = [
  { path: 'dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { path: 'expenses', label: 'Expenses', icon: Receipt },
  { path: 'bills', label: 'Bills', icon: CalendarCheck },
  { path: 'salary', label: 'Salary', icon: Wallet },
  { path: 'savings-goals', label: 'Savings Goals', icon: Target },
  { path: 'reports', label: 'Reports', icon: FileText },
  { path: 'settings', label: 'Settings', icon: SettingsIcon },
];

export default function Layout({ title, active, children }) {
  useRequireAuth();
  const location = useLocation();
  const navigate = useNavigate();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [dark, setDark] = useState(() => localStorage.getItem('theme') === 'dark');
  const user = JSON.parse(localStorage.getItem('user') || 'null');

  const currentPath = active || location.pathname.replace(/^\//, '').replace('.html', '') || 'dashboard';

  useEffect(() => {
    if (title) document.title = title;
  }, [title]);

  useEffect(() => {
    if (dark) {
      document.body.setAttribute('data-theme', 'dark');
    } else {
      document.body.removeAttribute('data-theme');
    }
    localStorage.setItem('theme', dark ? 'dark' : 'light');
  }, [dark]);

  // Close mobile drawer on route change
  useEffect(() => {
    setMobileMenuOpen(false);
  }, [location.pathname]);

  const initials = user?.name
    ? user.name.split(' ').map((n) => n[0]).join('').slice(0, 2).toUpperCase()
    : 'RR';

  return (
    <div className="app-container">
      {/* Mobile Hamburger Button */}
      <button
        className="mobile-menu-btn"
        onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
        aria-label="Toggle navigation menu"
      >
        {mobileMenuOpen ? <X size={22} /> : <Menu size={22} />}
      </button>

      {/* Sidebar Navigation */}
      <aside className={`sidebar${mobileMenuOpen ? ' active' : ''}`}>
        <Link to="/dashboard" className="sidebar-logo">
          <img
            src="/images/rupeerise-logo.png"
            alt="RupeeRise"
            style={{ width: 34, height: 34, borderRadius: 8, objectFit: 'contain' }}
          />
          <div style={{ display: 'flex', flexDirection: 'column' }}>
            <span style={{ fontWeight: 800, fontSize: '1.12rem', letterSpacing: '-0.02em', lineHeight: 1.1, color: '#FFFFFF' }}>
              Rupee<span style={{ color: 'var(--color-accent)' }}>Rise</span>
            </span>
            <span style={{ fontSize: '0.66rem', color: 'var(--sidebar-text-muted)', fontWeight: 500 }}>
              Track Smarter. Save Better.
            </span>
          </div>
        </Link>

        <ul className="nav-links">
          {NAV_ITEMS.map(({ path, label, icon: IconComponent }) => {
            const isActive = currentPath === path;
            return (
              <li key={path}>
                <Link to={`/${path}`} className={isActive ? 'active' : ''}>
                  <IconComponent size={19} />
                  <span>{label}</span>
                </Link>
              </li>
            );
          })}

          <li>
            <a
              href="#logout"
              onClick={(e) => {
                e.preventDefault();
                logoutUser(navigate);
              }}
            >
              <LogOut size={19} />
              <span>Logout</span>
            </a>
          </li>
        </ul>

        {/* User Profile Summary */}
        {user && (
          <div className="sidebar-user">
            <div
              style={{
                width: 34,
                height: 34,
                borderRadius: '50%',
                background: 'rgba(221, 242, 193, 0.18)',
                color: 'var(--color-accent)',
                border: '1px solid rgba(221, 242, 193, 0.3)',
                fontWeight: 700,
                fontSize: '0.8rem',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                flexShrink: 0,
              }}
            >
              {initials}
            </div>
            <div className="sidebar-user-info">
              <div className="sidebar-user-name">{user.name || 'User'}</div>
              <div className="sidebar-user-role">{user.email || 'Personal Account'}</div>
            </div>
          </div>
        )}

        {/* Dark Mode Switch */}
        <div className="theme-switch" onClick={() => setDark(!dark)}>
          <span style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            {dark ? <Sun size={17} /> : <Moon size={17} />}
            <span>{dark ? 'Light Theme' : 'Dark Theme'}</span>
          </span>
          <span
            style={{
              fontSize: '0.75rem',
              fontWeight: 600,
              color: '#FFFFFF',
              background: 'rgba(255, 255, 255, 0.12)',
              border: '1px solid rgba(255, 255, 255, 0.1)',
              padding: '2px 8px',
              borderRadius: 12,
            }}
          >
            {dark ? 'Dark' : 'Light'}
          </span>
        </div>
      </aside>

      {/* Backdrop overlay for mobile */}
      {mobileMenuOpen && (
        <div
          className="sidebar-overlay active"
          onClick={() => setMobileMenuOpen(false)}
        />
      )}

      {/* Main Page Area */}
      <main className="main-content">{children}</main>

      {/* Toast Notifications container */}
      <ToastContainer />

      {/* Financial Calculator Widget */}
      <Calculator />
    </div>
  );
}
