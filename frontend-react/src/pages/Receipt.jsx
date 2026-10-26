import { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import firebase from 'firebase/compat/app';
import { jsPDF } from 'jspdf';
import { Download, AlertCircle, ArrowLeft, Shield, CheckCircle2 } from '../components/Icons.jsx';
import '../css/style.css';

// Builds the receipt PDF on the fly from the Firestore document.
function buildReceiptPdf(expenseData) {
  const doc = new jsPDF();
  doc.setFillColor(30, 41, 59);
  doc.rect(0, 0, 210, 40, 'F');
  doc.setTextColor(71, 127, 224);
  doc.setFontSize(22);
  doc.setFont('helvetica', 'bold');
  doc.text('RUPEERISE', 20, 25);

  doc.setTextColor(70, 70, 70);
  doc.setFontSize(11);
  doc.setFont('helvetica', 'normal');
  doc.text(`Receipt ID: ${expenseData.expenseId}`, 20, 55);
  const dateStr = expenseData.createdAt
    ? expenseData.createdAt.toDate().toLocaleString()
    : new Date().toLocaleString();
  doc.text(`Date: ${dateStr}`, 20, 65);

  doc.setFillColor(241, 245, 249);
  doc.rect(20, 75, 170, 10, 'F');
  doc.setFont('helvetica', 'bold');
  doc.text('Description', 25, 82);
  doc.text('Category', 110, 82);
  doc.text('Amount (INR)', 155, 82);

  doc.setFont('helvetica', 'normal');
  let y = 92;
  if (expenseData.items && expenseData.items.length > 0) {
    expenseData.items.forEach((item) => {
      doc.text(String(item.description || 'Item'), 25, y);
      doc.text(String(item.category || 'General'), 110, y);
      doc.text(`Rs. ${Number(item.amount || 0).toFixed(2)}`, 155, y);
      y += 10;
    });
  } else {
    doc.text(expenseData.description || 'N/A', 25, y);
    doc.text(expenseData.category || 'N/A', 110, y);
    doc.text(`Rs. ${(expenseData.amount || 0).toFixed(2)}`, 155, y);
    y += 10;
  }

  doc.setLineWidth(0.5);
  doc.setDrawColor(226, 232, 240);
  doc.line(20, y, 190, y);
  y += 10;
  doc.setFont('helvetica', 'bold');
  doc.text('TOTAL AMOUNT', 110, y);
  doc.setTextColor(71, 127, 224);
  doc.text(`Rs. ${(expenseData.totalAmount || expenseData.amount || 0).toFixed(2)}`, 155, y);

  y += 35;
  doc.setTextColor(148, 163, 184);
  doc.setFontSize(9);
  doc.setFont('helvetica', 'italic');
  doc.text('Digitally Verified & Encrypted by RupeeRise Platform', 20, y);
  return doc.output('blob');
}

export default function Receipt() {
  const pdfBlob = useRef(null);
  const [status, setStatus] = useState('loading'); // loading | error | ready
  const [message, setMessage] = useState('Receipt not found or you do not have permission to view it.');
  const [pdfUrl, setPdfUrl] = useState(null);

  useEffect(() => {
    document.title = 'Receipt - RupeeRise';
    const showError = (msg) => {
      setMessage(msg);
      setStatus('error');
    };

    const loadReceipt = async (user) => {
      const expenseId = new URLSearchParams(window.location.search).get('id');
      if (!expenseId) {
        showError('Invalid receipt URL.');
        return;
      }
      try {
        const docSnap = await firebase.firestore().collection('qrShares').doc(expenseId).get();
        if (!docSnap.exists) {
          showError('Receipt not found in database.');
          return;
        }
        const data = docSnap.data();
        if (data.userId !== user.uid) {
          showError('You do not have permission to view this receipt.');
          return;
        }
        try {
          pdfBlob.current = buildReceiptPdf(data);
          setPdfUrl(URL.createObjectURL(pdfBlob.current));
          setStatus('ready');
        } catch (err) {
          console.error('Error generating PDF:', err);
          showError('Failed to render PDF document.');
        }
      } catch (error) {
        console.error('Error loading receipt:', error);
        showError('Error loading receipt data: ' + error.message);
      }
    };

    return firebase.auth().onAuthStateChanged((user) => {
      if (!user) showError('You must be logged in to view this receipt.');
      else loadReceipt(user);
    });
  }, []);

  const downloadPDF = () => {
    if (!pdfBlob.current) return;
    const url = URL.createObjectURL(pdfBlob.current);
    const link = document.createElement('a');
    link.download = `${new URLSearchParams(window.location.search).get('id') || 'receipt'}.pdf`;
    link.href = url;
    link.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div
      style={{
        minHeight: '100vh',
        background: 'var(--bg-main)',
        padding: '30px 20px',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center'
      }}
    >
      <div style={{ width: '100%', maxWidth: 750 }}>
        {/* Top Header */}
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            marginBottom: 20,
            flexWrap: 'wrap',
            gap: 12
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <Link to="/reports" className="btn btn-secondary btn-icon" title="Back to Reports">
              <ArrowLeft size={18} />
            </Link>
            <div>
              <h2 style={{ fontSize: '1.35rem', fontWeight: 700, margin: 0 }}>
                Verified Expense Receipt
              </h2>
              <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                RupeeRise Cryptographic Record
              </span>
            </div>
          </div>

          {status === 'ready' && (
            <button
              type="button"
              onClick={downloadPDF}
              className="btn btn-primary"
              style={{ gap: 8 }}
            >
              <Download size={18} />
              <span>Download PDF</span>
            </button>
          )}
        </div>

        {/* Status card */}
        {status === 'loading' && (
          <div className="glass-card" style={{ textAlign: 'center', padding: '60px 20px' }}>
            <div className="loading-spinner" style={{ margin: '0 auto 16px auto' }} />
            <p style={{ color: 'var(--text-muted)' }}>Loading verified document...</p>
          </div>
        )}

        {status === 'error' && (
          <div className="glass-card" style={{ textAlign: 'center', padding: '50px 20px' }}>
            <div
              style={{
                width: 56,
                height: 56,
                borderRadius: '50%',
                background: 'rgba(239, 68, 68, 0.1)',
                color: 'var(--danger-color)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                margin: '0 auto 16px auto'
              }}
            >
              <AlertCircle size={30} />
            </div>
            <h3 style={{ fontSize: '1.15rem', fontWeight: 600, marginBottom: 8 }}>
              Unable to Display Receipt
            </h3>
            <p style={{ color: 'var(--text-muted)', fontSize: '0.9rem', maxWidth: 440, margin: '0 auto 20px auto' }}>
              {message}
            </p>
            <Link to="/reports" className="btn btn-primary">
              Return to Reports
            </Link>
          </div>
        )}

        {status === 'ready' && (
          <div
            className="glass-card"
            style={{
              padding: 0,
              overflow: 'hidden',
              borderRadius: 16,
              boxShadow: '0 12px 36px var(--card-shadow)'
            }}
          >
            <iframe
              src={pdfUrl || undefined}
              title="Receipt PDF"
              style={{
                width: '100%',
                height: 650,
                border: 'none',
                display: 'block'
              }}
            />
          </div>
        )}
      </div>
    </div>
  );
}
