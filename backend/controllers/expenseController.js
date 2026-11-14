const { admin } = require('../db');
const { rolloverUser } = require('../services/monthlyRollover');
const { currentMonthKey, monthKeyOfDate } = require('../services/monthUtils');

// If a record is dated in a past month it belongs in that month's archive right away
const archiveIfPastMonth = async (userId, dateValue) => {
  const key = monthKeyOfDate(dateValue);
  if (key && key < currentMonthKey()) {
    try {
      await rolloverUser(admin.firestore(), userId, { force: true });
      return key;
    } catch (err) {
      console.error('Immediate archive failed:', err.message);
    }
  }
  return null;
};

// @desc    Get all expenses for a user
// @route   GET /api/expenses
// @access  Private
const getExpenses = async (req, res) => {
  try {
    const db = admin.firestore();
    const snapshot = await db.collection('expenses')
      .where('user', '==', req.user.id)
      .get();
      
    let expenses = snapshot.docs.map(doc => ({ _id: doc.id, ...doc.data() }));

    // Past months live in the archive; only the current month is shown unless asked otherwise
    if (req.query.includeArchived !== 'true') {
      expenses = expenses.filter(e => !e.archived);
    }
    
    // Sort in memory (descending by date)
    expenses.sort((a, b) => new Date(b.date) - new Date(a.date));
    
    res.json(expenses);
  } catch (error) {
    console.error('getExpenses error:', error.message);
    res.status(500).json({ message: error.message });
  }
};

// @desc    Create a new expense
// @route   POST /api/expenses
// @access  Private
const createExpense = async (req, res) => {
  const { amount, category, description, date, paymentMethod, receiptUrl, expenseType, isMonthly } = req.body;

  try {
    const db = admin.firestore();
    const resolvedType = expenseType || (isMonthly ? 'monthly' : 'daily');
    const expenseData = {
      user: req.user.id,
      amount: Number(amount),
      category,
      description: description || '',
      date: date || Date.now(),
      paymentMethod: paymentMethod || 'UPI',
      receiptUrl: receiptUrl || null,
      expenseType: resolvedType, // 'daily' or 'monthly'
      isMonthly: resolvedType === 'monthly',
      createdAt: new Date().toISOString()
    };

    const docRef = await db.collection('expenses').add(expenseData);
    const archivedMonth = await archiveIfPastMonth(req.user.id, expenseData.date);
    res.status(201).json({ _id: docRef.id, ...expenseData, ...(archivedMonth && { archivedMonth }) });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// @desc    Update an expense
// @route   PUT /api/expenses/:id
// @access  Private
const updateExpense = async (req, res) => {
  const { amount, category, description, date, paymentMethod, receiptUrl, expenseType, isMonthly } = req.body;

  try {
    const db = admin.firestore();
    const expenseRef = db.collection('expenses').doc(req.params.id);
    const doc = await expenseRef.get();

    if (doc.exists) {
      if (doc.data().user !== req.user.id) {
        return res.status(401).json({ message: 'Not authorized to update this expense' });
      }

      const updateData = {
        updatedAt: new Date().toISOString()
      };
      if (amount !== undefined) updateData.amount = Number(amount);
      if (category !== undefined) updateData.category = category;
      if (description !== undefined) updateData.description = description;
      if (date !== undefined) updateData.date = date;
      if (paymentMethod !== undefined) updateData.paymentMethod = paymentMethod;
      if (receiptUrl !== undefined) updateData.receiptUrl = receiptUrl;
      if (expenseType !== undefined || isMonthly !== undefined) {
        const resolved = expenseType || (isMonthly ? 'monthly' : 'daily');
        updateData.expenseType = resolved;
        updateData.isMonthly = resolved === 'monthly';
      }

      await expenseRef.update(updateData);
      
      const archivedMonth = date !== undefined ? await archiveIfPastMonth(req.user.id, date) : null;
      const updatedDoc = await expenseRef.get();
      res.json({ _id: updatedDoc.id, ...updatedDoc.data(), ...(archivedMonth && { archivedMonth }) });
    } else {
      res.status(404).json({ message: 'Expense not found' });
    }
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// @desc    Delete an expense
// @route   DELETE /api/expenses/:id
// @access  Private
const deleteExpense = async (req, res) => {
  try {
    const db = admin.firestore();
    const expenseRef = db.collection('expenses').doc(req.params.id);
    const doc = await expenseRef.get();

    if (doc.exists) {
      if (doc.data().user !== req.user.id) {
        return res.status(401).json({ message: 'Not authorized to delete this expense' });
      }
      await expenseRef.delete();
      res.json({ message: 'Expense removed' });
    } else {
      res.status(404).json({ message: 'Expense not found' });
    }
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

module.exports = {
  getExpenses,
  createExpense,
  updateExpense,
  deleteExpense
};
