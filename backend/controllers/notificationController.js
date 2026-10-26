const crypto = require('crypto');
const { admin } = require('../db');
const {
  VAPID_PUBLIC_KEY,
  sendPushToUser,
  checkAndDispatchReminders
} = require('../services/reminderScheduler');

// @desc    Get VAPID public key for web push subscription
// @route   GET /api/notifications/vapid-public-key
// @access  Public (or Private)
const getVapidPublicKey = (req, res) => {
  res.json({ publicKey: VAPID_PUBLIC_KEY });
};

// @desc    Register a new push subscription
// @route   POST /api/notifications/subscribe
// @access  Private
const subscribe = async (req, res) => {
  try {
    const { subscription, deviceName, userAgent } = req.body;

    if (!subscription || !subscription.endpoint || !subscription.keys) {
      return res.status(400).json({ message: 'Valid push subscription object is required' });
    }

    const db = admin.firestore();
    
    // Hash endpoint to create a deterministic, unique document ID per device subscription
    const endpointHash = crypto.createHash('sha256').update(subscription.endpoint).digest('hex');
    const subRef = db.collection('pushSubscriptions').doc(endpointHash);

    const subData = {
      user: req.user.id,
      endpointHash,
      subscription: {
        endpoint: subscription.endpoint,
        keys: {
          p256dh: subscription.keys.p256dh,
          auth: subscription.keys.auth
        }
      },
      deviceName: deviceName || 'Web Browser',
      userAgent: userAgent || req.headers['user-agent'] || '',
      active: true,
      updatedAt: new Date().toISOString(),
      createdAt: new Date().toISOString()
    };

    await subRef.set(subData, { merge: true });

    res.status(201).json({
      success: true,
      message: 'Push subscription registered successfully',
      id: endpointHash
    });
  } catch (error) {
    console.error('Error saving push subscription:', error);
    res.status(500).json({ message: error.message });
  }
};

// @desc    Unsubscribe a device
// @route   POST /api/notifications/unsubscribe
// @access  Private
const unsubscribe = async (req, res) => {
  try {
    const { endpoint } = req.body;

    if (!endpoint) {
      return res.status(400).json({ message: 'Endpoint is required' });
    }

    const endpointHash = crypto.createHash('sha256').update(endpoint).digest('hex');
    const db = admin.firestore();
    const docRef = db.collection('pushSubscriptions').doc(endpointHash);
    const doc = await docRef.get();

    if (doc.exists && doc.data().user === req.user.id) {
      await docRef.delete();
      return res.json({ success: true, message: 'Unsubscribed successfully' });
    }

    res.json({ success: true, message: 'Subscription not found or already removed' });
  } catch (error) {
    console.error('Error unsubscribing:', error);
    res.status(500).json({ message: error.message });
  }
};

// @desc    Get user notification preferences
// @route   GET /api/notifications/preferences
// @access  Private
const getPreferences = async (req, res) => {
  try {
    const db = admin.firestore();
    const docRef = db.collection('userPreferences').doc(req.user.id);
    const doc = await docRef.get();

    const defaultPrefs = {
      enabled: true,
      reminder5Days: true,
      reminder3Days: true,
      reminderDueDate: true,
      reminderOverdue: true,
      overdueFrequencyDays: 2,
      preferredTime: '09:00',
      timeZone: 'Asia/Kolkata',
      quietHoursEnabled: false,
      quietHoursStart: '22:00',
      quietHoursEnd: '07:00',
      privacyMode: false
    };

    if (doc.exists) {
      return res.json({ ...defaultPrefs, ...doc.data() });
    }

    res.json(defaultPrefs);
  } catch (error) {
    console.error('Error fetching notification preferences:', error);
    res.status(500).json({ message: error.message });
  }
};

// @desc    Update user notification preferences
// @route   PUT /api/notifications/preferences
// @access  Private
const updatePreferences = async (req, res) => {
  try {
    const db = admin.firestore();
    const docRef = db.collection('userPreferences').doc(req.user.id);

    const allowedFields = [
      'enabled',
      'reminder5Days',
      'reminder3Days',
      'reminderDueDate',
      'reminderOverdue',
      'overdueFrequencyDays',
      'preferredTime',
      'timeZone',
      'quietHoursEnabled',
      'quietHoursStart',
      'quietHoursEnd',
      'privacyMode'
    ];

    const updates = {};
    for (const key of allowedFields) {
      if (req.body[key] !== undefined) {
        updates[key] = req.body[key];
      }
    }
    updates.updatedAt = new Date().toISOString();

    await docRef.set(updates, { merge: true });
    const updatedDoc = await docRef.get();

    res.json({ success: true, preferences: updatedDoc.data() });
  } catch (error) {
    console.error('Error updating notification preferences:', error);
    res.status(500).json({ message: error.message });
  }
};

// @desc    Send test push notification to user's registered devices
// @route   POST /api/notifications/test
// @access  Private
const sendTestNotification = async (req, res) => {
  try {
    const payload = {
      title: 'RupeeRise Notification Test',
      body: 'Push notifications are active! You will receive bill reminders even when RupeeRise is closed.',
      icon: '/images/rupeerise-logo.png',
      badge: '/favicon.png',
      url: '/calendar',
      data: {
        type: 'test',
        timestamp: new Date().toISOString(),
        url: '/calendar'
      }
    };

    const result = await sendPushToUser(req.user.id, payload);

    if (!result.success) {
      return res.status(400).json({
        success: false,
        message: result.reason || 'Could not send test push notification. Please ensure push permission is granted and device is subscribed.',
        ...result
      });
    }

    res.json({
      success: true,
      message: `Test push sent successfully to ${result.sentCount} active device(s)`,
      ...result
    });
  } catch (error) {
    console.error('Error sending test notification:', error);
    res.status(500).json({ message: error.message });
  }
};

// @desc    Trigger scheduled reminder check on-demand
// @route   POST /api/notifications/run-cron
// @access  Private
const triggerCron = async (req, res) => {
  try {
    const result = await checkAndDispatchReminders();
    res.json({ success: true, result });
  } catch (error) {
    console.error('Error triggering cron:', error);
    res.status(500).json({ message: error.message });
  }
};

module.exports = {
  getVapidPublicKey,
  subscribe,
  unsubscribe,
  getPreferences,
  updatePreferences,
  sendTestNotification,
  triggerCron
};
