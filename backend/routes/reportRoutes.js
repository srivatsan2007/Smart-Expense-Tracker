const express = require('express');
const router = express.Router();
const { generatePDF, generateExcel, generateCSV } = require('../controllers/reportController');
const { protect } = require('../middleware/authMiddleware');

router.get('/pdf', protect, generatePDF);
router.get('/excel', protect, generateExcel);
router.get('/csv', protect, generateCSV);

module.exports = router;
