import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Html5Qrcode } from 'html5-qrcode';
import Layout from '../components/Layout.jsx';
import PageHeader from '../components/PageHeader.jsx';
import { notify } from '../components/Toast.jsx';
import {
  Camera,
  CheckCircle2,
  ArrowLeft,
  ArrowRight,
  AlertCircle
} from '../components/Icons.jsx';

export default function QrScanner() {
  const [scanUrl, setScanUrl] = useState(null);
  const [readerMsg, setReaderMsg] = useState('');

  useEffect(() => {
    const scanner = new Html5Qrcode('reader');

    const handleScanSuccess = (decodedText) => {
      try {
        const url = new URL(decodedText);
        if (scanner.isScanning) {
          scanner.stop().catch((err) => console.error('Error stopping scanner', err));
        }
        setScanUrl(url.href);
        notify('Receipt QR code detected!', 'success');
        window.open(url.href, '_blank');
      } catch (e) {
        console.error('Failed to parse QR code data as URL:', e);
        try {
          const parsed = JSON.parse(decodedText);
          notify(
            parsed.amount && parsed.category
              ? 'This is a legacy QR code format without a live PDF receipt.'
              : 'Invalid QR Code format.',
            'warning'
          );
        } catch (err) {
          notify('Invalid QR Code format. Please scan a valid Expense Receipt QR.', 'error');
        }
      }
    };

    Html5Qrcode.getCameras()
      .then((devices) => {
        if (devices && devices.length) {
          const cameraId = (devices.find((d) => d.label.toLowerCase().includes('back')) || devices[0]).id;
          scanner
            .start(cameraId, { fps: 10, qrbox: { width: 250, height: 250 } }, handleScanSuccess, () => {})
            .catch((err) => {
              console.error('Error starting scanner:', err);
              setReaderMsg('Camera access was denied or is unavailable on this device.');
            });
        } else {
          setReaderMsg('No cameras found on this device.');
        }
      })
      .catch((err) => {
        console.error('Error getting cameras:', err);
        setReaderMsg('Unable to query device cameras.');
      });

    return () => {
      if (scanner.isScanning) {
        scanner.stop().catch(() => {});
      }
    };
  }, []);

  return (
    <Layout title="Scan QR - RupeeRise" active="reports">
      <PageHeader
        title="Scan Expense QR"
        subtitle="Point your camera at a Smart Tracker QR code to open the encrypted receipt"
        action={
          <Link to="/reports" className="btn btn-secondary">
            <ArrowLeft size={16} />
            <span>Back to Reports</span>
          </Link>
        }
      />

      <div style={{ maxWidth: 560, margin: '0 auto' }}>
        <div className="glass-card" style={{ textAlign: 'center' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 10, marginBottom: 12 }}>
            <Camera size={22} color="var(--primary-color)" />
            <h3 style={{ fontSize: '1.2rem', fontWeight: 600, margin: 0 }}>
              Live Camera Scanner
            </h3>
          </div>
          <p style={{ fontSize: '0.88rem', color: 'var(--text-muted)', marginBottom: 20 }}>
            Position the receipt QR code clearly within the viewfinder
          </p>

          <div
            id="reader"
            style={{
              width: '100%',
              borderRadius: 14,
              overflow: 'hidden',
              border: '1px solid var(--border-color)',
              background: '#000'
            }}
          />

          {readerMsg && (
            <div
              style={{
                marginTop: 16,
                padding: '12px 16px',
                borderRadius: 10,
                background: 'rgba(239, 68, 68, 0.1)',
                color: 'var(--danger-color)',
                display: 'flex',
                alignItems: 'center',
                gap: 8,
                fontSize: '0.88rem'
              }}
            >
              <AlertCircle size={18} />
              <span>{readerMsg}</span>
            </div>
          )}

          {scanUrl && (
            <div
              style={{
                marginTop: 20,
                padding: 16,
                background: 'rgba(16, 185, 129, 0.1)',
                border: '1px solid rgba(16, 185, 129, 0.3)',
                borderRadius: 12,
                textAlign: 'left'
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
                <CheckCircle2 size={18} color="var(--success-color)" />
                <h4 style={{ margin: 0, fontSize: '0.98rem', fontWeight: 600, color: 'var(--success-color)' }}>
                  Receipt Detected!
                </h4>
              </div>
              <p style={{ fontSize: '0.82rem', color: 'var(--text-muted)', marginBottom: 14, wordBreak: 'break-all' }}>
                {scanUrl}
              </p>
              <button
                type="button"
                onClick={() => window.open(scanUrl, '_blank')}
                className="btn btn-primary"
                style={{ width: '100%', justifyContent: 'center', gap: 6 }}
              >
                <span>Open Receipt in New Tab</span>
                <ArrowRight size={16} />
              </button>
            </div>
          )}
        </div>
      </div>
    </Layout>
  );
}
