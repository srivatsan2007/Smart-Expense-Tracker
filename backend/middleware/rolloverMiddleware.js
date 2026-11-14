'use strict';

const { admin } = require('../db');
const { rolloverUser } = require('../services/monthlyRollover');

// Runs the monthly rollover (first request of a new month only; afterwards it is a no-op).
// A rollover problem must never break the page the user asked for, so errors are logged and swallowed.
const ensureRollover = async (req, res, next) => {
  try {
    if (req.user && req.user.id) await rolloverUser(admin.firestore(), req.user.id);
  } catch (error) {
    console.error('Monthly rollover failed:', error.message);
  }
  next();
};

module.exports = { ensureRollover };
