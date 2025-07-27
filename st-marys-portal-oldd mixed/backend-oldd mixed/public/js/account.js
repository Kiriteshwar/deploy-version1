// account.js

document.addEventListener('DOMContentLoaded', () => {
  // Tab switching
  const tabs = document.querySelectorAll('.settings-tab');
  const sections = document.querySelectorAll('.settings-section');
  tabs.forEach(tab => {
    tab.addEventListener('click', () => {
      tabs.forEach(t => t.classList.remove('active'));
      sections.forEach(s => s.classList.remove('active'));
      tab.classList.add('active');
      document.getElementById(`${tab.dataset.tab}-section`).classList.add('active');
    });
  });

  // Dark mode toggle
  const darkModeSwitch = document.getElementById('dark-mode-switch');
  if (localStorage.getItem('dark_mode') === 'true') {
    document.body.classList.add('dark-mode');
    darkModeSwitch.checked = true;
  }
  darkModeSwitch.addEventListener('change', () => {
    if (darkModeSwitch.checked) {
      document.body.classList.add('dark-mode');
      localStorage.setItem('dark_mode', 'true');
    } else {
      document.body.classList.remove('dark-mode');
      localStorage.setItem('dark_mode', 'false');
    }
  });

  // Fetch and populate user info
  const token = localStorage.getItem('auth_token');
  if (!token) {
    window.location.href = 'login.html';
    return;
  }
  fetch('/api/auth/profile', {
    method: 'GET',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`
    }
  })
    .then(res => res.json())
    .then(data => {
      document.getElementById('settings-name').textContent = data.name || 'User';
      document.getElementById('settings-email').textContent = data.email || '';
      document.getElementById('settings-role').textContent = `Role: ${data.role || ''}`;
      document.getElementById('profile-name').value = data.name || '';
      document.getElementById('profile-email').value = data.email || '';
      document.getElementById('profile-phone').value = data.phone || '';
      // Avatar
      let avatarUrl = data.profilePicUrl || `https://ui-avatars.com/api/?name=${encodeURIComponent(data.name || 'User')}&background=E0E7EF&color=1976d2&size=128`;
      document.getElementById('settings-avatar').src = avatarUrl;

      // Role-based field logic
      const nameInput = document.getElementById('profile-name');
      const emailInput = document.getElementById('profile-email');
      const phoneInput = document.getElementById('profile-phone');
      const saveBtn = document.querySelector('#profile-form button[type="submit"]');
      if (data.role === 'student') {
        nameInput.disabled = true;
        emailInput.disabled = true;
        phoneInput.disabled = true;
        phoneInput.parentElement.style.display = '';
        saveBtn.style.display = '';
      } else if (data.role === 'teacher') {
        nameInput.disabled = true;
        emailInput.disabled = true;
        phoneInput.disabled = false;
        phoneInput.parentElement.style.display = '';
        saveBtn.style.display = '';
      } else if (data.role === 'admin') {
        nameInput.disabled = false;
        emailInput.disabled = false;
        phoneInput.disabled = false;
        phoneInput.parentElement.style.display = '';
        saveBtn.style.display = '';
      }

      // Hide dark mode toggle for teachers and students
      const darkModeToggle = document.querySelector('.dark-mode-toggle');
      if (data.role !== 'admin' && darkModeToggle) {
        darkModeToggle.style.display = 'none';
      } else if (darkModeToggle) {
        darkModeToggle.style.display = '';
      }
    })
    .catch(() => {
      alert('Failed to load profile info.');
    });

  // Profile form submit
  document.getElementById('profile-form').onsubmit = async function(e) {
    e.preventDefault();
    const name = document.getElementById('profile-name').value.trim();
    const email = document.getElementById('profile-email').value.trim();
    const phone = document.getElementById('profile-phone').value.trim();
    const token = localStorage.getItem('auth_token');
    try {
      const res = await fetch('/api/auth/profile', {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ name, email, phone })
      });
      const data = await res.json();
      if (data.success) {
        alert('Profile updated successfully!');
        document.getElementById('settings-name').textContent = name;
        document.getElementById('settings-email').textContent = email;
      } else {
        alert(data.message || 'Failed to update profile.');
      }
    } catch {
      alert('Failed to update profile.');
    }
  };

  // Password form submit
  document.getElementById('password-form').onsubmit = async function(e) {
    e.preventDefault();
    const currentPassword = document.getElementById('current-password').value;
    const newPassword = document.getElementById('new-password').value;
    const confirmPassword = document.getElementById('confirm-password').value;
    if (newPassword !== confirmPassword) {
      alert('New passwords do not match.');
      return;
    }
    const token = localStorage.getItem('auth_token');
    try {
      const res = await fetch('/api/auth/change-password', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ currentPassword, newPassword })
      });
      const data = await res.json();
      if (data.success) {
        alert('Password changed successfully!');
        document.getElementById('password-form').reset();
      } else {
        alert(data.message || 'Failed to change password.');
      }
    } catch {
      alert('Failed to change password.');
    }
  };

  // Avatar upload
  const uploadBtn = document.getElementById('upload-avatar-btn');
  const avatarInput = document.getElementById('avatar-input');
  uploadBtn.addEventListener('click', () => avatarInput.click());
  avatarInput.addEventListener('change', async function() {
    const file = avatarInput.files[0];
    if (!file) return;
    const formData = new FormData();
    formData.append('avatar', file);
    const token = localStorage.getItem('auth_token');
    try {
      const res = await fetch('/api/auth/upload-avatar', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`
        },
        body: formData
      });
      const data = await res.json();
      if (data.success && data.url) {
        document.getElementById('settings-avatar').src = data.url;
        alert('Profile picture updated!');
      } else {
        alert(data.message || 'Failed to upload avatar.');
      }
    } catch {
      alert('Failed to upload avatar.');
    }
  });

  // Logout button for settings page
  const logoutBtn = document.getElementById('logout-btn-settings');
  if (logoutBtn) {
    logoutBtn.addEventListener('click', () => {
      localStorage.removeItem('auth_token');
      localStorage.removeItem('user_data');
      localStorage.removeItem('user_name');
      localStorage.removeItem('user_role');
      localStorage.removeItem('user_id');
      window.location.href = 'login.html';
    });
  }
});

// Optional: Add dark mode CSS class
if (localStorage.getItem('dark_mode') === 'true') {
  document.body.classList.add('dark-mode');
} 