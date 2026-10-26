/**
 * Push Notification Utility for RupeeRise
 * Handles browser Web Push API registration, VAPID key conversion, and subscription lifecycle
 */

/**
 * Converts a base64 VAPID public key string into a Uint8Array required by PushManager
 */
export function urlBase64ToUint8Array(base64String) {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding)
    .replace(/-/g, '+')
    .replace(/_/g, '/');

  const rawData = window.atob(base64);
  const outputArray = new Uint8Array(rawData.length);

  for (let i = 0; i < rawData.length; ++i) {
    outputArray[i] = rawData.charCodeAt(i);
  }
  return outputArray;
}

/**
 * Checks whether the current browser environment supports Service Workers and PushManager
 */
export function isPushNotificationSupported() {
  return 'serviceWorker' in navigator && 'PushManager' in window && 'Notification' in window;
}

/**
 * Returns the current notification permission state: 'default' | 'granted' | 'denied'
 */
export function getNotificationPermission() {
  if (!('Notification' in window)) return 'unsupported';
  return Notification.permission;
}

/**
 * Registers the service worker if not already registered and returns the registration
 */
export async function getServiceWorkerRegistration() {
  if (!('serviceWorker' in navigator)) {
    throw new Error('Service Worker is not supported in this browser');
  }

  // Register service worker
  const registration = await navigator.serviceWorker.register('/service-worker.js', {
    scope: '/'
  });

  await navigator.serviceWorker.ready;
  return registration;
}

/**
 * Subscribes the current device to push notifications using the provided VAPID public key
 */
export async function subscribeToPushManager(vapidPublicKey) {
  if (!isPushNotificationSupported()) {
    throw new Error('Push notifications are not supported on this browser or platform');
  }

  // Request browser permission explicitly
  const permission = await Notification.requestPermission();
  if (permission !== 'granted') {
    throw new Error(
      permission === 'denied'
        ? 'Notification permission was denied. Please allow notifications in your browser settings.'
        : 'Notification permission was dismissed.'
    );
  }

  const registration = await getServiceWorkerRegistration();

  // Check if already subscribed
  let subscription = await registration.pushManager.getSubscription();

  if (!subscription) {
    const convertedVapidKey = urlBase64ToUint8Array(vapidPublicKey);
    subscription = await registration.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: convertedVapidKey
    });
  }

  return subscription;
}

/**
 * Retrieves existing push subscription if present
 */
export async function getExistingPushSubscription() {
  if (!isPushNotificationSupported()) return null;
  try {
    const registration = await navigator.serviceWorker.ready;
    return await registration.pushManager.getSubscription();
  } catch {
    return null;
  }
}
