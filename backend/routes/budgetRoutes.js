const express = require('express');
const router = express.Router();
const { getBudget, setBudget } = require('../controllers/budgetController');
const { protect } = require('../middleware/authMiddleware');

router.route('/')
  .get(protect, getBudget)
  .post(protect, setBudget);

module.exports = router;
