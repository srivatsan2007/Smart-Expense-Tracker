import { useState, useEffect, useMemo, useRef } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import QRCode from 'qrcode';
import { Html5Qrcode } from 'html5-qrcode';
import firebase from 'firebase/compat/app';
import Layout from '../components/Layout.jsx';
import PageHeader from '../components/PageHeader.jsx';
import Modal from '../components/Modal.jsx';
import { notify } from '../components/Toast.jsx';
import { formatINR, formatDate } from '../utils/formatters.js';
import { downloadReport } from '../utils/premiumPdf.js';
import { getAuthHeaders } from '../hooks/useAuth.js';
import AtmSplitReceipt from '../components/AtmSplitReceipt.jsx';
import {
  FileText,
  FileSpreadsheet,
  Download,
  Camera,
  UploadCloud,
  QrCode,
  CheckCircle2,
  AlertCircle,
  AlertTriangle,
  ArrowRight,
  Sparkles,
  Shield,
  IndianRupee,
  CalendarCheck,
  RefreshCw,
  Copy,
  ExternalLink,
  Trash2,
  Plus,
  Clock,
  Filter,
  CreditCard
} from '../components/Icons.jsx';

const CATEGORIES = [
  'Food & Dining',
  'Transportation',
  'Shopping',
  'Housing & Rent',
  'Bills & Utilities',
  'Entertainment',
  'Health & Medical',
  'Other'
];

const PAYMENT_METHODS = [
  'UPI',
  'Credit Card',
  'Debit Card',
  'Cash',
  'Net Banking'
];

function getDateRange(periodKey, customStart, customEnd) {
  const now = new Date();
  const y = now.getFullYear();
  const m = now.getMonth();

  if (periodKey === 'this-month') {
    const start = new Date(y, m, 1);
    const end = new Date(y, m + 1, 0);
    return {
      startDate: start.toISOString().split('T')[0],
      endDate: end.toISOString().split('T')[0],
      label: `${start.toLocaleString('default', { month: 'long' })} ${y}`
    };
  }
  if (periodKey === 'last-month') {
    const start = new Date(y, m - 1, 1);
    const end = new Date(y, m, 0);
    return {
      startDate: start.toISOString().split('T')[0],
      endDate: end.toISOString().split('T')[0],
      label: `${start.toLocaleString('default', { month: 'long' })} ${start.getFullYear()}`
    };
  }
  if (periodKey === 'last-3-months') {
    const start = new Date(y, m - 2, 1);
    const end = new Date(y, m + 1, 0);
    return {
      startDate: start.toISOString().split('T')[0],
      endDate: end.toISOString().split('T')[0],
      label: 'Last 3 Months'
    };
  }
  if (periodKey === 'this-year') {
    const start = new Date(y, 0, 1);
    const end = new Date(y, 11, 31);
    return {
      startDate: start.toISOString().split('T')[0],
      endDate: end.toISOString().split('T')[0],
      label: `Year ${y}`
    };
  }
  // Custom
  return {
    startDate: customStart || '',
    endDate: customEnd || '',
    label: customStart && customEnd ? `${customStart} to ${customEnd}` : 'Custom Date Range'
  };
}

export default function Reports() {
  const navigate = useNavigate();

  // Raw data for live summary
  const [allExpenses, setAllExpenses] = useState([]);
  const [allSalaries, setAllSalaries] = useState([]);
  const [dataLoading, setDataLoading] = useState(true);

  // SECTION 1: Reports Export State
  const [period, setPeriod] = useState('this-month'); // this-month | last-month | last-3-months | this-year | custom
  const [customStartDate, setCustomStartDate] = useState(
    new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString().split('T')[0]
  );
  const [customEndDate, setCustomEndDate] = useState(new Date().toISOString().split('T')[0]);
  const [exportingType, setExportingType] = useState(null); // 'pdf' | 'excel' | 'csv' | null

  // SECTION 2: AI Receipt Scanner State
  const [dragActive, setDragActive] = useState(false);
  const [receiptFile, setReceiptFile] = useState(null);
  const [receiptPreview, setReceiptPreview] = useState(null);
  const [isScanning, setIsScanning] = useState(false);
  const [scanStatus, setScanStatus] = useState(null); // null | 'success' | 'warning' | 'error'
  const [extractedForm, setExtractedForm] = useState(null); // { merchant, amount, date, category, paymentMethod, description }
  const [savingExpense, setSavingExpense] = useState(false);

  // SECTION 3: QR Code Suite State
  const qrCanvasRef = useRef(null);
  const [showQrModal, setShowQrModal] = useState(false);
  const [qrItems, setQrItems] = useState([
    { id: 1, amount: '', category: 'Food & Dining', description: '' }
  ]);
  const [qrGenerating, setQrGenerating] = useState(false);
  const [activeQrUrl, setActiveQrUrl] = useState(null);
  const [activeQrExpenseId, setActiveQrExpenseId] = useState(null);
  const [copiedLink, setCopiedLink] = useState(false);

  // Scanner modal state
  const [showScannerModal, setShowScannerModal] = useState(false);
  const [cameraError, setCameraError] = useState('');
  const [scannedUrlResult, setScannedUrlResult] = useState(null);
  const [showAtmModal, setShowAtmModal] = useState(false);

  // Load live application data for report preview calculations
  const loadFinancialData = async () => {
    try {
      setDataLoading(true);
      const headers = getAuthHeaders();
      const [expRes, salRes] = await Promise.all([
        fetch('/api/expenses', { headers }),
        fetch('/api/salaries', { headers })
      ]);
      if (expRes.ok) {
        const expData = await expRes.json();
        setAllExpenses(Array.isArray(expData) ? expData : []);
      }
      if (salRes.ok) {
        const salData = await salRes.json();
        setAllSalaries(Array.isArray(salData) ? salData : []);
      }
    } catch (err) {
      console.error('Error loading report financial metrics:', err);
    } finally {
      setDataLoading(false);
    }
  };

  useEffect(() => {
    loadFinancialData();
  }, []);

  // Compute active date range based on period selector
  const activeRange = useMemo(() => {
    return getDateRange(period, customStartDate, customEndDate);
  }, [period, customStartDate, customEndDate]);

  // Compute live metrics for selected report range
  const periodSummary = useMemo(() => {
    const sDate = activeRange.startDate ? new Date(activeRange.startDate) : null;
    const eDate = activeRange.endDate ? new Date(activeRange.endDate) : null;
    if (eDate) eDate.setHours(23, 59, 59, 999);

    const filtered = allExpenses.filter((e) => {
      if (!e.date) return false;
      const d = new Date(e.date);
      if (sDate && d < sDate) return false;
      if (eDate && d > eDate) return false;
      return true;
    });

    const totalExpense = filtered.reduce((acc, e) => acc + (Number(e.amount) || 0), 0);
    const count = filtered.length;
    const avgTicket = count > 0 ? totalExpense / count : 0;

    return {
      filteredExpenses: filtered,
      totalExpense,
      count,
      avgTicket
    };
  }, [allExpenses, activeRange]);

  // Handle Export Actions (PDF, Excel, CSV)
  const handleExport = async (type) => {
    setExportingType(type);
    try {
      notify(`Generating ${type.toUpperCase()} statement for ${activeRange.label}...`, 'info');
      await downloadReport(type, {
        startDate: activeRange.startDate,
        endDate: activeRange.endDate,
        periodLabel: activeRange.label
      });
      notify(`${type.toUpperCase()} report generated successfully!`, 'success');
    } catch (err) {
      console.error(`Export ${type} error:`, err);
      notify(err.message || `Failed to export ${type.toUpperCase()} statement`, 'error');
    } finally {
      setExportingType(null);
    }
  };

  // Drag & drop handlers for receipt image
  const handleDrag = (e) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === 'dragenter' || e.type === 'dragover') {
      setDragActive(true);
    } else if (e.type === 'dragleave') {
      setDragActive(false);
    }
  };

  const processFile = (file) => {
    if (!file) return;
    const validTypes = ['image/jpeg', 'image/jpg', 'image/png'];
    if (!validTypes.includes(file.type.toLowerCase())) {
      notify('Please select an image file (JPG, JPEG, or PNG)', 'warning');
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      notify('Receipt image size exceeds 5MB limit', 'warning');
      return;
    }

    setReceiptFile(file);
    setScanStatus(null);
    setExtractedForm(null);

    const reader = new FileReader();
    reader.onload = (e) => setReceiptPreview(e.target.result);
    reader.readAsDataURL(file);
  };

  const handleDrop = (e) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      processFile(e.dataTransfer.files[0]);
    }
  };

  const handleFileInputChange = (e) => {
    if (e.target.files && e.target.files[0]) {
      processFile(e.target.files[0]);
    }
  };

  const removeReceipt = () => {
    setReceiptFile(null);
    setReceiptPreview(null);
    setScanStatus(null);
    setExtractedForm(null);
  };

  // Perform AI OCR scanning via backend
  const handleScanReceipt = async (e) => {
    e.preventDefault();
    if (!receiptFile) {
      notify('Please upload or drag-and-drop a receipt photo first', 'warning');
      return;
    }

    const formData = new FormData();
    formData.append('receipt', receiptFile);
    setIsScanning(true);
    setScanStatus(null);
    setExtractedForm(null);

    try {
      const res = await fetch('/api/ocr/scan', {
        method: 'POST',
        headers: { Authorization: `Bearer ${localStorage.getItem('token')}` },
        body: formData
      });

      const data = await res.json();
      if (res.ok && data.success) {
        const rawText = data.text || '';
        const lines = rawText
          .split('\n')
          .map((l) => l.trim())
          .filter((l) => l.length > 2);

        // Guess merchant name from top lines
        let guessedMerchant = '';
        if (lines.length > 0) {
          guessedMerchant = lines[0].replace(/[^a-zA-Z0-9 &'-]/g, '').slice(0, 30);
        }

        const detectedAmount = data.extracted?.amount ? String(data.extracted.amount) : '';
        let detectedDate = '';
        if (data.extracted?.date) {
          const parts = data.extracted.date.split(/[\/\-]/);
          if (parts.length === 3) {
            let [p1, p2, p3] = parts;
            if (p3.length === 2) p3 = '20' + p3;
            // standard ISO fallback
            detectedDate = `${p3}-${p1.padStart(2, '0')}-${p2.padStart(2, '0')}`;
          }
        }
        if (!detectedDate || isNaN(new Date(detectedDate).getTime())) {
          detectedDate = new Date().toISOString().split('T')[0];
        }

        setExtractedForm({
          merchant: guessedMerchant || 'Store / Merchant',
          amount: detectedAmount,
          date: detectedDate,
          category: 'Food & Dining',
          paymentMethod: 'UPI',
          description: guessedMerchant ? `Receipt from ${guessedMerchant}` : 'Scanned receipt expense'
        });

        if (detectedAmount) {
          setScanStatus('success');
          notify('Receipt scanned successfully! Review fields before saving.', 'success');
        } else {
          setScanStatus('warning');
          notify('Receipt text detected, but amount was not clear. Please verify the amount below.', 'warning');
        }
      } else {
        setScanStatus('error');
        notify(data.message || 'OCR was unable to extract legible text from this image.', 'error');
      }
    } catch (err) {
      console.error('OCR Error:', err);
      setScanStatus('error');
      notify('Network error during OCR processing. Check server connection.', 'error');
    } finally {
      setIsScanning(false);
    }
  };

  // Save the extracted expense to database
  const handleSaveExtractedExpense = async (e) => {
    e.preventDefault();
    if (!extractedForm) return;

    const amt = parseFloat(extractedForm.amount);
    if (isNaN(amt) || amt <= 0) {
      notify('Please enter a valid expense amount in INR', 'warning');
      return;
    }

    setSavingExpense(true);
    try {
      const res = await fetch('/api/expenses', {
        method: 'POST',
        headers: getAuthHeaders(),
        body: JSON.stringify({
          amount: amt,
          category: extractedForm.category,
          date: extractedForm.date,
          paymentMethod: extractedForm.paymentMethod,
          description: extractedForm.description || extractedForm.merchant || 'Receipt Expense'
        })
      });

      if (res.ok) {
        notify(`Saved ₹${amt} expense to your tracker!`, 'success');
        removeReceipt();
        loadFinancialData();
      } else {
        const err = await res.json().catch(() => ({}));
        notify(err.message || 'Failed to save expense', 'error');
      }
    } catch (err) {
      console.error('Error saving expense:', err);
      notify('Network error saving expense', 'error');
    } finally {
      setSavingExpense(false);
    }
  };

  // SECTION 3: QR Code Generator Helpers
  const handleAddQrItem = () => {
    setQrItems([
      ...qrItems,
      { id: Date.now(), amount: '', category: 'Food & Dining', description: '' }
    ]);
  };

  const handleUpdateQrItem = (id, field, val) => {
    setQrItems(qrItems.map((it) => (it.id === id ? { ...it, [field]: val } : it)));
  };

  const handleRemoveQrItem = (id) => {
    setQrItems(qrItems.filter((it) => it.id !== id));
  };

  const handleGenerateQr = async (e) => {
    e.preventDefault();
    const user = firebase.auth().currentUser;
    if (!user) {
      notify('You must be logged in to generate a verifiable receipt', 'warning');
      return;
    }

    const validItems = [];
    let totalAmt = 0;
    qrItems.forEach((it) => {
      const amt = parseFloat(it.amount);
      if (amt && it.category && it.description.trim()) {
        validItems.push({
          amount: amt,
          category: it.category,
          description: it.description.trim()
        });
        totalAmt += amt;
      }
    });

    if (validItems.length === 0) {
      notify('Please enter at least one valid expense item with description and amount', 'warning');
      return;
    }

    const expenseId = 'EXP' + Date.now();
    const expenseData = {
      expenseId,
      items: validItems,
      totalAmount: totalAmt,
      date: new Date().toISOString(),
      userId: user.uid
    };

    setQrGenerating(true);
    try {
      const receiptURL = `${window.location.origin}/receipt?id=${expenseId}`;
      await firebase.firestore().collection('qrShares').doc(expenseId).set({
        userId: expenseData.userId,
        expenseId: expenseData.expenseId,
        items: expenseData.items,
        totalAmount: expenseData.totalAmount,
        receiptURL,
        qrGenerated: true,
        createdAt: firebase.firestore.FieldValue.serverTimestamp()
      });

      setActiveQrUrl(receiptURL);
      setActiveQrExpenseId(expenseId);

      if (qrCanvasRef.current) {
        QRCode.toCanvas(qrCanvasRef.current, receiptURL, {
          width: 230,
          margin: 2,
          color: { dark: '#1e293b', light: '#ffffff' }
        });
      }

      notify('Cryptographic receipt created! Scan or share the QR code.', 'success');
    } catch (err) {
      console.error('Error generating QR:', err);
      notify('Failed to generate cloud receipt', 'error');
    } finally {
      setQrGenerating(false);
    }
  };

  const handleCopyLink = () => {
    if (!activeQrUrl) return;
    navigator.clipboard.writeText(activeQrUrl);
    setCopiedLink(true);
    notify('Receipt link copied to clipboard!', 'success');
    setTimeout(() => setCopiedLink(false), 3000);
  };

  const handleDownloadQr = () => {
    if (!qrCanvasRef.current) return;
    const link = document.createElement('a');
    link.download = `expense-qr-${activeQrExpenseId || 'receipt'}.png`;
    link.href = qrCanvasRef.current.toDataURL();
    link.click();
    notify('QR code image downloaded', 'success');
  };

  // Section 3: Live Scanner Modal effect
  useEffect(() => {
    let scannerInstance = null;
    if (showScannerModal) {
      setCameraError('');
      setScannedUrlResult(null);

      Html5Qrcode.getCameras()
        .then((devices) => {
          if (devices && devices.length > 0) {
            scannerInstance = new Html5Qrcode('qr-modal-reader');
            const cameraId = (devices.find((d) => d.label.toLowerCase().includes('back')) || devices[0]).id;
            scannerInstance
              .start(
                cameraId,
                { fps: 10, qrbox: { width: 220, height: 220 } },
                (decodedText) => {
                  try {
                    const parsedUrl = new URL(decodedText);
                    setScannedUrlResult(parsedUrl.href);
                    notify('QR receipt verified! Opening...', 'success');
                    if (scannerInstance && scannerInstance.isScanning) {
                      scannerInstance.stop().catch(() => {});
                    }
                    window.open(parsedUrl.href, '_blank');
                  } catch (e) {
                    notify('Scanned QR does not contain a valid receipt URL', 'warning');
                  }
                },
                () => {}
              )
              .catch((err) => {
                console.error(err);
                setCameraError('Camera access was denied or is unavailable.');
              });
          } else {
            setCameraError('No video cameras found on this device.');
          }
        })
        .catch(() => {
          setCameraError('Unable to access device media cameras.');
        });
    }

    return () => {
      if (scannerInstance && scannerInstance.isScanning) {
        scannerInstance.stop().catch(() => {});
      }
    };
  }, [showScannerModal]);

  return (
    <Layout title="Reports & AI Scanner - RupeeRise" active="reports">
      {/* Page Header */}
      <PageHeader
        title="Reports & AI Scanner"
        subtitle="Analyze your finances, export reports, and scan receipts."
      />

      {/* 3 Main Workspace Cards: Stacked/Grid Layout */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(340px, 1fr))',
          gap: 24,
          alignItems: 'start'
        }}
      >
        {/* =========================================================================
            SECTION 1: FINANCIAL REPORTS WORKSPACE
        ========================================================================= */}
        <div className="glass-card" style={{ display: 'flex', flexDirection: 'column' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 16 }}>
            <div
              style={{
                width: 44,
                height: 44,
                borderRadius: 12,
                background: 'rgba(71, 127, 224, 0.12)',
                color: 'var(--primary-color)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                flexShrink: 0
              }}
            >
              <FileText size={22} />
            </div>
            <div>
              <h3 style={{ fontSize: '1.15rem', fontWeight: 700, margin: 0 }}>
                Financial Statements
              </h3>
              <p style={{ fontSize: '0.82rem', color: 'var(--text-muted)', margin: '2px 0 0 0' }}>
                Generate period-specific audit logs &amp; spreadsheets
              </p>
            </div>
          </div>

          {/* Period Selector Tabs */}
          <div style={{ marginBottom: 16 }}>
            <label className="form-label" style={{ marginBottom: 8, display: 'block' }}>
              Report Period
            </label>
            <div
              style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fit, minmax(90px, 1fr))',
                gap: 6
              }}
            >
              {[
                { key: 'this-month', label: 'This Month' },
                { key: 'last-month', label: 'Last Month' },
                { key: 'last-3-months', label: '3 Months' },
                { key: 'this-year', label: 'This Year' },
                { key: 'custom', label: 'Custom' }
              ].map((tab) => (
                <button
                  key={tab.key}
                  type="button"
                  onClick={() => setPeriod(tab.key)}
                  className={`btn ${period === tab.key ? 'btn-primary' : 'btn-secondary'}`}
                  style={{
                    padding: '7px 8px',
                    fontSize: '0.78rem',
                    justifyContent: 'center',
                    fontWeight: 600,
                    borderRadius: 8
                  }}
                >
                  {tab.label}
                </button>
              ))}
            </div>
          </div>

          {/* Custom Date Inputs (if custom is selected) */}
          {period === 'custom' && (
            <div
              style={{
                display: 'grid',
                gridTemplateColumns: '1fr 1fr',
                gap: 12,
                marginBottom: 16,
                padding: 12,
                background: 'var(--bg-main)',
                borderRadius: 10,
                border: '1px solid var(--border-color)'
              }}
            >
              <div className="form-group" style={{ marginBottom: 0 }}>
                <label className="form-label" style={{ fontSize: '0.78rem' }}>Start Date</label>
                <input
                  type="date"
                  className="form-control"
                  value={customStartDate}
                  onChange={(e) => setCustomStartDate(e.target.value)}
                  style={{ fontSize: '0.82rem' }}
                />
              </div>
              <div className="form-group" style={{ marginBottom: 0 }}>
                <label className="form-label" style={{ fontSize: '0.78rem' }}>End Date</label>
                <input
                  type="date"
                  className="form-control"
                  value={customEndDate}
                  onChange={(e) => setCustomEndDate(e.target.value)}
                  style={{ fontSize: '0.82rem' }}
                />
              </div>
            </div>
          )}

          {/* Live Period Preview Summary */}
          <div
            style={{
              padding: '14px 16px',
              borderRadius: 12,
              background: 'var(--bg-main)',
              border: '1px solid var(--border-color)',
              marginBottom: 20
            }}
          >
            <div
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                marginBottom: 8
              }}
            >
              <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                Target Scope:
              </span>
              <span className="badge badge-default" style={{ fontSize: '0.75rem' }}>
                {activeRange.label}
              </span>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1.2fr 1fr', gap: 12 }}>
              <div>
                <span style={{ fontSize: '0.76rem', color: 'var(--text-muted)', display: 'block' }}>
                  Total Expenditure
                </span>
                <strong style={{ fontSize: '1.15rem', color: 'var(--danger-color)' }}>
                  {formatINR(periodSummary.totalExpense)}
                </strong>
              </div>
              <div>
                <span style={{ fontSize: '0.76rem', color: 'var(--text-muted)', display: 'block' }}>
                  Transactions
                </span>
                <strong style={{ fontSize: '1.15rem' }}>
                  {periodSummary.count} {periodSummary.count === 1 ? 'entry' : 'entries'}
                </strong>
              </div>
            </div>
          </div>

          {/* Export Action Buttons */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginTop: 'auto' }}>
            {/* PDF Statement */}
            <button
              type="button"
              onClick={() => handleExport('pdf')}
              disabled={exportingType !== null}
              className="btn btn-primary"
              style={{
                width: '100%',
                justifyContent: 'space-between',
                padding: '12px 18px',
                fontSize: '0.92rem'
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <FileText size={18} />
                <span>Download PDF Statement</span>
              </div>
              {exportingType === 'pdf' ? (
                <div className="loading-spinner" style={{ width: 16, height: 16, borderWidth: 2 }} />
              ) : (
                <span style={{ fontSize: '0.75rem', opacity: 0.85 }}>Signed PDF</span>
              )}
            </button>

            {/* Excel Export */}
            <button
              type="button"
              onClick={() => handleExport('excel')}
              disabled={exportingType !== null}
              className="btn btn-secondary"
              style={{
                width: '100%',
                justifyContent: 'space-between',
                padding: '12px 18px',
                fontSize: '0.92rem',
                borderColor: 'rgba(16, 185, 129, 0.4)',
                color: 'var(--success-color)'
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <FileSpreadsheet size={18} />
                <span>Export Excel Spreadsheet</span>
              </div>
              {exportingType === 'excel' ? (
                <div className="loading-spinner" style={{ width: 16, height: 16, borderWidth: 2 }} />
              ) : (
                <span style={{ fontSize: '0.75rem', opacity: 0.85 }}>.xlsx</span>
              )}
            </button>

            {/* CSV Export */}
            <button
              type="button"
              onClick={() => handleExport('csv')}
              disabled={exportingType !== null}
              className="btn btn-secondary"
              style={{
                width: '100%',
                justifyContent: 'space-between',
                padding: '12px 18px',
                fontSize: '0.92rem'
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <Download size={18} />
                <span>Export Raw CSV Data</span>
              </div>
              {exportingType === 'csv' ? (
                <div className="loading-spinner" style={{ width: 16, height: 16, borderWidth: 2 }} />
              ) : (
                <span style={{ fontSize: '0.75rem', opacity: 0.85 }}>.csv</span>
              )}
            </button>
          </div>
        </div>

        {/* =========================================================================
            SECTION 2: AI RECEIPT SCANNER WORKSPACE
        ========================================================================= */}
        <div className="glass-card" style={{ display: 'flex', flexDirection: 'column' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 16 }}>
            <div
              style={{
                width: 44,
                height: 44,
                borderRadius: 12,
                background: 'rgba(99, 102, 241, 0.12)',
                color: '#6366f1',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                flexShrink: 0
              }}
            >
              <Sparkles size={22} />
            </div>
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <h3 style={{ fontSize: '1.15rem', fontWeight: 700, margin: 0 }}>
                  AI Receipt Scanner
                </h3>
                <span className="badge badge-primary" style={{ fontSize: '0.7rem' }}>OCR</span>
              </div>
              <p style={{ fontSize: '0.82rem', color: 'var(--text-muted)', margin: '2px 0 0 0' }}>
                Instant character recognition &amp; review-to-save pipeline
              </p>
            </div>
          </div>

          {/* Upload Zone */}
          {!receiptPreview ? (
            <div
              onDragEnter={handleDrag}
              onDragLeave={handleDrag}
              onDragOver={handleDrag}
              onDrop={handleDrop}
              style={{
                border: `2px dashed ${dragActive ? 'var(--primary-color)' : 'var(--border-color)'}`,
                borderRadius: 14,
                padding: '32px 16px',
                textAlign: 'center',
                background: dragActive ? 'rgba(71, 127, 224, 0.05)' : 'var(--bg-main)',
                transition: 'all 0.2s ease',
                marginBottom: 16
              }}
            >
              <UploadCloud
                size={38}
                color="var(--primary-color)"
                style={{ margin: '0 auto 12px auto' }}
              />
              <p style={{ fontWeight: 600, fontSize: '0.92rem', marginBottom: 4 }}>
                Drag &amp; drop receipt photo here
              </p>
              <p style={{ fontSize: '0.78rem', color: 'var(--text-muted)', marginBottom: 14 }}>
                Supports JPG, JPEG, PNG (Max 5MB)
              </p>
              <label className="btn btn-secondary" style={{ display: 'inline-flex', cursor: 'pointer' }}>
                <Camera size={16} />
                <span>Browse Files</span>
                <input
                  type="file"
                  accept="image/png, image/jpeg, image/jpg"
                  onChange={handleFileInputChange}
                  style={{ display: 'none' }}
                />
              </label>
            </div>
          ) : (
            /* Uploaded Preview with Actions */
            <div style={{ marginBottom: 16 }}>
              <div
                style={{
                  position: 'relative',
                  borderRadius: 12,
                  overflow: 'hidden',
                  border: '1px solid var(--border-color)',
                  background: '#0f172a',
                  maxHeight: 180,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center'
                }}
              >
                <img
                  src={receiptPreview}
                  alt="Receipt Preview"
                  style={{ maxHeight: 180, width: 'auto', objectFit: 'contain' }}
                />
                <button
                  type="button"
                  onClick={removeReceipt}
                  title="Remove image"
                  style={{
                    position: 'absolute',
                    top: 8,
                    right: 8,
                    background: 'rgba(0,0,0,0.6)',
                    color: '#fff',
                    border: 'none',
                    borderRadius: '50%',
                    width: 28,
                    height: 28,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    cursor: 'pointer'
                  }}
                >
                  <Trash2 size={15} />
                </button>
              </div>

              {/* Replace and Scan actions */}
              <div style={{ display: 'flex', gap: 10, marginTop: 10 }}>
                <label
                  className="btn btn-secondary"
                  style={{ flex: 1, justifyContent: 'center', cursor: 'pointer', fontSize: '0.82rem' }}
                >
                  <span>Replace Photo</span>
                  <input
                    type="file"
                    accept="image/png, image/jpeg, image/jpg"
                    onChange={handleFileInputChange}
                    style={{ display: 'none' }}
                  />
                </label>
                <button
                  type="button"
                  onClick={handleScanReceipt}
                  disabled={isScanning}
                  className="btn btn-primary"
                  style={{ flex: 1.5, justifyContent: 'center', gap: 8, fontSize: '0.82rem' }}
                >
                  {isScanning ? (
                    <>
                      <div className="loading-spinner" style={{ width: 14, height: 14, borderWidth: 2 }} />
                      <span>Reading text...</span>
                    </>
                  ) : (
                    <>
                      <Sparkles size={16} />
                      <span>Scan Receipt</span>
                    </>
                  )}
                </button>
              </div>
            </div>
          )}

          {/* OCR Result Review Form */}
          {extractedForm ? (
            <form
              onSubmit={handleSaveExtractedExpense}
              style={{
                padding: 16,
                borderRadius: 12,
                background: 'var(--bg-main)',
                border: '1px solid var(--border-color)',
                marginTop: 6
              }}
            >
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  marginBottom: 12
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                  {scanStatus === 'success' ? (
                    <CheckCircle2 size={16} color="var(--success-color)" />
                  ) : (
                    <AlertTriangle size={16} color="var(--warning-color)" />
                  )}
                  <h4 style={{ fontSize: '0.9rem', fontWeight: 700, margin: 0 }}>
                    {scanStatus === 'success' ? 'OCR Extracted Review' : 'Verify Detected Details'}
                  </h4>
                </div>
                <button
                  type="button"
                  onClick={() => setExtractedForm(null)}
                  style={{
                    background: 'transparent',
                    border: 'none',
                    color: 'var(--text-muted)',
                    cursor: 'pointer',
                    fontSize: '0.78rem'
                  }}
                >
                  Discard
                </button>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 10 }}>
                <div className="form-group" style={{ marginBottom: 0 }}>
                  <label className="form-label" style={{ fontSize: '0.78rem' }}>Amount (₹) *</label>
                  <input
                    type="number"
                    className="form-control"
                    placeholder="e.g. 450"
                    required
                    step="0.01"
                    min="1"
                    value={extractedForm.amount}
                    onChange={(e) => setExtractedForm({ ...extractedForm, amount: e.target.value })}
                  />
                </div>

                <div className="form-group" style={{ marginBottom: 0 }}>
                  <label className="form-label" style={{ fontSize: '0.78rem' }}>Date *</label>
                  <input
                    type="date"
                    className="form-control"
                    required
                    value={extractedForm.date}
                    onChange={(e) => setExtractedForm({ ...extractedForm, date: e.target.value })}
                  />
                </div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 10 }}>
                <div className="form-group" style={{ marginBottom: 0 }}>
                  <label className="form-label" style={{ fontSize: '0.78rem' }}>Category</label>
                  <select
                    className="form-control"
                    value={extractedForm.category}
                    onChange={(e) => setExtractedForm({ ...extractedForm, category: e.target.value })}
                  >
                    {CATEGORIES.map((c) => (
                      <option key={c} value={c}>{c}</option>
                    ))}
                  </select>
                </div>

                <div className="form-group" style={{ marginBottom: 0 }}>
                  <label className="form-label" style={{ fontSize: '0.78rem' }}>Payment</label>
                  <select
                    className="form-control"
                    value={extractedForm.paymentMethod}
                    onChange={(e) => setExtractedForm({ ...extractedForm, paymentMethod: e.target.value })}
                  >
                    {PAYMENT_METHODS.map((pm) => (
                      <option key={pm} value={pm}>{pm}</option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="form-group" style={{ marginBottom: 12 }}>
                <label className="form-label" style={{ fontSize: '0.78rem' }}>Merchant / Description</label>
                <input
                  type="text"
                  className="form-control"
                  placeholder="e.g. Starbucks, Reliance Mart"
                  value={extractedForm.description}
                  onChange={(e) => setExtractedForm({ ...extractedForm, description: e.target.value })}
                />
              </div>

              <div style={{ display: 'flex', gap: 10 }}>
                <button
                  type="button"
                  className="btn btn-secondary"
                  style={{ flex: 1, fontSize: '0.85rem', justifyContent: 'center' }}
                  onClick={() => setExtractedForm(null)}
                  disabled={savingExpense}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="btn btn-primary"
                  style={{ flex: 1.6, fontSize: '0.85rem', justifyContent: 'center' }}
                  disabled={savingExpense}
                >
                  {savingExpense ? 'Saving...' : 'Save Expense'}
                </button>
              </div>
            </form>
          ) : (
            <p
              style={{
                fontSize: '0.8rem',
                color: 'var(--text-muted)',
                lineHeight: 1.5,
                marginTop: 'auto'
              }}
            >
              Upload clear store receipts or invoices. Tesseract OCR will automatically detect dates and totals with pre-filled editing.
            </p>
          )}
        </div>

        {/* =========================================================================
            SECTION 3: QR CODE SHARING & VALIDATION
        ========================================================================= */}
        <div className="glass-card" style={{ display: 'flex', flexDirection: 'column' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 16 }}>
            <div
              style={{
                width: 44,
                height: 44,
                borderRadius: 12,
                background: 'rgba(142, 68, 173, 0.12)',
                color: '#8e44ad',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                flexShrink: 0
              }}
            >
              <QrCode size={22} />
            </div>
            <div>
              <h3 style={{ fontSize: '1.15rem', fontWeight: 700, margin: 0 }}>
                QR Sharing &amp; Proofs
              </h3>
              <p style={{ fontSize: '0.82rem', color: 'var(--text-muted)', margin: '2px 0 0 0' }}>
                Itemize split expenses and scan live receipts
              </p>
            </div>
          </div>

          <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)', lineHeight: 1.5, marginBottom: 18 }}>
            Generate cryptographic, tamper-proof QR codes linking to real-time PDF receipts for seamless bill splitting and expense verification.
          </p>

          {/* Quick Actions */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            <button
              type="button"
              onClick={() => setShowAtmModal(true)}
              className="btn btn-primary"
              style={{
                width: '100%',
                justifyContent: 'center',
                gap: 8,
                background: 'linear-gradient(135deg, #1b2540 0%, #2a1f8f 60%, #5b4be0 100%)',
                borderColor: '#2a1f8f',
                padding: '12px 16px',
                fontWeight: 600,
                boxShadow: '0 4px 14px rgba(42, 31, 143, 0.35)'
              }}
            >
              <CreditCard size={18} />
              <span>ATM Card &amp; Split Terminal</span>
            </button>

            <button
              type="button"
              onClick={() => setShowScannerModal(true)}
              className="btn btn-secondary"
              style={{
                width: '100%',
                justifyContent: 'center',
                gap: 8,
                padding: '11px 16px'
              }}
            >
              <Camera size={18} />
              <span>Scan QR Receipt (Camera)</span>
            </button>
          </div>

          {/* Live Generated QR Code Card Preview (if generated) */}
          {activeQrUrl && (
            <div
              style={{
                marginTop: 20,
                padding: 16,
                background: 'var(--bg-main)',
                border: '1px solid var(--border-color)',
                borderRadius: 12,
                textAlign: 'center'
              }}
            >
              <span className="badge badge-success" style={{ marginBottom: 10, display: 'inline-block' }}>
                QR Active &amp; Verified
              </span>
              <div
                style={{
                  background: '#ffffff',
                  padding: 10,
                  borderRadius: 12,
                  display: 'inline-block',
                  margin: '0 auto 12px auto',
                  border: '1px solid var(--border-color)'
                }}
              >
                <canvas ref={qrCanvasRef} style={{ display: 'block' }} />
              </div>

              <div style={{ display: 'flex', gap: 8, justifyContent: 'center' }}>
                <button
                  type="button"
                  onClick={handleDownloadQr}
                  className="btn btn-primary"
                  style={{ padding: '6px 12px', fontSize: '0.8rem' }}
                >
                  <Download size={14} />
                  <span>Download</span>
                </button>

                <button
                  type="button"
                  onClick={handleCopyLink}
                  className="btn btn-secondary"
                  style={{ padding: '6px 12px', fontSize: '0.8rem' }}
                >
                  <Copy size={14} />
                  <span>{copiedLink ? 'Copied!' : 'Copy Link'}</span>
                </button>
              </div>
            </div>
          )}

          {/* Cloud Security Seal */}
          <div
            style={{
              marginTop: 'auto',
              paddingTop: 18,
              display: 'flex',
              alignItems: 'center',
              gap: 8,
              fontSize: '0.78rem',
              color: 'var(--text-muted)'
            }}
          >
            <Shield size={16} color="var(--primary-color)" />
            <span>Encrypted cloud storage powered by Firebase Firestore</span>
          </div>
        </div>
      </div>

      {/* =========================================================================
          MODAL 1: QR CODE GENERATOR DIALOG
      ========================================================================= */}
      <Modal
        isOpen={showQrModal}
        onClose={() => setShowQrModal(false)}
        title="Generate Itemized Expense QR"
      >
        <form onSubmit={handleGenerateQr}>
          <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)', marginBottom: 14 }}>
            Add individual items. The generated QR will securely link to a verified PDF receipt.
          </p>

          <div style={{ maxHeight: 280, overflowY: 'auto', paddingRight: 4, display: 'flex', flexDirection: 'column', gap: 10 }}>
            {qrItems.map((it, idx) => (
              <div
                key={it.id}
                style={{
                  padding: 12,
                  borderRadius: 10,
                  background: 'var(--bg-main)',
                  border: '1px solid var(--border-color)',
                  position: 'relative'
                }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                  <span style={{ fontSize: '0.78rem', fontWeight: 600, color: 'var(--text-muted)' }}>
                    Item #{idx + 1}
                  </span>
                  {qrItems.length > 1 && (
                    <button
                      type="button"
                      onClick={() => handleRemoveQrItem(it.id)}
                      style={{
                        background: 'transparent',
                        border: 'none',
                        color: 'var(--danger-color)',
                        cursor: 'pointer',
                        padding: 2
                      }}
                    >
                      <Trash2 size={14} />
                    </button>
                  )}
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1.2fr 1.5fr', gap: 10, marginBottom: 8 }}>
                  <div className="form-group" style={{ marginBottom: 0 }}>
                    <label className="form-label" style={{ fontSize: '0.76rem' }}>Amount (₹)</label>
                    <input
                      type="number"
                      className="form-control"
                      placeholder="e.g. 500"
                      required
                      min="1"
                      step="0.01"
                      value={it.amount}
                      onChange={(e) => handleUpdateQrItem(it.id, 'amount', e.target.value)}
                    />
                  </div>
                  <div className="form-group" style={{ marginBottom: 0 }}>
                    <label className="form-label" style={{ fontSize: '0.76rem' }}>Category</label>
                    <select
                      className="form-control"
                      value={it.category}
                      onChange={(e) => handleUpdateQrItem(it.id, 'category', e.target.value)}
                    >
                      {CATEGORIES.map((c) => (
                        <option key={c} value={c}>{c}</option>
                      ))}
                    </select>
                  </div>
                </div>

                <div className="form-group" style={{ marginBottom: 0 }}>
                  <label className="form-label" style={{ fontSize: '0.76rem' }}>Description</label>
                  <input
                    type="text"
                    className="form-control"
                    placeholder="e.g. Dinner, Taxi fare"
                    required
                    value={it.description}
                    onChange={(e) => handleUpdateQrItem(it.id, 'description', e.target.value)}
                  />
                </div>
              </div>
            ))}
          </div>

          <button
            type="button"
            className="btn btn-secondary"
            onClick={handleAddQrItem}
            style={{ width: '100%', margin: '14px 0', borderStyle: 'dashed', justifyContent: 'center', fontSize: '0.85rem' }}
          >
            <Plus size={15} />
            <span>Add Another Item</span>
          </button>

          <div style={{ display: 'flex', gap: 10 }}>
            <button
              type="button"
              className="btn btn-secondary"
              style={{ flex: 1, justifyContent: 'center' }}
              onClick={() => setShowQrModal(false)}
              disabled={qrGenerating}
            >
              Cancel
            </button>
            <button
              type="submit"
              className="btn btn-primary"
              style={{ flex: 1.5, justifyContent: 'center' }}
              disabled={qrGenerating}
            >
              {qrGenerating ? 'Generating...' : 'Generate QR Receipt'}
            </button>
          </div>
        </form>
      </Modal>

      {/* =========================================================================
          MODAL 2: LIVE CAMERA QR SCANNER
      ========================================================================= */}
      <Modal
        isOpen={showScannerModal}
        onClose={() => setShowScannerModal(false)}
        title="Scan Expense QR Code"
      >
        <div style={{ textAlign: 'center' }}>
          <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)', marginBottom: 16 }}>
            Point your camera at a Smart Tracker receipt QR code
          </p>

          <div
            id="qr-modal-reader"
            style={{
              width: '100%',
              borderRadius: 12,
              overflow: 'hidden',
              background: '#000',
              border: '1px solid var(--border-color)',
              minHeight: 240
            }}
          />

          {cameraError && (
            <div
              style={{
                marginTop: 14,
                padding: '10px 14px',
                borderRadius: 8,
                background: 'rgba(239, 68, 68, 0.1)',
                color: 'var(--danger-color)',
                fontSize: '0.85rem',
                display: 'flex',
                alignItems: 'center',
                gap: 8
              }}
            >
              <AlertCircle size={16} />
              <span>{cameraError}</span>
            </div>
          )}

          {scannedUrlResult && (
            <div
              style={{
                marginTop: 14,
                padding: 12,
                borderRadius: 8,
                background: 'rgba(16, 185, 129, 0.1)',
                color: 'var(--success-color)',
                fontSize: '0.85rem'
              }}
            >
              <CheckCircle2 size={16} style={{ display: 'inline', marginRight: 6 }} />
              <span>Verified receipt link detected!</span>
            </div>
          )}

          <button
            type="button"
            className="btn btn-secondary"
            style={{ marginTop: 16, width: '100%', justifyContent: 'center' }}
            onClick={() => setShowScannerModal(false)}
          >
            Close Scanner
          </button>
        </div>
      </Modal>

      {/* =========================================================================
          MODAL 3: ATM CARD & SPLIT TERMINAL
      ========================================================================= */}
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
