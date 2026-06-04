const PDFDocument = require('pdfkit');
const ExcelJS = require('exceljs');
const fs = require('fs');
const path = require('path');
const { admin } = require('../db');
const { parse } = require('json2csv');

// Helper to get expenses from Firestore
const fetchUserExpenses = async (userId) => {
  const db = admin.firestore();
  const snapshot = await db.collection('expenses')
    .where('user', '==', userId)
    .get();
  let expenses = snapshot.docs.map(doc => doc.data());
  expenses.sort((a, b) => new Date(b.date) - new Date(a.date));
  return expenses;
};

// @desc    Generate PDF report
// @route   GET /api/reports/pdf
// @access  Private
const generatePDF = async (req, res) => {
  try {
    const expenses = await fetchUserExpenses(req.user.id);
    const doc = new PDFDocument();
    
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename=Expense_Report_${Date.now()}.pdf`);
    
    doc.pipe(res);

    doc.fontSize(20).text('Expense Tracker Report', { align: 'center' });
    doc.moveDown();
    doc.fontSize(12).text(`Generated on: ${new Date().toLocaleDateString()}`);
    doc.moveDown();

    let totalExpense = 0;

    expenses.forEach(expense => {
      doc.fontSize(10).text(`${new Date(expense.date).toLocaleDateString()} - ${expense.category} - ₹${expense.amount} - ${expense.description || ''}`);
      totalExpense += Number(expense.amount);
    });

    doc.moveDown();
    doc.fontSize(14).text(`Total Expenses: ₹${totalExpense.toFixed(2)}`, { underline: true });

    doc.end();
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// @desc    Generate Excel report
// @route   GET /api/reports/excel
// @access  Private
const generateExcel = async (req, res) => {
  try {
    const expenses = await fetchUserExpenses(req.user.id);
    
    const workbook = new ExcelJS.Workbook();
    const worksheet = workbook.addWorksheet('Expenses');

    worksheet.columns = [
      { header: 'Date', key: 'date', width: 15 },
      { header: 'Category', key: 'category', width: 20 },
      { header: 'Amount', key: 'amount', width: 15 },
      { header: 'Description', key: 'description', width: 30 },
      { header: 'Payment Method', key: 'paymentMethod', width: 20 }
    ];

    expenses.forEach(expense => {
      worksheet.addRow({
        date: new Date(expense.date).toLocaleDateString(),
        category: expense.category,
        amount: expense.amount,
        description: expense.description,
        paymentMethod: expense.paymentMethod
      });
    });

    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', `attachment; filename=Expense_Report_${Date.now()}.xlsx`);

    await workbook.xlsx.write(res);
    res.end();
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// @desc    Generate CSV report
// @route   GET /api/reports/csv
// @access  Private
const generateCSV = async (req, res) => {
  try {
    const expenses = await fetchUserExpenses(req.user.id);
    
    if (!expenses || expenses.length === 0) {
       return res.status(404).json({ message: 'No expenses found to export.' });
    }

    const fields = ['date', 'category', 'amount', 'description', 'paymentMethod'];
    const opts = { fields };
    const csv = parse(expenses, opts);

    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', `attachment; filename=Expense_Report_${Date.now()}.csv`);
    res.status(200).send(csv);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

module.exports = {
  generatePDF,
  generateExcel,
  generateCSV
};
