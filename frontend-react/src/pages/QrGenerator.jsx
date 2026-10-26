import { useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import firebase from 'firebase/compat/app';
import QRCode from 'qrcode';
import Layout from '../components/Layout.jsx';
import PageHeader from '../components/PageHeader.jsx';
import Modal from '../components/Modal.jsx';
import AtmSplitReceipt from '../components/AtmSplitReceipt.jsx';
import { notify } from '../components/Toast.jsx';
import {
  QrCode,
  Plus,
  Trash2,
  Download,
  Share2,
  CheckCircle2,
  ArrowLeft,
  IndianRupee,
  Receipt as ReceiptIcon,
  CreditCard
} from '../components/Icons.jsx';

const CATEGORIES = [
  ['Food', 'Food & Dining'],
  ['Transportation', 'Transportation'],
  ['Shopping', 'Shopping'],
  ['Housing', 'Housing / Rent'],
  ['Bills', 'Bills & Utilities'],
  ['Entertainment', 'Entertainment'],
  ['Other', 'Other']
];

let nextId = 1;
const newItem = () => ({ id: nextId++, amount: '', category: 'Food', description: '' });

export default function QrGenerator() {
  const canvasRef = useRef(null);
  const [items, setItems] = useState([newItem()]);
  const [generating, setGenerating] = useState(false);
  const [qrUrl, setQrUrl] = useState(null);
  const [saved, setSaved] = useState(false);
  const [showAtmModal, setShowAtmModal] = useState(false);

  const update = (id, key, value) =>
    setItems(items.map((it) => (it.id === id ? { ...it, [key]: value } : it)));

  const saveQRToFirebase = async (expenseData, receiptURL) => {
    try {
      await firebase.firestore().collection('qrShares').doc(expenseData.expenseId).set({
        userId: expenseData.userId,
        expenseId: expenseData.expenseId,
        items: expenseData.items,
        totalAmount: expenseData.totalAmount,
        receiptURL,
        qrGenerated: true,
        createdAt: firebase.firestore.FieldValue.serverTimestamp()
      });
      setSaved(true);
      setTimeout(() => setSaved(false), 4000);
    } catch (error) {
      console.error('Error saving to Firestore:', error);
      throw error;
    }
  };

  const generate = async (e) => {
    e.preventDefault();
    const user = firebase.auth().currentUser;
    if (!user) {
      notify('You must be logged in to generate a QR receipt', 'warning');
      return;
    }

    const valid = [];
    let totalAmount = 0;
    items.forEach((it) => {
      const amount = parseFloat(it.amount);
      if (amount && it.category && it.description) {
        valid.push({ amount, category: it.category, description: it.description });
        totalAmount += amount;
      }
    });

    if (valid.length === 0) {
      notify('Please enter at least one valid expense item', 'warning');
      return;
    }

    const expenseId = 'EXP' + Date.now();
    const expenseData = {
      expenseId,
      items: valid,
      totalAmount,
      date: new Date().toISOString(),
      userId: user.uid
    };

    setGenerating(true);
    try {
      const receiptURL = `${window.location.origin}/receipt?id=${expenseId}`;
      await saveQRToFirebase(expenseData, receiptURL);
      if (canvasRef.current) {
        QRCode.toCanvas(canvasRef.current, receiptURL, {
          width: 240,
          margin: 2,
          color: { dark: '#1e293b', light: '#ffffff' }
        });
      }
      setQrUrl(receiptURL);
      notify('Expense QR code & verified receipt generated!', 'success');
    } catch (err) {
      console.error('Error in QR generation flow:', err);
      notify('Failed to generate QR code and receipt', 'error');
    } finally {
      setGenerating(false);
    }
  };

  const downloadQR = () => {
    if (!qrUrl || !canvasRef.current) return;
    const link = document.createElement('a');
    link.download = `expense-qr-${Date.now()}.png`;
    link.href = canvasRef.current.toDataURL();
    link.click();
    notify('QR code image downloaded', 'success');
  };

  const shareQR = () => {
    if (!qrUrl || !canvasRef.current) return;
    canvasRef.current.toBlob(async (blob) => {
      try {
        const file = new File([blob], 'expense-qr.png', { type: 'image/png' });
        if (navigator.canShare && navigator.canShare({ files: [file] })) {
          await navigator.share({
            title: 'Split Expense Receipt',
            text: 'Scan this QR code to view the verified PDF receipt.',
            files: [file]
          });
        } else {
          notify('Native sharing not supported. Use the Download button instead.', 'info');
        }
      } catch (err) {
        console.error('Share failed:', err);
      }
    });
  };

  const totalCalc = items.reduce((sum, it) => sum + (parseFloat(it.amount) || 0), 0);

  return (
    <Layout title="Generate QR - RupeeRise" active="reports">
      <PageHeader
        title="Generate Expense QR Receipt"
        subtitle="Itemize shared expenses, generate live digital proofs, and share instantly"
        action={
          <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
            <button
              type="button"
              className="btn btn-primary"
              onClick={() => setShowAtmModal(true)}
              style={{
                background: 'linear-gradient(135deg, #1b2540 0%, #2a1f8f 60%, #5b4be0 100%)',
                borderColor: '#2a1f8f',
                gap: 8
              }}
            >
              <CreditCard size={18} />
              <span>ATM Split Machine</span>
            </button>
            <Link to="/reports" className="btn btn-secondary">
              <ArrowLeft size={16} />
              <span>Back to Reports</span>
            </Link>
          </div>
        }
      />

      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(340px, 1fr))',
          gap: 24,
          alignItems: 'start'
        }}
      >
        {/* Itemized Form */}
        <div className="glass-card">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 18 }}>
            <div>
              <h3 style={{ fontSize: '1.15rem', fontWeight: 600 }}>Itemized Items</h3>
              <p style={{ fontSize: '0.82rem', color: 'var(--text-muted)' }}>
                Add individual items for transparent group splitting
              </p>
            </div>
            {totalCalc > 0 && (
              <span className="badge badge-primary" style={{ fontSize: '0.88rem' }}>
                Total: ₹{totalCalc.toFixed(2)}
              </span>
            )}
          </div>

          <form onSubmit={generate}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
              {items.map((it, i) => (
                <div
                  key={it.id}
                  style={{
                    padding: 16,
                    background: 'var(--bg-main)',
                    borderRadius: 12,
                    border: '1px solid var(--border-color)',
                    position: 'relative'
                  }}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
                    <span style={{ fontSize: '0.8rem', fontWeight: 600, color: 'var(--text-muted)' }}>
                      Item #{i + 1}
                    </span>
                    {items.length > 1 && (
                      <button
                        type="button"
                        onClick={() => setItems(items.filter((x) => x.id !== it.id))}
                        className="btn btn-secondary btn-icon"
                        style={{ padding: 4, color: 'var(--danger-color)', borderColor: 'transparent', background: 'transparent' }}
                      >
                        <Trash2 size={15} />
                      </button>
                    )}
                  </div>

                  <div style={{ display: 'grid', gridTemplateColumns: '1.2fr 1.5fr', gap: 12, marginBottom: 12 }}>
                    <div className="form-group" style={{ marginBottom: 0 }}>
                      <label className="form-label">Amount (₹)</label>
                      <input
                        type="number"
                        className="form-control"
                        placeholder="500"
                        required
                        min="1"
                        step="0.01"
                        value={it.amount}
                        onChange={(e) => update(it.id, 'amount', e.target.value)}
                      />
                    </div>
                    <div className="form-group" style={{ marginBottom: 0 }}>
                      <label className="form-label">Category</label>
                      <select
                        className="form-control"
                        required
                        value={it.category}
                        onChange={(e) => update(it.id, 'category', e.target.value)}
                      >
                        {CATEGORIES.map(([v, l]) => (
                          <option key={v} value={v}>{l}</option>
                        ))}
                      </select>
                    </div>
                  </div>

                  <div className="form-group" style={{ marginBottom: 0 }}>
                    <label className="form-label">Description</label>
                    <input
                      type="text"
                      className="form-control"
                      placeholder="e.g. Dinner at Bistro, Uber Ride"
                      required
                      value={it.description}
                      onChange={(e) => update(it.id, 'description', e.target.value)}
                    />
                  </div>
                </div>
              ))}
            </div>

            <button
              type="button"
              className="btn btn-secondary"
              onClick={() => setItems([...items, newItem()])}
              style={{ width: '100%', margin: '16px 0', borderStyle: 'dashed', justifyContent: 'center', gap: 6 }}
            >
              <Plus size={16} />
              <span>Add Another Expense Item</span>
            </button>

            <button
              type="submit"
              className="btn btn-primary"
              disabled={generating}
              style={{ width: '100%', justifyContent: 'center', gap: 8 }}
            >
              {generating ? (
                <>
                  <div className="loading-spinner" style={{ width: 16, height: 16, borderWidth: 2 }} />
                  <span>Generating Verified Receipt...</span>
                </>
              ) : (
                <>
                  <QrCode size={18} />
                  <span>Generate QR Code &amp; Receipt</span>
                </>
              )}
            </button>
          </form>
        </div>

        {/* QR Code Output Box */}
        <div className="glass-card" style={{ textAlign: 'center', display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
          <h3 style={{ fontSize: '1.15rem', fontWeight: 600, marginBottom: 6 }}>
            Generated QR Code
          </h3>
          <p style={{ fontSize: '0.82rem', color: 'var(--text-muted)', marginBottom: 20 }}>
            Anyone scanning this code can inspect the tamper-proof PDF receipt
          </p>

          <div
            style={{
              padding: 16,
              background: '#ffffff',
              borderRadius: 16,
              border: '1px solid var(--border-color)',
              boxShadow: '0 4px 12px rgba(0,0,0,0.06)',
              display: 'inline-block'
            }}
          >
            <canvas ref={canvasRef} style={{ display: qrUrl ? 'block' : 'none' }} />
            {!qrUrl && (
              <div
                style={{
                  width: 240,
                  height: 240,
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  justifyContent: 'center',
                  color: 'var(--text-muted)',
                  gap: 8
                }}
              >
                <QrCode size={48} color="#cbd5e1" />
                <span style={{ fontSize: '0.85rem' }}>QR will appear here</span>
              </div>
            )}
          </div>

          {qrUrl && (
            <div style={{ display: 'flex', gap: 12, marginTop: 20, width: '100%', maxWidth: 300 }}>
              <button
                type="button"
                onClick={downloadQR}
                className="btn btn-primary"
                style={{ flex: 1, justifyContent: 'center', gap: 6 }}
              >
                <Download size={16} />
                <span>Download</span>
              </button>
              <button
                type="button"
                onClick={shareQR}
                className="btn btn-secondary"
                style={{ flex: 1, justifyContent: 'center', gap: 6 }}
              >
                <Share2 size={16} />
                <span>Share</span>
              </button>
            </div>
          )}

          {saved && (
            <div
              style={{
                marginTop: 16,
                padding: '8px 16px',
                borderRadius: 8,
                background: 'rgba(16, 185, 129, 0.1)',
                color: 'var(--success-color)',
                display: 'inline-flex',
                alignItems: 'center',
                gap: 6,
                fontSize: '0.85rem'
              }}
            >
              <CheckCircle2 size={16} />
              <span>Saved securely to cloud database</span>
            </div>
          )}
        </div>
      </div>

      <Modal
        isOpen={showAtmModal}
        onClose={() => setShowAtmModal(false)}
        title="RupeeRise ATM Card & Split Terminal"
        maxWidth={740}
      >
        <div style={{ maxHeight: '85vh', overflowY: 'auto', padding: '0 4px' }}>
          <AtmSplitReceipt />
        </div>
      </Modal>
    </Layout>
  );
}
