document.addEventListener('DOMContentLoaded', () => {
  // Mobile menu toggle
  const mobileMenuBtn = document.getElementById('mobile-menu-btn');
  const sidebar = document.getElementById('sidebar');
  
  if (mobileMenuBtn && sidebar) {
    // Create overlay dynamically
    const overlay = document.createElement('div');
    overlay.className = 'sidebar-overlay';
    document.body.appendChild(overlay);

    const toggleMenu = () => {
      sidebar.classList.toggle('active');
      overlay.classList.toggle('active');
    };

    mobileMenuBtn.addEventListener('click', toggleMenu);
    overlay.addEventListener('click', toggleMenu); // click outside to close
  }

  // Theme switch
  const themeSwitchBtn = document.getElementById('theme-switch');
  const currentTheme = localStorage.getItem('theme') || 'light';
  
  if (currentTheme === 'dark') {
    document.body.setAttribute('data-theme', 'dark');
  }

  if (themeSwitchBtn) {
    themeSwitchBtn.addEventListener('click', () => {
      const isDark = document.body.getAttribute('data-theme') === 'dark';
      if (isDark) {
        document.body.removeAttribute('data-theme');
        localStorage.setItem('theme', 'light');
      } else {
        document.body.setAttribute('data-theme', 'dark');
        localStorage.setItem('theme', 'dark');
      }
    });
  }

  // Admin Panel Visibility
  const adminNavItem = document.getElementById('admin-nav-item');
  const user = JSON.parse(localStorage.getItem('user'));
  if (adminNavItem && user && user.role === 'admin') {
    adminNavItem.style.display = 'flex';
  }

  // Logout handler
  const logoutBtn = document.getElementById('logout-btn');
  if (logoutBtn) {
    logoutBtn.addEventListener('click', (e) => {
      e.preventDefault();
      if(typeof logoutUser === 'function') {
        logoutUser();
      }
    });
  }
});
