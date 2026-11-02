const admin = require('firebase-admin');

const connectDB = async () => {
  try {
    const fs = require('fs');
    const path = require('path');
    let serviceAccount;

    if (process.env.FIREBASE_SERVICE_ACCOUNT) {
      try {
        serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT);
      } catch (e) {
        // Handle potential base64 encoding
        const decoded = Buffer.from(process.env.FIREBASE_SERVICE_ACCOUNT, 'base64').toString('utf8');
        serviceAccount = JSON.parse(decoded);
      }
    } else if (fs.existsSync('/etc/secrets/firebaseServiceAccountKey.json')) {
      serviceAccount = require('/etc/secrets/firebaseServiceAccountKey.json');
    } else if (fs.existsSync(path.join(__dirname, 'firebaseServiceAccountKey.json'))) {
      serviceAccount = require('./firebaseServiceAccountKey.json');
    } else {
      throw new Error(
        'Firebase service account key not found. Please provide FIREBASE_SERVICE_ACCOUNT environment variable or place firebaseServiceAccountKey.json in the backend folder.'
      );
    }

    admin.initializeApp({
      credential: admin.credential.cert(serviceAccount)
    });
    
    console.log('Firebase Admin SDK Initialized successfully');
  } catch (error) {
    console.error(`Error initializing Firebase: ${error.message}`);
    process.exit(1);
  }
};

module.exports = { connectDB, admin };
