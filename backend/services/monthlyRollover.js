'use strict';

// Monthly rollover: when a new month starts, last month's salary + expenses are
//   1) copied into one immutable-looking summary document (monthlyArchives/{uid}_{YYYY-MM})
//   2) flagged `archived: true` so the live pages (Dashboard, Salary, Expenses) start from zero.
// Nothing is deleted, so signed statements and reports keep working.
//
// It runs lazily on the user's first request of a new month (no cron needed, so it also
// works on Render's free plan where the server sleeps). It is safe to run any number of times.

const {
  currentMonthKey, monthKeyOfDate, monthKeyOfSalary, parseKey, labelOfKey, toIso,
} = require('./monthUtils');

const round2 = (n) => Math.round((Number(n) || 0) * 100) / 100;
const BATCH_LIMIT = 400; // Firestore allows 500 writes per batch

const doneThisMonth = new Map(); // userId -> month key already rolled over (per process)
const inFlight = new Map();      // userId -> Promise (de-duplicates parallel requests)

// Build the archive document for one month from its salary and expense records
const buildArchive = (userId, key, salaries, expenses) => {
  const { year, monthIndex } = parseKey(key);
  const salaryTotal = round2(salaries.reduce((s, x) => s + (Number(x.amount) || 0), 0));
  const expenseTotal = round2(expenses.reduce((s, x) => s + (Number(x.amount) || 0), 0));

  const byCategory = {};
  const byPayment = {};
  expenses.forEach((e) => {
    const cat = e.category || 'Others';
    byCategory[cat] = byCategory[cat] || { category: cat, total: 0, count: 0 };
    byCategory[cat].total += Number(e.amount) || 0;
    byCategory[cat].count += 1;
    const pay = e.paymentMethod || 'Other';
    byPayment[pay] = (byPayment[pay] || 0) + (Number(e.amount) || 0);
  });

  return {
    user: userId,
    key,
    year,
    monthIndex,
    label: labelOfKey(key),
    salaryTotal,
    expenseTotal,
    balance: round2(salaryTotal - expenseTotal),
    savingsRate: salaryTotal > 0 ? round2(((salaryTotal - expenseTotal) / salaryTotal) * 100) : null,
    salaryCount: salaries.length,
    expenseCount: expenses.length,
    categoryTotals: Object.values(byCategory)
      .map((c) => ({ ...c, total: round2(c.total) }))
      .sort((a, b) => b.total - a.total),
    paymentTotals: Object.entries(byPayment)
      .map(([method, total]) => ({ method, total: round2(total) }))
      .sort((a, b) => b.total - a.total),
    salaries: salaries.map((s) => ({
      id: s._id, amount: round2(s.amount), month: s.month, year: s.year,
    })),
    expenses: expenses
      .map((e) => ({
        id: e._id,
        date: toIso(e.date),
        category: e.category || 'Others',
        description: e.description || '',
        paymentMethod: e.paymentMethod || '',
        amount: round2(e.amount),
        expenseType: e.expenseType || (e.isMonthly ? 'monthly' : 'daily'),
      }))
      .sort((a, b) => new Date(b.date) - new Date(a.date)),
    archivedAt: new Date().toISOString(),
  };
};

const archiveDocId = (userId, key) => `${userId}_${key}`;

async function runRollover(db, userId, now) {
  const curKey = currentMonthKey(now);

  const [expSnap, salSnap] = await Promise.all([
    db.collection('expenses').where('user', '==', userId).get(),
    db.collection('salaries').where('user', '==', userId).get(),
  ]);
  const expenses = expSnap.docs.map((d) => ({ _id: d.id, ref: d.ref, ...d.data() }));
  const salaries = salSnap.docs.map((d) => ({ _id: d.id, ref: d.ref, ...d.data() }));

  // Group records that belong to a month before the current one
  const months = {}; // key -> { salaries: [], expenses: [], pending: [] (refs still to flag) }
  const bucket = (key) => (months[key] = months[key] || { salaries: [], expenses: [], pending: [] });

  expenses.forEach((e) => {
    const key = e.archived && e.archivedMonth ? e.archivedMonth : monthKeyOfDate(e.date);
    if (!key || key >= curKey) return; // current/future/unknown dates stay live
    bucket(key).expenses.push(e);
    if (!e.archived) bucket(key).pending.push(e.ref);
  });
  salaries.forEach((s) => {
    const key = s.archived && s.archivedMonth ? s.archivedMonth : monthKeyOfSalary(s);
    if (!key || key >= curKey) return;
    bucket(key).salaries.push(s);
    if (!s.archived) bucket(key).pending.push(s.ref);
  });

  const affected = Object.keys(months).filter((k) => months[k].pending.length > 0);
  const archivedAt = new Date().toISOString();

  for (const key of affected) {
    const m = months[key];
    // 1) write the archive first (deterministic id => idempotent if we crash before step 2)
    await db.collection('monthlyArchives').doc(archiveDocId(userId, key))
      .set(buildArchive(userId, key, m.salaries, m.expenses));

    // 2) then take the records off the live pages
    for (let i = 0; i < m.pending.length; i += BATCH_LIMIT) {
      const batch = db.batch();
      m.pending.slice(i, i + BATCH_LIMIT).forEach((ref) => {
        batch.update(ref, { archived: true, archivedMonth: key, archivedAt });
      });
      await batch.commit();
    }
  }

  await db.collection('rolloverState').doc(userId).set({ lastKey: curKey, updatedAt: archivedAt });
  doneThisMonth.set(userId, curKey);
  return { archivedMonths: affected, currentMonth: curKey };
}

/**
 * Archive every record that belongs to a month before the current one.
 * @param {object} db     Firestore instance (admin.firestore())
 * @param {string} userId
 * @param {object} opts   { now: Date, force: boolean }  force skips the "already done this month" shortcut
 */
async function rolloverUser(db, userId, { now = new Date(), force = false } = {}) {
  const curKey = currentMonthKey(now);
  if (!force) {
    if (doneThisMonth.get(userId) === curKey) return { skipped: true, currentMonth: curKey };
    const state = await db.collection('rolloverState').doc(userId).get();
    if (state.exists && state.data().lastKey === curKey) {
      doneThisMonth.set(userId, curKey);
      return { skipped: true, currentMonth: curKey };
    }
  }

  if (inFlight.has(userId)) return inFlight.get(userId);
  const promise = runRollover(db, userId, now).finally(() => inFlight.delete(userId));
  inFlight.set(userId, promise);
  return promise;
}

const resetCacheForTests = () => { doneThisMonth.clear(); inFlight.clear(); };

module.exports = { rolloverUser, buildArchive, archiveDocId, resetCacheForTests };
