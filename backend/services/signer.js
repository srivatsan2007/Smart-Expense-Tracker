'use strict';

/**
 * RupeeRise digital-signature service.
 *
 *   payload ──canonicalize──▶ bytes ──SHA-256──▶ digest (hash)
 *                                   └─ sign with private key ─▶ signature
 *
 * Anyone holding the public X.509 certificate can recompute the digest and
 * check the signature, so a signed record cannot be edited without detection.
 *
 * Configuration (all optional except the key + certificate):
 *   SIGN_ALGO         sha256 (default) | sha384 | sha512 | sha1 (legacy only)
 *   SIGN_PRIVATE_KEY  PEM private key  (raw PEM, PEM with "\n" escapes, or base64 of the PEM)
 *   SIGN_CERT_PEM     PEM X.509 certificate (same accepted formats)
 *
 * If the env vars are missing, the files
 *   /etc/secrets/signing.key.pem + signing.cert.pem   (Render secret files)
 *   backend/certs/signing.key.pem + signing.cert.pem  (local, from `npm run gen:cert`)
 * are used.
 */

const crypto = require('crypto');
const fs = require('fs');
const path = require('path');

const ALLOWED_ALGOS = ['sha256', 'sha384', 'sha512', 'sha1'];

class SigningNotConfiguredError extends Error {
  constructor(message) {
    super(message || 'Document signing is not configured on the server.');
    this.name = 'SigningNotConfiguredError';
    this.code = 'SIGNING_NOT_CONFIGURED';
  }
}

// ---------------------------------------------------------------------------
// Configuration helpers
// ---------------------------------------------------------------------------

function getAlgorithm() {
  const algo = String(process.env.SIGN_ALGO || 'sha256').toLowerCase().replace('-', '');
  if (!ALLOWED_ALGOS.includes(algo)) {
    throw new Error(`Unsupported SIGN_ALGO "${process.env.SIGN_ALGO}". Use one of: ${ALLOWED_ALGOS.join(', ')}`);
  }
  return algo;
}

// Accepts raw PEM, PEM with literal "\n" sequences (typical in env vars), or base64 of a PEM.
function normalizePem(value) {
  if (!value) return null;
  let text = String(value).trim();
  if (!text.includes('-----BEGIN')) {
    try {
      const decoded = Buffer.from(text, 'base64').toString('utf8');
      if (decoded.includes('-----BEGIN')) text = decoded;
    } catch (e) {
      /* fall through */
    }
  }
  text = text.replace(/\\n/g, '\n').trim();
  return text.includes('-----BEGIN') ? text + '\n' : null;
}

function readFirstExisting(fileNames) {
  for (const file of fileNames) {
    try {
      if (fs.existsSync(file)) return fs.readFileSync(file, 'utf8');
    } catch (e) {
      /* try next */
    }
  }
  return null;
}

const KEY_FILES = [
  '/etc/secrets/signing.key.pem',
  path.join(__dirname, '..', 'certs', 'signing.key.pem'),
];
const CERT_FILES = [
  '/etc/secrets/signing.cert.pem',
  path.join(__dirname, '..', 'certs', 'signing.cert.pem'),
];

let cached = null;

function loadMaterial() {
  if (cached) return cached;

  const keyPem = normalizePem(process.env.SIGN_PRIVATE_KEY) || normalizePem(readFirstExisting(KEY_FILES));
  const certPem = normalizePem(process.env.SIGN_CERT_PEM) || normalizePem(readFirstExisting(CERT_FILES));

  if (!keyPem || !certPem) {
    throw new SigningNotConfiguredError(
      'Signing key/certificate not found. Run "npm run gen:cert" or set SIGN_PRIVATE_KEY and SIGN_CERT_PEM.'
    );
  }

  let privateKey;
  let x509;
  try {
    privateKey = crypto.createPrivateKey(keyPem);
    x509 = new crypto.X509Certificate(certPem);
  } catch (err) {
    throw new SigningNotConfiguredError(`Signing key or certificate is not valid PEM: ${err.message}`);
  }

  // The certificate's public key must belong to the private key, otherwise every signature would fail.
  const probe = Buffer.from('rupeerise-key-pair-check');
  const probeAlgo = getAlgorithm();
  const probeSig = crypto.sign(probeAlgo, probe, privateKey);
  if (!crypto.verify(probeAlgo, probe, x509.publicKey, probeSig)) {
    throw new SigningNotConfiguredError('SIGN_PRIVATE_KEY does not match SIGN_CERT_PEM.');
  }

  const keyType = x509.publicKey.asymmetricKeyType; // 'rsa' | 'ec'
  const details = x509.publicKey.asymmetricKeyDetails || {};

  cached = {
    privateKey,
    x509,
    certPem,
    fingerprint256: x509.fingerprint256,
    keyType,
    keyBits: details.modulusLength || null,
    curve: details.namedCurve || null,
  };
  return cached;
}

function resetForTests() {
  cached = null;
}

function isConfigured() {
  try {
    loadMaterial();
    return true;
  } catch (e) {
    return false;
  }
}

function schemeName(algo, keyType) {
  return `${keyType === 'ec' ? 'ECDSA' : 'RSA'}-${algo.toUpperCase()}`;
}

// ---------------------------------------------------------------------------
// Canonical JSON: sorted keys at every depth, so the same data always gives the same bytes.
// ---------------------------------------------------------------------------

function canonicalize(value) {
  if (value === null || typeof value !== 'object') {
    const json = JSON.stringify(value);
    return json === undefined ? 'null' : json;
  }
  if (Array.isArray(value)) {
    return '[' + value.map(canonicalize).join(',') + ']';
  }
  return (
    '{' +
    Object.keys(value)
      .sort()
      .filter((k) => value[k] !== undefined)
      .map((k) => JSON.stringify(k) + ':' + canonicalize(value[k]))
      .join(',') +
    '}'
  );
}

function digest(payload, algo) {
  return crypto.createHash(algo || getAlgorithm()).update(canonicalize(payload)).digest('hex');
}

// ---------------------------------------------------------------------------
// Sign / verify
// ---------------------------------------------------------------------------

function signPayload(payload, algo) {
  const material = loadMaterial();
  const algorithm = algo || getAlgorithm();
  if (algorithm === 'sha1') {
    console.warn('[signer] SHA-1 is deprecated (collision attacks). Use SHA-256 unless a legacy system requires SHA-1.');
  }
  const data = Buffer.from(canonicalize(payload), 'utf8');
  const hash = crypto.createHash(algorithm).update(data).digest('hex');
  const signature = crypto.sign(algorithm, data, material.privateKey).toString('base64');

  return {
    algorithm,
    scheme: schemeName(algorithm, material.keyType),
    hash,
    signature,
    certFingerprint: material.fingerprint256,
  };
}

/**
 * Re-checks a stored record.
 * Returns { hash, hashIntact, signatureValid, certMatches }.
 */
function verifyPayload(payload, record) {
  const material = loadMaterial();
  const algorithm = record.algorithm || 'sha256';
  const data = Buffer.from(canonicalize(payload), 'utf8');
  const hash = crypto.createHash(algorithm).update(data).digest('hex');

  let signatureValid = false;
  try {
    signatureValid = crypto.verify(
      algorithm,
      data,
      material.x509.publicKey,
      Buffer.from(String(record.signature || ''), 'base64')
    );
  } catch (e) {
    signatureValid = false;
  }

  return {
    hash,
    hashIntact: hash === record.hash,
    signatureValid,
    certMatches: !record.certFingerprint || record.certFingerprint === material.fingerprint256,
  };
}

function getCertificateInfo() {
  const m = loadMaterial();
  return {
    pem: m.certPem,
    fingerprint256: m.fingerprint256,
    subject: m.x509.subject.replace(/\n/g, ', '),
    issuer: m.x509.issuer.replace(/\n/g, ', '),
    validFrom: m.x509.validFrom,
    validTo: m.x509.validTo,
    keyType: m.keyType,
    keyBits: m.keyBits,
    curve: m.curve,
    algorithm: getAlgorithm(),
    scheme: schemeName(getAlgorithm(), m.keyType),
  };
}

module.exports = {
  ALLOWED_ALGOS,
  SigningNotConfiguredError,
  canonicalize,
  digest,
  getAlgorithm,
  getCertificateInfo,
  isConfigured,
  normalizePem,
  resetForTests,
  signPayload,
  verifyPayload,
};
