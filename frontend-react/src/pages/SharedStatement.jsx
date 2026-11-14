import { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { Shield, AlertCircle } from '../components/Icons.jsx';
import { fetchSharedStatement } from '../utils/archiveApi.js';
import { formatINR, formatDate } from '../utils/formatters.js';
import '../css/style.css';

// Public, read-only page opened by scanning the QR code of a shared monthly statement.
export default function SharedStatement() {
  const { token } = useParams();
  const [state, setState] = useState({ loading: true });

  useEffect(() => {
    document.title = 'Shared statement - RupeeRise';
    let cancelled = false;
    fetchSharedStatement(token)
      .then((data) => { if (!cancelled) setState({ loading: false, data }); })
      .catch(() => { if (!cancelled) setState({ loading: false, data: { status: 'error', message: 'Could not load this statement.' } }); });
    return () => { cancelled = true; };
  }, [token]);

  const data = state.data;
  const ok = data && data.status === 'ok';

  return (
    <div style={{ minHeight: '100vh', background: 'var(--bg-color)', padding: '24px 16px' }}>
      <div style={{ maxWidth: 720, margin: '0 auto' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 18 }}>
          <img src="/images/rupeerise-logo.png" alt="RupeeRise" style={{ width: 34, height: 34, borderRadius: 8 }} />
          <strong style={{ fontSize: '1.1rem' }}>RupeeRise</strong>
        </div>

        {state.loading ? (
          <div style={{ textAlign: 'center', padding: '60px 0' }}><div className="loading-spinner" style={{ margin: '0 auto' }} /></div>
        ) : !ok ? (
          <div className="glass-card" style={{ textAlign: 'center', padding: 32 }}>
            <AlertCircle size={36} color="var(--danger-color)" />
            <h2 style={{ fontSize: '1.2rem', margin: '12px 0 6px' }}>
              {data.status === 'expired' ? 'This link has expired' : 'Statement unavailable'}
            </h2>
            <p style={{ color: 'var(--text-muted)' }}>{data.message || 'This link is not valid.'}</p>
          </div>
        ) : (
          <>
            <div className="glass-card" style={{ marginBottom: 16 }}>
              <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: 6 }}>
                <Shield size={14} /> Read-only statement shared with you
              </div>
              <h1 style={{ fontSize: '1.5rem', fontWeight: 700, margin: '6px 0 14px' }}>{data.label}</h1>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: 12 }}>
                {[
                  ['Income', formatINR(data.salaryTotal), 'var(--success-color)'],
                  ['Expenses', formatINR(data.expenseTotal), 'var(--danger-color)'],
                  ['Balance', formatINR(data.balance), data.balance >= 0 ? 'var(--success-color)' : 'var(--danger-color)'],
                  ['Savings rate', data.savingsRate === null ? '-' : `${data.savingsRate}%`, 'inherit'],
                ].map(([k, v, color]) => (
                  <div key={k}>
                    <div style={{ fontSize: '0.72rem', textTransform: 'uppercase', letterSpacing: 0.4, color: 'var(--text-muted)' }}>{k}</div>
                    <div style={{ fontSize: '1.15rem', fontWeight: 700, color }}>{v}</div>
                  </div>
                ))}
              </div>
            </div>

            {data.categoryTotals.length > 0 && (
              <div className="glass-card" style={{ marginBottom: 16 }}>
                <h3 style={{ fontSize: '1.02rem', fontWeight: 600, marginBottom: 10 }}>Spending by category</h3>
                {data.categoryTotals.map((c) => (
                  <div key={c.category} style={{ display: 'flex', justifyContent: 'space-between', padding: '6px 0', borderBottom: '1px solid var(--border-color)', fontSize: '0.9rem' }}>
                    <span>{c.category} <span style={{ color: 'var(--text-muted)' }}>({c.count})</span></span>
                    <strong>{formatINR(c.total)}</strong>
                  </div>
                ))}
              </div>
            )}

            {data.includeDetails && (
              <div className="glass-card" style={{ marginBottom: 16 }}>
                <h3 style={{ fontSize: '1.02rem', fontWeight: 600, marginBottom: 10 }}>Transactions</h3>
                <div className="table-wrapper">
                  <table>
                    <thead><tr><th>Date</th><th>Category</th><th>Description</th><th style={{ textAlign: 'right' }}>Amount</th></tr></thead>
                    <tbody>
                      {data.expenses.map((e, i) => (
                        <tr key={i}>
                          <td>{formatDate(e.date)}</td>
                          <td>{e.category}</td>
                          <td>{e.description || '-'}</td>
                          <td style={{ textAlign: 'right', fontWeight: 600 }}>{formatINR(e.amount)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            <p style={{ textAlign: 'center', fontSize: '0.78rem', color: 'var(--text-muted)' }}>
              This link expires on {new Date(data.expiresAt).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}.
            </p>
          </>
        )}
      </div>
    </div>
  );
}
