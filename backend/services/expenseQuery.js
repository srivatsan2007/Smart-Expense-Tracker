'use strict';

const { admin } = require('../db');

// Fetch a user's expenses from Firestore with an optional date-range filter.
// Shared by the report exporters and the digital-signature service so both
// always see exactly the same data.
const fetchUserExpenses = async (userId, startDate, endDate) => {
  const db = admin.firestore();
  const snapshot = await db.collection('expenses')
    .where('user', '==', userId)
    .get();
  let expenses = snapshot.docs.map(doc => doc.data());
  if (startDate) {
    const s = new Date(startDate);
    expenses = expenses.filter(e => new Date(e.date) >= s);
  }
  if (endDate) {
    const end = new Date(endDate);
    end.setHours(23, 59, 59, 999);
    expenses = expenses.filter(e => new Date(e.date) <= end);
  }
  expenses.sort((a, b) => new Date(b.date) - new Date(a.date));
  return expenses;
};

module.exports = { fetchUserExpenses };
