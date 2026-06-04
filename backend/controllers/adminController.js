const { admin } = require('../db');

// @desc    Get all users
// @route   GET /api/admin/users
// @access  Private/Admin
const getUsers = async (req, res) => {
  try {
    const db = admin.firestore();
    const snapshot = await db.collection('users').get();
    
    const users = snapshot.docs.map(doc => ({
      _id: doc.id,
      ...doc.data()
    }));

    res.json(users);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// @desc    Delete user and cascade delete all their data
// @route   DELETE /api/admin/users/:id
// @access  Private/Admin
const deleteUser = async (req, res) => {
  try {
    const userId = req.params.id;
    const db = admin.firestore();

    // 1. Delete user from Firebase Authentication
    try {
      await admin.auth().deleteUser(userId);
    } catch (authErr) {
      console.warn(`User ${userId} not found in Firebase Auth, proceeding to delete Firestore data.`);
    }

    // 2. Delete user's profile from Firestore
    await db.collection('users').doc(userId).delete();

    // 3. Cascade Delete: Expenses
    const expensesSnapshot = await db.collection('expenses').where('user', '==', userId).get();
    const batch = db.batch();
    expensesSnapshot.docs.forEach(doc => {
      batch.delete(doc.ref);
    });
    
    // 4. Cascade Delete: Salaries
    const salariesSnapshot = await db.collection('salaries').where('user', '==', userId).get();
    salariesSnapshot.docs.forEach(doc => {
      batch.delete(doc.ref);
    });

    // 5. Cascade Delete: Savings Goals
    const savingsSnapshot = await db.collection('savings_goals').where('user', '==', userId).get();
    savingsSnapshot.docs.forEach(doc => {
      batch.delete(doc.ref);
    });

    // Commit all deletions
    await batch.commit();

    res.json({ message: 'User and all associated data permanently deleted' });
  } catch (error) {
    console.error('Delete User Error:', error);
    res.status(500).json({ message: error.message });
  }
};

module.exports = {
  getUsers,
  deleteUser
};
