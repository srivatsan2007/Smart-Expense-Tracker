import { useEffect, useState } from 'react';
import { Link, useParams, useSearchParams } from 'react-router-dom';
import { Shield, CheckCircle2, AlertCircle, ArrowLeft } from '../components/Icons.jsx';
import { fetchVerification, certificateUrl } from '../utils/signing.js';
import '../css/style.css';

const inr = (n) =>
  new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 2 }).format(Number(n) || 0);

const STATUS_VIEW = {
  valid: {
    tone: 'ok',
    title: 'Authentic document',
    sub: 'The digital signature is valid and the record has not been altered.',
  },
  hash_mismatch: {
    tone: 'warn',
    title: 'Document may have been altered',
    sub: 'The record exists and is genuine, but the hash on your copy does not match it.',
  },
  tampered: {
    tone: 'bad',
    title: 'Verification failed',
    sub: 'The stored record does not match its digital signature.',
  },
  not_found: {
    tone: 'bad',
    title: 'Document not found',
    sub: 'No signed document with this ID exists. It may be forged.',
  },
};

const TONES = {
  ok: { color: 'var(--success-color, #10B981)', bg: 'rgba(16, 185, 129, 0.12)' },
  warn: { color: '#d97706', bg: 'rgba(217, 119, 6, 0.12)' },
  bad: { color: 'var(--danger-color, #ef4444)', bg: 'rgba(239, 68, 68, 0.12)' },
};

function Row({ label, value, mono }) {
  if (value === undefined || value === null || value === '') return null;
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 2, padding: '10px 0', borderBottom: '1px solid var(--border-color)' }}>
      <span style={{ fontSize: '0.72rem', textTransform: 'uppercase', letterSpacing: 0.4, color: 'var(--text-muted)' }}>{label}</span>
      <span
        style={{
          fontSize: mono ? '0.78rem' : '0.95rem',
          fontWeight: mono ? 400 : 600,
          fontFamily: mono ? 'ui-monospace, SFMono-Regular, Menlo, monospace' : 'inherit',
          wordBreak: 'break-all',
        }}
      >
        {value}
      </span>
    </div>
  );
}

export default function Verify() {
  const { docId } = useParams();
  const [params] = useSearchParams();
  const presentedHash = params.get('h') || '';

  const [state, setState] = useState({ loading: true, data: null, error: '' });
  const [typedAmount, setTypedAmount] = useState('');

  useEffect(() => {
    document.title = 'Verify Document - RupeeRise';
    let cancelled = false;
    setState({ loading: true, data: null, error: '' });
    fetchVerification(docId, presentedHash)
      .then((data) => {
        if (!cancelled) setState({ loading: false, data, error: '' });
      })
      .catch((err) => {
        if (!cancelled) setState({ loading: false, data: null, error: err.message || 'Could not reach the verification server.' });
      });
    return () => {
      cancelled = true;
    };
  }, [docId, presentedHash]);

  const { loading, data, error } = state;
  const view = data && STATUS_VIEW[data.status];
  const known = Boolean(view);
  const tone = TONES[known ? view.tone : 'bad'];
  const summary = data?.summary;

  let amountCheck = null;
  if (summary && typedAmount.trim() !== '') {
    const typed = Number(typedAmount.replace(/[₹,\s]/g, ''));
    if (!Number.isNaN(typed)) {
      amountCheck = Math.abs(typed - Number(summary.total)) < 0.005;
    }
  }

  const periodText =
    summary?.period && (summary.period.start || summary.period.end)
      ? `${summary.period.start || 'Beginning'} to ${summary.period.end || 'Today'}`
      : summary?.type === 'report'
      ? 'All time'
      : '';

  return (
    <div style={{ minHeight: '100vh', background: 'var(--bg-main)', padding: '30px 20px', display: 'flex', justifyContent: 'center' }}>
      <div style={{ width: '100%', maxWidth: 640 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 20 }}>
          <Link to="/" className="btn btn-secondary btn-icon" title="Home">
            <ArrowLeft size={18} />
          </Link>
          <div>
            <h2 style={{ fontSize: '1.35rem', fontWeight: 700, margin: 0 }}>Document Verification</h2>
            <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>RupeeRise digital signature check</span>
          </div>
        </div>

        {loading && (
          <div className="glass-card" style={{ textAlign: 'center', padding: '60px 20px' }}>
            <div className="loading-spinner" style={{ margin: '0 auto 16px auto' }} />
            <p style={{ color: 'var(--text-muted)' }}>Checking signature...</p>
          </div>
        )}

        {!loading && error && (
          <div className="glass-card" style={{ textAlign: 'center', padding: '40px 20px' }}>
            <AlertCircle size={34} color="var(--danger-color, #ef4444)" />
            <h3 style={{ margin: '12px 0 6px' }}>Could not verify</h3>
            <p style={{ color: 'var(--text-muted)', fontSize: '0.9rem' }}>{error}</p>
          </div>
        )}

        {!loading && !error && data && (
          <>
            <div className="glass-card" style={{ padding: 24, textAlign: 'center' }}>
              <div
                style={{
                  width: 64,
                  height: 64,
                  borderRadius: '50%',
                  background: tone.bg,
                  color: tone.color,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  margin: '0 auto 14px auto',
                }}
              >
                {data.status === 'valid' ? <CheckCircle2 size={34} /> : data.status === 'hash_mismatch' ? <Shield size={34} /> : <AlertCircle size={34} />}
              </div>
              <h3 style={{ fontSize: '1.2rem', fontWeight: 700, margin: '0 0 6px', color: tone.color }}>
                {known ? view.title : 'Verification unavailable'}
              </h3>
              <p style={{ color: 'var(--text-muted)', fontSize: '0.9rem', maxWidth: 440, margin: '0 auto' }}>
                {known ? view.sub : data.message || 'The verification service is not available right now.'}
              </p>
            </div>

            {data.found && summary && (
              <div className="glass-card" style={{ marginTop: 16, padding: '8px 20px 16px' }}>
                <Row label="Document type" value={summary.type === 'report' ? 'Expense statement' : 'Expense receipt'} />
                <Row label="Signed total" value={inr(summary.total)} />
                <Row label={summary.type === 'report' ? 'Transactions' : 'Items'} value={summary.count} />
                <Row label="Period" value={periodText} />
                <Row label="Receipt reference" value={summary.receiptId} />
                <Row label="Signed on" value={summary.issuedAt ? new Date(summary.issuedAt).toLocaleString('en-IN') : ''} />
                <Row label="Document ID" value={data.docId} mono />
                <Row label="Signature scheme" value={data.scheme} />
                <Row label={`Digest (${String(data.algorithm || '').toUpperCase()})`} value={data.hash} mono />
                <Row label="Certificate SHA-256 fingerprint" value={data.certFingerprint} mono />
                {presentedHash && (
                  <Row
                    label="Hash printed on your copy"
                    value={data.hashMatches ? 'Matches the signed record' : 'DOES NOT MATCH the signed record'}
                  />
                )}
              </div>
            )}

            {data.found && summary && (
              <div className="glass-card" style={{ marginTop: 16, padding: 20 }}>
                <h4 style={{ margin: '0 0 6px', fontSize: '0.95rem' }}>Compare with your copy</h4>
                <p style={{ margin: '0 0 12px', fontSize: '0.82rem', color: 'var(--text-muted)' }}>
                  Type the total printed on your document. It must equal the signed total above.
                </p>
                <input
                  type="text"
                  inputMode="decimal"
                  value={typedAmount}
                  onChange={(e) => setTypedAmount(e.target.value)}
                  placeholder="e.g. 1250.50"
                  className="form-control"
                  style={{ width: '100%' }}
                />
                {amountCheck !== null && (
                  <p style={{ marginTop: 10, fontWeight: 600, color: amountCheck ? TONES.ok.color : TONES.bad.color }}>
                    {amountCheck ? 'Matches the signed total.' : 'Does NOT match the signed total. Do not trust this document.'}
                  </p>
                )}
              </div>
            )}

            <p style={{ marginTop: 18, fontSize: '0.78rem', color: 'var(--text-muted)', textAlign: 'center', lineHeight: 1.6 }}>
              Signatures are created on the RupeeRise server with a private key that never leaves it. Anyone can check them with the
              public{' '}
              <a href={certificateUrl()} target="_blank" rel="noreferrer" style={{ color: 'inherit', textDecoration: 'underline' }}>
                X.509 certificate
              </a>
              .
            </p>
          </>
        )}
      </div>
    </div>
  );
}
