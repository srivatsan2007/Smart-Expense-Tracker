import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import firebase from 'firebase/compat/app';

export const getAuthHeaders = () => ({
  'Content-Type': 'application/json',
  Authorization: `Bearer ${localStorage.getItem('token') || ''}`,
});

export function logoutUser(navigate) {
  firebase.auth().signOut().then(() => {
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    if (navigate) navigate('/login');
    else window.location.href = '/login';
  }).catch((error) => console.error('Sign out error', error));
}

// React version of checkAuth(): redirect to login if signed out, keep the token fresh.
export function useRequireAuth() {
  const navigate = useNavigate();
  useEffect(() => {
    return firebase.auth().onAuthStateChanged((user) => {
      if (!user) navigate('/login');
      else user.getIdToken().then((t) => localStorage.setItem('token', t));
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
    const res = await fetch(`${AUTH_API}/get-email`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ loginId }),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.message || 'Mobile number not found');
    emails = data.emails || [data.email];
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

  localStorage.setItem('token', await credential.user.getIdToken());
  const res = await fetch(`${AUTH_API}/profile`, await authConfig());
  let profile = null;
  if (res.ok) {
    profile = await res.json();
    localStorage.setItem('user', JSON.stringify(profile));
  }
  return profile;
}

export async function registerUser(name, email, mobileNumber, password, role) {
  if (role === 'admin' && !email.includes('@smarttracker.com')) {
    alert('Notice: Only @smarttracker.com emails can be Admins. You will be registered as a standard User.');
    role = 'user';
  }
  const { user } = await firebase.auth().createUserWithEmailAndPassword(email, password);
  localStorage.setItem('token', await user.getIdToken());
  const config = await authConfig();
  const res = await fetch(`${AUTH_API}/register`, {
    method: 'POST',
    ...config,
    body: JSON.stringify({ name, email, mobileNumber, uid: user.uid, role }),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.message);
  localStorage.setItem('user', JSON.stringify(data));
  return data;
}
