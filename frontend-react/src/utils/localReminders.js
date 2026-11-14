/**
 * On-device bill reminders for the Android app (Capacitor Local Notifications).
 *
 * No Firebase Cloud Messaging / server push is needed: the phone itself schedules
 * a notification for each pending bill (5 days before, 3 days before, on the due
 * date, and a few overdue follow-ups) and Android shows them even when the app is closed.
 *
 * The schedule is rebuilt every time the app opens, after any bill is added /
 * edited / paid / deleted, and when the notification settings are saved.
 */
import { LocalNotifications } from '@capacitor/local-notifications';
import { getAuthHeaders } from '../hooks/useAuth.js';

const FLAG_KEY = 'rr_local_reminders'; // '1' = on, '0' = off, null = never asked
const PREFS_KEY = 'rr_notif_prefs';
const CHANNEL_ID = 'bill-reminders';
const MAX_SCHEDULED = 150; // Android limits pending alarms per app, stay well below it
const HORIZON_DAYS = 60; // only schedule bills due within this window
const MAX_OVERDUE_REMINDERS = 6;

const DEFAULT_PREFS = {
  enabled: true,
  reminder5Days: true,
  reminder3Days: true,
  reminderDueDate: true,
  reminderOverdue: true,
  overdueFrequencyDays: 2,
  preferredTime: '09:00',
  quietHoursEnabled: false,
  quietHoursStart: '22:00',
  quietHoursEnd: '07:00',
  privacyMode: false,
};

export const isNativeApp = () => {
  try {
    return Boolean(window.Capacitor?.isNativePlatform?.());
  } catch {
    return false;
  }
};

export const getReminderFlag = () => localStorage.getItem(FLAG_KEY);
export const setReminderFlag = (on) => localStorage.setItem(FLAG_KEY, on ? '1' : '0');

/* ---------------- permission ---------------- */

/** Returns 'granted' | 'denied' | 'prompt' */
export async function checkReminderPermission() {
  try {
    const { display } = await LocalNotifications.checkPermissions();
    if (display === 'granted') return 'granted';
    if (display === 'denied') return 'denied';
    return 'prompt';
  } catch {
    return 'denied';
  }
}

export async function requestReminderPermission() {
  try {
    const { display } = await LocalNotifications.requestPermissions();
    return display === 'granted' ? 'granted' : 'denied';
  } catch {
    return 'denied';
  }
}

async function ensureChannel() {
  try {
    await LocalNotifications.createChannel({
      id: CHANNEL_ID,
      name: 'Bill reminders',
      description: 'Upcoming and overdue bill payment reminders',
      importance: 4, // high: shows in the notification bar with sound
      visibility: 1,
      vibration: true,
    });
  } catch {
    /* channels only exist on Android 8+; ignore elsewhere */
  }
}

/* ---------------- helpers ---------------- */

function formatINR(amount) {
  try {
    return new Intl.NumberFormat('en-IN', {
      style: 'currency',
      currency: 'INR',
      maximumFractionDigits: 0,
    }).format(Number(amount) || 0);
  } catch {
    return `₹${amount}`;
  }
}

// Deterministic positive 31-bit id so the same reminder always gets the same id.
function makeId(text) {
  let h = 5381;
  for (let i = 0; i < text.length; i++) h = ((h << 5) + h + text.charCodeAt(i)) | 0;
  return (Math.abs(h) % 2147483000) + 1;
}

function parseTime(str, fallback) {
  const m = /^(\d{1,2}):(\d{2})$/.exec(String(str || ''));
  if (!m) return fallback;
  return { h: Math.min(23, Number(m[1])), m: Math.min(59, Number(m[2])) };
}

// If the chosen time falls inside quiet hours, push it to the end of quiet hours.
function applyQuietHours(date, prefs) {
  if (!prefs.quietHoursEnabled) return date;
  const start = parseTime(prefs.quietHoursStart, { h: 22, m: 0 });
  const end = parseTime(prefs.quietHoursEnd, { h: 7, m: 0 });
  const mins = date.getHours() * 60 + date.getMinutes();
  const s = start.h * 60 + start.m;
  const e = end.h * 60 + end.m;
  const inQuiet = s <= e ? mins >= s && mins <= e : mins >= s || mins <= e;
  if (!inQuiet) return date;
  const out = new Date(date);
  out.setHours(end.h, end.m, 0, 0);
  if (out < date && s > e && mins >= s) out.setDate(out.getDate() + 1);
  return out;
}

async function loadPrefs() {
  try {
    const res = await fetch('/api/notifications/preferences', { headers: getAuthHeaders() });
    if (res.ok) {
      const data = await res.json();
      const merged = { ...DEFAULT_PREFS, ...data };
      localStorage.setItem(PREFS_KEY, JSON.stringify(merged));
      return merged;
    }
  } catch {
    /* offline – fall back to the cached copy */
  }
  try {
    const cached = JSON.parse(localStorage.getItem(PREFS_KEY) || 'null');
    if (cached) return { ...DEFAULT_PREFS, ...cached };
  } catch {
    /* ignore */
  }
  return { ...DEFAULT_PREFS };
}

async function loadBills() {
  const res = await fetch('/api/bills', { headers: getAuthHeaders() });
  if (!res.ok) throw new Error('bills fetch failed');
  const list = await res.json();
  return Array.isArray(list) ? list : [];
}

/* ---------------- build the schedule ---------------- */

export function buildReminders(bills, prefs, now = new Date()) {
  const time = parseTime(prefs.preferredTime, { h: 9, m: 0 });
  const startOfToday = new Date(now);
  startOfToday.setHours(0, 0, 0, 0);
  const horizon = new Date(startOfToday);
  horizon.setDate(horizon.getDate() + HORIZON_DAYS);

  const items = [];

  const add = (bill, key, daysFromDue, title, body) => {
    const due = new Date(bill.dueDate);
    if (Number.isNaN(due.getTime())) return;
    const at = new Date(due);
    at.setHours(time.h, time.m, 0, 0);
    at.setDate(at.getDate() + daysFromDue);
    const when = applyQuietHours(at, prefs);
    if (when <= now) return; // already in the past
    if (when > horizon) return;
    const billId = bill.id || bill._id || bill.billName;
    items.push({
      id: makeId(`${billId}_${key}_${String(bill.dueDate).slice(0, 10)}`),
      title,
      body,
      channelId: CHANNEL_ID,
      schedule: { at: when, allowWhileIdle: true },
      extra: { url: '/calendar', billId },
    });
  };

  for (const bill of bills) {
    if (bill.status !== 'pending' || !bill.dueDate) continue;
    const name = bill.billName || 'Bill';
    const amt = formatINR(bill.amount);
    const priv = prefs.privacyMode;

    if (prefs.reminder5Days !== false) {
      add(bill, '5d', -5, 'Upcoming Payment',
        priv ? 'You have an upcoming bill due in 5 days. Open RupeeRise to review.'
             : `Your ${name} payment (${amt}) is due in 5 days.`);
    }
    if (prefs.reminder3Days !== false) {
      add(bill, '3d', -3, 'Payment Due Soon',
        priv ? 'A bill payment is due in 3 days. Review details in RupeeRise.'
             : `Your ${name} (${amt}) is due in 3 days.`);
    }
    if (prefs.reminderDueDate !== false) {
      add(bill, '0d', 0, 'Payment Due Today',
        priv ? 'You have a bill due today. Open RupeeRise to confirm.'
             : `Your ${name} (${amt}) is due today.`);
    }
    if (prefs.reminderOverdue !== false) {
      const freq = Math.max(1, Number(prefs.overdueFrequencyDays) || 2);
      const days = new Set([1]);
      for (let d = freq; days.size < MAX_OVERDUE_REMINDERS; d += freq) days.add(d);
      for (const d of days) {
        add(bill, `od${d}`, d, 'Payment Overdue',
          priv ? `A bill is overdue by ${d} day(s). Open RupeeRise to review.`
               : `Overdue Alert: ${name} (${amt}) was due ${d} day(s) ago.`);
      }
    }
  }

  items.sort((a, b) => a.schedule.at - b.schedule.at);
  return items.slice(0, MAX_SCHEDULED);
}

/* ---------------- public API ---------------- */

export async function cancelAllReminders() {
  if (!isNativeApp()) return;
  try {
    const { notifications } = await LocalNotifications.getPending();
    if (notifications?.length) {
      await LocalNotifications.cancel({ notifications: notifications.map((n) => ({ id: n.id })) });
    }
  } catch (err) {
    console.warn('[Reminders] cancel failed', err);
  }
}

/**
 * Rebuilds all bill reminders from scratch.
 * Pass `bills` if you already have the list, otherwise it is fetched.
 */
let syncing = false;
export async function syncBillReminders(bills) {
  if (!isNativeApp()) return { scheduled: 0, skipped: 'not-native' };
  if (getReminderFlag() !== '1') return { scheduled: 0, skipped: 'disabled' };
  if (!localStorage.getItem('token')) return { scheduled: 0, skipped: 'signed-out' };
  if (syncing) return { scheduled: 0, skipped: 'busy' };
  syncing = true;
  try {
    if ((await checkReminderPermission()) !== 'granted') {
      return { scheduled: 0, skipped: 'no-permission' };
    }
    await ensureChannel();
    const prefs = await loadPrefs();
    await cancelAllReminders();
    if (prefs.enabled === false) return { scheduled: 0, skipped: 'prefs-off' };

    const list = bills || (await loadBills());
    const items = buildReminders(list, prefs);
    if (items.length) await LocalNotifications.schedule({ notifications: items });
    return { scheduled: items.length };
  } catch (err) {
    console.warn('[Reminders] sync failed', err);
    return { scheduled: 0, error: err.message };
  } finally {
    syncing = false;
  }
}

/** Turn reminders on: asks Android for permission, then schedules everything. */
export async function enableReminders() {
  const perm = await requestReminderPermission();
  if (perm !== 'granted') {
    setReminderFlag(false);
    return { ok: false, permission: perm };
  }
  setReminderFlag(true);
  const result = await syncBillReminders();
  return { ok: true, permission: 'granted', ...result };
}

export async function disableReminders() {
  setReminderFlag(false);
  await cancelAllReminders();
}

/** Fires a notification ~3 seconds from now so the user can confirm it works. */
export async function sendTestReminder() {
  await ensureChannel();
  await LocalNotifications.schedule({
    notifications: [
      {
        id: makeId('rupeerise-test'),
        title: 'RupeeRise Notification Test',
        body: 'Notifications are working! You will get bill reminders even when the app is closed.',
        channelId: CHANNEL_ID,
        schedule: { at: new Date(Date.now() + 3000), allowWhileIdle: true },
      },
    ],
  });
}
