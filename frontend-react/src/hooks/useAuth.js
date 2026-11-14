import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import firebase from 'firebase/compat/app';

export const getAuthHeaders = () => ({
  'Content-Type': 'application/json',
  Authorization: `Bearer ${localStorage.getItem('token') || ''}`,
});

export const getFreshToken = async () => {
  try {
    const user = firebase.auth().currentUser;
    if (user) {
      const token = await user.getIdToken();
      if (token) {
        localStorage.setItem('token', token);
        return token;
      }
    }
  } catch (err) {
    console.warn('Could not refresh auth token:', err);
  }
  return localStorage.getItem('token') || '';
};

export const getFreshAuthHeaders = async () => {
  const token = await getFreshToken();
  return {
    'Content-Type': 'application/json',
    Authorization: `Bearer ${token}`,
  };
};

export function logoutUser(navigate) {
  import('../utils/localReminders.js')
    .then((m) => m.cancelAllReminders())
    .catch(() => {});
  firebase.auth().signOut().then(() => {
    localStorage.removeItem('token');
    localStorage.removeItem('rr_local_reminders');
    localStorage.removeItem('rr_notif_prefs');
    localStorage.removeItem('user');
    if (navigate) navigate('/login');
    else window.location.href = '/login';
  }).catch((error) => console.error('Sign out error', error));
}

// React version of checkAuth(): redirect to login if signed out, keep the token fresh.
export function useRequireAuth() {
  const navigate = useNavigate();
  useEffect(() => {
    return firebase.auth().onAuthStateChanged(async (user) => {
      if (!user) {
        navigate('/login');
      } else {
        try {
          const t = await user.getIdToken();
          localStorage.setItem('token', t);
        } catch (err) {
          console.error('Failed to update ID token:', err);
        }
      }
    });
  }, [navigate]);
}

// ---- Login / registration (React version of loginUser / registerUser) ----
const AUTH_API = '/api/auth';

const authConfig = async () => {
  const user = firebase.auth().currentUser;
  const token = user ? await user.getIdToken() : localStorage.getItem('token') || '';
  return { headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` } };
};

// Returns user profile on success
export async function loginUser(loginId, password) {
  let emails = [loginId];
  if (!loginId.includes('@')) {
    // 1. First check if we have a saved remembered account with this mobile number
    const savedAccountStr = localStorage.getItem('remembered_account');
    let foundEmail = null;
    if (savedAccountStr) {
      try {
        const saved = JSON.parse(savedAccountStr);
        if (saved.loginId === loginId && saved.email) {
          foundEmail = saved.email;
        }
      } catch (e) {}
    }

    if (foundEmail) {
      emails = [foundEmail];
    } else {
      try {
        const res = await fetch(`${AUTH_API}/get-email`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ loginId }),
        });
        const data = await res.json();
        if (res.ok && (data.emails || data.email)) {
          emails = data.emails || [data.email];
        } else if (!res.ok) {
          throw new Error(data.message || 'Mobile number not found');
        }
      } catch (err) {
        if (!foundEmail) {
          throw err;
        }
      }
    }
  }

  let credential = null, lastError = null;
  for (const email of emails) {
    try {
      credential = await firebase.auth().signInWithEmailAndPassword(email, password);
      break;
    } catch (err) {
      lastError = err;
    }
  }
  if (!credential) throw lastError || new Error('Invalid credentials');

  const token = await credential.user.getIdToken();
  localStorage.setItem('token', token);

  let profile = null;
  // Attempt to fetch profile from backend API; if backend is offline, gracefully fallback to user details
  try {
    const config = await authConfig();
    const res = await fetch(`${AUTH_API}/profile`, config);
    if (res.ok) {
      profile = await res.json();
    }
  } catch (backendErr) {
    console.warn('Backend server unreachable during login, using direct Firebase profile:', backendErr);
  }

  if (!profile) {
    profile = {
      _id: credential.user.uid,
      name: credential.user.displayName || credential.user.email?.split('@')[0] || 'User',
      email: credential.user.email,
      role: 'user'
    };
  }

  localStorage.setItem('user', JSON.stringify(profile));
  localStorage.setItem('remembered_account', JSON.stringify({
    email: profile.email || credential.user.email,
    name: profile.name || credential.user.displayName || 'User',
    loginId: loginId,
    lastActive: new Date().toISOString()
  }));

  return profile;
}

export async function registerUser(name, email, mobileNumber, password) {
  const { user } = await firebase.auth().createUserWithEmailAndPassword(email, password);
  const token = await user.getIdToken();
  localStorage.setItem('token', token);

  let data = null;
  try {
    const config = await authConfig();
    const res = await fetch(`${AUTH_API}/register`, {
      method: 'POST',
      ...config,
      body: JSON.stringify({ name, email, mobileNumber, uid: user.uid, role: 'user' }),
    });
    if (res.ok) {
      data = await res.json();
    }
  } catch (backendErr) {
    console.warn('Backend register sync unreachable, using client profile:', backendErr);
  }

  if (!data) {
    data = { _id: user.uid, name, email, mobileNumber, role: 'user' };
  }

  localStorage.setItem('user', JSON.stringify(data));
  localStorage.setItem('remembered_account', JSON.stringify({
    email,
    name,
    loginId: email,
    lastActive: new Date().toISOString()
  }));
  return data;
}

// Auto-detects previously authenticated session or active Firebase user and logs in automatically
export async function autoDetectAndLogin() {
  return new Promise((resolve) => {
    try {
      const existingToken = localStorage.getItem('token');
      const existingUserStr = localStorage.getItem('user');

      const unsubscribe = firebase.auth().onAuthStateChanged(async (user) => {
        if (unsubscribe) unsubscribe();

        if (user) {
          try {
            const token = await user.getIdToken();
            localStorage.setItem('token', token);
            let profile = null;
            try {
              const res = await fetch(`${AUTH_API}/profile`, {
                headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` }
              });
              if (res.ok) {
                profile = await res.json();
              }
            } catch (fetchErr) {
              console.warn('Backend profile fetch failed, using cached session:', fetchErr);
            }

            if (!profile && existingUserStr) {
              try { profile = JSON.parse(existingUserStr); } catch (e) {}
            }

            if (!profile) {
              profile = {
                _id: user.uid,
                name: user.displayName || user.email?.split('@')[0] || 'User',
                email: user.email,
                role: 'user'
              };
            }

            localStorage.setItem('user', JSON.stringify(profile));
            localStorage.setItem('remembered_account', JSON.stringify({
              email: profile.email || user.email,
              name: profile.name || user.displayName || 'User',
              loginId: profile.email || user.email,
              lastActive: new Date().toISOString()
            }));
            resolve({ success: true, profile, user, autoDetected: true });
            return;
          } catch (err) {
            console.warn('Auto-login session restoration error:', err);
          }
        }

        // 2. Fallback check for cached localStorage session
        if (existingToken && existingUserStr) {
          try {
            const parsed = JSON.parse(existingUserStr);
            resolve({ success: true, profile: parsed, token: existingToken, autoDetected: true });
            return;
          } catch {
            // Invalid cached JSON
          }
        }

        resolve({ success: false });
      });
    } catch (e) {
      console.warn('Auto detect failed:', e);
      resolve({ success: false });
    }
  });
}

// Google Sign-In with 1-click automatic account detection
export async function loginWithGoogle() {
  const provider = new firebase.auth.GoogleAuthProvider();
  provider.setCustomParameters({ prompt: 'select_account' });
  const credential = await firebase.auth().signInWithPopup(provider);
  const user = credential.user;
  const token = await user.getIdToken();
  localStorage.setItem('token', token);

  const config = await authConfig();
  let profile = null;
  const res = await fetch(`${AUTH_API}/profile`, config);

  if (res.ok) {
    profile = await res.json();
  } else {
    // Sync newly authenticated Google user profile to backend
    const regRes = await fetch(`${AUTH_API}/register`, {
      method: 'POST',
      ...config,
      body: JSON.stringify({
        name: user.displayName || user.email.split('@')[0],
        email: user.email,
        mobileNumber: user.phoneNumber || '',
        uid: user.uid,
        role: 'user'
      })
    });
    if (regRes.ok) {
      profile = await regRes.json();
    }
  }

  const finalProfile = profile || { _id: user.uid, name: user.displayName || 'User', email: user.email };
  localStorage.setItem('user', JSON.stringify(finalProfile));
  localStorage.setItem('remembered_account', JSON.stringify({
    email: user.email,
    name: user.displayName || user.email.split('@')[0],
    loginId: user.email,
    lastActive: new Date().toISOString()
  }));

  return finalProfile;
}

