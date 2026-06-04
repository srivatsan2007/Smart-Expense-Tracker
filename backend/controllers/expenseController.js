const { admin } = require('../db');

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
  const { amount, category, description, date, paymentMethod, receiptUrl } = req.body;

  try {
    const db = admin.firestore();
    const expenseData = {
      user: req.user.id,
      amount: Number(amount),
      category,
      description,
      date: date || Date.now(),
      paymentMethod,
      receiptUrl: receiptUrl || null
    };

    const docRef = await db.collection('expenses').add(expenseData);
    res.status(201).json({ _id: docRef.id, ...expenseData });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// @desc    Update an expense
// @route   PUT /api/expenses/:id
// @access  Private
const updateExpense = async (req, res) => {
  const { amount, category, description, date, paymentMethod, receiptUrl } = req.body;

  try {
    const db = admin.firestore();
    const expenseRef = db.collection('expenses').doc(req.params.id);
    const doc = await expenseRef.get();

    if (doc.exists) {
      if (doc.data().user !== req.user.id) {
        return res.status(401).json({ message: 'Not authorized to update this expense' });
      }

      const updateData = {};
      if (amount !== undefined) updateData.amount = amount;
      if (category !== undefined) updateData.category = category;
      if (description !== undefined) updateData.description = description;
      if (date !== undefined) updateData.date = date;
      if (paymentMethod !== undefined) updateData.paymentMethod = paymentMethod;
      if (receiptUrl !== undefined) updateData.receiptUrl = receiptUrl;

      await expenseRef.update(updateData);
      
      const updatedDoc = await expenseRef.get();
      res.json({ _id: updatedDoc.id, ...updatedDoc.data() });
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
