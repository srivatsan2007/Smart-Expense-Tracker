// firebase-config.js
const firebaseConfig = {
  apiKey: "AIzaSyADXMbBy2kfssqal1j2jZVQp2BHhfjk59s",
  authDomain: "expense-tracker-e53ca.firebaseapp.com",
  projectId: "expense-tracker-e53ca",
  storageBucket: "expense-tracker-e53ca.firebasestorage.app",
  messagingSenderId: "638630665198",
  appId: "1:638630665198:web:17f8e2b80ce26743720cff",
  measurementId: "G-SM6MKHWGXM"
};

// Initialize Firebase
firebase.initializeApp(firebaseConfig);
const auth = firebase.auth();
// const analytics = firebase.analytics(); // optional
