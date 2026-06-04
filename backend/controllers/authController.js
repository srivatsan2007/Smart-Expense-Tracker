const { admin } = require('../db');

// @desc    Sync user after Firebase client registration
// @route   POST /api/auth/register
// @access  Public
const registerUser = async (req, res) => {
  let { name, email, mobileNumber, uid, role = 'user' } = req.body;
  
  if (role === 'admin' && !email.includes('@smarttracker.com')) {
    role = 'user';
  }

  // Note: With Firebase, the actual registration (password) happens on the frontend using Client SDK.
  // This endpoint is just to sync the user profile to Firestore after successful frontend registration.
  try {
    const db = admin.firestore();
    if (!uid) {
      return res.status(400).json({ message: 'UID from Firebase Auth is required' });
    }

    await db.collection('users').doc(uid).set({
      name,
      email,
      mobileNumber,
      role
    });

    res.status(201).json({
      _id: uid,
      name,
      email,
      mobileNumber,
      role
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// @desc    Auth user & get token (Deprecated on backend)
// @route   POST /api/auth/login
// @access  Public
const loginUser = async (req, res) => {
  // With Firebase, login MUST happen on the frontend using the Client SDK.
  // The frontend will then get an ID token and send it in the Authorization header.
  res.status(400).json({ 
    message: 'Login is handled by Firebase Client SDK on the frontend. Please use Firebase Auth on the client to get an ID token.' 
  });
};

// @desc    Get user profile
// @route   GET /api/auth/profile
// @access  Private
const getUserProfile = async (req, res) => {
  try {
    const db = admin.firestore();
    const doc = await db.collection('users').doc(req.user.id).get();

    if (doc.exists) {
      res.json({
        _id: doc.id,
        ...doc.data()
      });
    } else {
      // Fallback if not in Firestore but in Auth
      res.json({
        _id: req.user.id,
        email: req.user.email
      });
    }
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// @desc    Get email by mobile number (Helper for login)
// @route   POST /api/auth/get-email
// @access  Public
const getEmailByMobile = async (req, res) => {
  try {
    const { loginId } = req.body;
    if (!loginId) {
      return res.status(400).json({ message: 'Mobile number is required' });
    }

    const db = admin.firestore();
    const snapshot = await db.collection('users').where('mobileNumber', '==', loginId).get();
    
    if (snapshot.empty) {
      return res.status(404).json({ message: 'No account found with this mobile number' });
    }

    const emails = [];
    snapshot.forEach(doc => {
      emails.push(doc.data().email);
    });
    
    res.json({ emails });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// @desc    Update user profile
// @route   PUT /api/auth/profile
// @access  Private
const updateUserProfile = async (req, res) => {
  try {
    const { name, mobileNumber } = req.body;
    const db = admin.firestore();
    const userRef = db.collection('users').doc(req.user.id);
    
    // We only allow updating name and mobile number. Email is tied to Firebase Auth.
    await userRef.update({
      name,
      mobileNumber
    });

    // Fetch the updated document
    const updatedDoc = await userRef.get();
    res.json({
      _id: updatedDoc.id,
      ...updatedDoc.data()
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// @desc    Delete user account and cascade delete all their data
// @route   DELETE /api/auth/profile
// @access  Private
const deleteMyAccount = async (req, res) => {
  try {
    const userId = req.user.id;
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

    res.json({ message: 'Your account and all associated data have been permanently deleted.' });
  } catch (error) {
    console.error('Delete Account Error:', error);
    res.status(500).json({ message: error.message });
  }
};

module.exports = {
  registerUser,
  loginUser,
  getUserProfile,
  getEmailByMobile,
  updateUserProfile,
  deleteMyAccount,
};
