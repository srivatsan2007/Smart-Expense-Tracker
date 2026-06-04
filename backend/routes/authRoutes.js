const express = require('express');
const router = express.Router();
const { registerUser, loginUser, getUserProfile, getEmailByMobile, updateUserProfile, deleteMyAccount } = require('../controllers/authController');
const { protect } = require('../middleware/authMiddleware');

router.post('/register', registerUser);
router.post('/login', loginUser);
router.post('/get-email', getEmailByMobile);
router.get('/profile', protect, getUserProfile);
router.put('/profile', protect, updateUserProfile);
router.delete('/profile', protect, deleteMyAccount);

module.exports = router;
