const express = require('express');
const router = express.Router();
const { getSalaries, createSalary, updateSalary, deleteSalary } = require('../controllers/salaryController');
const { protect } = require('../middleware/authMiddleware');
const { ensureRollover } = require('../middleware/rolloverMiddleware');

router.route('/')
  .get(protect, ensureRollover, getSalaries)
  .post(protect, createSalary);

router.route('/:id')
  .put(protect, updateSalary)
  .delete(protect, deleteSalary);

module.exports = router;
