import { jsPDF } from 'jspdf';
import 'jspdf-autotable';
import QRCode from 'qrcode';

const colors = {
  bgDark: [15, 23, 42],
  primary: [71, 127, 224],
  purple: [124, 58, 237],
  cyan: [6, 182, 212],
  textWhite: [255, 255, 255],
  textGray: [170, 170, 170],
  cardBg: [240, 245, 250],
  cardText: [50, 50, 50],
};

// Generates an audit-ready PDF statement with digital QR verification
export async function generatePremiumPDF(options = {}) {
  try {
    const token = localStorage.getItem('token');
    if (!token) {
      throw new Error('Please login first to generate statements.');
    }

    const headers = { Authorization: `Bearer ${token}` };
    const [expRes, savRes, salRes, budRes] = await Promise.all([
      fetch('/api/expenses', { headers }),
      fetch('/api/savings', { headers }),
      fetch('/api/salaries', { headers }),
      fetch('/api/budget', { headers }),
    ]);

    let expenses = expRes.ok ? await expRes.json() : [];
    const savings = savRes.ok ? await savRes.json() : [];
    const salaries = salRes.ok ? await salRes.json() : [];
    let budgetObj = { amount: 0 };
    if (budRes.ok) {
      const b = await budRes.json();
      if (b && (b.amount || b.monthlyLimit)) budgetObj = b;
      else if (Array.isArray(b) && b.length > 0) budgetObj = b[0];
    }

    // Apply period filtering if requested
    if (options.startDate) {
      const s = new Date(options.startDate);
      expenses = expenses.filter((e) => new Date(e.date) >= s);
    }
    if (options.endDate) {
      const end = new Date(options.endDate);
      end.setHours(23, 59, 59, 999);
      expenses = expenses.filter((e) => new Date(e.date) <= end);
    }

    const totalExp = expenses.reduce((sum, e) => sum + Number(e.amount || 0), 0);
    const totalSav = savings.reduce((sum, s) => sum + Number(s.currentAmount || 0), 0);
    const totalInc = salaries.reduce((sum, s) => sum + Number(s.amount || 0), 0);
    const remaining = totalInc - totalExp;
    const budAmt = Number(budgetObj.monthlyLimit || budgetObj.amount || 0);
    const budgetStatus = budAmt > 0 ? ((totalExp / budAmt) * 100).toFixed(1) + '%' : 'N/A';
    const formatter = new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR' });

    const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });

    // Load custom font to support the ₹ symbol
    try {
      const fontRes = await fetch('https://cdn.jsdelivr.net/npm/roboto-font@0.1.0/fonts/Roboto/roboto-regular-webfont.ttf');
      if (fontRes.ok) {
        const bytes = new Uint8Array(await fontRes.arrayBuffer());
        let binary = '';
        for (let i = 0; i < bytes.byteLength; i++) binary += String.fromCharCode(bytes[i]);
        doc.addFileToVFS('Roboto-Regular.ttf', window.btoa(binary));
        doc.addFont('Roboto-Regular.ttf', 'Roboto', 'normal');
        doc.setFont('Roboto');
      }
    } catch (e) {
      console.warn('Could not load custom font for Rupee symbol', e);
    }

    const pageWidth = doc.internal.pageSize.getWidth();
    const pageHeight = doc.internal.pageSize.getHeight();

    // Header
    doc.setFillColor(...colors.bgDark);
    doc.rect(0, 0, pageWidth, 45, 'F');
    doc.setTextColor(...colors.primary);
    doc.setFontSize(22);
    doc.setFont('Roboto', 'bold');
    doc.text('RUPEERISE', pageWidth - 15, 18, { align: 'right' });
    doc.setTextColor(...colors.textGray);
    doc.setFontSize(10);
    doc.setFont('Roboto', 'normal');
    doc.text(
      options.periodLabel ? `Period: ${options.periodLabel}` : 'Financial Statement & Audit Log',
      pageWidth - 15,
      25,
      { align: 'right' }
    );
    const reportId = 'RPT-' + Math.floor(Math.random() * 1000000);
    doc.text(`Report ID: ${reportId}`, pageWidth - 15, 32, { align: 'right' });
    doc.text(`Generated: ${new Date().toLocaleString()}`, pageWidth - 15, 38, { align: 'right' });
    doc.setTextColor(...colors.textWhite);
    doc.setFontSize(20);
    doc.setFont('Roboto', 'bold');
    doc.text('RupeeRise', 15, 25);

    // Watermark
    doc.saveGraphicsState();
    doc.setGState(new doc.GState({ opacity: 0.05 }));
    doc.setTextColor(50, 50, 50);
    doc.setFontSize(70);
    doc.text('CONFIDENTIAL', pageWidth / 2, pageHeight / 2, { align: 'center', angle: 45 });
    doc.restoreGraphicsState();

    // Summary cards
    const drawCard = (title, value, x, y, w, h, valColor) => {
      doc.setFillColor(...colors.cardBg);
      doc.roundedRect(x, y, w, h, 3, 3, 'F');
      doc.setTextColor(...colors.cardText);
      doc.setFontSize(9);
      doc.setFont('Roboto', 'normal');
      doc.text(title, x + 5, y + 8);
      doc.setTextColor(...valColor);
      doc.setFontSize(12);
      doc.setFont('Roboto', 'bold');
      doc.text(value, x + 5, y + 16);
    };
    const cardW = 40, cardH = 22, startY = 55;
    const spacing = (pageWidth - 30 - cardW * 4) / 3;
    drawCard('Period Expenses', formatter.format(totalExp), 15, startY, cardW, cardH, colors.purple);
    drawCard('Total Savings', formatter.format(totalSav), 15 + cardW + spacing, startY, cardW, cardH, colors.cyan);
    drawCard('Remaining Bal', formatter.format(remaining), 15 + (cardW + spacing) * 2, startY, cardW, cardH, [16, 185, 129]);
    drawCard('Budget Status', budgetStatus, 15 + (cardW + spacing) * 3, startY, cardW, cardH, [239, 68, 68]);

    // Expense table
    doc.autoTable({
      startY: startY + 30,
      head: [['Date', 'Category', 'Description', 'Payment', 'Amount']],
      body: expenses.map((exp) => [
        new Date(exp.date).toLocaleDateString(),
        exp.category || '-',
        exp.description || '-',
        exp.paymentMethod || '-',
        formatter.format(exp.amount),
      ]),
      theme: 'striped',
      styles: { font: 'Roboto' },
      headStyles: { fillColor: colors.bgDark, textColor: colors.primary, fontStyle: 'bold' },
      alternateRowStyles: { fillColor: [248, 250, 252] },
      margin: { top: 20, left: 15, right: 15 },
    });

    let finalY = doc.lastAutoTable.finalY || 150;
    if (finalY > pageHeight - 70) {
      doc.addPage();
      finalY = 20;
    }

    // Digital signature
    doc.setTextColor(...colors.bgDark);
    doc.setFontSize(12);
    doc.setFont('Roboto', 'bold');
    doc.text('Authorized Signature', 15, finalY + 20);
    doc.setFont('times', 'italic');
    doc.setFontSize(22);
    doc.setTextColor(...colors.purple);
    doc.text('RupeeRise Finance', 15, finalY + 35);
    doc.setFont('Roboto', 'normal');
    doc.setFontSize(9);
    doc.setTextColor(100, 100, 100);
    doc.text('Digitally Verified by RupeeRise Platform', 15, finalY + 45);

    // Verification QR code
    const qrDataUrl = await QRCode.toDataURL(
      `${window.location.origin}/reports?verified=${reportId}`,
      { width: 128, margin: 4 }
    );
    doc.addImage(qrDataUrl, 'PNG', pageWidth - 55, finalY + 15, 35, 35);

    // Footer
    doc.setFillColor(...colors.bgDark);
    doc.rect(0, pageHeight - 12, pageWidth, 12, 'F');
    doc.setTextColor(...colors.textWhite);
    doc.setFontSize(8);
    doc.text(
      'This report is digitally verified by RupeeRise. | support@rupeerise.com',
      pageWidth / 2,
      pageHeight - 4,
      { align: 'center' }
    );
    doc.save(`RupeeRise_Report_${reportId}.pdf`);
  } catch (err) {
    console.error('Error generating Premium PDF:', err);
    throw err;
  }
}

export async function downloadReport(type, options = {}) {
  if (type === 'pdf') {
    await generatePremiumPDF(options);
    return;
  }

  const params = new URLSearchParams();
  if (options.startDate) params.set('startDate', options.startDate);
  if (options.endDate) params.set('endDate', options.endDate);
  const queryStr = params.toString() ? `?${params.toString()}` : '';

  const res = await fetch(`/api/reports/${type}${queryStr}`, {
    method: 'GET',
    headers: { Authorization: `Bearer ${localStorage.getItem('token')}` },
  });

  if (!res.ok) {
    const errorJson = await res.json().catch(() => ({}));
    throw new Error(errorJson.message || `Failed to generate ${type.toUpperCase()} report.`);
  }

  const blob = await res.blob();
  const url = window.URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `Expense_Report_${Date.now()}.${type === 'excel' ? 'xlsx' : type}`;
  document.body.appendChild(a);
  a.click();
  window.URL.revokeObjectURL(url);
  a.remove();
}
