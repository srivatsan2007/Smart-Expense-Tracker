import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import '../css/style.css';
import '../css/responsive.css';
import '../css/calculator.css';
import Calculator from '../components/Calculator.jsx';
import {
  Wallet,
  ArrowRight,
  Sparkles,
  Shield,
  IndianRupee,
  TrendingUp,
  FileText
} from '../components/Icons.jsx';

export default function Index() {
  const [splashHidden, setSplashHidden] = useState(false);
  const navigate = useNavigate();

  useEffect(() => {
    document.title = 'Smart Tracker — Modern Personal Finance Dashboard';
    const timer = setTimeout(() => setSplashHidden(true), 800);
    // Already logged in? go straight to the dashboard
    if (localStorage.getItem('token')) {
      navigate('/dashboard');
    }
    // Register Service Worker
    if ('serviceWorker' in navigator) {
      navigator.serviceWorker
        .register('/service-worker.js')
        .then(() => console.log('SW registered'))
        .catch((err) => console.error('SW reg error', err));
    }
    return () => clearTimeout(timer);
  }, [navigate]);

  return (
    <>
      <div id="splash-screen" className={splashHidden ? 'hidden' : undefined}>
        <div className="logo-anim">Smart Tracker</div>
      </div>

      <div
        style={{
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          minHeight: '100vh',
          padding: '40px 20px',
          background: 'var(--bg-main)',
          backgroundImage:
            'radial-gradient(at 15% 15%, rgba(71, 127, 224, 0.08) 0px, transparent 50%), radial-gradient(at 85% 85%, rgba(16, 185, 129, 0.06) 0px, transparent 50%)'
        }}
      >
        <div
          className="glass-card"
          style={{
            maxWidth: 680,
            width: '100%',
            textAlign: 'center',
            padding: '48px 36px',
            position: 'relative'
          }}
        >
          {/* RupeeRise Logo badge */}
          <div
            style={{
              width: 90,
              height: 90,
              borderRadius: 24,
              overflow: 'hidden',
              boxShadow: '0 12px 32px rgba(16, 185, 129, 0.22), 0 4px 12px rgba(0,0,0,0.08)',
              margin: '0 auto 18px auto',
              background: '#ffffff',
              padding: 6,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <img
              src="/images/rupeerise-logo.png"
              alt="RupeeRise Logo"
              style={{ width: '100%', height: '100%', objectFit: 'contain' }}
            />
          </div>

          <div
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: 6,
              padding: '6px 14px',
              borderRadius: 999,
              background: 'rgba(16, 185, 129, 0.1)',
              color: 'var(--success-color)',
              fontSize: '0.8rem',
              fontWeight: 600,
              marginBottom: 16
            }}
          >
            <Sparkles size={14} />
            <span>Track Smarter. Save Better. Rise Higher.</span>
          </div>

          <h1
            style={{
              fontSize: 'clamp(2rem, 5vw, 2.75rem)',
              fontWeight: 800,
              letterSpacing: '-0.03em',
              color: 'var(--text-color)',
              marginBottom: 16,
              lineHeight: 1.2
            }}
          >
            Master Your Money with <span style={{ color: 'var(--primary-color)' }}>Rupee</span><span style={{ color: 'var(--success-color)' }}>Rise</span>
          </h1>

          <p
            style={{
              fontSize: 'clamp(0.95rem, 2.5vw, 1.1rem)',
              color: 'var(--text-muted)',
              lineHeight: 1.6,
              maxWidth: 540,
              margin: '0 auto 28px auto'
            }}
          >
            Track daily expenses in Indian Rupees (₹), manage recurring bills, monitor monthly income, set savings milestones, and scan receipts with AI.
          </p>

          {/* Feature highlights */}
          <div
            style={{
              display: 'flex',
              flexWrap: 'wrap',
              gap: 10,
              justifyContent: 'center',
              marginBottom: 36
            }}
          >
            <span className="badge badge-default" style={{ padding: '6px 12px', fontSize: '0.82rem' }}>
              ₹ INR Native Currency
            </span>
            <span className="badge badge-default" style={{ padding: '6px 12px', fontSize: '0.82rem' }}>
              AI OCR Receipt Scanner
            </span>
            <span className="badge badge-default" style={{ padding: '6px 12px', fontSize: '0.82rem' }}>
              80% &amp; 100% Budget Alerts
            </span>
            <span className="badge badge-default" style={{ padding: '6px 12px', fontSize: '0.82rem' }}>
              Audit-Ready PDF Statements
            </span>
          </div>

          {/* CTA actions */}
          <div
            style={{
              display: 'flex',
              gap: 14,
              justifyContent: 'center',
              flexWrap: 'wrap'
            }}
          >
            <Link
              to="/login"
              className="btn btn-primary"
              style={{ padding: '12px 28px', fontSize: '0.98rem', gap: 8 }}
            >
              <span>Sign In to Dashboard</span>
              <ArrowRight size={18} />
            </Link>

            <Link
              to="/register"
              className="btn btn-secondary"
              style={{ padding: '12px 28px', fontSize: '0.98rem' }}
            >
              Create Free Account
            </Link>
          </div>
        </div>
      </div>

      <Calculator />
    </>
  );
}
