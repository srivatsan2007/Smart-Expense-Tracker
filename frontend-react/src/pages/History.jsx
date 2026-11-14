import { useEffect, useState, useCallback } from 'react';
import QRCode from 'qrcode';
import Layout from '../components/Layout.jsx';
import PageHeader from '../components/PageHeader.jsx';
import StatCard from '../components/StatCard.jsx';
import Modal from '../components/Modal.jsx';
import EmptyState from '../components/EmptyState.jsx';
import { notify } from '../components/Toast.jsx';
import { formatINR, formatDate, CATEGORY_COLORS } from '../utils/formatters.js';
import {
  fetchArchives, fetchArchive, downloadArchiveFile,
  createShare, fetchShares, revokeShare, buildShareUrl,
} from '../utils/archiveApi.js';
import {
  Archive, Wallet, Receipt, TrendingUp, PiggyBank, Download, FileText,
  FileSpreadsheet, QrCode, Share2, Copy, Trash2, Info,
} from '../components/Icons.jsx';

const EXPIRY_OPTIONS = [
  { days: 1, label: '24 hours' },
  { days: 7, label: '7 days' },
  { days: 30, label: '30 days' },
];

const fmtDateTime = (iso) =>
  new Date(iso).toLocaleString('en-IN', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' });

/* ------------------------------------------------------------------ Share (QR) dialog */
function ShareModal({ isOpen, onClose, archiveKey, label }) {
  const [days, setDays] = useState(7);
  const [includeDetails, setIncludeDetails] = useState(false);
  const [creating, setCreating] = useState(false);
  const [shares, setShares] = useState([]);
  const [active, setActive] = useState(null); // { token, expiresAt, includeDetails }
  const [qr, setQr] = useState('');
  const [copied, setCopied] = useState(false);

  const loadShares = useCallback(async () => {
    try {
      setShares(await fetchShares(archiveKey));
    } catch {
      setShares([]);
    }
  }, [archiveKey]);

  useEffect(() => {
    if (!isOpen) return;
    setActive(null);
    setQr('');
    setCopied(false);
    loadShares();
  }, [isOpen, loadShares]);

  useEffect(() => {
    if (!active) { setQr(''); return; }
    QRCode.toDataURL(buildShareUrl(active.token), { width: 300, margin: 2, errorCorrectionLevel: 'M' })
      .then(setQr)
      .catch(() => notify('Could not draw the QR code', 'error'));
  }, [active]);

  const handleCreate = async () => {
    setCreating(true);
    try {
      const share = await createShare(archiveKey, { days, includeDetails });
      setActive(share);
      loadShares();
    } catch (err) {
      notify(err.message || 'Could not create the share link', 'error');
    } finally {
      setCreating(false);
    }
  };

  const handleRevoke = async (token) => {
    try {
      await revokeShare(archiveKey, token);
      if (active && active.token === token) setActive(null);
      notify('Link revoked. The QR code no longer works.');
      loadShares();
    } catch (err) {
      notify(err.message || 'Could not revoke the link', 'error');
    }
  };

  const url = active ? buildShareUrl(active.token) : '';

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      notify('Copy failed. Select the link and copy it manually.', 'warning');
    }
  };

  const handleNativeShare = async () => {
    try {
      await navigator.share({ title: `RupeeRise - ${label}`, text: `My ${label} statement`, url });
    } catch { /* user cancelled */ }
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} title={`Share ${label}`} maxWidth={460}>
      {!active ? (
        <>
          <div
            style={{
              display: 'flex', gap: 10, padding: 12, borderRadius: 10, marginBottom: 16,
              background: 'var(--warning-light)', border: '1px solid var(--warning-border)',
              fontSize: '0.82rem', color: 'var(--text-secondary)', lineHeight: 1.5,
            }}
          >
            <Info size={18} color="var(--warning-color)" style={{ flexShrink: 0, marginTop: 2 }} />
            <span>Anyone who scans the QR code can view this statement until the link expires. You can revoke a link at any time.</span>
          </div>

          <div className="form-group">
            <label className="form-label">Link expires after</label>
            <select className="form-control" value={days} onChange={(e) => setDays(Number(e.target.value))}>
              {EXPIRY_OPTIONS.map((o) => <option key={o.days} value={o.days}>{o.label}</option>)}
            </select>
          </div>

          <label style={{ display: 'flex', gap: 10, alignItems: 'flex-start', cursor: 'pointer', marginBottom: 20 }}>
            <input
              type="checkbox"
              checked={includeDetails}
              onChange={(e) => setIncludeDetails(e.target.checked)}
              style={{ marginTop: 4 }}
            />
            <span style={{ fontSize: '0.88rem' }}>
              Include every transaction
              <span style={{ display: 'block', fontSize: '0.78rem', color: 'var(--text-muted)' }}>
                Off = only totals and category breakdown are shared.
              </span>
            </span>
          </label>

          <button type="button" className="btn btn-primary" style={{ width: '100%' }} onClick={handleCreate} disabled={creating}>
            <QrCode size={18} />
            <span>{creating ? 'Creating...' : 'Generate QR code'}</span>
          </button>
        </>
      ) : (
        <div style={{ textAlign: 'center' }}>
          {qr ? (
            <img src={qr} alt={`QR code for ${label}`} width={260} height={260} style={{ borderRadius: 12, border: '1px solid var(--border-color)', background: '#fff' }} />
          ) : (
            <div className="loading-spinner" style={{ margin: '40px auto' }} />
          )}
          <p style={{ fontSize: '0.82rem', color: 'var(--text-muted)', margin: '10px 0 14px' }}>
            Scan to view. Expires {fmtDateTime(active.expiresAt)}.
            {active.includeDetails ? ' Includes all transactions.' : ' Totals only.'}
          </p>

          <input className="form-control" readOnly value={url} onFocus={(e) => e.target.select()} style={{ fontSize: '0.78rem', marginBottom: 12 }} />

          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            <button type="button" className="btn btn-secondary" style={{ flex: 1 }} onClick={handleCopy}>
              <Copy size={16} /><span>{copied ? 'Copied!' : 'Copy link'}</span>
            </button>
            {qr && (
              <a className="btn btn-secondary" style={{ flex: 1, textDecoration: 'none' }} href={qr} download={`RupeeRise_${archiveKey}_QR.png`}>
                <Download size={16} /><span>Save QR</span>
              </a>
            )}
            {typeof navigator !== 'undefined' && navigator.share && (
              <button type="button" className="btn btn-primary" style={{ flex: 1 }} onClick={handleNativeShare}>
                <Share2 size={16} /><span>Share</span>
              </button>
            )}
          </div>
          <button type="button" className="btn btn-secondary" style={{ width: '100%', marginTop: 10 }} onClick={() => setActive(null)}>
            Back
          </button>
        </div>
      )}

      {shares.length > 0 && (
        <div style={{ marginTop: 22, borderTop: '1px solid var(--border-color)', paddingTop: 14 }}>
          <div style={{ fontSize: '0.78rem', fontWeight: 600, textTransform: 'uppercase', letterSpacing: 0.4, color: 'var(--text-muted)', marginBottom: 8 }}>
            Active links
          </div>
          {shares.map((s) => (
            <div key={s.token} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '8px 0', fontSize: '0.82rem' }}>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div>Expires {fmtDateTime(s.expiresAt)}</div>
                <div style={{ color: 'var(--text-muted)', fontSize: '0.75rem' }}>{s.includeDetails ? 'With transactions' : 'Totals only'}</div>
              </div>
              <button type="button" className="btn btn-secondary btn-icon" title="Show QR" onClick={() => setActive(s)}>
                <QrCode size={16} />
              </button>
              <button
                type="button" className="btn btn-secondary btn-icon" title="Revoke link"
                style={{ color: 'var(--danger-color)' }} onClick={() => handleRevoke(s.token)}
              >
                <Trash2 size={16} />
              </button>
            </div>
          ))}
        </div>
      )}
    </Modal>
  );
}

/* ------------------------------------------------------------------ Page */
export default function History() {
  const [archives, setArchives] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedKey, setSelectedKey] = useState(null);
  const [detail, setDetail] = useState(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [busy, setBusy] = useState(''); // 'pdf' | 'excel' | ''
  const [shareOpen, setShareOpen] = useState(false);

  useEffect(() => {
    (async () => {
      try {
        const list = await fetchArchives();
        setArchives(list);
        if (list.length > 0) setSelectedKey(list[0].key);
      } catch (err) {
        notify(err.message || 'Failed to load monthly history', 'error');
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  useEffect(() => {
    if (!selectedKey) { setDetail(null); return; }
    let cancelled = false;
    setDetailLoading(true);
    fetchArchive(selectedKey)
      .then((d) => { if (!cancelled) setDetail(d); })
      .catch((err) => { if (!cancelled) notify(err.message || 'Failed to load this month', 'error'); })
      .finally(() => { if (!cancelled) setDetailLoading(false); });
    return () => { cancelled = true; };
  }, [selectedKey]);

  const handleDownload = async (type) => {
    setBusy(type);
    try {
      await downloadArchiveFile(selectedKey, type);
      notify(type === 'pdf' ? 'PDF downloaded' : 'Excel file downloaded');
    } catch (err) {
      notify(err.message || 'Download failed', 'error');
    } finally {
      setBusy('');
    }
  };

  const maxCat = detail && detail.categoryTotals.length ? detail.categoryTotals[0].total : 0;

  return (
    <Layout title="Monthly History - RupeeRise" active="history">
      <PageHeader
        title="Monthly History"
        subtitle="Salary and expenses reset on the 1st of every month. Past months are kept here."
      />

      {loading ? (
        <div style={{ textAlign: 'center', padding: '60px 0', color: 'var(--text-muted)' }}>
          <div className="loading-spinner" style={{ margin: '0 auto 12px auto' }} />
          <p>Loading history...</p>
        </div>
      ) : archives.length === 0 ? (
        <div className="glass-card">
          <EmptyState
            icon={<Archive size={36} />}
            title="No past months yet"
            description="Your current month's salary and expenses are on the Dashboard. When the month ends they move here automatically, with PDF, Excel and QR sharing."
          />
        </div>
      ) : (
        <>
          {/* Month picker */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(210px, 1fr))', gap: 12, marginBottom: 24 }}>
            {archives.map((a) => {
              const selected = a.key === selectedKey;
              return (
                <button
                  key={a.key}
                  type="button"
                  onClick={() => setSelectedKey(a.key)}
                  className="glass-card"
                  style={{
                    textAlign: 'left', cursor: 'pointer', padding: 16, font: 'inherit', color: 'inherit',
                    border: selected ? '2px solid var(--primary-color)' : '1px solid var(--border-color)',
                    background: selected ? 'var(--primary-light)' : 'var(--card-bg)',
                  }}
                >
                  <div style={{ fontWeight: 700, marginBottom: 8 }}>{a.label}</div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                    <span>Income</span><span style={{ color: 'var(--success-color)', fontWeight: 600 }}>{formatINR(a.salaryTotal)}</span>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                    <span>Spent</span><span style={{ color: 'var(--danger-color)', fontWeight: 600 }}>{formatINR(a.expenseTotal)}</span>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.8rem', marginTop: 4, paddingTop: 4, borderTop: '1px dashed var(--border-color)' }}>
                    <span style={{ color: 'var(--text-muted)' }}>Balance</span>
                    <span style={{ fontWeight: 700, color: a.balance >= 0 ? 'var(--success-color)' : 'var(--danger-color)' }}>{formatINR(a.balance)}</span>
                  </div>
                </button>
              );
            })}
          </div>

          {/* Selected month */}
          {detailLoading || !detail ? (
            <div style={{ textAlign: 'center', padding: '40px 0' }}><div className="loading-spinner" style={{ margin: '0 auto' }} /></div>
          ) : (
            <>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 12, marginBottom: 16 }}>
                <h2 style={{ fontSize: '1.3rem', fontWeight: 700 }}>{detail.label}</h2>
                <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                  <button type="button" className="btn btn-secondary" onClick={() => handleDownload('pdf')} disabled={!!busy}>
                    <FileText size={16} /><span>{busy === 'pdf' ? 'Preparing...' : 'PDF'}</span>
                  </button>
                  <button type="button" className="btn btn-secondary" onClick={() => handleDownload('excel')} disabled={!!busy}>
                    <FileSpreadsheet size={16} /><span>{busy === 'excel' ? 'Preparing...' : 'Excel'}</span>
                  </button>
                  <button type="button" className="btn btn-primary" onClick={() => setShareOpen(true)}>
                    <QrCode size={16} /><span>Share via QR</span>
                  </button>
                </div>
              </div>

              <div className="stats-grid">
                <StatCard label="Income" value={formatINR(detail.salaryTotal)} sub={`${detail.salaryCount} ${detail.salaryCount === 1 ? 'entry' : 'entries'}`} icon={<Wallet size={22} />} badge="Salary" variant="success" />
                <StatCard label="Expenses" value={formatINR(detail.expenseTotal)} sub={`${detail.expenseCount} transactions`} icon={<Receipt size={22} />} badge="Spent" variant="danger" />
                <StatCard label="Balance" value={formatINR(detail.balance)} sub="Income minus expenses" icon={<TrendingUp size={22} />} badge="Net" variant={detail.balance >= 0 ? 'primary' : 'danger'} />
                <StatCard label="Savings rate" value={detail.savingsRate === null ? '-' : `${detail.savingsRate}%`} sub={detail.savingsRate === null ? 'No income recorded' : 'Of income saved'} icon={<PiggyBank size={22} />} badge="Saved" variant="default" />
              </div>

              {detail.categoryTotals.length > 0 && (
                <div className="glass-card" style={{ marginTop: 24 }}>
                  <h3 style={{ fontSize: '1.05rem', fontWeight: 600, marginBottom: 14 }}>Spending by category</h3>
                  {detail.categoryTotals.map((c) => (
                    <div key={c.category} style={{ marginBottom: 12 }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.88rem', marginBottom: 4 }}>
                        <span>{c.category} <span style={{ color: 'var(--text-muted)' }}>({c.count})</span></span>
                        <strong>{formatINR(c.total)}</strong>
                      </div>
                      <div style={{ height: 8, borderRadius: 6, background: 'var(--primary-light)', overflow: 'hidden' }}>
                        <div style={{ width: `${maxCat ? (c.total / maxCat) * 100 : 0}%`, height: '100%', background: CATEGORY_COLORS[c.category] || '#64748B', borderRadius: 6 }} />
                      </div>
                    </div>
                  ))}
                </div>
              )}

              <div className="glass-card" style={{ marginTop: 24 }}>
                <h3 style={{ fontSize: '1.05rem', fontWeight: 600, marginBottom: 14 }}>Income</h3>
                {detail.salaries.length === 0 ? (
                  <p style={{ color: 'var(--text-muted)', fontSize: '0.9rem' }}>No income was recorded this month.</p>
                ) : (
                  <div className="table-wrapper">
                    <table>
                      <thead><tr><th>Period</th><th style={{ textAlign: 'right' }}>Amount</th></tr></thead>
                      <tbody>
                        {detail.salaries.map((s) => (
                          <tr key={s.id}>
                            <td>{s.month} {s.year}</td>
                            <td style={{ textAlign: 'right', fontWeight: 700, color: 'var(--success-color)' }}>+{formatINR(s.amount)}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>

              <div className="glass-card" style={{ marginTop: 24 }}>
                <h3 style={{ fontSize: '1.05rem', fontWeight: 600, marginBottom: 14 }}>Expenses</h3>
                {detail.expenses.length === 0 ? (
                  <p style={{ color: 'var(--text-muted)', fontSize: '0.9rem' }}>No expenses were recorded this month.</p>
                ) : (
                  <div className="table-wrapper">
                    <table>
                      <thead>
                        <tr><th>Date</th><th>Category</th><th>Description</th><th>Method</th><th style={{ textAlign: 'right' }}>Amount</th></tr>
                      </thead>
                      <tbody>
                        {detail.expenses.map((e) => (
                          <tr key={e.id}>
                            <td>{formatDate(e.date)}</td>
                            <td><span className="badge badge-default">{e.category}</span></td>
                            <td>{e.description || '-'}</td>
                            <td>{e.paymentMethod || '-'}</td>
                            <td style={{ textAlign: 'right', fontWeight: 700 }}>{formatINR(e.amount)}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>

              <ShareModal isOpen={shareOpen} onClose={() => setShareOpen(false)} archiveKey={detail.key} label={detail.label} />
            </>
          )}
        </>
      )}
    </Layout>
  );
}
