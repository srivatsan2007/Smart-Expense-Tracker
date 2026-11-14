const express = require('express');
const router = express.Router();
const { signReport, signReceipt } = require('../controllers/signatureController');
const { protect } = require('../middleware/authMiddleware');
const { rateLimit } = require('../middleware/rateLimit');

// Signing is authenticated and rate limited (each call writes a Firestore document)
router.use(rateLimit({ windowMs: 60 * 1000, max: 30 }));
router.post('/report', protect, signReport);
router.post('/receipt', protect, signReceipt);

module.exports = router;
