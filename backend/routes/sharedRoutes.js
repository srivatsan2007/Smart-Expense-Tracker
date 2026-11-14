const express = require('express');
const router = express.Router();
const { getSharedArchive } = require('../controllers/archiveController');
const { rateLimit } = require('../middleware/rateLimit');

// Public: anyone holding the QR/link can read the shared statement until it expires or is revoked
router.use(rateLimit({ windowMs: 60 * 1000, max: 60 }));
router.get('/:token', getSharedArchive);

module.exports = router;
