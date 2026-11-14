import { getBackendBaseUrl } from './apiConfig.js';
import { getFreshAuthHeaders } from '../hooks/useAuth.js';

// Client helpers for the monthly history (archive) feature.

async function request(path, options = {}) {
  const headers = await getFreshAuthHeaders();
  const res = await fetch(path, { ...options, headers: { ...headers, ...(options.headers || {}) } });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.message || `Request failed (${res.status})`);
  }
  return res;
}

export const fetchArchives = async () => (await request('/api/archives')).json();
export const fetchArchive = async (key) => (await request(`/api/archives/${key}`)).json();

// type: 'pdf' | 'excel'
export async function downloadArchiveFile(key, type) {
  const res = await request(`/api/archives/${key}/${type}`);
  const blob = await res.blob();
  const url = window.URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `RupeeRise_${key}_Statement.${type === 'pdf' ? 'pdf' : 'xlsx'}`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => window.URL.revokeObjectURL(url), 1000);
}

export const createShare = async (key, { days = 7, includeDetails = false } = {}) =>
  (await request(`/api/archives/${key}/share`, { method: 'POST', body: JSON.stringify({ days, includeDetails }) })).json();

export const fetchShares = async (key) => (await request(`/api/archives/${key}/shares`)).json();

export const revokeShare = async (key, token) =>
  request(`/api/archives/${key}/share/${encodeURIComponent(token)}`, { method: 'DELETE' });

// Public link that goes inside the QR code.
// In the Android app window.location.origin is https://localhost, so the real backend URL is used instead.
export const buildShareUrl = (token) => `${getBackendBaseUrl() || window.location.origin}/shared/${encodeURIComponent(token)}`;

export async function fetchSharedStatement(token) {
  const res = await fetch(`/api/shared/${encodeURIComponent(token)}`);
  const data = await res.json().catch(() => ({}));
  return { httpStatus: res.status, ...data };
}
