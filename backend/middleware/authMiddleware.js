const { admin } = require('../db');

const protect = async (req, res, next) => {
  let token;

  if (
    req.headers.authorization &&
    req.headers.authorization.startsWith('Bearer')
  ) {
    try {
      token = req.headers.authorization.split(' ')[1];

      // Decode and verify Firebase token
      const decodedToken = await admin.auth().verifyIdToken(token);

      // Attach user to req (you could also fetch extra user details from Firestore if needed)
      req.user = {
        id: decodedToken.uid,
        email: decodedToken.email
      };

      next();
    } catch (error) {
      console.error('Firebase Auth Error:', error);
      res.status(401).json({ message: 'Not authorized, token failed' });
    }
  } else {
    res.status(401).json({ message: 'Not authorized, no token' });
  }
};

module.exports = { protect };
