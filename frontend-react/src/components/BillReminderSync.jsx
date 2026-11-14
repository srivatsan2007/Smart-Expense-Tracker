import { useEffect } from 'react';
import {
  isNativeApp,
  getReminderFlag,
  enableReminders,
  syncBillReminders,
} from '../utils/localReminders.js';

/**
 * Keeps the phone's bill reminders in sync. Renders nothing.
 * Mounted once inside <Layout>, i.e. only for signed-in pages.
 */
export default function BillReminderSync() {
  useEffect(() => {
    if (!isNativeApp()) return undefined;

    let timer = null;
    const scheduleSync = () => {
      clearTimeout(timer);
      timer = setTimeout(() => syncBillReminders(), 1500); // debounce bursts of changes
    };

    // First launch: ask for notification permission once, then turn reminders on.
    if (getReminderFlag() === null) {
      enableReminders();
    } else {
      scheduleSync();
    }

    const onVisible = () => {
      if (document.visibilityState === 'visible') scheduleSync();
    };
    window.addEventListener('rupeerise:bills-changed', scheduleSync);
    window.addEventListener('rupeerise:prefs-changed', scheduleSync);
    document.addEventListener('visibilitychange', onVisible);

    return () => {
      clearTimeout(timer);
      window.removeEventListener('rupeerise:bills-changed', scheduleSync);
      window.removeEventListener('rupeerise:prefs-changed', scheduleSync);
      document.removeEventListener('visibilitychange', onVisible);
    };
  }, []);

  return null;
}
