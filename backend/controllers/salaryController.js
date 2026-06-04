const { admin } = require('../db');

// @desc    Get all salaries for a user
// @route   GET /api/salaries
// @access  Private
const getSalaries = async (req, res) => {
  try {
    const db = admin.firestore();
    const snapshot = await db.collection('salaries')
      .where('user', '==', req.user.id)
      .get();
      
    let salaries = snapshot.docs.map(doc => ({ _id: doc.id, ...doc.data() }));
    
    // Sort in memory to avoid requiring Firestore composite indexes
    salaries.sort((a, b) => {
      if (a.year !== b.year) return b.year - a.year; // Descending year
      const months = { "January":1, "February":2, "March":3, "April":4, "May":5, "June":6, "July":7, "August":8, "September":9, "October":10, "November":11, "December":12 };
      return months[b.month] - months[a.month]; // Descending month
    });
    
    res.json(salaries);
  } catch (error) {
    console.error('getSalaries error:', error.message);
    res.status(500).json({ message: error.message });
  }
};

// @desc    Add a new salary
// @route   POST /api/salaries
// @access  Private
const createSalary = async (req, res) => {
  const { amount, month, year } = req.body;

  try {
    const db = admin.firestore();
    const salaryData = {
      user: req.user.id,
      amount: Number(amount),
      month,
      year
    };

    const docRef = await db.collection('salaries').add(salaryData);
    res.status(201).json({ _id: docRef.id, ...salaryData });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// @desc    Update a salary
// @route   PUT /api/salaries/:id
// @access  Private
const updateSalary = async (req, res) => {
  const { amount, month, year } = req.body;

  try {
    const db = admin.firestore();
    const salaryRef = db.collection('salaries').doc(req.params.id);
    const doc = await salaryRef.get();

    if (doc.exists) {
      if (doc.data().user !== req.user.id) {
        return res.status(401).json({ message: 'Not authorized to update this salary' });
      }

      const updateData = {};
      if (amount !== undefined) updateData.amount = amount;
      if (month !== undefined) updateData.month = month;
      if (year !== undefined) updateData.year = year;

      await salaryRef.update(updateData);
      
      const updatedDoc = await salaryRef.get();
      res.json({ _id: updatedDoc.id, ...updatedDoc.data() });
    } else {
      res.status(404).json({ message: 'Salary not found' });
    }
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// @desc    Delete a salary
// @route   DELETE /api/salaries/:id
// @access  Private
const deleteSalary = async (req, res) => {
  try {
    const db = admin.firestore();
    const salaryRef = db.collection('salaries').doc(req.params.id);
    const doc = await salaryRef.get();

    if (doc.exists) {
      if (doc.data().user !== req.user.id) {
        return res.status(401).json({ message: 'Not authorized to delete this salary' });
      }
      await salaryRef.delete();
      res.json({ message: 'Salary removed' });
    } else {
      res.status(404).json({ message: 'Salary not found' });
    }
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

module.exports = {
  getSalaries,
  createSalary,
  updateSalary,
  deleteSalary
};
