const { admin } = require('../db');

// @desc    Get all savings goals for a user
// @route   GET /api/savings
// @access  Private
const getSavingsGoals = async (req, res) => {
  try {
    const db = admin.firestore();
    const snapshot = await db.collection('savingsGoals')
      .where('user', '==', req.user.id)
      .get();
      
    const goals = snapshot.docs.map(doc => ({ _id: doc.id, ...doc.data() }));
    res.json(goals);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// @desc    Create a savings goal
// @route   POST /api/savings
// @access  Private
const createSavingsGoal = async (req, res) => {
  const { name, targetAmount, currentAmount, targetDate } = req.body;

  try {
    const db = admin.firestore();
    const goalData = {
      user: req.user.id,
      name,
      targetAmount: Number(targetAmount),
      currentAmount: currentAmount ? Number(currentAmount) : 0,
      targetDate
    };

    const docRef = await db.collection('savingsGoals').add(goalData);
    res.status(201).json({ _id: docRef.id, ...goalData });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// @desc    Update a savings goal
// @route   PUT /api/savings/:id
// @access  Private
const updateSavingsGoal = async (req, res) => {
  const { name, targetAmount, currentAmount, targetDate } = req.body;

  try {
    const db = admin.firestore();
    const goalRef = db.collection('savingsGoals').doc(req.params.id);
    const doc = await goalRef.get();

    if (doc.exists) {
      if (doc.data().user !== req.user.id) {
        return res.status(401).json({ message: 'Not authorized to update this goal' });
      }

      const updateData = {};
      if (name !== undefined) updateData.name = name;
      if (targetAmount !== undefined) updateData.targetAmount = targetAmount;
      if (currentAmount !== undefined) updateData.currentAmount = currentAmount;
      if (targetDate !== undefined) updateData.targetDate = targetDate;

      await goalRef.update(updateData);
      
      const updatedDoc = await goalRef.get();
      res.json({ _id: updatedDoc.id, ...updatedDoc.data() });
    } else {
      res.status(404).json({ message: 'Savings goal not found' });
    }
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// @desc    Delete a savings goal
// @route   DELETE /api/savings/:id
// @access  Private
const deleteSavingsGoal = async (req, res) => {
  try {
    const db = admin.firestore();
    const goalRef = db.collection('savingsGoals').doc(req.params.id);
    const doc = await goalRef.get();

    if (doc.exists) {
      if (doc.data().user !== req.user.id) {
        return res.status(401).json({ message: 'Not authorized to delete this goal' });
      }
      await goalRef.delete();
      res.json({ message: 'Savings goal removed' });
    } else {
      res.status(404).json({ message: 'Savings goal not found' });
    }
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

module.exports = {
  getSavingsGoals,
  createSavingsGoal,
  updateSavingsGoal,
  deleteSavingsGoal
};
