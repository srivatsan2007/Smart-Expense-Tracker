/**
 * Monthly rollover test suite.   Run:  npm run test:rollover
 * Uses an in-memory fake Firestore - no Firebase credentials needed.
 */
const assert = require('assert');
const {
  currentMonthKey, monthKeyOfDate, monthKeyOfSalary, labelOfKey, isValidMonthKey,
} = require('../services/monthUtils');
const { rolloverUser, resetCacheForTests } = require('../services/monthlyRollover');

function createFakeFirestore(seed = {}) {
  const store = {};
  Object.keys(seed).forEach((c) => { store[c] = JSON.parse(JSON.stringify(seed[c])); });
  const clone = (v) => JSON.parse(JSON.stringify(v));
  const refOf = (name, id) => ({
    name, id,
    async get() { const d = store[name] && store[name][id]; return { id, exists: d !== undefined, data: () => clone(d) }; },
    async set(data) { store[name] = store[name] || {}; store[name][id] = clone(data); },
  });
  const counters = { queries: 0 };
  return {
    store, counters,
    collection(name) {
      store[name] = store[name] || {};
      return {
        doc: (id) => refOf(name, id),
        where(field, op, value) {
          assert.strictEqual(op, '==');
          return {
            async get() {
              counters.queries += 1;
              const docs = Object.entries(store[name]).filter(([, d]) => d[field] === value)
                .map(([id, d]) => ({ id, ref: refOf(name, id), data: () => clone(d) }));
              return { docs, empty: docs.length === 0 };
            },
          };
        },
      };
    },
    batch() {
      const ops = [];
      return {
        update(ref, data) { ops.push([ref, data]); },
        async commit() { ops.forEach(([ref, data]) => { Object.assign(store[ref.name][ref.id], data); }); },
      };
    },
  };
}

let passed = 0;
async function test(name, fn) {
  try { await fn(); passed += 1; console.log(`  ok  ${name}`); }
  catch (err) { console.error(`  FAIL ${name}\n       ${err.stack}`); process.exitCode = 1; }
}

const NOV_15 = new Date('2026-11-15T10:00:00+05:30');
const seed = () => ({
  expenses: {
    e1: { user: 'u1', amount: 500, category: 'Grocery', date: '2026-10-05', paymentMethod: 'UPI' },
    e2: { user: 'u1', amount: 1500.5, category: 'Rent', date: '2026-10-28T20:00:00.000Z', paymentMethod: 'Cash', expenseType: 'monthly' },
    e3: { user: 'u1', amount: 250, category: 'Petrol', date: '2026-11-02', paymentMethod: 'UPI' },
    e4: { user: 'u1', amount: 99, category: 'Milk', date: '2026-09-30', paymentMethod: 'UPI' },
    e5: { user: 'u2', amount: 777, category: 'Grocery', date: '2026-10-05', paymentMethod: 'UPI' },
    e6: { user: 'u1', amount: 60, category: 'Others', date: 'not a date', paymentMethod: 'UPI' },
  },
  salaries: {
    s1: { user: 'u1', amount: 50000, month: 'October', year: 2026 },
    s2: { user: 'u1', amount: 52000, month: 'November', year: 2026 },
    s3: { user: 'u2', amount: 1, month: 'October', year: 2026 },
  },
});

(async () => {
  console.log('Month helpers');
  await test('currentMonthKey uses the app time zone, not UTC', () => {
    // 1 Dec 00:30 IST is still 30 Nov in UTC
    assert.strictEqual(currentMonthKey(new Date('2026-12-01T00:30:00+05:30')), '2026-12');
    assert.strictEqual(currentMonthKey(new Date('2026-11-30T23:59:00+05:30')), '2026-11');
  });
  await test('monthKeyOfDate handles the formats stored by the app', () => {
    assert.strictEqual(monthKeyOfDate('2026-10-31'), '2026-10');
    assert.strictEqual(monthKeyOfDate(new Date('2026-10-31T19:00:00Z')), '2026-11'); // 00:30 IST on 1 Nov
    assert.strictEqual(monthKeyOfDate(new Date('2026-10-05T10:00:00+05:30').getTime()), '2026-10');
    assert.strictEqual(monthKeyOfDate({ toDate: () => new Date('2026-03-10T10:00:00Z') }), '2026-03');
    assert.strictEqual(monthKeyOfDate('garbage'), null);
    assert.strictEqual(monthKeyOfDate(null), null);
  });
  await test('monthKeyOfSalary + labels + validation', () => {
    assert.strictEqual(monthKeyOfSalary({ month: 'October', year: 2026 }), '2026-10');
    assert.strictEqual(monthKeyOfSalary({ month: 'october', year: '2026' }), '2026-10');
    assert.strictEqual(monthKeyOfSalary({ month: 'Octember', year: 2026 }), null);
    assert.strictEqual(labelOfKey('2026-10'), 'October 2026');
    assert.ok(isValidMonthKey('2026-12') && !isValidMonthKey('2026-13') && !isValidMonthKey('../x'));
  });

  console.log('\nRollover');
  await test('archives past months, leaves current month live, ignores other users', async () => {
    resetCacheForTests();
    const db = createFakeFirestore(seed());
    const r = await rolloverUser(db, 'u1', { now: NOV_15 });
    assert.deepStrictEqual(r.archivedMonths.sort(), ['2026-09', '2026-10']);

    const oct = db.store.monthlyArchives['u1_2026-10'];
    assert.strictEqual(oct.salaryTotal, 50000);
    assert.strictEqual(oct.expenseTotal, 2000.5);
    assert.strictEqual(oct.balance, 47999.5);
    assert.strictEqual(oct.expenseCount, 2);
    assert.strictEqual(oct.label, 'October 2026');
    assert.strictEqual(oct.categoryTotals[0].category, 'Rent');
    assert.ok(db.store.monthlyArchives['u1_2026-09']);

    assert.strictEqual(db.store.expenses.e1.archived, true);
    assert.strictEqual(db.store.expenses.e1.archivedMonth, '2026-10');
    assert.strictEqual(db.store.expenses.e3.archived, undefined, 'current month expense stays live');
    assert.strictEqual(db.store.salaries.s2.archived, undefined, 'current month salary stays live');
    assert.strictEqual(db.store.salaries.s1.archived, true);
    assert.strictEqual(db.store.expenses.e6.archived, undefined, 'unparseable dates are never archived');
    assert.strictEqual(db.store.expenses.e5.archived, undefined, "other user's data untouched");
    assert.strictEqual(db.store.salaries.s3.archived, undefined);
    assert.strictEqual(db.store.monthlyArchives['u2_2026-10'], undefined);
  });

  await test('runs once per month: second call does no queries', async () => {
    resetCacheForTests();
    const db = createFakeFirestore(seed());
    await rolloverUser(db, 'u1', { now: NOV_15 });
    const q = db.counters.queries;
    const again = await rolloverUser(db, 'u1', { now: NOV_15 });
    assert.strictEqual(again.skipped, true);
    assert.strictEqual(db.counters.queries, q);
    // even after a server restart (cache cleared) the saved state avoids the full scan
    resetCacheForTests();
    const afterRestart = await rolloverUser(db, 'u1', { now: NOV_15 });
    assert.strictEqual(afterRestart.skipped, true);
    assert.strictEqual(db.counters.queries, q);
  });

  await test('new month archives the previous month (live data resets to zero)', async () => {
    resetCacheForTests();
    const db = createFakeFirestore(seed());
    await rolloverUser(db, 'u1', { now: NOV_15 });
    const dec = await rolloverUser(db, 'u1', { now: new Date('2026-12-01T00:05:00+05:30') });
    assert.deepStrictEqual(dec.archivedMonths, ['2026-11']);
    assert.strictEqual(db.store.monthlyArchives['u1_2026-11'].salaryTotal, 52000);
    assert.strictEqual(db.store.monthlyArchives['u1_2026-11'].expenseTotal, 250);
    const live = Object.values(db.store.expenses).filter((e) => e.user === 'u1' && !e.archived && e.date !== 'not a date');
    assert.strictEqual(live.length, 0);
  });

  await test('late back-dated entry is merged into the existing archive', async () => {
    resetCacheForTests();
    const db = createFakeFirestore(seed());
    await rolloverUser(db, 'u1', { now: NOV_15 });
    db.store.expenses.late = { user: 'u1', amount: 100, category: 'Medical', date: '2026-10-30', paymentMethod: 'UPI' };
    const r = await rolloverUser(db, 'u1', { now: NOV_15, force: true });
    assert.deepStrictEqual(r.archivedMonths, ['2026-10']);
    const oct = db.store.monthlyArchives['u1_2026-10'];
    assert.strictEqual(oct.expenseCount, 3);
    assert.strictEqual(oct.expenseTotal, 2100.5);
    assert.strictEqual(db.store.expenses.late.archived, true);
  });

  await test('parallel requests are de-duplicated', async () => {
    resetCacheForTests();
    const db = createFakeFirestore(seed());
    const [a, b] = await Promise.all([rolloverUser(db, 'u1', { now: NOV_15 }), rolloverUser(db, 'u1', { now: NOV_15 })]);
    assert.strictEqual(a, b);
  });

  await test('user with no data still completes and records state', async () => {
    resetCacheForTests();
    const db = createFakeFirestore({});
    const r = await rolloverUser(db, 'nobody', { now: NOV_15 });
    assert.deepStrictEqual(r.archivedMonths, []);
    assert.strictEqual(db.store.rolloverState.nobody.lastKey, '2026-11');
  });

  console.log(`\n${passed} tests passed${process.exitCode ? ' (with failures above)' : ''}`);
})();
