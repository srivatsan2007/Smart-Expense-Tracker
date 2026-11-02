// Centralized backend configuration and fetch interception for RupeeRise
// Ensures Android APK / native Capacitor webviews connect to the actual backend server instead of localhost assets.

export function getBackendBaseUrl() {
  const saved = localStorage.getItem('rupeerise_backend_url');
  if (saved && saved.trim()) {
    return saved.trim().replace(/\/+$/, '');
  }

  if (import.meta.env.VITE_API_URL) {
    return import.meta.env.VITE_API_URL.replace(/\/+$/, '');
  }

  // Check if running inside Capacitor Android/iOS native webview
  const isCapacitor =
    (typeof window !== 'undefined' && window.Capacitor?.isNativePlatform?.()) ||
    window.location.protocol === 'capacitor:' ||
    (window.location.hostname === 'localhost' && !window.location.port);

  if (isCapacitor) {
    // Default development IP of the host computer
    return 'http://10.18.146.59:5000';
  }

  return '';
}

export function setBackendBaseUrl(url) {
  if (!url || !url.trim()) {
    localStorage.removeItem('rupeerise_backend_url');
  } else {
    localStorage.setItem('rupeerise_backend_url', url.trim().replace(/\/+$/, ''));
  }
}

// Global fetch override to automatically redirect all '/api/*' and '/backend/*' requests
if (typeof window !== 'undefined' && !window.__rupeeriseFetchInitialized) {
  window.__rupeeriseFetchInitialized = true;
  const originalFetch = window.fetch;

  window.fetch = async function (input, init) {
    let url = typeof input === 'string' ? input : (input && input.url ? input.url : '');

    if (typeof input === 'string' && (input.startsWith('/api/') || input.startsWith('/backend/'))) {
      const base = getBackendBaseUrl();
      if (base) {
        input = `${base}${input}`;
        url = input;
      }
    }

    try {
      const response = await originalFetch.call(this, input, init);
      
      // Wrap .json() to provide user-friendly error messages when HTML fallback is returned
      const originalJson = response.json;
      response.json = async function () {
        const text = await response.text();
        try {
          return JSON.parse(text);
        } catch (parseErr) {
          if (text.trim().startsWith('<') || text.includes('<!DOCTYPE')) {
            const base = getBackendBaseUrl() || window.location.origin;
            throw new Error(
              `Cannot connect to RupeeRise Backend Server (${base}). The server returned a web page instead of API data. Please verify your Server Connection URL in Settings.`
            );
          }
          throw parseErr;
        }
      };

      return response;
    } catch (networkErr) {
      if (networkErr.name === 'TypeError' && networkErr.message?.toLowerCase().includes('failed to fetch')) {
        const base = getBackendBaseUrl() || window.location.origin;
        throw new Error(
          `Network error: Could not reach backend server at ${base}. Ensure your phone is connected to the same Wi-Fi as your computer, or enter a cloud backend URL.`
        );
      }
      throw networkErr;
    }
  };
}
