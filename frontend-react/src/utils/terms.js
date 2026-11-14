// Bump TERMS_VERSION whenever the Terms & Conditions change materially.
// Users who accepted an older version will be asked to accept again on login.
export const TERMS_VERSION = '1.0';
export const TERMS_LAST_UPDATED = 'November 14, 2026';
const KEY = 'terms_accepted_version';

export function hasAcceptedTerms() {
  try {
    return localStorage.getItem(KEY) === TERMS_VERSION;
  } catch {
    return false;
  }
}

export function recordTermsAcceptance() {
  try {
    localStorage.setItem(KEY, TERMS_VERSION);
    localStorage.setItem('terms_accepted_at', new Date().toISOString());
  } catch {
    /* storage unavailable – ignore */
  }
}
