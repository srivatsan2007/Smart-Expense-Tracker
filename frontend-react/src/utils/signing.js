import { getBackendBaseUrl } from './apiConfig.js';
import { getFreshAuthHeaders } from '../hooks/useAuth.js';

/**
 * Client helpers for RupeeRise digital signatures.
 * All signing happens on the server (the private key never reaches the browser/app);
 * the client only asks for a signature and prints the result on the document.
 */

// Public verification link that goes inside QR codes.
// In the Android app window.location.origin is https://localhost, so the real backend URL is used instead.
export function buildVerifyUrl(docId, hash) {
  const base = getBackendBaseUrl() || window.location.origin;
  const query = hash ? `?h=${encodeURIComponent(hash)}` : '';
  return `${base}/verify/${encodeURIComponent(docId)}${query}`;
}

async function postSign(path, body) {
  try {
    const headers = await getFreshAuthHeaders();
    const res = await fetch(path, { method: 'POST', headers, body: JSON.stringify(body) });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      console.warn(`Signing request failed (${res.status}):`, err.message || err);
      return null;
    }
    return await res.json();
  } catch (err) {
    console.warn('Signing request failed:', err);
    return null;
  }
}

// Returns { docId, hash, algorithm, scheme, certFingerprint, issuedAt, total, count } or null when unavailable.
// null never blocks the user: the PDF is still produced, but is clearly marked "not digitally signed".
export function requestReportSignature({ startDate, endDate, periodLabel } = {}) {
  return postSign('/api/sign/report', { startDate: startDate || '', endDate: endDate || '', periodLabel });
}

export function requestReceiptSignature(expenseId) {
  return postSign('/api/sign/receipt', { expenseId });
}

export async function fetchVerification(docId, hash) {
  const query = hash ? `?h=${encodeURIComponent(hash)}` : '';
  const res = await fetch(`/api/verify/${encodeURIComponent(docId)}${query}`);
  const data = await res.json().catch(() => ({}));
  return { httpStatus: res.status, ...data };
}

export function certificateUrl() {
  return `${getBackendBaseUrl() || window.location.origin}/api/verify/certificate`;
}

export function shortFingerprint(fp, bytes = 12) {
  if (!fp) return '';
  const parts = String(fp).split(':');
  return parts.length > bytes ? parts.slice(0, bytes).join(':') + '…' : fp;
}

export function shortHash(hash, head = 16, tail = 8) {
  if (!hash) return '';
  return hash.length > head + tail + 1 ? `${hash.slice(0, head)}…${hash.slice(-tail)}` : hash;
}
