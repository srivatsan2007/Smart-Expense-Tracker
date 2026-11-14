import firebase from 'firebase/compat/app';
import 'firebase/compat/auth';
import 'firebase/compat/firestore';

// Firebase *web* config identifies your project; it is public by design (security comes
// from Firebase Auth + Firestore rules). It is read from frontend-react/.env (VITE_*),
// falling back to the values below so existing builds keep working.
const env = import.meta.env;
const firebaseConfig = {
  apiKey: env.VITE_FIREBASE_API_KEY || 'AIzaSyADXMbBy2kfssqal1j2jZVQp2BHhfjk59s',
  authDomain: env.VITE_FIREBASE_AUTH_DOMAIN || 'expense-tracker-e53ca.firebaseapp.com',
  projectId: env.VITE_FIREBASE_PROJECT_ID || 'expense-tracker-e53ca',
  storageBucket: env.VITE_FIREBASE_STORAGE_BUCKET || 'expense-tracker-e53ca.firebasestorage.app',
  messagingSenderId: env.VITE_FIREBASE_MESSAGING_SENDER_ID || '638630665198',
  appId: env.VITE_FIREBASE_APP_ID || '1:638630665198:web:17f8e2b80ce26743720cff',
  measurementId: env.VITE_FIREBASE_MEASUREMENT_ID || 'G-SM6MKHWGXM',
};

if (!firebase.apps.length) firebase.initializeApp(firebaseConfig);
export const auth = firebase.auth();
export default firebase;
