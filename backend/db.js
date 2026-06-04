const admin = require('firebase-admin');

const connectDB = async () => {
  try {
    // If you have a service account key file, use it like this:
    const serviceAccount = require('./firebaseServiceAccountKey.json');
    admin.initializeApp({
      credential: admin.credential.cert(serviceAccount)
    });
    
    console.log('Firebase Admin SDK Initialized');
  } catch (error) {
    console.error(`Error initializing Firebase: ${error.message}`);
    process.exit(1);
  }
};

module.exports = { connectDB, admin };
