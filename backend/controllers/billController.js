const { admin } = require('../db');

// @desc    Get all bills for a user
// @route   GET /api/bills
// @access  Private
const getBills = async (req, res) => {
  try {
    const db = admin.firestore();
    const snapshot = await db.collection('bills').where('user', '==', req.user.id).get();
    
    const bills = snapshot.docs.map(doc => ({
      _id: doc.id,
      ...doc.data()
    }));

    // Sort by due date ascending
    bills.sort((a, b) => new Date(a.dueDate) - new Date(b.dueDate));

    res.json(bills);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// @desc    Add new bill
// @route   POST /api/bills
// @access  Private
const addBill = async (req, res) => {
  try {
    const { billName, amount, dueDate, category, recurring, notes } = req.body;
    
    if (!billName || !amount || !dueDate) {
      return res.status(400).json({ message: 'Please provide all required fields' });
    }

    const db = admin.firestore();
    
    const newBill = {
      user: req.user.id,
      billName: billName.trim(),
      amount: Number(amount),
      dueDate: new Date(dueDate).toISOString(),
      category: category || 'Utilities',
      recurring: recurring || 'none', // none, weekly, monthly, yearly
      status: 'pending', // pending, paid
      notes: notes || '',
      createdAt: new Date().toISOString()
    };

    const docRef = await db.collection('bills').add(newBill);

    res.status(201).json({
      _id: docRef.id,
      ...newBill
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// @desc    Mark bill as paid
// @route   PUT /api/bills/:id/pay
// @access  Private
const markAsPaid = async (req, res) => {
  try {
    const db = admin.firestore();
    const billRef = db.collection('bills').doc(req.params.id);
    const doc = await billRef.get();

    if (!doc.exists) {
      return res.status(404).json({ message: 'Bill not found' });
    }

    if (doc.data().user !== req.user.id) {
      return res.status(401).json({ message: 'User not authorized' });
    }

    const billData = doc.data();

    // Prevent duplicate payment executions
    if (billData.status === 'paid') {
      return res.status(400).json({ message: 'This bill is already marked as paid' });
    }

    const paymentDate = req.body.paidDate ? new Date(req.body.paidDate).toISOString() : new Date().toISOString();
    const paymentMethod = req.body.paymentMethod || 'UPI';
    const paymentReference = req.body.paymentReference || '';
    const shouldCreateExpense = req.body.createExpense !== false;

    let linkedExpenseId = null;

    // Create linked expense record so that this payment is automatically reflected in spending history
    if (shouldCreateExpense) {
      const expenseDoc = {
        user: req.user.id,
        amount: Number(billData.amount),
        category: billData.category || 'Utilities',
        description: req.body.description || `Bill Payment: ${billData.billName}`,
        date: paymentDate,
        paymentMethod,
        billId: billRef.id,
        isBillPayment: true,
        createdAt: new Date().toISOString()
      };

      const expRef = await db.collection('expenses').add(expenseDoc);
      linkedExpenseId = expRef.id;
    }

    // Update current bill to paid
    await billRef.update({
      status: 'paid',
      paidDate: paymentDate,
      paymentMethod,
      paymentReference,
      expenseId: linkedExpenseId,
      updatedAt: new Date().toISOString()
    });

    // Handle recurring: Create the next bill instance automatically if not already created
    if (billData.recurring && billData.recurring !== 'none') {
      const currentDueDate = new Date(billData.dueDate);
      const nextDueDate = new Date(currentDueDate);

      if (billData.recurring === 'weekly') {
        nextDueDate.setDate(currentDueDate.getDate() + 7);
      } else if (billData.recurring === 'monthly') {
        nextDueDate.setMonth(currentDueDate.getMonth() + 1);
      } else if (billData.recurring === 'yearly') {
        nextDueDate.setFullYear(currentDueDate.getFullYear() + 1);
      }

      // Check if a bill with same name and next dueDate already exists for user
      const existingNext = await db.collection('bills')
        .where('user', '==', req.user.id)
        .where('billName', '==', billData.billName)
        .where('dueDate', '==', nextDueDate.toISOString())
        .get();

      if (existingNext.empty) {
        const nextBill = {
          user: req.user.id,
          billName: billData.billName,
          amount: billData.amount,
          dueDate: nextDueDate.toISOString(),
          category: billData.category,
          recurring: billData.recurring,
          status: 'pending',
          previousBillId: billRef.id,
          createdAt: new Date().toISOString()
        };

        await db.collection('bills').add(nextBill);
      }
    }

    const updatedDoc = await billRef.get();
    res.json({
      success: true,
      message: 'Bill marked as paid successfully',
      bill: { _id: updatedDoc.id, ...updatedDoc.data() }
    });
  } catch (error) {
    console.error('Error marking bill as paid:', error);
    res.status(500).json({ message: error.message });
  }
};

// @desc    Reverse recorded bill payment
// @route   PUT /api/bills/:id/unpay
// @access  Private
const unmarkAsPaid = async (req, res) => {
  try {
    const db = admin.firestore();
    const billRef = db.collection('bills').doc(req.params.id);
    const doc = await billRef.get();

    if (!doc.exists) {
      return res.status(404).json({ message: 'Bill not found' });
    }

    if (doc.data().user !== req.user.id) {
      return res.status(401).json({ message: 'User not authorized' });
    }

    const billData = doc.data();

    if (billData.status !== 'paid') {
      return res.status(400).json({ message: 'Bill is not marked as paid' });
    }

    // If an associated expense was created, delete it to prevent double-counting or orphan expenses
    if (billData.expenseId) {
      try {
        await db.collection('expenses').doc(billData.expenseId).delete();
      } catch (err) {
        console.warn('Could not delete associated expense on bill unpay:', err.message);
      }
    }

    // Restore bill to pending
    await billRef.update({
      status: 'pending',
      paidDate: null,
      paymentMethod: null,
      paymentReference: null,
      expenseId: null,
      updatedAt: new Date().toISOString()
    });

    const updatedDoc = await billRef.get();
    res.json({
      success: true,
      message: 'Bill payment reversed successfully',
      bill: { _id: updatedDoc.id, ...updatedDoc.data() }
    });
  } catch (error) {
    console.error('Error reversing bill payment:', error);
    res.status(500).json({ message: error.message });
  }
};

// @desc    Update bill
// @route   PUT /api/bills/:id
// @access  Private
const updateBill = async (req, res) => {
  try {
    const db = admin.firestore();
    const billRef = db.collection('bills').doc(req.params.id);
    const doc = await billRef.get();

    if (!doc.exists) {
      return res.status(404).json({ message: 'Bill not found' });
    }

    if (doc.data().user !== req.user.id) {
      return res.status(401).json({ message: 'User not authorized' });
    }

    const { billName, amount, dueDate, category, recurring, notes } = req.body;
    
    const updateData = {
      updatedAt: new Date().toISOString()
    };
    if (billName !== undefined) updateData.billName = billName.trim();
    if (amount !== undefined) updateData.amount = Number(amount);
    if (dueDate !== undefined) updateData.dueDate = new Date(dueDate).toISOString();
    if (category !== undefined) updateData.category = category;
    if (recurring !== undefined) updateData.recurring = recurring;
    if (notes !== undefined) updateData.notes = notes;

    await billRef.update(updateData);

    const updatedDoc = await billRef.get();
    res.json({ _id: updatedDoc.id, ...updatedDoc.data() });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// @desc    Delete bill
// @route   DELETE /api/bills/:id
// @access  Private
const deleteBill = async (req, res) => {
  try {
    const db = admin.firestore();
    const billRef = db.collection('bills').doc(req.params.id);
    const doc = await billRef.get();

    if (!doc.exists) {
      return res.status(404).json({ message: 'Bill not found' });
    }

    if (doc.data().user !== req.user.id) {
      return res.status(401).json({ message: 'User not authorized' });
    }

    await billRef.delete();
    res.json({ message: 'Bill removed' });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

module.exports = {
  getBills,
  addBill,
  markAsPaid,
  unmarkAsPaid,
  updateBill,
  deleteBill
};
