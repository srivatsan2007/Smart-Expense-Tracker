/**
 * Digital signature test suite.   Run:  npm run test:signature
 * Uses a throw-away certificate and an in-memory fake Firestore - no Firebase credentials needed.
 */
const assert = require('assert');
const path = require('path');

// ---------------------------------------------------------------------------
// In-memory Firestore stand-in (only the calls the signature code uses)
// ---------------------------------------------------------------------------
function createFakeFirestore(seed = {}) {
  const store = {};
  Object.keys(seed).forEach((c) => {
    store[c] = { ...seed[c] };
  });
  const clone = (v) => JSON.parse(JSON.stringify(v));
  const snapOf = (id, data) => ({ id, exists: data !== undefined, data: () => (data === undefined ? undefined : clone(data)) });

  return {
    store,
    collection(name) {
      store[name] = store[name] || {};
      return {
        doc(id) {
          return {
            async get() {
              return snapOf(id, store[name][id]);
            },
            async set(data, opts) {
              store[name][id] = opts && opts.merge ? { ...(store[name][id] || {}), ...clone(data) } : clone(data);
            },
          };
        },
        where(field, op, value) {
          assert.strictEqual(op, '==');
          return {
            async get() {
              const docs = Object.entries(store[name])
                .filter(([, d]) => d[field] === value)
                .map(([id, d]) => snapOf(id, d));
              return { docs, empty: docs.length === 0 };
            },
          };
        },
      };
    },
  };
}

function createRes() {
  return {
    statusCode: 200,
    body: null,
    headers: {},
    status(code) { this.statusCode = code; return this; },
    json(obj) { this.body = obj; return this; },
    set(k, v) { this.headers[k] = v; return this; },
  };
}

let passed = 0;
async function test(name, fn) {
  try {
    await fn();
    passed += 1;
    console.log('  PASS  ' + name);
  } catch (err) {
    console.error('  FAIL  ' + name);
    console.error(err);
    process.exitCode = 1;
  }
}

async function main() {
  console.log('================================================================');
  console.log('RUPEERISE DIGITAL SIGNATURE TEST SUITE');
  console.log('================================================================');

  // Throw-away certificate
  const { generateSigningMaterial } = require('../scripts/generate-signing-cert');
  const { privateKeyPem, certPem } = await generateSigningMaterial({ days: 30 });
  process.env.SIGN_PRIVATE_KEY = Buffer.from(privateKeyPem).toString('base64'); // base64 form, as on Render
  process.env.SIGN_CERT_PEM = certPem;
  delete process.env.SIGN_ALGO;

  // Replace backend/db.js (firebase-admin) with the fake
  let fakeDb = createFakeFirestore();
  const dbPath = require.resolve(path.join(__dirname, '..', 'db.js'));
  require.cache[dbPath] = {
    id: dbPath, filename: dbPath, loaded: true,
    exports: { admin: { firestore: () => fakeDb }, connectDB: async () => {} },
  };

  const signer = require('../services/signer');
  const ctrl = require('../controllers/signatureController');

  const seedExpenses = () => ({
    e1: { user: 'user-1', date: '2026-11-02T10:00:00.000Z', category: 'Food', amount: 250.5, description: 'Lunch', paymentMethod: 'UPI' },
    e2: { user: 'user-1', date: '2026-11-05T10:00:00.000Z', category: 'Travel', amount: 120, description: 'Bus', paymentMethod: 'Cash' },
    e3: { user: 'user-1', date: '2026-09-01T10:00:00.000Z', category: 'Rent', amount: 9000, description: 'Old rent', paymentMethod: 'UPI' },
    x1: { user: 'someone-else', date: '2026-11-03T10:00:00.000Z', category: 'Food', amount: 999, description: 'Not mine', paymentMethod: 'UPI' },
  });
  const resetDb = () => {
    fakeDb = createFakeFirestore({
      expenses: seedExpenses(),
      qrShares: {
        EXP1: { userId: 'user-1', expenseId: 'EXP1', items: [{ description: 'Pizza', category: 'Food', amount: 300 }, { description: 'Cola', category: 'Food', amount: 60.25 }], totalAmount: 360.25, createdAt: { toDate: () => new Date('2026-11-10T08:00:00Z') } },
      },
    });
  };
  resetDb();

  console.log('\n[Suite 1: signer service]');

  await test('canonicalize is independent of key order, at every depth', () => {
    const a = signer.canonicalize({ b: 1, a: { y: 2, x: [3, { q: 1, p: 2 }] } });
    const b = signer.canonicalize({ a: { x: [3, { p: 2, q: 1 }], y: 2 }, b: 1 });
    assert.strictEqual(a, b);
  });

  await test('defaults to SHA-256 and RSA-2048 certificate is loaded', () => {
    assert.strictEqual(signer.getAlgorithm(), 'sha256');
    const info = signer.getCertificateInfo();
    assert.strictEqual(info.scheme, 'RSA-SHA256');
    assert.strictEqual(info.keyBits, 2048);
    assert.ok(/^([0-9A-F]{2}:){31}[0-9A-F]{2}$/.test(info.fingerprint256), 'SHA-256 fingerprint format');
  });

  await test('sign -> verify round trip succeeds', () => {
    const payload = { type: 'report', total: 100.5, count: 3 };
    const signed = signer.signPayload(payload);
    assert.strictEqual(signed.hash.length, 64); // 256-bit digest
    const check = signer.verifyPayload(payload, signed);
    assert.ok(check.hashIntact && check.signatureValid && check.certMatches);
  });

  await test('changing a single value breaks hash and signature', () => {
    const payload = { type: 'report', total: 100.5, count: 3 };
    const signed = signer.signPayload(payload);
    const check = signer.verifyPayload({ ...payload, total: 100.6 }, signed);
    assert.strictEqual(check.hashIntact, false);
    assert.strictEqual(check.signatureValid, false);
  });

  await test('a forged signature (hash recomputed by attacker) is rejected', () => {
    const forged = { type: 'report', total: 1, count: 1 };
    const record = { algorithm: 'sha256', hash: signer.digest(forged, 'sha256'), signature: Buffer.from('not-a-real-signature').toString('base64') };
    const check = signer.verifyPayload(forged, record);
    assert.strictEqual(check.hashIntact, true); // attacker can fix the hash...
    assert.strictEqual(check.signatureValid, false); // ...but cannot fix the signature
  });

  await test('SHA-1 can be selected for legacy use and still verifies', () => {
    process.env.SIGN_ALGO = 'sha1';
    const origWarn = console.warn; console.warn = () => {};
    const signed = signer.signPayload({ a: 1 });
    console.warn = origWarn;
    assert.strictEqual(signed.hash.length, 40);
    assert.strictEqual(signed.scheme, 'RSA-SHA1');
    assert.ok(signer.verifyPayload({ a: 1 }, signed).signatureValid);
    delete process.env.SIGN_ALGO;
  });

  await test('unsupported algorithm is rejected', () => {
    process.env.SIGN_ALGO = 'md5';
    assert.throws(() => signer.getAlgorithm(), /Unsupported SIGN_ALGO/);
    delete process.env.SIGN_ALGO;
  });

  console.log('\n[Suite 2: sign + verify API]');

  let reportSig;
  await test('signReport signs only the caller\'s expenses in the date range', async () => {
    const res = createRes();
    await ctrl.signReport({ user: { id: 'user-1' }, body: { startDate: '2026-11-01', endDate: '2026-11-30' } }, res);
    assert.strictEqual(res.statusCode, 201);
    assert.strictEqual(res.body.total, 370.5); // 250.5 + 120 (not the Sept rent, not another user's 999)
    assert.strictEqual(res.body.count, 2);
    assert.ok(/^RR-\d{4}-[0-9A-F]{12}$/.test(res.body.docId));
    assert.strictEqual(res.body.scheme, 'RSA-SHA256');
    reportSig = res.body;
  });

  await test('verify: genuine report is valid, with matching hash', async () => {
    const res = createRes();
    await ctrl.verifyDocument({ params: { docId: reportSig.docId }, query: { h: reportSig.hash } }, res);
    assert.strictEqual(res.statusCode, 200);
    assert.strictEqual(res.body.status, 'valid');
    assert.strictEqual(res.body.hashMatches, true);
    assert.strictEqual(res.body.summary.total, 370.5);
    assert.strictEqual(res.headers['Cache-Control'], 'no-store');
  });

  await test('verify: public response does not leak user ID or line items', async () => {
    const res = createRes();
    await ctrl.verifyDocument({ params: { docId: reportSig.docId }, query: {} }, res);
    const text = JSON.stringify(res.body);
    assert.ok(!text.includes('user-1'));
    assert.ok(!text.includes('Lunch'));
    assert.ok(!text.includes('"signature"'));
  });

  await test('verify: hash printed on the document does not match -> hash_mismatch', async () => {
    const res = createRes();
    await ctrl.verifyDocument({ params: { docId: reportSig.docId }, query: { h: 'a'.repeat(64) } }, res);
    assert.strictEqual(res.body.status, 'hash_mismatch');
    assert.strictEqual(res.body.valid, false);
  });

  await test('verify: editing the stored total in the database is detected', async () => {
    const stored = fakeDb.store.signedDocuments[reportSig.docId];
    const original = stored.payload.total;
    stored.payload.total = 99999; // attacker edits Firestore
    const res = createRes();
    await ctrl.verifyDocument({ params: { docId: reportSig.docId }, query: {} }, res);
    assert.strictEqual(res.body.status, 'tampered');
    assert.strictEqual(res.body.valid, false);
    stored.payload.total = original; // restore
    const res2 = createRes();
    await ctrl.verifyDocument({ params: { docId: reportSig.docId }, query: {} }, res2);
    assert.strictEqual(res2.body.status, 'valid');
  });

  await test('verify: unknown and malformed IDs', async () => {
    const r1 = createRes();
    await ctrl.verifyDocument({ params: { docId: 'RR-2026-AAAAAAAAAAAA' }, query: {} }, r1);
    assert.strictEqual(r1.statusCode, 404);
    assert.strictEqual(r1.body.status, 'not_found');
    const r2 = createRes();
    await ctrl.verifyDocument({ params: { docId: '../../etc/passwd' }, query: {} }, r2);
    assert.strictEqual(r2.statusCode, 400);
  });

  await test('signReport rejects invalid dates', async () => {
    const res = createRes();
    await ctrl.signReport({ user: { id: 'user-1' }, body: { startDate: 'not-a-date' } }, res);
    assert.strictEqual(res.statusCode, 400);
  });

  let receiptSig;
  await test('signReceipt signs the owner\'s receipt and stores a copy on it', async () => {
    const res = createRes();
    await ctrl.signReceipt({ user: { id: 'user-1' }, body: { expenseId: 'EXP1' } }, res);
    assert.strictEqual(res.statusCode, 201);
    assert.strictEqual(res.body.total, 360.25);
    assert.strictEqual(res.body.count, 2);
    assert.ok(/^RC-/.test(res.body.docId));
    assert.strictEqual(fakeDb.store.qrShares.EXP1.signature.docId, res.body.docId);
    receiptSig = res.body;
  });

  await test('signReceipt is idempotent while the receipt is unchanged', async () => {
    const res = createRes();
    await ctrl.signReceipt({ user: { id: 'user-1' }, body: { expenseId: 'EXP1' } }, res);
    assert.strictEqual(res.statusCode, 200);
    assert.strictEqual(res.body.reused, true);
    assert.strictEqual(res.body.docId, receiptSig.docId);
    assert.strictEqual(Object.keys(fakeDb.store.signedDocuments).filter((k) => k.startsWith('RC-')).length, 1);
  });

  await test('signReceipt issues a NEW signature if the receipt content changed', async () => {
    fakeDb.store.qrShares.EXP1.totalAmount = 400;
    const res = createRes();
    await ctrl.signReceipt({ user: { id: 'user-1' }, body: { expenseId: 'EXP1' } }, res);
    assert.strictEqual(res.statusCode, 201);
    assert.notStrictEqual(res.body.docId, receiptSig.docId);
    assert.strictEqual(res.body.total, 400);
    fakeDb.store.qrShares.EXP1.totalAmount = 360.25;
  });

  await test('signReceipt refuses another user\'s receipt (403) and unknown receipt (404)', async () => {
    const r1 = createRes();
    await ctrl.signReceipt({ user: { id: 'user-2' }, body: { expenseId: 'EXP1' } }, r1);
    assert.strictEqual(r1.statusCode, 403);
    const r2 = createRes();
    await ctrl.signReceipt({ user: { id: 'user-1' }, body: { expenseId: 'NOPE' } }, r2);
    assert.strictEqual(r2.statusCode, 404);
    const r3 = createRes();
    await ctrl.signReceipt({ user: { id: 'user-1' }, body: {} }, r3);
    assert.strictEqual(r3.statusCode, 400);
  });

  await test('certificate endpoint exposes only public data', () => {
    const res = createRes();
    ctrl.getCertificate({}, res);
    assert.ok(res.body.pem.includes('BEGIN CERTIFICATE'));
    assert.ok(!JSON.stringify(res.body).includes('PRIVATE KEY'));
  });

  await test('missing key/certificate gives 503 (not a crash, not a fake signature)', async () => {
    const savedKey = process.env.SIGN_PRIVATE_KEY;
    const savedCert = process.env.SIGN_CERT_PEM;
    delete process.env.SIGN_PRIVATE_KEY;
    delete process.env.SIGN_CERT_PEM;
    signer.resetForTests();
    const res = createRes();
    await ctrl.signReport({ user: { id: 'user-1' }, body: {} }, res);
    // (only meaningful when no key files exist in backend/certs on this machine)
    if (!signer.isConfigured()) {
      assert.strictEqual(res.statusCode, 503);
      assert.strictEqual(res.body.code, 'SIGNING_NOT_CONFIGURED');
    }
    process.env.SIGN_PRIVATE_KEY = savedKey;
    process.env.SIGN_CERT_PEM = savedCert;
    signer.resetForTests();
  });

  await test('a key that does not belong to the certificate is rejected', async () => {
    const other = await generateSigningMaterial({ days: 30 });
    const savedKey = process.env.SIGN_PRIVATE_KEY;
    process.env.SIGN_PRIVATE_KEY = other.privateKeyPem;
    signer.resetForTests();
    assert.throws(() => signer.signPayload({ a: 1 }), /does not match/);
    process.env.SIGN_PRIVATE_KEY = savedKey;
    signer.resetForTests();
  });

  console.log(`\n${passed} tests passed${process.exitCode ? ' (with failures above)' : ''}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
