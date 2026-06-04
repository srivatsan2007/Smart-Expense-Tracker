document.addEventListener('DOMContentLoaded', () => {
    if (typeof checkAuth === 'function') checkAuth();
});

async function downloadReport(type) {
    if (type === 'pdf') {
        await generatePremiumPDF();
        return;
    }

    try {
        const token = localStorage.getItem('token');
        const res = await fetch(`/api/reports/${type}`, {
            method: 'GET',
            headers: {
                'Authorization': `Bearer ${token}`
            }
        });

        if (!res.ok) {
            alert('Failed to generate report.');
            return;
        }

        // Convert response to blob
        const blob = await res.blob();
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        
        let ext = type === 'excel' ? 'xlsx' : type;
        a.download = `Expense_Report_${Date.now()}.${ext}`;
        
        document.body.appendChild(a);
        a.click();
        window.URL.revokeObjectURL(url);
        a.remove();

    } catch (error) {
        console.error('Download error:', error);
        alert('Error downloading report.');
    }
}

async function generatePremiumPDF() {
    try {
        const token = localStorage.getItem('token');
        if (!token) {
            alert("Please login first.");
            return;
        }

        // Fetch data
        const headers = { 'Authorization': `Bearer ${token}` };
        const [expRes, savRes, salRes, budRes] = await Promise.all([
            fetch('/api/expenses', { headers }),
            fetch('/api/savings', { headers }),
            fetch('/api/salaries', { headers }),
            fetch('/api/budget', { headers })
        ]);

        const expenses = expRes.ok ? await expRes.json() : [];
        const savings = savRes.ok ? await savRes.json() : [];
        const salaries = salRes.ok ? await salRes.json() : [];
        
        let budgetObj = { amount: 0 };
        if (budRes.ok) {
            const b = await budRes.json();
            if (b && b.amount) budgetObj = b;
            else if (Array.isArray(b) && b.length > 0) budgetObj = b[0];
        }

        // Calculate Totals
        const totalExp = expenses.reduce((sum, e) => sum + Number(e.amount || 0), 0);
        const totalSav = savings.reduce((sum, s) => sum + Number(s.currentAmount || 0), 0);
        const totalInc = salaries.reduce((sum, s) => sum + Number(s.amount || 0), 0);
        const remaining = totalInc - totalExp;
        const budAmt = Number(budgetObj.amount || 0);
        const budgetStatus = budAmt > 0 ? ((totalExp / budAmt) * 100).toFixed(1) + '%' : 'N/A';

        const formatter = new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR' });

        const { jsPDF } = window.jspdf;
        const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
        
        // Load custom font to support ₹ symbol
        try {
            const fontRes = await fetch('https://cdn.jsdelivr.net/npm/roboto-font@0.1.0/fonts/Roboto/roboto-regular-webfont.ttf');
            if (fontRes.ok) {
                const fontBuffer = await fontRes.arrayBuffer();
                let binary = '';
                const bytes = new Uint8Array(fontBuffer);
                for (let i = 0; i < bytes.byteLength; i++) {
                    binary += String.fromCharCode(bytes[i]);
                }
                const base64Font = window.btoa(binary);
                doc.addFileToVFS("Roboto-Regular.ttf", base64Font);
                doc.addFont("Roboto-Regular.ttf", "Roboto", "normal");
                doc.setFont("Roboto");
            }
        } catch (e) {
            console.warn('Could not load custom font for Rupee symbol', e);
        }
        const pageWidth = doc.internal.pageSize.getWidth();
        const pageHeight = doc.internal.pageSize.getHeight();

        // Colors
        const colors = {
            bgDark: [15, 23, 42],       // #0F172A
            primary: [0, 245, 255],     // #00F5FF
            purple: [124, 58, 237],     // #7C3AED
            cyan: [6, 182, 212],        // #06B6D4
            textWhite: [255, 255, 255],
            textGray: [170, 170, 170],
            cardBg: [240, 245, 250],
            cardText: [50, 50, 50]
        };

        // Header Background
        doc.setFillColor(...colors.bgDark);
        doc.rect(0, 0, pageWidth, 45, 'F');

        // Header Text
        doc.setTextColor(...colors.primary);
        doc.setFontSize(22);
        doc.setFont('Roboto', 'bold');
        doc.text('SMART EXPENSE TRACKER', pageWidth - 15, 18, { align: 'right' });

        doc.setTextColor(...colors.textGray);
        doc.setFontSize(10);
        doc.setFont('Roboto', 'normal');
        doc.text('Financial Report & Invoice', pageWidth - 15, 25, { align: 'right' });

        const reportId = 'RPT-' + Math.floor(Math.random() * 1000000);
        doc.text(`Report ID: ${reportId}`, pageWidth - 15, 32, { align: 'right' });
        doc.text(`Generated: ${new Date().toLocaleString()}`, pageWidth - 15, 38, { align: 'right' });

        // App Logo Text Placeholder
        doc.setTextColor(...colors.textWhite);
        doc.setFontSize(20);
        doc.setFont('Roboto', 'bold');
        doc.text('Smart Tracker', 15, 25);

        // Watermark
        doc.saveGraphicsState();
        doc.setGState(new doc.GState({opacity: 0.05}));
        doc.setTextColor(50, 50, 50);
        doc.setFontSize(70);
        doc.text('CONFIDENTIAL', pageWidth / 2, pageHeight / 2, { align: 'center', angle: 45 });
        doc.restoreGraphicsState();

        // Summary Section
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

        const cardW = 40;
        const cardH = 22;
        const startY = 55;
        const spacing = (pageWidth - 30 - (cardW * 4)) / 3;

        drawCard('Total Expenses', formatter.format(totalExp), 15, startY, cardW, cardH, colors.purple);
        drawCard('Total Savings', formatter.format(totalSav), 15 + cardW + spacing, startY, cardW, cardH, colors.cyan);
        drawCard('Remaining Bal', formatter.format(remaining), 15 + (cardW + spacing) * 2, startY, cardW, cardH, [40, 167, 69]);
        drawCard('Budget Used', budgetStatus, 15 + (cardW + spacing) * 3, startY, cardW, cardH, [220, 53, 69]);

        // Expense Table
        const tableColumn = ["Date", "Category", "Description", "Payment", "Amount"];
        const tableRows = expenses.map(exp => [
            new Date(exp.date).toLocaleDateString(),
            exp.category || '-',
            exp.description || '-',
            exp.paymentMethod || '-',
            formatter.format(exp.amount)
        ]);

        doc.autoTable({
            startY: startY + 30,
            head: [tableColumn],
            body: tableRows,
            theme: 'striped',
            styles: { font: 'Roboto' },
            headStyles: { fillColor: colors.bgDark, textColor: colors.primary, fontStyle: 'bold' },
            alternateRowStyles: { fillColor: [248, 250, 252] },
            margin: { top: 20, left: 15, right: 15 }
        });

        let finalY = doc.lastAutoTable.finalY || 150;

        if (finalY > pageHeight - 70) {
            doc.addPage();
            finalY = 20;
        }

        // Digital Signature Section
        doc.setTextColor(...colors.bgDark);
        doc.setFontSize(12);
        doc.setFont('Roboto', 'bold');
        doc.text('Authorized Signature', 15, finalY + 20);

        doc.setFont('times', 'italic');
        doc.setFontSize(22);
        doc.setTextColor(...colors.purple);
        doc.text('Smart Tracker Admin', 15, finalY + 35);

        doc.setFont('Roboto', 'normal');
        doc.setFontSize(9);
        doc.setTextColor(100, 100, 100);
        doc.text('Verified by Smart Expense Tracker', 15, finalY + 45);

        // QR Code Generation
        const qrContainer = document.createElement('div');
        const verifyUrl = `https://yourapp.com/verify-report?id=${reportId}`;
        new QRCode(qrContainer, { text: verifyUrl, width: 128, height: 128 });

        setTimeout(() => {
            const qrCanvas = qrContainer.querySelector('canvas');
            if (qrCanvas) {
                const qrDataUrl = qrCanvas.toDataURL('image/png');
                doc.addImage(qrDataUrl, 'PNG', pageWidth - 55, finalY + 15, 35, 35);
            }

            // Footer
            doc.setFillColor(...colors.bgDark);
            doc.rect(0, pageHeight - 12, pageWidth, 12, 'F');
            doc.setTextColor(...colors.textWhite);
            doc.setFontSize(8);
            doc.text('This report is digitally verified by Smart Expense Tracker. | support@smarttracker.com', pageWidth / 2, pageHeight - 4, { align: 'center' });

            doc.save(`Expense_Report_${reportId}.pdf`);
        }, 100);

    } catch (err) {
        console.error('Error generating Premium PDF:', err);
        alert('Error generating Premium PDF. Please check console.');
    }
}
