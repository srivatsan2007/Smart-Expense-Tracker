const express = require('express');
const router = express.Router();
const {
  listArchives, getArchive, downloadPdf, downloadExcel, createShare, listShares, revokeShare,
} = require('../controllers/archiveController');
const { protect } = require('../middleware/authMiddleware');
const { ensureRollover } = require('../middleware/rolloverMiddleware');
const { rateLimit } = require('../middleware/rateLimit');

router.use(rateLimit({ windowMs: 60 * 1000, max: 60 }));

router.get('/', protect, ensureRollover, listArchives);
router.get('/:key', protect, getArchive);
router.get('/:key/pdf', protect, downloadPdf);
router.get('/:key/excel', protect, downloadExcel);
router.get('/:key/shares', protect, listShares);
router.post('/:key/share', protect, createShare);
router.delete('/:key/share/:token', protect, revokeShare);

module.exports = router;
