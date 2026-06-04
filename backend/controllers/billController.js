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
    const { billName, amount, dueDate, category, recurring } = req.body;
    
    if (!billName || !amount || !dueDate) {
      return res.status(400).json({ message: 'Please provide all required fields' });
    }

    const db = admin.firestore();
    
    const newBill = {
      user: req.user.id,
      billName,
      amount: Number(amount),
      dueDate: new Date(dueDate).toISOString(),
      category: category || 'Other',
      recurring: recurring || 'none', // none, weekly, monthly, yearly
      status: 'pending', // pending, paid
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

    // Update current bill to paid
    await billRef.update({
      status: 'paid',
      paidDate: new Date().toISOString()
    });

    // Handle recurring: Create the next bill instance automatically
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

      const nextBill = {
        user: req.user.id,
        billName: billData.billName,
        amount: billData.amount,
        dueDate: nextDueDate.toISOString(),
        category: billData.category,
        recurring: billData.recurring,
        status: 'pending',
        createdAt: new Date().toISOString()
      };

      await db.collection('bills').add(nextBill);
    }

    res.json({ message: 'Bill marked as paid successfully' });
  } catch (error) {
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

    const { billName, amount, dueDate, category, recurring } = req.body;
    
    await billRef.update({
      billName: billName || doc.data().billName,
      amount: amount ? Number(amount) : doc.data().amount,
      dueDate: dueDate ? new Date(dueDate).toISOString() : doc.data().dueDate,
      category: category || doc.data().category,
      recurring: recurring || doc.data().recurring,
    });

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
  updateBill,
  deleteBill
};
