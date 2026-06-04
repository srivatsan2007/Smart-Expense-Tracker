const { admin } = require('../db');

const adminProtect = async (req, res, next) => {
  try {
    const db = admin.firestore();
    const doc = await db.collection('users').doc(req.user.id).get();

    if (doc.exists && doc.data().role === 'admin') {
      next();
    } else {
      res.status(403).json({ message: 'Not authorized as an admin' });
    }
  } catch (error) {
    console.error('Admin Middleware Error:', error);
    res.status(500).json({ message: 'Internal server error checking admin privileges' });
  }
};

module.exports = { adminProtect };
