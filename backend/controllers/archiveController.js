'use strict';

const crypto = require('crypto');
const PDFDocument = require('pdfkit');
const ExcelJS = require('exceljs');
const { admin } = require('../db');
const { isValidMonthKey } = require('../services/monthUtils');
const { archiveDocId } = require('../services/monthlyRollover');

const SHARE_COLLECTION = 'archiveShares';
const TOKEN_PATTERN = /^[A-Za-z0-9_-]{20,64}$/;
const ALLOWED_SHARE_DAYS = [1, 7, 30];

// Helvetica (built into PDFs) has no ₹ glyph, so PDFs use "Rs."
const rs = (n) => `Rs. ${Number(n || 0).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
const fmtDate = (iso) => {
  if (!iso) return '';
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? String(iso) : d.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric', timeZone: 'Asia/Kolkata' });
};

const loadArchive = async (userId, key) => {
  const doc = await admin.firestore().collection('monthlyArchives').doc(archiveDocId(userId, key)).get();
  return doc.exists ? doc.data() : null;
};

// Summary only (no line items, no user id)
const toSummary = (a) => ({
  key: a.key, label: a.label, year: a.year, monthIndex: a.monthIndex,
  salaryTotal: a.salaryTotal, expenseTotal: a.expenseTotal, balance: a.balance,
  savingsRate: a.savingsRate, salaryCount: a.salaryCount, expenseCount: a.expenseCount,
  archivedAt: a.archivedAt,
});

const withoutUser = (a) => {
  const { user, ...rest } = a; // eslint-disable-line no-unused-vars
  return rest;
};

const badKey = (res) => res.status(400).json({ message: 'Invalid month. Use the format YYYY-MM.' });

// @route GET /api/archives
const listArchives = async (req, res) => {
  try {
    const snap = await admin.firestore().collection('monthlyArchives').where('user', '==', req.user.id).get();
    const list = snap.docs.map((d) => toSummary(d.data())).sort((a, b) => (a.key < b.key ? 1 : -1));
    res.json(list);
  } catch (error) {
    console.error('listArchives error:', error.message);
    res.status(500).json({ message: 'Could not load monthly history.' });
  }
};

// @route GET /api/archives/:key
const getArchive = async (req, res) => {
  try {
    if (!isValidMonthKey(req.params.key)) return badKey(res);
    const archive = await loadArchive(req.user.id, req.params.key);
    if (!archive) return res.status(404).json({ message: 'No archive for this month.' });
    res.json(withoutUser(archive));
  } catch (error) {
    console.error('getArchive error:', error.message);
    res.status(500).json({ message: 'Could not load this month.' });
  }
};

// @route GET /api/archives/:key/pdf
const downloadPdf = async (req, res) => {
  try {
    if (!isValidMonthKey(req.params.key)) return badKey(res);
    const a = await loadArchive(req.user.id, req.params.key);
    if (!a) return res.status(404).json({ message: 'No archive for this month.' });

    const doc = new PDFDocument({ margin: 40, size: 'A4' });
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename=RupeeRise_${a.key}_Statement.pdf`);
    doc.pipe(res);

    const left = doc.page.margins.left;
    const width = doc.page.width - left - doc.page.margins.right;
    const bottom = () => doc.page.height - doc.page.margins.bottom - 20;

    // Header band
    doc.rect(0, 0, doc.page.width, 78).fill('#1F3328');
    doc.fillColor('#FFFFFF').fontSize(20).font('Helvetica-Bold').text('RupeeRise', left, 24);
    doc.fontSize(11).font('Helvetica').text(`Monthly Statement - ${a.label}`, left, 50);
    doc.fillColor('#000000');
    doc.y = 96;

    // Summary
    const summary = [
      ['Total income', rs(a.salaryTotal)],
      ['Total expenses', rs(a.expenseTotal)],
      ['Balance', rs(a.balance)],
      ['Savings rate', a.savingsRate === null ? '-' : `${a.savingsRate}%`],
    ];
    doc.font('Helvetica-Bold').fontSize(13).text('Summary', left, doc.y);
    doc.moveDown(0.4);
    summary.forEach(([k, v]) => {
      const y = doc.y;
      doc.font('Helvetica').fontSize(11).text(k, left, y);
      doc.font('Helvetica-Bold').text(v, left, y, { width, align: 'right' });
      doc.moveDown(0.3);
    });
    doc.moveDown(0.6);

    const table = (title, columns, rows) => {
      if (doc.y > bottom() - 60) doc.addPage();
      doc.font('Helvetica-Bold').fontSize(13).fillColor('#000000').text(title, left, doc.y);
      doc.moveDown(0.4);
      const drawHeader = () => {
        const y = doc.y;
        doc.rect(left, y - 2, width, 18).fill('#EEF3EF');
        doc.fillColor('#1F3328').font('Helvetica-Bold').fontSize(9);
        columns.forEach((c) => doc.text(c.label, c.x, y + 2, { width: c.w, align: c.align || 'left' }));
        doc.fillColor('#000000');
        doc.y = y + 20;
      };
      drawHeader();
      if (rows.length === 0) {
        doc.font('Helvetica-Oblique').fontSize(9).fillColor('#666666').text('No entries', left + 4, doc.y);
        doc.fillColor('#000000').moveDown(0.8);
        return;
      }
      rows.forEach((r) => {
        if (doc.y > bottom()) { doc.addPage(); drawHeader(); }
        const y = doc.y;
        doc.font('Helvetica').fontSize(9);
        let rowH = 12;
        columns.forEach((c, i) => {
          const text = String(r[i] ?? '');
          const h = doc.heightOfString(text, { width: c.w });
          rowH = Math.max(rowH, h);
          doc.text(text, c.x, y, { width: c.w, align: c.align || 'left' });
        });
        doc.y = y + rowH + 4;
      });
      doc.moveDown(0.8);
    };

    const cx = (offsets) => offsets; // readability helper
    table('Spending by category',
      cx([{ label: 'Category', x: left, w: 220 }, { label: 'Entries', x: left + 230, w: 70, align: 'right' }, { label: 'Amount', x: left + 310, w: width - 310, align: 'right' }]),
      a.categoryTotals.map((c) => [c.category, c.count, rs(c.total)]));

    table('Income',
      cx([{ label: 'Period', x: left, w: 220 }, { label: 'Amount', x: left + 230, w: width - 230, align: 'right' }]),
      a.salaries.map((s) => [`${s.month} ${s.year}`, rs(s.amount)]));

    table('Expenses',
      cx([
        { label: 'Date', x: left, w: 70 },
        { label: 'Category', x: left + 75, w: 90 },
        { label: 'Description', x: left + 170, w: 150 },
        { label: 'Method', x: left + 325, w: 70 },
        { label: 'Amount', x: left + 400, w: width - 400, align: 'right' },
      ]),
      a.expenses.map((e) => [fmtDate(e.date), e.category, e.description, e.paymentMethod, rs(e.amount)]));

    doc.font('Helvetica-Oblique').fontSize(8).fillColor('#777777')
      .text(`Archived on ${fmtDate(a.archivedAt)} - Generated by RupeeRise`, left, doc.y + 6, { width, align: 'center' });

    doc.end();
  } catch (error) {
    console.error('downloadPdf error:', error.message);
    if (!res.headersSent) res.status(500).json({ message: 'Could not create the PDF.' });
    else res.end();
  }
};

// @route GET /api/archives/:key/excel
const downloadExcel = async (req, res) => {
  try {
    if (!isValidMonthKey(req.params.key)) return badKey(res);
    const a = await loadArchive(req.user.id, req.params.key);
    if (!a) return res.status(404).json({ message: 'No archive for this month.' });

    const money = '"₹"#,##0.00';
    const wb = new ExcelJS.Workbook();
    wb.creator = 'RupeeRise';

    const head = (ws) => { ws.getRow(1).font = { bold: true }; ws.views = [{ state: 'frozen', ySplit: 1 }]; };

    const sum = wb.addWorksheet('Summary');
    sum.columns = [{ header: 'Item', key: 'k', width: 24 }, { header: 'Value', key: 'v', width: 22 }];
    sum.addRows([
      { k: 'Month', v: a.label },
      { k: 'Total income', v: a.salaryTotal },
      { k: 'Total expenses', v: a.expenseTotal },
      { k: 'Balance', v: a.balance },
      { k: 'Savings rate (%)', v: a.savingsRate },
      { k: 'Income entries', v: a.salaryCount },
      { k: 'Expense entries', v: a.expenseCount },
    ]);
    [2, 3, 4].forEach((r) => { sum.getCell(`B${r + 1}`).numFmt = money; });
    head(sum);

    const inc = wb.addWorksheet('Income');
    inc.columns = [{ header: 'Month', key: 'month', width: 16 }, { header: 'Year', key: 'year', width: 10 }, { header: 'Amount', key: 'amount', width: 16, style: { numFmt: money } }];
    a.salaries.forEach((s) => inc.addRow(s));
    head(inc);

    const exp = wb.addWorksheet('Expenses');
    exp.columns = [
      { header: 'Date', key: 'date', width: 14 }, { header: 'Category', key: 'category', width: 18 },
      { header: 'Description', key: 'description', width: 34 }, { header: 'Payment Method', key: 'paymentMethod', width: 18 },
      { header: 'Type', key: 'expenseType', width: 10 }, { header: 'Amount', key: 'amount', width: 16, style: { numFmt: money } },
    ];
    a.expenses.forEach((e) => exp.addRow({ ...e, date: e.date ? new Date(e.date) : null }));
    exp.getColumn('date').numFmt = 'dd-mmm-yyyy';
    head(exp);

    const cat = wb.addWorksheet('Categories');
    cat.columns = [{ header: 'Category', key: 'category', width: 22 }, { header: 'Entries', key: 'count', width: 10 }, { header: 'Total', key: 'total', width: 16, style: { numFmt: money } }];
    a.categoryTotals.forEach((c) => cat.addRow(c));
    head(cat);

    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', `attachment; filename=RupeeRise_${a.key}_Statement.xlsx`);
    await wb.xlsx.write(res);
    res.end();
  } catch (error) {
    console.error('downloadExcel error:', error.message);
    if (!res.headersSent) res.status(500).json({ message: 'Could not create the Excel file.' });
    else res.end();
  }
};

// ---------------------------------------------------------------- sharing (QR)

// @route POST /api/archives/:key/share   body: { days: 1|7|30, includeDetails: boolean }
const createShare = async (req, res) => {
  try {
    if (!isValidMonthKey(req.params.key)) return badKey(res);
    const archive = await loadArchive(req.user.id, req.params.key);
    if (!archive) return res.status(404).json({ message: 'No archive for this month.' });

    const days = ALLOWED_SHARE_DAYS.includes(Number(req.body && req.body.days)) ? Number(req.body.days) : 7;
    const includeDetails = !!(req.body && req.body.includeDetails);
    const token = crypto.randomBytes(24).toString('base64url');
    const now = Date.now();
    const share = {
      token,
      user: req.user.id,
      archiveKey: req.params.key,
      includeDetails,
      createdAt: new Date(now).toISOString(),
      expiresAt: new Date(now + days * 24 * 60 * 60 * 1000).toISOString(),
    };
    await admin.firestore().collection(SHARE_COLLECTION).doc(token).set(share);
    res.status(201).json({ token, includeDetails, createdAt: share.createdAt, expiresAt: share.expiresAt });
  } catch (error) {
    console.error('createShare error:', error.message);
    res.status(500).json({ message: 'Could not create the share link.' });
  }
};

// @route GET /api/archives/:key/shares   (active links for this month)
const listShares = async (req, res) => {
  try {
    if (!isValidMonthKey(req.params.key)) return badKey(res);
    const snap = await admin.firestore().collection(SHARE_COLLECTION).where('user', '==', req.user.id).get();
    const nowIso = new Date().toISOString();
    const shares = snap.docs.map((d) => d.data())
      .filter((s) => s.archiveKey === req.params.key && s.expiresAt > nowIso)
      .map(({ token, includeDetails, createdAt, expiresAt }) => ({ token, includeDetails, createdAt, expiresAt }))
      .sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1));
    res.json(shares);
  } catch (error) {
    console.error('listShares error:', error.message);
    res.status(500).json({ message: 'Could not load share links.' });
  }
};

// @route DELETE /api/archives/:key/share/:token
const revokeShare = async (req, res) => {
  try {
    const { token } = req.params;
    if (!TOKEN_PATTERN.test(token)) return res.status(400).json({ message: 'Invalid link.' });
    const ref = admin.firestore().collection(SHARE_COLLECTION).doc(token);
    const doc = await ref.get();
    if (!doc.exists) return res.status(404).json({ message: 'Link not found.' });
    if (doc.data().user !== req.user.id) return res.status(403).json({ message: 'Not allowed.' });
    await ref.delete();
    res.json({ message: 'Link revoked.' });
  } catch (error) {
    console.error('revokeShare error:', error.message);
    res.status(500).json({ message: 'Could not revoke the link.' });
  }
};

// @route GET /api/shared/:token   (PUBLIC - whoever holds the QR/link can read it until it expires)
const getSharedArchive = async (req, res) => {
  try {
    res.set('Cache-Control', 'no-store');
    res.set('X-Robots-Tag', 'noindex, nofollow');
    const { token } = req.params;
    if (!TOKEN_PATTERN.test(token)) return res.status(404).json({ status: 'not_found', message: 'This link is not valid.' });

    const db = admin.firestore();
    const shareDoc = await db.collection(SHARE_COLLECTION).doc(token).get();
    if (!shareDoc.exists) return res.status(404).json({ status: 'not_found', message: 'This link is not valid or was revoked.' });
    const share = shareDoc.data();
    if (share.expiresAt <= new Date().toISOString()) {
      return res.status(410).json({ status: 'expired', message: 'This link has expired.' });
    }

    const archive = await loadArchive(share.user, share.archiveKey);
    if (!archive) return res.status(404).json({ status: 'not_found', message: 'This statement is no longer available.' });

    const out = {
      status: 'ok',
      ...toSummary(archive),
      categoryTotals: archive.categoryTotals,
      includeDetails: !!share.includeDetails,
      expiresAt: share.expiresAt,
    };
    if (share.includeDetails) {
      out.salaries = archive.salaries.map(({ month, year, amount }) => ({ month, year, amount }));
      out.expenses = archive.expenses.map(({ date, category, description, paymentMethod, amount }) => ({ date, category, description, paymentMethod, amount }));
    }
    res.json(out);
  } catch (error) {
    console.error('getSharedArchive error:', error.message);
    res.status(500).json({ status: 'error', message: 'Could not load this statement.' });
  }
};

module.exports = {
  listArchives, getArchive, downloadPdf, downloadExcel,
  createShare, listShares, revokeShare, getSharedArchive,
};
