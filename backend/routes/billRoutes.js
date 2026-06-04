const express = require('express');
const router = express.Router();
const { getBills, addBill, markAsPaid, updateBill, deleteBill } = require('../controllers/billController');
const { protect } = require('../middleware/authMiddleware');

router.route('/')
  .get(protect, getBills)
  .post(protect, addBill);

router.route('/:id')
  .put(protect, updateBill)
  .delete(protect, deleteBill);

router.route('/:id/pay')
  .put(protect, markAsPaid);

module.exports = router;
