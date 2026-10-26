import { useEffect, useState } from 'react';
import Layout from '../components/Layout.jsx';
import PageHeader from '../components/PageHeader.jsx';
import Modal from '../components/Modal.jsx';
import { notify } from '../components/Toast.jsx';
import { formatINR } from '../utils/formatters.js';
import { getAuthHeaders, logoutUser } from '../hooks/useAuth.js';
import {
  Settings as SettingsIcon,
  IndianRupee,
  User,
  Mail,
  Phone,
  AlertTriangle,
  AlertCircle,
  CheckCircle2,
  Trash2,
  Shield,
  Lock,
  Bell,
  Clock,
  Sparkles,
  RefreshCw,
  Check,
  Info
} from '../components/Icons.jsx';
import {
  isPushNotificationSupported,
  getNotificationPermission,
  subscribeToPushManager,
  getExistingPushSubscription
} from '../utils/pushNotifications.js';

const MONTHS = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December'
];

export default function Settings() {
  const currentMonthIdx = new Date().getMonth();
  const currentYearVal = new Date().getFullYear();

  const [month, setMonth] = useState(MONTHS[currentMonthIdx]);
  const [year, setYear] = useState(currentYearVal);
  const [limit, setLimit] = useState('');
  const [savingBudget, setSavingBudget] = useState(false);

  // Budget status tracking
  const [monthSpent, setMonthSpent] = useState(0);
  const [alertLevel, setAlertLevel] = useState(null); // null | 'healthy' | 'warning' | 'danger'

  // User Profile
  const storedUser = JSON.parse(localStorage.getItem('user') || 'null');
  const [profile, setProfile] = useState({
    name: storedUser?.name || '',
    email: storedUser?.email || '',
    mobileNumber: storedUser?.mobileNumber || ''
  });
  const [savingProfile, setSavingProfile] = useState(false);

  // Danger Zone
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [deletingAccount, setDeletingAccount] = useState(false);

  // Push Notifications & Reminders State
  const [pushSupported, setPushSupported] = useState(true);
  const [permission, setPermission] = useState('default'); // 'default' | 'granted' | 'denied' | 'unsupported'
  const [isSubscribed, setIsSubscribed] = useState(false);
  const [subscribing, setSubscribing] = useState(false);
  const [testingPush, setTestingPush] = useState(false);
  const [savingPrefs, setSavingPrefs] = useState(false);

  const [notifPrefs, setNotifPrefs] = useState({
    enabled: true,
    reminder5Days: true,
    reminder3Days: true,
    reminderDueDate: true,
    reminderOverdue: true,
    overdueFrequencyDays: 2,
    preferredTime: '09:00',
    timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone || 'Asia/Kolkata',
    quietHoursEnabled: false,
    quietHoursStart: '22:00',
    quietHoursEnd: '07:00',
    privacyMode: false
  });

  const fetchBudget = async () => {
    try {
      const res = await fetch(`/api/budget?month=${month}&year=${year}`, { headers: getAuthHeaders() });
      if (res.ok) {
        const data = await res.json();
        setLimit(data && data.monthlyLimit ? data.monthlyLimit : '');
      }
    } catch (error) {
      console.error('Error fetching budget:', error);
    }
  };

  useEffect(() => {
    fetchBudget();
  }, [month, year]);

  const checkBudgetStatus = async () => {
    try {
      const allExpenses = await (await fetch('/api/expenses', { headers: getAuthHeaders() })).json();
      const m = new Date().getMonth();
      const y = new Date().getFullYear();
      const totalSpent = (Array.isArray(allExpenses) ? allExpenses : [])
        .filter((e) => {
          const d = new Date(e.date);
          return d.getMonth() === m && d.getFullYear() === y;
        })
        .reduce((acc, e) => acc + (Number(e.amount) || 0), 0);

      setMonthSpent(totalSpent);

      const budgetData = await (await fetch(`/api/budget?month=${MONTHS[m]}&year=${y}`, { headers: getAuthHeaders() })).json();
      if (budgetData && budgetData.monthlyLimit && Number(budgetData.monthlyLimit) > 0) {
        const pct = (totalSpent / budgetData.monthlyLimit) * 100;
        if (pct >= 100) setAlertLevel('danger');
        else if (pct >= 80) setAlertLevel('warning');
        else setAlertLevel('healthy');
      } else {
        setAlertLevel(null);
      }
    } catch (error) {
      console.error('Error checking budget status:', error);
    }
  };

  useEffect(() => {
    checkBudgetStatus();
  }, []);

  // Fetch Notification Settings & Browser Push Status
  const fetchNotificationState = async () => {
    const supported = isPushNotificationSupported();
    setPushSupported(supported);

    if (!supported) {
      setPermission('unsupported');
      return;
    }

    const currentPerm = getNotificationPermission();
    setPermission(currentPerm);

    // Check if device already has active PushManager subscription
    const existingSub = await getExistingPushSubscription();
    setIsSubscribed(Boolean(existingSub));

    // Fetch user preferences from backend
    try {
      const res = await fetch('/api/notifications/preferences', { headers: getAuthHeaders() });
      if (res.ok) {
        const data = await res.json();
        setNotifPrefs(prev => ({ ...prev, ...data }));
      }
    } catch (err) {
      console.error('Error fetching notification preferences:', err);
    }
  };

  useEffect(() => {
    fetchNotificationState();
  }, []);

  // Enable Push Notifications
  const handleEnableNotifications = async () => {
    try {
      setSubscribing(true);

      // 1. Fetch public VAPID key
      const keyRes = await fetch('/api/notifications/vapid-public-key', { headers: getAuthHeaders() });
      if (!keyRes.ok) throw new Error('Could not fetch server VAPID key');
      const { publicKey } = await keyRes.json();

      // 2. Request permission and subscribe in browser
      const subscription = await subscribeToPushManager(publicKey);

      // 3. Register subscription with backend
      const regRes = await fetch('/api/notifications/subscribe', {
        method: 'POST',
        headers: getAuthHeaders(),
        body: JSON.stringify({
          subscription,
          deviceName: navigator.userAgent.includes('Mobile') ? 'Mobile Device' : 'Desktop Browser',
          userAgent: navigator.userAgent
        })
      });

      if (regRes.ok) {
        setIsSubscribed(true);
        setPermission('granted');
        notify('Background push notifications enabled! You will receive reminders even when RupeeRise is closed.');
      } else {
        const err = await regRes.json();
        notify(err.message || 'Failed to save push subscription on server', 'error');
      }
    } catch (err) {
      console.error('Push subscription error:', err);
      notify(err.message || 'Failed to enable notifications', 'error');
      setPermission(getNotificationPermission());
    } finally {
      setSubscribing(false);
    }
  };

  // Disable Push Notifications
  const handleDisableNotifications = async () => {
    try {
      setSubscribing(true);
      const sub = await getExistingPushSubscription();

      if (sub) {
        await fetch('/api/notifications/unsubscribe', {
          method: 'POST',
          headers: getAuthHeaders(),
          body: JSON.stringify({ endpoint: sub.endpoint })
        });
        await sub.unsubscribe();
      }

      setIsSubscribed(false);
      notify('Push notifications disabled for this device');
    } catch (err) {
      console.error('Error disabling push:', err);
      notify('Error disabling notifications', 'error');
    } finally {
      setSubscribing(false);
    }
  };

  // Send Test Push Notification
  const handleSendTestNotification = async () => {
    try {
      setTestingPush(true);
      const res = await fetch('/api/notifications/test', {
        method: 'POST',
        headers: getAuthHeaders()
      });

      const data = await res.json();
      if (res.ok) {
        notify('Test notification dispatched! Check your system notification tray/lock-screen.');
      } else {
        notify(data.message || 'Could not deliver test notification', 'error');
      }
    } catch (err) {
      console.error(err);
      notify('An error occurred during test push', 'error');
    } finally {
      setTestingPush(false);
    }
  };

  // Save Preferences
  const handleSavePreferences = async (e) => {
    e.preventDefault();
    try {
      setSavingPrefs(true);
      const res = await fetch('/api/notifications/preferences', {
        method: 'PUT',
        headers: getAuthHeaders(),
        body: JSON.stringify(notifPrefs)
      });

      if (res.ok) {
        notify('Notification schedule and quiet hours updated successfully!');
      } else {
        notify('Failed to save notification preferences', 'error');
      }
    } catch (err) {
      console.error(err);
      notify('Error updating preferences', 'error');
    } finally {
      setSavingPrefs(false);
    }
  };

  const saveBudget = async (e) => {
    e.preventDefault();
    if (!limit || Number(limit) <= 0) {
      notify('Please enter a valid monthly budget limit', 'warning');
      return;
    }

    setSavingBudget(true);
    try {
      const res = await fetch('/api/budget', {
        method: 'POST',
        headers: getAuthHeaders(),
        body: JSON.stringify({
          month,
          year: Number(year),
          monthlyLimit: Number(limit),
          categoryLimits: []
        })
      });

      if (res.ok) {
        notify(`Budget for ${month} ${year} saved successfully!`, 'success');
        checkBudgetStatus();
      } else {
        const err = await res.json().catch(() => ({}));
        notify(err.message || 'Failed to save budget', 'error');
      }
    } catch (err) {
      console.error(err);
      notify('Error saving budget', 'error');
    } finally {
      setSavingBudget(false);
    }
  };

  const saveProfile = async (e) => {
    e.preventDefault();
    if (!profile.name.trim()) {
      notify('Name cannot be empty', 'warning');
      return;
    }

    setSavingProfile(true);
    try {
      const res = await fetch('/api/auth/profile', {
        method: 'PUT',
        headers: getAuthHeaders(),
        body: JSON.stringify({
          name: profile.name.trim(),
          mobileNumber: profile.mobileNumber.trim()
        })
      });
      const data = await res.json();
      if (res.ok) {
        localStorage.setItem('user', JSON.stringify(data));
        notify('Profile updated successfully!', 'success');
      } else {
        notify(data.message || 'Failed to update profile', 'error');
      }
    } catch (error) {
      console.error('Profile Update Error:', error);
      notify('An error occurred while updating profile', 'error');
    } finally {
      setSavingProfile(false);
    }
  };

  const deleteAccount = async () => {
    setDeletingAccount(true);
    try {
      const res = await fetch('/api/auth/profile', {
        method: 'DELETE',
        headers: getAuthHeaders()
      });
      const data = await res.json();
      if (res.ok) {
        notify('Your account and records have been deleted', 'info');
        setTimeout(() => logoutUser(), 1000);
      } else {
        notify(data.message || 'Failed to delete account', 'error');
        setDeletingAccount(false);
      }
    } catch (error) {
      console.error('Account Deletion Error:', error);
      notify('Error deleting account', 'error');
      setDeletingAccount(false);
    }
  };

  const budgetNum = Number(limit) || 0;
  const spentPct = budgetNum > 0 ? Math.min(100, (monthSpent / budgetNum) * 100) : 0;

  return (
    <Layout title="Settings & Notifications - RupeeRise" active="settings">
      <PageHeader
        title="Settings & Notification Preferences"
        subtitle="Manage spending thresholds, real-time background push alerts, reminder schedules, and user profile"
      />

      {/* Dynamic Alert Banner */}
      {alertLevel === 'danger' && (
        <div
          style={{
            padding: '16px 20px',
            background: 'rgba(239, 68, 68, 0.12)',
            border: '1px solid rgba(239, 68, 68, 0.35)',
            borderRadius: 14,
            marginBottom: 24,
            display: 'flex',
            alignItems: 'center',
            gap: 14,
            color: 'var(--danger-color)'
          }}
        >
          <AlertCircle size={24} />
          <div>
            <h4 style={{ fontWeight: 700, margin: 0, fontSize: '0.98rem' }}>
              Budget Alert: 100% Threshold Exceeded!
            </h4>
            <p style={{ margin: 0, fontSize: '0.85rem', opacity: 0.9 }}>
              Your current spending of {formatINR(monthSpent)} exceeds your monthly budget limit of {formatINR(budgetNum)}.
            </p>
          </div>
        </div>
      )}

      {alertLevel === 'warning' && (
        <div
          style={{
            padding: '16px 20px',
            background: 'rgba(245, 158, 11, 0.12)',
            border: '1px solid rgba(245, 158, 11, 0.35)',
            borderRadius: 14,
            marginBottom: 24,
            display: 'flex',
            alignItems: 'center',
            gap: 14,
            color: '#b45309'
          }}
        >
          <AlertTriangle size={24} />
          <div>
            <h4 style={{ fontWeight: 700, margin: 0, fontSize: '0.98rem' }}>
              Caution: 80% Budget Threshold Reached
            </h4>
            <p style={{ margin: 0, fontSize: '0.85rem', opacity: 0.9 }}>
              You have spent {formatINR(monthSpent)} ({spentPct.toFixed(0)}% of your monthly cap). Consider moderating discretionary expenses.
            </p>
          </div>
        </div>
      )}

      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(340px, 1fr))',
          gap: 24,
          alignItems: 'start'
        }}
      >
        {/* Left Column: Monthly Budget Config & Push Notification Controls */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
          {/* Monthly Budget Card */}
          <div className="glass-card">
            <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 18 }}>
              <div
                style={{
                  width: 42,
                  height: 42,
                  borderRadius: 12,
                  background: 'var(--primary-light)',
                  color: 'var(--primary-color)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center'
                }}
              >
                <IndianRupee size={22} />
              </div>
              <div>
                <h3 style={{ fontSize: '1.15rem', fontWeight: 600 }}>Monthly Budget Cap</h3>
                <p style={{ fontSize: '0.82rem', color: 'var(--text-muted)' }}>
                  Set limits to receive automatic 80% and 100% alert triggers
                </p>
              </div>
            </div>

            <form onSubmit={saveBudget}>
              <div style={{ display: 'grid', gridTemplateColumns: '1.4fr 1fr', gap: 12, marginBottom: 16 }}>
                <div className="form-group" style={{ marginBottom: 0 }}>
                  <label className="form-label">Month</label>
                  <select
                    className="form-control"
                    required
                    value={month}
                    onChange={(e) => setMonth(e.target.value)}
                  >
                    {MONTHS.map((m) => (
                      <option key={m} value={m}>{m}</option>
                    ))}
                  </select>
                </div>

                <div className="form-group" style={{ marginBottom: 0 }}>
                  <label className="form-label">Year</label>
                  <input
                    type="number"
                    className="form-control"
                    required
                    min="2000"
                    max="2100"
                    value={year}
                    onChange={(e) => setYear(e.target.value)}
                  />
                </div>
              </div>

              <div className="form-group">
                <label className="form-label">
                  Overall Spending Limit (₹) <span style={{ color: 'var(--danger-color)' }}>*</span>
                </label>
                <input
                  type="number"
                  className="form-control"
                  placeholder="e.g. 40000"
                  required
                  min="1"
                  step="0.01"
                  value={limit}
                  onChange={(e) => setLimit(e.target.value)}
                />
              </div>

              {/* Live Visual Status for this month */}
              {budgetNum > 0 && (
                <div
                  style={{
                    padding: 14,
                    borderRadius: 12,
                    background: 'var(--bg-main)',
                    border: '1px solid var(--border-color)',
                    marginBottom: 20
                  }}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.82rem', marginBottom: 6 }}>
                    <span style={{ color: 'var(--text-muted)' }}>
                      Current Spend ({MONTHS[currentMonthIdx]}):
                    </span>
                    <strong style={{ color: spentPct >= 100 ? 'var(--danger-color)' : 'var(--text-color)' }}>
                      {formatINR(monthSpent)} / {formatINR(budgetNum)}
                    </strong>
                  </div>

                  <div
                    style={{
                      height: 8,
                      borderRadius: 999,
                      background: 'var(--border-color)',
                      overflow: 'hidden',
                      marginBottom: 6
                    }}
                  >
                    <div
                      style={{
                        height: '100%',
                        width: `${spentPct}%`,
                        background: spentPct >= 100 ? 'var(--danger-color)' : spentPct >= 80 ? 'var(--warning-color)' : 'var(--primary-color)',
                        borderRadius: 999,
                        transition: 'width 0.4s ease'
                      }}
                    />
                  </div>

                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                    <span>Usage</span>
                    <span style={{ fontWeight: 600 }}>{spentPct.toFixed(1)}% utilized</span>
                  </div>
                </div>
              )}

              <button
                type="submit"
                className="btn btn-primary"
                style={{ width: '100%', justifyContent: 'center' }}
                disabled={savingBudget}
              >
                {savingBudget ? 'Saving...' : 'Save Budget Configuration'}
              </button>
            </form>
          </div>

          {/* SMART BACKGROUND PUSH NOTIFICATIONS & REMINDERS CARD */}
          <div className="glass-card">
            <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 18 }}>
              <div
                style={{
                  width: 42,
                  height: 42,
                  borderRadius: 12,
                  background: 'var(--primary-light)',
                  color: 'var(--primary-color)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center'
                }}
              >
                <Bell size={22} />
              </div>
              <div>
                <h3 style={{ fontSize: '1.15rem', fontWeight: 600 }}>Background Push Notifications</h3>
                <p style={{ fontSize: '0.82rem', color: 'var(--text-muted)' }}>
                  Receive system alerts even when RupeeRise is closed or in background
                </p>
              </div>
            </div>

            {/* Permission & Device Subscription Status */}
            <div
              style={{
                padding: '14px 16px',
                borderRadius: 12,
                background: isSubscribed && permission === 'granted'
                  ? 'rgba(16, 185, 129, 0.08)'
                  : permission === 'denied'
                  ? 'rgba(239, 68, 68, 0.08)'
                  : 'var(--bg-main)',
                border: isSubscribed && permission === 'granted'
                  ? '1px solid rgba(16, 185, 129, 0.25)'
                  : permission === 'denied'
                  ? '1px solid rgba(239, 68, 68, 0.25)'
                  : '1px solid var(--border-color)',
                marginBottom: 20
              }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
                <span style={{ fontSize: '0.82rem', fontWeight: 600, color: 'var(--text-color)' }}>
                  Device Push Status
                </span>
                <span
                  className={`badge ${
                    isSubscribed && permission === 'granted'
                      ? 'badge-success'
                      : permission === 'denied'
                      ? 'badge-danger'
                      : 'badge-neutral'
                  }`}
                  style={{ fontSize: '0.72rem' }}
                >
                  {isSubscribed && permission === 'granted'
                    ? 'Active on this Device'
                    : permission === 'denied'
                    ? 'Blocked in Browser'
                    : 'Not Subscribed'}
                </span>
              </div>

              <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)', margin: '0 0 12px 0', lineHeight: 1.45 }}>
                {isSubscribed && permission === 'granted' ? (
                  <span>
                    Your device is actively registered to receive Web Push notifications. Scheduled reminders will appear in your device notification tray even with the browser closed.
                  </span>
                ) : permission === 'denied' ? (
                  <span style={{ color: 'var(--danger-color)' }}>
                    Browser notifications are currently blocked. To enable, click the lock icon in your browser address bar and change Notifications to "Allow".
                  </span>
                ) : (
                  <span>
                    Enable background notifications to receive timely alerts 5 days before, 3 days before, and on bill due dates.
                  </span>
                )}
              </p>

              {/* Action Buttons */}
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10 }}>
                {isSubscribed && permission === 'granted' ? (
                  <>
                    <button
                      type="button"
                      className="btn btn-primary"
                      style={{ padding: '6px 14px', fontSize: '0.8rem' }}
                      onClick={handleSendTestNotification}
                      disabled={testingPush}
                    >
                      <Sparkles size={14} />
                      <span>{testingPush ? 'Dispatching...' : 'Send Test Notification'}</span>
                    </button>
                    <button
                      type="button"
                      className="btn btn-secondary"
                      style={{ padding: '6px 12px', fontSize: '0.8rem' }}
                      onClick={handleDisableNotifications}
                      disabled={subscribing}
                    >
                      Disable on this Device
                    </button>
                  </>
                ) : (
                  <button
                    type="button"
                    className="btn btn-primary"
                    style={{ padding: '8px 16px', fontSize: '0.82rem', width: '100%', justifyContent: 'center' }}
                    onClick={handleEnableNotifications}
                    disabled={subscribing || permission === 'denied'}
                  >
                    <Bell size={16} />
                    <span>{subscribing ? 'Registering with Device...' : 'Enable Background Push Notifications'}</span>
                  </button>
                )}
              </div>
            </div>

            {/* Reminder Schedule & Rules Configuration */}
            <form onSubmit={handleSavePreferences}>
              <div style={{ fontSize: '0.85rem', fontWeight: 700, color: 'var(--text-color)', marginBottom: 12 }}>
                Reminder Schedule & Triggers
              </div>

              {/* Global Enable Switch */}
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '8px 0', borderBottom: '1px solid var(--border-color)', marginBottom: 10 }}>
                <div>
                  <div style={{ fontSize: '0.85rem', fontWeight: 600 }}>Automated Bill Reminders</div>
                  <div style={{ fontSize: '0.74rem', color: 'var(--text-muted)' }}>Send background push messages for upcoming bills</div>
                </div>
                <input
                  type="checkbox"
                  checked={notifPrefs.enabled}
                  onChange={(e) => setNotifPrefs({ ...notifPrefs, enabled: e.target.checked })}
                />
              </div>

              {/* 5-Day Reminder */}
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '8px 0', borderBottom: '1px solid var(--border-color)' }}>
                <div>
                  <div style={{ fontSize: '0.85rem', fontWeight: 500 }}>5 Days Before Due Date</div>
                  <div style={{ fontSize: '0.74rem', color: 'var(--text-muted)' }}>Early notice to prepare funds</div>
                </div>
                <input
                  type="checkbox"
                  checked={notifPrefs.reminder5Days}
                  disabled={!notifPrefs.enabled}
                  onChange={(e) => setNotifPrefs({ ...notifPrefs, reminder5Days: e.target.checked })}
                />
              </div>

              {/* 3-Day Reminder */}
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '8px 0', borderBottom: '1px solid var(--border-color)' }}>
                <div>
                  <div style={{ fontSize: '0.85rem', fontWeight: 500 }}>3 Days Before Due Date</div>
                  <div style={{ fontSize: '0.74rem', color: 'var(--text-muted)' }}>Action reminder for approaching payments</div>
                </div>
                <input
                  type="checkbox"
                  checked={notifPrefs.reminder3Days}
                  disabled={!notifPrefs.enabled}
                  onChange={(e) => setNotifPrefs({ ...notifPrefs, reminder3Days: e.target.checked })}
                />
              </div>

              {/* Due Date Reminder */}
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '8px 0', borderBottom: '1px solid var(--border-color)' }}>
                <div>
                  <div style={{ fontSize: '0.85rem', fontWeight: 500 }}>On Due Date</div>
                  <div style={{ fontSize: '0.74rem', color: 'var(--text-muted)' }}>Urgent alert to pay before deadline</div>
                </div>
                <input
                  type="checkbox"
                  checked={notifPrefs.reminderDueDate}
                  disabled={!notifPrefs.enabled}
                  onChange={(e) => setNotifPrefs({ ...notifPrefs, reminderDueDate: e.target.checked })}
                />
              </div>

              {/* Overdue Reminder */}
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '8px 0', borderBottom: '1px solid var(--border-color)' }}>
                <div>
                  <div style={{ fontSize: '0.85rem', fontWeight: 500 }}>Overdue Alerts</div>
                  <div style={{ fontSize: '0.74rem', color: 'var(--text-muted)' }}>Periodic notice until payment is settled</div>
                </div>
                <input
                  type="checkbox"
                  checked={notifPrefs.reminderOverdue}
                  disabled={!notifPrefs.enabled}
                  onChange={(e) => setNotifPrefs({ ...notifPrefs, reminderOverdue: e.target.checked })}
                />
              </div>

              {/* Privacy Mode */}
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '10px 0', borderBottom: '1px solid var(--border-color)' }}>
                <div>
                  <div style={{ fontSize: '0.85rem', fontWeight: 600 }}>Privacy Mode (Lock-Screen)</div>
                  <div style={{ fontSize: '0.74rem', color: 'var(--text-muted)' }}>Hide exact monetary amounts on lock-screen notification cards</div>
                </div>
                <input
                  type="checkbox"
                  checked={notifPrefs.privacyMode}
                  onChange={(e) => setNotifPrefs({ ...notifPrefs, privacyMode: e.target.checked })}
                />
              </div>

              {/* Quiet Hours Configuration */}
              <div style={{ marginTop: 14 }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
                  <div style={{ fontSize: '0.82rem', fontWeight: 600, color: 'var(--text-color)' }}>
                    Quiet Hours (Do Not Disturb)
                  </div>
                  <input
                    type="checkbox"
                    checked={notifPrefs.quietHoursEnabled}
                    onChange={(e) => setNotifPrefs({ ...notifPrefs, quietHoursEnabled: e.target.checked })}
                  />
                </div>

                {notifPrefs.quietHoursEnabled && (
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 12 }}>
                    <div className="form-group" style={{ marginBottom: 0 }}>
                      <label style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>Quiet Start</label>
                      <input
                        type="time"
                        className="form-control"
                        value={notifPrefs.quietHoursStart}
                        onChange={(e) => setNotifPrefs({ ...notifPrefs, quietHoursStart: e.target.value })}
                        style={{ padding: '4px 8px', fontSize: '0.8rem' }}
                      />
                    </div>
                    <div className="form-group" style={{ marginBottom: 0 }}>
                      <label style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>Quiet End</label>
                      <input
                        type="time"
                        className="form-control"
                        value={notifPrefs.quietHoursEnd}
                        onChange={(e) => setNotifPrefs({ ...notifPrefs, quietHoursEnd: e.target.value })}
                        style={{ padding: '4px 8px', fontSize: '0.8rem' }}
                      />
                    </div>
                  </div>
                )}
              </div>

              <div style={{ marginTop: 16 }}>
                <button
                  type="submit"
                  className="btn btn-secondary"
                  style={{ width: '100%', justifyContent: 'center', fontSize: '0.82rem' }}
                  disabled={savingPrefs}
                >
                  {savingPrefs ? 'Updating...' : 'Save Notification Preferences'}
                </button>
              </div>
            </form>
          </div>
        </div>

        {/* Right Column: Profile & Danger Zone */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
          {/* Profile Card */}
          <div className="glass-card">
            <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 18 }}>
              <div
                style={{
                  width: 42,
                  height: 42,
                  borderRadius: 12,
                  background: 'rgba(16, 185, 129, 0.12)',
                  color: 'var(--success-color)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center'
                }}
              >
                <User size={22} />
              </div>
              <div>
                <h3 style={{ fontSize: '1.15rem', fontWeight: 600 }}>Profile Information</h3>
                <p style={{ fontSize: '0.82rem', color: 'var(--text-muted)' }}>
                  Update your contact and account identity
                </p>
              </div>
            </div>

            <form onSubmit={saveProfile}>
              <div className="form-group">
                <label className="form-label">Full Name</label>
                <input
                  type="text"
                  className="form-control"
                  required
                  value={profile.name}
                  onChange={(e) => setProfile({ ...profile, name: e.target.value })}
                />
              </div>

              <div className="form-group">
                <label className="form-label">
                  Email Address <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>(Non-editable)</span>
                </label>
                <div style={{ position: 'relative' }}>
                  <input
                    type="email"
                    className="form-control"
                    disabled
                    value={profile.email}
                    readOnly
                    style={{ background: 'var(--bg-main)', cursor: 'not-allowed', paddingRight: 36 }}
                  />
                  <div style={{ position: 'absolute', right: 12, top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }}>
                    <Lock size={16} />
                  </div>
                </div>
              </div>

              <div className="form-group">
                <label className="form-label">Mobile Number</label>
                <input
                  type="tel"
                  className="form-control"
                  placeholder="e.g. 9876543210"
                  value={profile.mobileNumber}
                  onChange={(e) => setProfile({ ...profile, mobileNumber: e.target.value })}
                />
              </div>

              <button
                type="submit"
                className="btn btn-secondary"
                style={{ width: '100%', justifyContent: 'center' }}
                disabled={savingProfile}
              >
                {savingProfile ? 'Updating...' : 'Update Profile Details'}
              </button>
            </form>
          </div>

          {/* Danger Zone */}
          <div className="glass-card" style={{ borderColor: 'rgba(239, 68, 68, 0.35)' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 14 }}>
              <div
                style={{
                  width: 36,
                  height: 36,
                  borderRadius: 10,
                  background: 'rgba(239, 68, 68, 0.12)',
                  color: 'var(--danger-color)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center'
                }}
              >
                <AlertTriangle size={18} />
              </div>
              <h3 style={{ fontSize: '1.05rem', fontWeight: 600, margin: 0, color: 'var(--danger-color)' }}>
                Danger Zone
              </h3>
            </div>
            <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)', lineHeight: 1.5, marginBottom: 16 }}>
              Permanently delete your account along with all stored expenses, salary logs, savings goals, and receipts. This operation is irrevocable.
            </p>
            <button
              type="button"
              className="btn btn-danger"
              style={{ width: '100%', justifyContent: 'center', gap: 8 }}
              onClick={() => setShowDeleteModal(true)}
            >
              <Trash2 size={16} />
              <span>Delete My Account</span>
            </button>
          </div>
        </div>
      </div>

      {/* Delete Account Confirmation Modal */}
      <Modal
        isOpen={showDeleteModal}
        onClose={() => setShowDeleteModal(false)}
        title="Confirm Account Deletion"
      >
        <div style={{ textAlign: 'center', padding: '10px 0' }}>
          <div
            style={{
              width: 56,
              height: 56,
              borderRadius: '50%',
              background: 'rgba(239, 68, 68, 0.12)',
              color: 'var(--danger-color)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              margin: '0 auto 16px auto'
            }}
          >
            <AlertTriangle size={30} />
          </div>
          <h4 style={{ fontSize: '1.15rem', fontWeight: 700, marginBottom: 8, color: 'var(--danger-color)' }}>
            Permanently Delete Your Account?
          </h4>
          <p style={{ color: 'var(--text-muted)', fontSize: '0.88rem', lineHeight: 1.5, marginBottom: 24 }}>
            This will permanently erase your user credentials and all historical data (expenses, bills, income records, and savings milestones). This action cannot be reversed.
          </p>
          <div style={{ display: 'flex', gap: 12 }}>
            <button
              type="button"
              className="btn btn-secondary"
              style={{ flex: 1 }}
              onClick={() => setShowDeleteModal(false)}
              disabled={deletingAccount}
            >
              Cancel
            </button>
            <button
              type="button"
              className="btn btn-danger"
              style={{ flex: 1.5 }}
              onClick={deleteAccount}
              disabled={deletingAccount}
            >
              {deletingAccount ? 'Deleting...' : 'Yes, Permanently Delete'}
            </button>
          </div>
        </div>
      </Modal>
    </Layout>
  );
}
