const express = require('express');
const router = express.Router();
const { getUsers, deleteUser } = require('../controllers/adminController');
const { protect } = require('../middleware/authMiddleware');
const { adminProtect } = require('../middleware/adminMiddleware');

// All routes require authentication AND admin privileges
router.use(protect, adminProtect);

router.get('/users', getUsers);
router.delete('/users/:id', deleteUser);

module.exports = router;
