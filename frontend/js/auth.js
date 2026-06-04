const API_URL = '/api/auth';

// Common setup for fetch requests
const getConfig = async () => {
  let token = '';
  const user = firebase.auth().currentUser;
  if (user) {
    token = await user.getIdToken();
  } else {
    token = localStorage.getItem('token') || '';
  }
  return {
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`
    },
  };
};

async function loginUser(loginId, password) {
  try {
    let emails = [loginId];
    
    // If it's a mobile number (doesn't contain @), fetch the emails first
    if (!loginId.includes('@')) {
      const res = await fetch(`${API_URL}/get-email`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ loginId })
      });
      
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.message || 'Mobile number not found');
      }
      emails = data.emails || [data.email]; // Handle both old and new backend response
    }

    let userCredential = null;
    let lastError = null;

    // Try logging in with each email associated with this mobile number
    for (const email of emails) {
      try {
        userCredential = await firebase.auth().signInWithEmailAndPassword(email, password);
        break; // Successfully logged in, exit the loop
      } catch (err) {
        lastError = err;
      }
    }

    if (!userCredential) {
      throw lastError || new Error('Invalid credentials');
    }

    const token = await userCredential.user.getIdToken();
    localStorage.setItem('token', token);
    
    const config = await getConfig();
    const res = await fetch(`${API_URL}/profile`, config);
    if(res.ok) {
       const profile = await res.json();
       localStorage.setItem('user', JSON.stringify(profile));
       if (profile.role === 'admin') {
         window.location.href = 'admin.html';
         return;
       }
    }
    
    window.location.href = 'dashboard.html';
  } catch (error) {
    showError(error.message || 'Login failed, please try again.');
  }
}

async function registerUser(name, email, mobileNumber, password, role) {
  try {
    if (role === 'admin' && !email.includes('@smarttracker.com')) {
      alert('Notice: Only @smarttracker.com emails can be Admins. You will be registered as a standard User.');
      role = 'user';
    }

    // 1. Create user in Firebase Auth
    const userCredential = await firebase.auth().createUserWithEmailAndPassword(email, password);
    const user = userCredential.user;
    
    // 2. Sync profile to backend
    const token = await user.getIdToken();
    localStorage.setItem('token', token);
    
    const config = await getConfig();
    const res = await fetch(`${API_URL}/register`, {
      method: 'POST',
      ...config,
      body: JSON.stringify({ name, email, mobileNumber, uid: user.uid, role }),
    });
    
    const data = await res.json();
    
    if (res.ok) {
      localStorage.setItem('user', JSON.stringify(data));
      if (data.role === 'admin') {
        window.location.href = 'admin.html';
      } else {
        window.location.href = 'dashboard.html';
      }
    } else {
      showError(data.message);
    }
  } catch (error) {
    showError(error.message || 'Registration failed, please try again.');
  }
}

function logoutUser() {
  firebase.auth().signOut().then(() => {
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    window.location.href = 'login.html';
  }).catch((error) => {
    console.error("Sign out error", error);
  });
}

function showError(msg) {
  const errorEl = document.getElementById('error-msg');
  if (errorEl) {
    errorEl.textContent = msg;
    errorEl.style.display = 'block';
  } else {
    alert(msg);
  }
}

// Check Auth state on protected pages
function checkAuth() {
  // Firebase Auth takes a moment to initialize on page load.
  // We use onAuthStateChanged for accurate checking.
  firebase.auth().onAuthStateChanged((user) => {
    if (!user) {
      // Not logged in
      window.location.href = 'login.html';
    } else {
      // Refresh token if needed
      user.getIdToken().then(t => localStorage.setItem('token', t));
    }
  });
}

// Global Auth Header setup for protected API calls
function getAuthHeaders() {
  const token = localStorage.getItem('token') || '';
  return {
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${token}`
  };
}
