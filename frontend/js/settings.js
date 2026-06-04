document.addEventListener('DOMContentLoaded', () => {
  // Populate the form with current user data
  const user = JSON.parse(localStorage.getItem('user'));
  if (user) {
    const nameInput = document.getElementById('profile-name');
    const emailInput = document.getElementById('profile-email');
    const mobileInput = document.getElementById('profile-mobile');
    
    if (nameInput) nameInput.value = user.name || '';
    if (emailInput) emailInput.value = user.email || '';
    if (mobileInput) mobileInput.value = user.mobileNumber || '';
  }

  // Handle Profile Update
  const profileForm = document.getElementById('profile-form');
  if (profileForm) {
    profileForm.addEventListener('submit', async (e) => {
      e.preventDefault();
      
      const name = document.getElementById('profile-name').value;
      const mobileNumber = document.getElementById('profile-mobile').value;

      try {
        const res = await fetch('/api/auth/profile', {
          method: 'PUT',
          headers: getAuthHeaders(),
          body: JSON.stringify({ name, mobileNumber })
        });
        
        const data = await res.json();
        
        if (res.ok) {
          // Update local storage
          localStorage.setItem('user', JSON.stringify(data));
          alert('Profile updated successfully!');
        } else {
          alert(`Failed to update profile: ${data.message}`);
        }
      } catch (error) {
        console.error('Profile Update Error:', error);
        alert('An error occurred while updating your profile.');
      }
    });
  }

  // Handle Account Deletion
  const deleteBtn = document.getElementById('delete-account-btn');
  if (deleteBtn) {
    deleteBtn.addEventListener('click', async () => {
      const confirmed = confirm("DANGER ZONE!\n\nAre you absolutely sure you want to delete your account?\nThis will permanently erase your login credentials and ALL of your expenses, salaries, and savings goals from our servers.\n\nTHIS ACTION CANNOT BE UNDONE.");
      
      if (confirmed) {
        try {
          const res = await fetch('/api/auth/profile', {
            method: 'DELETE',
            headers: getAuthHeaders()
          });
          
          const data = await res.json();
          
          if (res.ok) {
            alert(data.message || 'Your account has been deleted.');
            if (typeof logoutUser === 'function') {
              logoutUser(); // Clears local storage and redirects to login
            }
          } else {
            alert(`Failed to delete account: ${data.message}`);
          }
        } catch (error) {
          console.error('Account Deletion Error:', error);
          alert('An error occurred while attempting to delete your account.');
        }
      }
    });
  }
});
