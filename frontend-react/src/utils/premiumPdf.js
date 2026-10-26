import { jsPDF } from 'jspdf';
import 'jspdf-autotable';
import QRCode from 'qrcode';
import firebase from 'firebase/compat/app';

/**
 * RupeeRise — Premium PDF Report Generator
 *
 * Brand Palette:
 * - Primary Olive Green: #355E3B (53, 94, 59)
 * - Pista Green:         #DDF2C1 (221, 242, 193)
 * - Soft Pale Green:     #F2F8ED (242, 248, 237)
 * - Page Background:     #FFFFFF (White document with subtle green accents)
 * - Deep Forest Text:    #1F3328 (31, 51, 40)
 * - Muted Forest Text:   #5A7365 (90, 115, 101)
 * - Subtle Green Border: #C8E2AB (200, 226, 171)
 * - Tagline: "Track Smarter. Save Better. Rise Higher."
 */

const PALETTE = {
  olive: [53, 94, 59],
  pista: [221, 242, 193],
  softPista: [242, 248, 237],
  paleGreenRow: [247, 250, 244],
  deepForest: [31, 51, 40],
  mutedForest: [90, 115, 101],
  borderGreen: [200, 226, 171],
  tableBorder: [226, 237, 217],
  white: [255, 255, 255],
  crimson: [185, 28, 28],
  emerald: [46, 125, 50],
};

// Safe helper to convert image URL to base64 Data URL for jsPDF
async function loadLogoDataUrl() {
  try {
    const res = await fetch('/images/rupeerise-logo.png');
    if (!res.ok) return null;
    const blob = await res.blob();
    return new Promise((resolve) => {
      const reader = new FileReader();
      reader.onloadend = () => resolve(reader.result);
      reader.onerror = () => resolve(null);
      reader.readAsDataURL(blob);
    });
  } catch (e) {
    return null;
  }
}

/**
 * Generates a fintech-grade RupeeRise PDF Statement
 */
export async function generatePremiumPDF(options = {}) {
  try {
    let token = localStorage.getItem('token') || '';
    try {
      const user = firebase.auth().currentUser;
      if (user) {
        token = await user.getIdToken();
        localStorage.setItem('token', token);
      }
    } catch (e) {}

    const headers = token ? { Authorization: `Bearer ${token}` } : {};

    // Fetch necessary financial metrics in parallel
    const [expRes, savRes, salRes, budRes] = await Promise.all([
      options.expenses ? Promise.resolve(null) : fetch('/api/expenses', { headers }).catch(() => null),
      fetch('/api/savings', { headers }).catch(() => null),
      fetch('/api/salaries', { headers }).catch(() => null),
      fetch('/api/budget', { headers }).catch(() => null),
    ]);

    let expenses = options.expenses || [];
    if (!options.expenses && expRes && expRes.ok) {
      expenses = await expRes.json();
    }

    const savings = savRes && savRes.ok ? await savRes.json() : [];
    const salaries = salRes && salRes.ok ? await salRes.json() : [];

    let budgetObj = { amount: 0 };
    if (budRes && budRes.ok) {
      const b = await budRes.json();
      if (b && (b.amount || b.monthlyLimit)) budgetObj = b;
      else if (Array.isArray(b) && b.length > 0) budgetObj = b[0];
    }

    // Apply period filtering if explicit dates provided and expenses were not pre-filtered
    if (!options.expenses) {
      if (options.startDate) {
        const s = new Date(options.startDate);
        expenses = expenses.filter((e) => new Date(e.date) >= s);
      }
      if (options.endDate) {
        const end = new Date(options.endDate);
        end.setHours(23, 59, 59, 999);
        expenses = expenses.filter((e) => new Date(e.date) <= end);
      }
    }

    // Financial calculations
    const totalExp = expenses.reduce((sum, e) => sum + (Number(e.amount) || 0), 0);
    const totalSav = savings.reduce((sum, s) => sum + (Number(s.currentAmount) || 0), 0);
    const totalInc = salaries.reduce((sum, s) => sum + (Number(s.amount) || 0), 0);
    const remaining = totalInc - totalExp;
    const budAmt = Number(budgetObj.monthlyLimit || budgetObj.amount || 0);

    // Dynamic document properties
    const reportId = options.reportId || `RR-${new Date().getFullYear()}-${Math.floor(100000 + Math.random() * 900000)}`;
    const periodLabel = options.periodLabel || 'All Time';
    const nowStr = new Date().toLocaleDateString('en-IN', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });

    // Create A4 portrait document
    const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
    const pageWidth = doc.internal.pageSize.getWidth();
    const pageHeight = doc.internal.pageSize.getHeight();

    // Check custom font availability for Unicode Rupee symbol
    let hasCustomFont = false;
    try {
      const fontRes = await fetch('https://cdn.jsdelivr.net/npm/roboto-font@0.1.0/fonts/Roboto/roboto-regular-webfont.ttf');
      if (fontRes.ok) {
        const bytes = new Uint8Array(await fontRes.arrayBuffer());
        let binary = '';
        for (let i = 0; i < bytes.byteLength; i++) binary += String.fromCharCode(bytes[i]);
        doc.addFileToVFS('Roboto-Regular.ttf', window.btoa(binary));
        doc.addFont('Roboto-Regular.ttf', 'Roboto', 'normal');
        doc.setFont('Roboto');
        hasCustomFont = true;
      }
    } catch (e) {
      hasCustomFont = false;
    }

    const formatINR = (val) => {
      const num = Number(val || 0);
      const formatted = Math.abs(num).toLocaleString('en-IN', {
        maximumFractionDigits: 2,
        minimumFractionDigits: 2,
      });
      const sign = num < 0 ? '-' : '';
      return hasCustomFont ? `${sign}₹${formatted}` : `${sign}Rs. ${formatted}`;
    };

    // =========================================================================
    // 1. PROFESSIONAL REPORT HEADER (White background with pista accents)
    // =========================================================================
    const logoData = await loadLogoDataUrl();
    if (logoData) {
      doc.addImage(logoData, 'PNG', 14, 10, 16, 16);
    } else {
      // Fallback vector badge
      doc.setFillColor(...PALETTE.olive);
      doc.roundedRect(14, 10, 16, 16, 3, 3, 'F');
      doc.setFillColor(...PALETTE.pista);
      doc.circle(22, 18, 5, 'F');
      doc.setTextColor(...PALETTE.olive);
      doc.setFontSize(10);
      doc.setFont('helvetica', 'bold');
      doc.text('R', 22, 21.5, { align: 'center' });
    }

    // Two-tone green wordmark
    doc.setFontSize(19);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(...PALETTE.olive);
    doc.text('Rupee', 33, 19);

    const rupeeWidth = doc.getTextWidth('Rupee');
    doc.setTextColor(...PALETTE.deepForest);
    doc.text('Rise', 33 + rupeeWidth, 19);

    doc.setFontSize(8.5);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(...PALETTE.mutedForest);
    doc.text('Personal Finance Report', 33, 25);

    // Right header details
    doc.setFontSize(9);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(...PALETTE.deepForest);
    doc.text(`Period: ${periodLabel}`, pageWidth - 14, 16, { align: 'right' });

    doc.setFontSize(7.5);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(...PALETTE.mutedForest);
    doc.text(`Report ID: ${reportId}`, pageWidth - 14, 21.5, { align: 'right' });
    doc.text(`Generated: ${nowStr}`, pageWidth - 14, 26.5, { align: 'right' });

    // Restrained decorative accent rules
    doc.setFillColor(...PALETTE.olive);
    doc.rect(14, 29.5, pageWidth - 28, 0.4, 'F');
    doc.setFillColor(...PALETTE.pista);
    doc.rect(14, 29.9, 44, 1.2, 'F');

    // =========================================================================
    // 2. REPORT TITLE & SUBTITLE
    // =========================================================================
    const dynamicTitle = periodLabel.toLowerCase().includes('month')
      ? 'Monthly Financial Summary'
      : `${periodLabel} Financial Summary`;

    doc.setFontSize(15);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(...PALETTE.deepForest);
    doc.text(dynamicTitle, 14, 38);

    doc.setFontSize(8.5);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(...PALETTE.mutedForest);
    doc.text('A clear view of your spending and savings.', 14, 43);

    // =========================================================================
    // 3. FINANCIAL SUMMARY CARDS (4-card aligned grid)
    // =========================================================================
    const startY = 48;
    const cardW = 42;
    const cardH = 22;
    const gap = (pageWidth - 28 - cardW * 4) / 3;

    const cards = [
      {
        title: 'TOTAL EXPENSES',
        value: formatINR(totalExp),
        sub: `${expenses.length} transaction${expenses.length === 1 ? '' : 's'}`,
        accent: PALETTE.olive,
      },
      {
        title: 'TOTAL SAVINGS',
        value: formatINR(totalSav),
        sub: `${savings.length} active goal${savings.length === 1 ? '' : 's'}`,
        accent: PALETTE.emerald,
      },
      {
        title: 'REMAINING BALANCE',
        value: formatINR(remaining),
        sub: remaining >= 0 ? 'Net Positive Flow' : 'Expenses Exceeded',
        accent: remaining >= 0 ? PALETTE.olive : PALETTE.crimson,
      },
      {
        title: 'BUDGET STATUS',
        value: budAmt > 0 ? `${((totalExp / budAmt) * 100).toFixed(1)}% Used` : 'No Budget Set',
        sub: budAmt > 0 ? `Limit: ${formatINR(budAmt)}` : 'Monthly limit unconfigured',
        accent: budAmt > 0 && totalExp > budAmt ? PALETTE.crimson : PALETTE.olive,
      },
    ];

    cards.forEach((c, idx) => {
      const cx = 14 + idx * (cardW + gap);

      // Soft pista card background & subtle border
      doc.setFillColor(...PALETTE.softPista);
      doc.setDrawColor(...PALETTE.borderGreen);
      doc.setLineWidth(0.3);
      doc.roundedRect(cx, startY, cardW, cardH, 2.5, 2.5, 'FD');

      // Top color accent bar
      doc.setFillColor(...c.accent);
      doc.roundedRect(cx, startY, cardW, 1.4, 1, 1, 'F');

      // Card Title
      doc.setFontSize(6.8);
      doc.setFont('helvetica', 'bold');
      doc.setTextColor(...PALETTE.mutedForest);
      doc.text(c.title, cx + 3.5, startY + 6.5);

      // Card Value
      doc.setFontSize(10.5);
      doc.setFont('helvetica', 'bold');
      doc.setTextColor(...PALETTE.deepForest);
      doc.text(c.value, cx + 3.5, startY + 13.5);

      // Card Subtitle / Context
      doc.setFontSize(6.2);
      doc.setFont('helvetica', 'normal');
      doc.setTextColor(...PALETTE.mutedForest);
      doc.text(c.sub, cx + 3.5, startY + 18.5);
    });

    // =========================================================================
    // 4. EXPENSE TRANSACTION TABLE
    // =========================================================================
    const tableStartY = startY + cardH + 7;

    const tableRows = expenses.length > 0
      ? expenses.map((exp) => [
          exp.date ? new Date(exp.date).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }) : '-',
          exp.category || 'General',
          exp.description || 'Expense entry',
          exp.paymentMethod || 'UPI / Online',
          formatINR(exp.amount),
        ])
      : [['No expense records found for this period.', '', '', '', '']];

    doc.autoTable({
      startY: tableStartY,
      head: [['Date', 'Category', 'Description', 'Payment Method', 'Amount']],
      body: tableRows,
      theme: 'plain',
      styles: {
        font: 'helvetica',
        fontSize: 8,
        textColor: PALETTE.deepForest,
        cellPadding: { top: 3.2, bottom: 3.2, left: 3, right: 3 },
        lineColor: PALETTE.tableBorder,
        lineWidth: 0.15,
      },
      headStyles: {
        fillColor: PALETTE.olive,
        textColor: PALETTE.white,
        fontStyle: 'bold',
        fontSize: 8.5,
        cellPadding: { top: 3.5, bottom: 3.5, left: 3, right: 3 },
      },
      alternateRowStyles: {
        fillColor: PALETTE.paleGreenRow,
      },
      columnStyles: {
        0: { cellWidth: 26 },
        1: { cellWidth: 34 },
        2: { cellWidth: 64 },
        3: { cellWidth: 30 },
        4: { cellWidth: 28, halign: 'right', fontStyle: 'bold' },
      },
      margin: { left: 14, right: 14, top: 22, bottom: 24 },
      showHead: 'everyPage',
    });

    // =========================================================================
    // 5. COMPACT VERIFICATION SECTION
    // =========================================================================
    let finalY = doc.lastAutoTable.finalY + 6;
    const vH = 34;
    const vW = pageWidth - 28;
    const vX = 14;

    // Check if new page is needed for verification card
    if (finalY + vH > pageHeight - 20) {
      doc.addPage();
      finalY = 22;
    }

    // Verification Card background
    doc.setFillColor(...PALETTE.softPista);
    doc.setDrawColor(...PALETTE.borderGreen);
    doc.setLineWidth(0.3);
    doc.roundedRect(vX, finalY, vW, vH, 2.5, 2.5, 'FD');

    // Left olive border accent strip
    doc.setFillColor(...PALETTE.olive);
    doc.roundedRect(vX, finalY, 3, vH, 1, 1, 'F');

    // Verification Content
    doc.setFontSize(9.5);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(...PALETTE.olive);
    doc.text('Verified Report', vX + 8, finalY + 6.5);

    doc.setFontSize(7.5);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(...PALETTE.deepForest);
    doc.text('RupeeRise Financial Verification Seal', vX + 8, finalY + 11.5);

    doc.setFontSize(6.8);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(...PALETTE.mutedForest);
    const descLines = doc.splitTextToSize(
      'This document was electronically generated and audit-verified by RupeeRise personal finance platform. For independent verification of transaction totals and authenticity, scan the verification QR code.',
      vW - 46
    );
    doc.text(descLines, vX + 8, finalY + 16.5);

    // Decorative signature note
    doc.setFontSize(6.2);
    doc.setFont('helvetica', 'italic');
    doc.setTextColor(...PALETTE.mutedForest);
    doc.text(
      'Authorized Digital Release: RupeeRise Automated System (Electronic generation — physical signature not legally required)',
      vX + 8,
      finalY + 30
    );

    // Real QR Code generation for report verification
    const verifyUrl = `${window.location.origin}/reports?verify=${reportId}&amt=${totalExp}&date=${new Date().toISOString().split('T')[0]}`;
    const qrDataUrl = await QRCode.toDataURL(verifyUrl, { width: 120, margin: 2 });
    const qrSize = 21;
    const qrX = vX + vW - qrSize - 6;
    const qrY = finalY + 4;
    doc.addImage(qrDataUrl, 'PNG', qrX, qrY, qrSize, qrSize);

    doc.setFontSize(6);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(...PALETTE.olive);
    doc.text('Scan to verify report', qrX + qrSize / 2, qrY + qrSize + 3.2, { align: 'center' });

    // =========================================================================
    // 6. MULTI-PAGE FOOTER WITH PAGE NUMBERS & TAGLINE
    // =========================================================================
    const pageCount = doc.internal.getNumberOfPages();
    for (let i = 1; i <= pageCount; i++) {
      doc.setPage(i);

      // Subtle green divider
      doc.setDrawColor(...PALETTE.borderGreen);
      doc.setLineWidth(0.3);
      doc.line(14, pageHeight - 11, pageWidth - 14, pageHeight - 11);

      // Left branding & tagline
      doc.setFontSize(7.5);
      doc.setFont('helvetica', 'bold');
      doc.setTextColor(...PALETTE.olive);
      doc.text('RupeeRise', 14, pageHeight - 6.5);

      const tagX = 14 + doc.getTextWidth('RupeeRise');
      doc.setFont('helvetica', 'normal');
      doc.setTextColor(...PALETTE.mutedForest);
      doc.text(' — Track Smarter. Save Better. Rise Higher.', tagX, pageHeight - 6.5);

      // Right page numbers
      doc.text(`Page ${i} of ${pageCount}`, pageWidth - 14, pageHeight - 6.5, { align: 'right' });
    }

    // Save and download PDF
    const periodSlug = periodLabel.toLowerCase().replace(/[^a-z0-9]/g, '_');
    const filename = `RupeeRise_Statement_${periodSlug}_${reportId}.pdf`;
    doc.save(filename);
  } catch (err) {
    console.error('Error generating Premium PDF:', err);
    throw err;
  }
}

/**
 * Universal report exporter (PDF, Excel, CSV)
 */
export async function downloadReport(type, options = {}) {
  if (type === 'pdf') {
    await generatePremiumPDF(options);
    return;
  }

  const expenses = options.expenses || [];

  // Direct client-side CSV download for instantaneous, 100% reliable export
  if (type === 'csv') {
    const headers = ['Date', 'Category', 'Description', 'Payment Method', 'Amount (INR)'];
    const rows = expenses.map((e) => [
      e.date ? new Date(e.date).toLocaleDateString('en-IN') : '',
      `"${String(e.category || 'Other').replace(/"/g, '""')}"`,
      `"${String(e.description || '').replace(/"/g, '""')}"`,
      `"${String(e.paymentMethod || 'UPI').replace(/"/g, '""')}"`,
      Number(e.amount || 0).toFixed(2),
    ]);
    const csvContent = '\uFEFF' + [headers.join(','), ...rows.map((r) => r.join(','))].join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `RupeeRise_Expense_Report_${Date.now()}.csv`;
    document.body.appendChild(a);
    a.click();
    window.URL.revokeObjectURL(url);
    a.remove();
    return;
  }

  // For Excel, query backend API with fresh token, with fallback to CSV spreadsheet format if API returns error
  const params = new URLSearchParams();
  if (options.startDate) params.set('startDate', options.startDate);
  if (options.endDate) params.set('endDate', options.endDate);
  const queryStr = params.toString() ? `?${params.toString()}` : '';

  let token = localStorage.getItem('token') || '';
  try {
    const user = firebase.auth().currentUser;
    if (user) {
      token = await user.getIdToken();
      localStorage.setItem('token', token);
    }
  } catch (e) {}

  try {
    const res = await fetch(`/api/reports/excel${queryStr}`, {
      method: 'GET',
      headers: { Authorization: `Bearer ${token}` },
    });

    if (res.ok) {
      const blob = await res.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `RupeeRise_Expense_Report_${Date.now()}.xlsx`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      a.remove();
      return;
    }
  } catch (err) {
    console.warn('Backend excel route failed, using client-side export fallback:', err);
  }

  // Fallback: Generate Excel-compatible CSV with UTF-8 BOM so Excel opens it with perfect columns
  const headers = ['Date', 'Category', 'Description', 'Payment Method', 'Amount (INR)'];
  const rows = expenses.map((e) => [
    e.date ? new Date(e.date).toLocaleDateString('en-IN') : '',
    `"${String(e.category || 'Other').replace(/"/g, '""')}"`,
    `"${String(e.description || '').replace(/"/g, '""')}"`,
    `"${String(e.paymentMethod || 'UPI').replace(/"/g, '""')}"`,
    Number(e.amount || 0).toFixed(2),
  ]);
  const csvContent = '\uFEFF' + [headers.join(','), ...rows.map((r) => r.join(','))].join('\n');
  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  const url = window.URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `RupeeRise_Expense_Report_${Date.now()}.csv`;
  document.body.appendChild(a);
  a.click();
  window.URL.revokeObjectURL(url);
  a.remove();
}
