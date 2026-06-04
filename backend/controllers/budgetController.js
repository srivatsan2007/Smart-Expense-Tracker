const { admin } = require('../db');

// @desc    Get budget for a specific month and year
// @route   GET /api/budget
// @access  Private
const getBudget = async (req, res) => {
  const { month, year } = req.query;

  try {
    const db = admin.firestore();
    const snapshot = await db.collection('budgets')
      .where('user', '==', req.user.id)
      .where('month', '==', String(month))
      .where('year', '==', String(year))
      .limit(1)
      .get();

    if (!snapshot.empty) {
      const doc = snapshot.docs[0];
      res.json({ _id: doc.id, ...doc.data() });
    } else {
      res.json({ message: 'No budget set for this month' });
    }
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// @desc    Create or update budget
// @route   POST /api/budget
// @access  Private
const setBudget = async (req, res) => {
  const { monthlyLimit, categoryLimits, month, year } = req.body;

  try {
    const db = admin.firestore();
    const snapshot = await db.collection('budgets')
      .where('user', '==', req.user.id)
      .where('month', '==', String(month))
      .where('year', '==', String(year))
      .limit(1)
      .get();

    if (!snapshot.empty) {
      // Update
      const doc = snapshot.docs[0];
      const budgetRef = db.collection('budgets').doc(doc.id);
      
      const updateData = {};
      if (monthlyLimit !== undefined) updateData.monthlyLimit = monthlyLimit;
      if (categoryLimits !== undefined) updateData.categoryLimits = categoryLimits;
      
      await budgetRef.update(updateData);
      
      const updatedDoc = await budgetRef.get();
      res.json({ _id: updatedDoc.id, ...updatedDoc.data() });
    } else {
      // Create
      const budgetData = {
        user: req.user.id,
        monthlyLimit,
        categoryLimits: categoryLimits || [],
        month: String(month),
        year: String(year)
      };
      const docRef = await db.collection('budgets').add(budgetData);
      res.status(201).json({ _id: docRef.id, ...budgetData });
    }
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

module.exports = {
  getBudget,
  setBudget
};
