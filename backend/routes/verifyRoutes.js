const express = require('express');
const router = express.Router();
const { verifyDocument, getCertificate } = require('../controllers/signatureController');
const { rateLimit } = require('../middleware/rateLimit');

// Public endpoints: anyone holding a printed/QR document can verify it
router.use(rateLimit({ windowMs: 60 * 1000, max: 60 }));
router.get('/certificate', getCertificate); // must stay above '/:docId'
router.get('/:docId', verifyDocument);

module.exports = router;
