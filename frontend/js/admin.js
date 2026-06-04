document.addEventListener('DOMContentLoaded', () => {
  checkAuth();
  
  // Ensure the user is an admin before allowing them to stay on the page
  const user = JSON.parse(localStorage.getItem('user'));
  if (!user || user.role !== 'admin') {
    alert('Access Denied: You must be an administrator to view this page.');
    window.location.href = 'dashboard.html';
    return;
  }

  fetchUsers();

  const searchInput = document.getElementById('user-search');
  if (searchInput) {
    searchInput.addEventListener('keyup', (e) => {
      const term = e.target.value.toLowerCase();
      const rows = document.querySelectorAll('#users-table tbody tr');
      rows.forEach(row => {
        const text = row.innerText.toLowerCase();
        row.style.display = text.includes(term) ? '' : 'none';
      });
    });
  }
});

async function fetchUsers() {
  try {
    const res = await fetch('/api/admin/users', { headers: getAuthHeaders() });
    
    if (res.status === 403 || res.status === 401) {
      alert('Access Denied');
      window.location.href = 'dashboard.html';
      return;
    }

    const users = await res.json();
    renderUsers(users);
  } catch (error) {
    console.error('Error fetching users:', error);
  }
}

function renderUsers(users) {
  const tbody = document.querySelector('#users-table tbody');
  tbody.innerHTML = '';
  
  if (users.length === 0) {
    tbody.innerHTML = '<tr><td colspan="5" style="text-align:center;">No users found.</td></tr>';
    return;
  }

  users.forEach(u => {
    const tr = document.createElement('tr');
    
    const roleBadge = u.role === 'admin' 
      ? '<span class="badge admin"><i class="fas fa-crown"></i> Admin</span>' 
      : '<span class="badge user">User</span>';

    const deleteBtn = u.role === 'admin' 
      ? `<button class="btn-delete" disabled style="opacity: 0.5; cursor: not-allowed;" title="Cannot delete another admin">Protected</button>`
      : `<button class="btn-delete" onclick="deleteUser('${u._id}', '${u.name}')"><i class="fas fa-trash-alt"></i> Delete</button>`;

    tr.innerHTML = `
      <td><strong>${u.name || 'Unknown'}</strong></td>
      <td>${u.email}</td>
      <td>${u.mobileNumber || '-'}</td>
      <td>${roleBadge}</td>
      <td>${deleteBtn}</td>
    `;
    tbody.appendChild(tr);
  });
}

async function deleteUser(userId, userName) {
  const confirmed = confirm(`WARNING: Are you absolutely sure you want to permanently delete user "${userName}"?\n\nThis will ERASE their account and ALL their expenses, salaries, and data forever!`);
  
  if (confirmed) {
    try {
      const res = await fetch(`/api/admin/users/${userId}`, {
        method: 'DELETE',
        headers: getAuthHeaders()
      });
      
      const data = await res.json();
      
      if (res.ok) {
        alert(data.message || 'User deleted successfully.');
        fetchUsers(); // Refresh table
      } else {
        alert(`Failed to delete user: ${data.message}`);
      }
    } catch (error) {
      console.error('Delete error:', error);
      alert('An error occurred while deleting the user.');
    }
  }
}
