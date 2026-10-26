const express = require('express');
const router = express.Router();
const {
  getVapidPublicKey,
  subscribe,
  unsubscribe,
  getPreferences,
  updatePreferences,
  sendTestNotification,
  triggerCron
} = require('../controllers/notificationController');
const { protect } = require('../middleware/authMiddleware');

router.get('/vapid-public-key', getVapidPublicKey);

router.post('/subscribe', protect, subscribe);
router.post('/unsubscribe', protect, unsubscribe);

router.route('/preferences')
  .get(protect, getPreferences)
  .put(protect, updatePreferences);

router.post('/test', protect, sendTestNotification);
router.post('/run-cron', protect, triggerCron);

module.exports = router;
