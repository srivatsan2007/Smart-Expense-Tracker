const webpush = require('web-push');
const cron = require('node-cron');
const { admin } = require('../db');

// VAPID keys setup
const VAPID_PUBLIC_KEY = process.env.VAPID_PUBLIC_KEY || 'BFwbSbz9-qqK6HSUL1qjOiMydAqlBIaTpS_Rf_FBbhUOSVYSr0R71rNpPIwAaWoocmXwcghFLL8Mf0RPZa70gw0';
const VAPID_PRIVATE_KEY = process.env.VAPID_PRIVATE_KEY || 'vyoYRKhwwj4n7Z3q4TqUxRj30PzFG64Vce4TMW-fl7E';
const VAPID_SUBJECT = process.env.VAPID_SUBJECT || 'mailto:support@rupeerise.app';

try {
  webpush.setVapidDetails(VAPID_SUBJECT, VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY);
  console.log('[WebPush] VAPID details configured successfully');
} catch (err) {
  console.error('[WebPush] Failed to configure VAPID details:', err.message);
}

/**
 * Send push notification to all active devices registered by a user
 */
async function sendPushToUser(userId, payload) {
  const db = admin.firestore();
  const snapshot = await db.collection('pushSubscriptions')
    .where('user', '==', userId)
    .where('active', '==', true)
    .get();

  if (snapshot.empty) {
    return { success: false, reason: 'No active push subscriptions found for user' };
  }

  let sentCount = 0;
  let failureCount = 0;
  const expiredSubs = [];

  const stringifiedPayload = JSON.stringify(payload);

  for (const doc of snapshot.docs) {
    const data = doc.data();
    if (!data.subscription || !data.subscription.endpoint) {
      expiredSubs.push(doc.id);
      continue;
    }

    try {
      await webpush.sendNotification(data.subscription, stringifiedPayload);
      sentCount++;
    } catch (error) {
      failureCount++;
      console.warn(`[WebPush] Push delivery failure for sub ${doc.id}: ${error.statusCode || error.message}`);
      // 410 Gone or 404 Not Found indicates subscription has expired or unsubscribed
      if (error.statusCode === 410 || error.statusCode === 404) {
        expiredSubs.push(doc.id);
      }
    }
  }

  // Clean up expired or invalid subscriptions
  if (expiredSubs.length > 0) {
    const batch = db.batch();
    for (const subId of expiredSubs) {
      batch.delete(db.collection('pushSubscriptions').doc(subId));
    }
    await batch.commit();
    console.log(`[WebPush] Pruned ${expiredSubs.length} expired push subscriptions`);
  }

  return { success: sentCount > 0, sentCount, failureCount };
}

/**
 * Check if the current time in user's timezone is within quiet hours
 */
function isWithinQuietHours(preferences) {
  if (!preferences || !preferences.quietHoursEnabled) return false;

  try {
    const timeZone = preferences.timeZone || 'Asia/Kolkata';
    const now = new Date();
    const formatter = new Intl.DateTimeFormat('en-US', {
      timeZone,
      hour: '2-digit',
      minute: '2-digit',
      hour12: false
    });
    const parts = formatter.format(now).split(':');
    const currentMinutes = parseInt(parts[0], 10) * 60 + parseInt(parts[1], 10);

    const [startH, startM] = (preferences.quietHoursStart || '22:00').split(':').map(Number);
    const [endH, endM] = (preferences.quietHoursEnd || '07:00').split(':').map(Number);
    const startMinutes = startH * 60 + startM;
    const endMinutes = endH * 60 + endM;

    if (startMinutes <= endMinutes) {
      // Quiet hours in same day (e.g. 13:00 to 15:00)
      return currentMinutes >= startMinutes && currentMinutes <= endMinutes;
    } else {
      // Quiet hours overnight (e.g. 22:00 to 07:00)
      return currentMinutes >= startMinutes || currentMinutes <= endMinutes;
    }
  } catch (e) {
    console.warn('[Scheduler] Quiet hours evaluation error:', e.message);
    return false;
  }
}

/**
 * Formats rupee amount into clean INR string without relying on DOM
 */
function formatCurrency(amount) {
  return new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    maximumFractionDigits: 0
  }).format(amount);
}

/**
 * Core reminder checker: scans unpaid bills, determines applicable reminders,
 * checks deduplication log, checks user preferences & quiet hours, and delivers push notifications.
 */
async function checkAndDispatchReminders() {
  const db = admin.firestore();
  console.log('[Scheduler] Running reminder check at', new Date().toISOString());

  try {
    // 1. Fetch all pending bills
    const billsSnapshot = await db.collection('bills')
      .where('status', '==', 'pending')
      .get();

    if (billsSnapshot.empty) {
      console.log('[Scheduler] No pending bills found');
      return { checked: 0, sent: 0 };
    }

    const today = new Date();
    today.setHours(0, 0, 0, 0);

    let checkedCount = 0;
    let sentCount = 0;

    // Cache preferences per user during this run
    const userPrefsCache = {};

    for (const billDoc of billsSnapshot.docs) {
      checkedCount++;
      const bill = billDoc.data();
      const billId = billDoc.id;
      const userId = bill.user;

      if (!userId || !bill.dueDate) continue;

      // Load user preferences
      if (!userPrefsCache[userId]) {
        const prefDoc = await db.collection('userPreferences').doc(userId).get();
        userPrefsCache[userId] = prefDoc.exists ? prefDoc.data() : {
          enabled: true,
          reminder5Days: true,
          reminder3Days: true,
          reminderDueDate: true,
          reminderOverdue: true,
          overdueFrequencyDays: 2,
          preferredTime: '09:00',
          timeZone: 'Asia/Kolkata',
          quietHoursEnabled: false,
          privacyMode: false
        };
      }

      const prefs = userPrefsCache[userId];

      // If user disabled notifications globally, skip
      if (prefs.enabled === false) continue;

      // Check quiet hours
      if (isWithinQuietHours(prefs)) {
        continue;
      }

      // Calculate days difference
      const dueDate = new Date(bill.dueDate);
      dueDate.setHours(0, 0, 0, 0);
      const diffDays = Math.round((dueDate - today) / (1000 * 60 * 60 * 24));
      const dueDateKey = bill.dueDate.split('T')[0];

      let reminderType = null;
      let title = '';
      let body = '';

      if (diffDays === 5 && prefs.reminder5Days !== false) {
        reminderType = '5days';
        title = 'Upcoming Payment';
        body = prefs.privacyMode
          ? 'You have an upcoming bill due in 5 days. Open RupeeRise to review.'
          : `Your ${bill.billName} payment (${formatCurrency(bill.amount)}) is due in 5 days.`;
      } else if (diffDays === 3 && prefs.reminder3Days !== false) {
        reminderType = '3days';
        title = 'Payment Due Soon';
        body = prefs.privacyMode
          ? 'A bill payment is due in 3 days. Review details in RupeeRise.'
          : `Your ${bill.billName} (${formatCurrency(bill.amount)}) is due in 3 days.`;
      } else if (diffDays === 0 && prefs.reminderDueDate !== false) {
        reminderType = 'dueDate';
        title = 'Payment Due Today';
        body = prefs.privacyMode
          ? 'You have a bill due today. Open RupeeRise to confirm.'
          : `Your ${bill.billName} (${formatCurrency(bill.amount)}) is due today.`;
      } else if (diffDays < 0 && prefs.reminderOverdue !== false) {
        // Overdue reminder: check frequency to avoid spamming every day
        const daysOverdue = Math.abs(diffDays);
        const freq = prefs.overdueFrequencyDays || 2;
        if (daysOverdue % freq === 0 || daysOverdue === 1) {
          reminderType = `overdue_day_${daysOverdue}`;
          title = 'Payment Overdue';
          body = prefs.privacyMode
            ? `A bill is overdue by ${daysOverdue} day(s). Open RupeeRise to review.`
            : `Overdue Alert: ${bill.billName} (${formatCurrency(bill.amount)}) was due ${daysOverdue} day(s) ago.`;
        }
      }

      if (!reminderType) continue;

      // Deduplication check: unique key per user + bill + reminderType + dueDateKey
      const reminderKey = `${userId}_${billId}_${reminderType}_${dueDateKey}`;
      const logRef = db.collection('reminderLogs').doc(reminderKey);
      const logDoc = await logRef.get();

      if (logDoc.exists && logDoc.data().sent) {
        // Already dispatched
        continue;
      }

      // Build push payload
      const pushPayload = {
        title,
        body,
        icon: '/images/rupeerise-logo.png',
        badge: '/favicon.png',
        url: `/calendar?highlightBill=${billId}`,
        data: {
          billId,
          billName: bill.billName,
          amount: bill.amount,
          dueDate: bill.dueDate,
          reminderType,
          url: '/calendar'
        }
      };

      const result = await sendPushToUser(userId, pushPayload);

      // Record in persistent reminderLogs
      await logRef.set({
        key: reminderKey,
        user: userId,
        billId,
        billName: bill.billName,
        amount: bill.amount,
        dueDate: bill.dueDate,
        reminderType,
        sent: result.success,
        attemptedAt: new Date().toISOString(),
        deliveredDevices: result.sentCount || 0,
        failedDevices: result.failureCount || 0,
        createdAt: new Date().toISOString()
      });

      if (result.success) {
        sentCount++;
        console.log(`[Scheduler] Sent push reminder (${reminderType}) to user ${userId} for bill "${bill.billName}"`);
      }
    }

    console.log(`[Scheduler] Finished run. Checked ${checkedCount} bills, dispatched ${sentCount} reminders.`);
    return { checked: checkedCount, sent: sentCount };
  } catch (error) {
    console.error('[Scheduler] Error during reminder run:', error);
    return { error: error.message };
  }
}

/**
 * Initialize persistent cron scheduler
 * Runs every 30 minutes in background (e.g. 09:00, 09:30, 10:00, etc.)
 */
function initScheduler() {
  console.log('[Scheduler] Initializing background notification scheduler (Cron: */30 * * * *)');
  
  // Every 30 minutes
  cron.schedule('*/30 * * * *', () => {
    checkAndDispatchReminders();
  });

  // Also run 10 seconds after server boot to catch any pending reminders
  setTimeout(() => {
    checkAndDispatchReminders();
  }, 10000);
}

module.exports = {
  VAPID_PUBLIC_KEY,
  sendPushToUser,
  checkAndDispatchReminders,
  initScheduler
};
