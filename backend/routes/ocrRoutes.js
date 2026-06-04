const express = require('express');
const router = express.Router();
const { upload, scanReceipt } = require('../controllers/ocrController');
const { protect } = require('../middleware/authMiddleware');

router.post('/scan', protect, upload.single('receipt'), scanReceipt);

module.exports = router;
