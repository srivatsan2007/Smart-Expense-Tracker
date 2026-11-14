'use strict';

const crypto = require('crypto');
const { admin } = require('../db');
const { fetchUserExpenses } = require('../services/expenseQuery');
const signer = require('../services/signer');

const COLLECTION = 'signedDocuments';
const DOC_ID_PATTERN = /^[A-Z]{2}-\d{4}-[0-9A-F]{12}$/;
const HASH_PATTERN = /^[0-9a-fA-F]{40,128}$/;

const round2 = (n) => Math.round((Number(n) || 0) * 100) / 100;

const newDocId = (prefix) =>
  `${prefix}-${new Date().getFullYear()}-${crypto.randomBytes(6).toString('hex').toUpperCase()}`;

const toIso = (value) => {
  if (!value) return null;
  if (typeof value.toDate === 'function') return value.toDate().toISOString(); // Firestore Timestamp
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? String(value) : d.toISOString();
};

const isValidDateInput = (value) => !value || !Number.isNaN(new Date(value).getTime());

// Shared error handling: a missing key/certificate is a server setup problem (503), not a client error.
const handleError = (res, error, label) => {
  if (error instanceof signer.SigningNotConfiguredError) {
    return res.status(503).json({ message: error.message, code: error.code });
  }
  console.error(`${label}:`, error);
  return res.status(500).json({ message: 'Unexpected error while processing the signature request.' });
};

const publicSummary = (doc) => {
  const p = doc.payload || {};
  return {
    type: doc.type,
    total: p.total !== undefined ? p.total : p.totalAmount,
    count: p.count !== undefined ? p.count : Array.isArray(p.items) ? p.items.length : null,
    period: p.period || null,
    receiptId: p.expenseId || null,
    issuedAt: p.issuedAt || doc.createdAt || null,
  };
};

// @desc    Sign a statement for the logged-in user's expenses (server recomputes totals from Firestore)
// @route   POST /api/sign/report
// @access  Private
const signReport = async (req, res) => {
  try {
    const { startDate, endDate } = req.body || {};
    if (!isValidDateInput(startDate) || !isValidDateInput(endDate)) {
      return res.status(400).json({ message: 'startDate / endDate must be valid dates' });
    }

    const expenses = await fetchUserExpenses(req.user.id, startDate || null, endDate || null);

    // Canonical, order-independent fingerprint of every transaction in the statement
    const rows = expenses
      .map((e) => ({
        date: toIso(e.date),
        category: e.category || '',
        amount: round2(e.amount),
        description: e.description || '',
        paymentMethod: e.paymentMethod || '',
      }))
      .map((r) => signer.canonicalize(r))
      .sort();
    const algo = signer.getAlgorithm();
    const expensesDigest = crypto.createHash(algo).update(rows.join('\n')).digest('hex');

    const payload = {
      v: 1,
      type: 'report',
      userId: req.user.id,
      period: { start: startDate || null, end: endDate || null },
      count: expenses.length,
      total: round2(expenses.reduce((sum, e) => sum + (Number(e.amount) || 0), 0)),
      expensesDigest,
      issuedAt: new Date().toISOString(),
    };

    const signed = signer.signPayload(payload, algo);
    const docId = newDocId('RR');

    await admin.firestore().collection(COLLECTION).doc(docId).set({
      docId,
      type: 'report',
      userId: req.user.id,
      payload,
      hash: signed.hash,
      signature: signed.signature,
      algorithm: signed.algorithm,
      scheme: signed.scheme,
      certFingerprint: signed.certFingerprint,
      createdAt: payload.issuedAt,
    });

    res.status(201).json({
      docId,
      type: 'report',
      hash: signed.hash,
      algorithm: signed.algorithm,
      scheme: signed.scheme,
      certFingerprint: signed.certFingerprint,
      issuedAt: payload.issuedAt,
      total: payload.total,
      count: payload.count,
      period: payload.period,
    });
  } catch (error) {
    handleError(res, error, 'signReport error');
  }
};

// @desc    Sign a QR split receipt that the user created (qrShares/{expenseId})
// @route   POST /api/sign/receipt
// @access  Private
const signReceipt = async (req, res) => {
  try {
    const { expenseId } = req.body || {};
    if (!expenseId || typeof expenseId !== 'string' || expenseId.length > 100) {
      return res.status(400).json({ message: 'expenseId is required' });
    }

    const db = admin.firestore();
    const shareRef = db.collection('qrShares').doc(expenseId);
    const shareDoc = await shareRef.get();
    if (!shareDoc.exists) {
      return res.status(404).json({ message: 'Receipt not found' });
    }
    const data = shareDoc.data();
    if (data.userId !== req.user.id) {
      return res.status(403).json({ message: 'You can only sign your own receipts' });
    }

    const items = (Array.isArray(data.items) ? data.items : []).map((it) => ({
      description: String(it.description || ''),
      category: String(it.category || ''),
      amount: round2(it.amount),
    }));

    const content = {
      v: 1,
      type: 'receipt',
      userId: req.user.id,
      expenseId,
      items,
      totalAmount: round2(data.totalAmount !== undefined ? data.totalAmount : items.reduce((s, i) => s + i.amount, 0)),
      date: toIso(data.createdAt) || toIso(data.date),
    };
    const algo = signer.getAlgorithm();
    const contentHash = signer.digest(content, algo);

    // Idempotent: same receipt content + same algorithm => return the signature that already exists.
    const existing = await db.collection(COLLECTION).where('sourceId', '==', expenseId).get();
    const match = existing.docs
      .map((d) => d.data())
      .find((d) => d.type === 'receipt' && d.userId === req.user.id && d.contentHash === contentHash && d.algorithm === algo);
    if (match) {
      return res.json({
        docId: match.docId,
        type: 'receipt',
        hash: match.hash,
        algorithm: match.algorithm,
        scheme: match.scheme,
        certFingerprint: match.certFingerprint,
        issuedAt: match.payload.issuedAt,
        total: match.payload.totalAmount,
        count: match.payload.items.length,
        reused: true,
      });
    }

    const payload = { ...content, issuedAt: new Date().toISOString() };
    const signed = signer.signPayload(payload, algo);
    const docId = newDocId('RC');

    await db.collection(COLLECTION).doc(docId).set({
      docId,
      type: 'receipt',
      sourceId: expenseId,
      userId: req.user.id,
      payload,
      contentHash,
      hash: signed.hash,
      signature: signed.signature,
      algorithm: signed.algorithm,
      scheme: signed.scheme,
      certFingerprint: signed.certFingerprint,
      createdAt: payload.issuedAt,
    });

    // Convenience copy on the receipt itself (verification never trusts this copy, only signedDocuments)
    await shareRef.set(
      { signature: { docId, hash: signed.hash, algorithm: signed.algorithm, certFingerprint: signed.certFingerprint } },
      { merge: true }
    );

    res.status(201).json({
      docId,
      type: 'receipt',
      hash: signed.hash,
      algorithm: signed.algorithm,
      scheme: signed.scheme,
      certFingerprint: signed.certFingerprint,
      issuedAt: payload.issuedAt,
      total: payload.totalAmount,
      count: items.length,
      reused: false,
    });
  } catch (error) {
    handleError(res, error, 'signReceipt error');
  }
};

// @desc    Publicly verify a signed document by ID (+ optional hash printed on the document/QR)
// @route   GET /api/verify/:docId?h=<hash>
// @access  Public - returns a minimal summary only (no user ID, no line items)
const verifyDocument = async (req, res) => {
  try {
    res.set('Cache-Control', 'no-store');
    const { docId } = req.params;
    const presentedHash = req.query.h ? String(req.query.h) : null;

    if (!DOC_ID_PATTERN.test(docId)) {
      return res.status(400).json({ found: false, status: 'invalid_id', message: 'Malformed document ID' });
    }
    if (presentedHash && !HASH_PATTERN.test(presentedHash)) {
      return res.status(400).json({ found: false, status: 'invalid_hash', message: 'Malformed hash' });
    }

    const snap = await admin.firestore().collection(COLLECTION).doc(docId).get();
    if (!snap.exists) {
      return res.status(404).json({
        found: false,
        valid: false,
        status: 'not_found',
        message: 'No signed document with this ID exists. The document may be forged.',
      });
    }
    const doc = snap.data();

    const check = signer.verifyPayload(doc.payload, doc);
    const recordValid = check.hashIntact && check.signatureValid && check.certMatches;
    const hashMatches = presentedHash ? presentedHash.toLowerCase() === String(doc.hash).toLowerCase() : null;

    let status = 'valid';
    let message = 'Signature is valid. This record has not been altered since it was signed.';
    if (!recordValid) {
      status = 'tampered';
      message = check.certMatches
        ? 'Signature check FAILED. The stored record does not match its digital signature.'
        : 'This record was signed with a different certificate than the one currently trusted by the server.';
    } else if (hashMatches === false) {
      status = 'hash_mismatch';
      message = 'The record is genuine, but the hash on your document does not match it. The document or QR code may have been altered.';
    }

    res.json({
      found: true,
      valid: status === 'valid',
      status,
      message,
      docId: doc.docId,
      algorithm: doc.algorithm,
      scheme: doc.scheme,
      hash: doc.hash,
      hashMatches,
      certFingerprint: doc.certFingerprint,
      summary: publicSummary(doc),
    });
  } catch (error) {
    if (error instanceof signer.SigningNotConfiguredError) {
      return res.status(503).json({ found: false, status: 'unavailable', message: error.message, code: error.code });
    }
    console.error('verifyDocument error:', error);
    res.status(500).json({ found: false, status: 'error', message: 'Verification failed due to a server error.' });
  }
};

// @desc    Public certificate (lets anyone verify signatures independently, e.g. with openssl)
// @route   GET /api/verify/certificate
// @access  Public
const getCertificate = (req, res) => {
  try {
    res.json(signer.getCertificateInfo());
  } catch (error) {
    handleError(res, error, 'getCertificate error');
  }
};

module.exports = { signReport, signReceipt, verifyDocument, getCertificate };
