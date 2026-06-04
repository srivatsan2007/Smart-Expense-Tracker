const express = require('express');
const router = express.Router();
const { getSavingsGoals, createSavingsGoal, updateSavingsGoal, deleteSavingsGoal } = require('../controllers/savingsController');
const { protect } = require('../middleware/authMiddleware');

router.route('/')
  .get(protect, getSavingsGoals)
  .post(protect, createSavingsGoal);

router.route('/:id')
  .put(protect, updateSavingsGoal)
  .delete(protect, deleteSavingsGoal);

module.exports = router;
