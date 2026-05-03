const API_BASE = '/api';

// ─── API Helpers ──────────────────────────────────────────────────────────────

async function fetchFolders() {
  const res = await fetch(`${API_BASE}/folders`);
  if (!res.ok) throw new Error('Failed to fetch folders');
  return res.json();
}

async function createFolder(name) {
  const res = await fetch(`${API_BASE}/folders`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ name })
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || 'Failed to create folder');
  return data;
}

async function deleteFile(folder, filename) {
  const email = localStorage.getItem('gantec_user_email') || '';
  const res = await fetch(`${API_BASE}/file?folder=${encodeURIComponent(folder)}&file=${encodeURIComponent(filename)}&email=${encodeURIComponent(email)}`, {
    method: 'DELETE'
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || 'Failed to delete file');
  return data;
}

function getFileUrl(folder, filename) {
  return `${API_BASE}/file?folder=${encodeURIComponent(folder)}&file=${encodeURIComponent(filename)}`;
}

// ─── Toast Notifications ──────────────────────────────────────────────────────

function showToast(message, type = 'info', duration = 3500) {
  let container = document.getElementById('toast-container');
  if (!container) {
    container = document.createElement('div');
    container.id = 'toast-container';
    document.body.appendChild(container);
  }

  const icons = { success: '✅', error: '❌', info: 'ℹ️', warning: '⚠️' };
  const toast = document.createElement('div');
  toast.className = `toast ${type}`;
  toast.innerHTML = `
    <span class="toast-icon">${icons[type] || icons.info}</span>
    <span>${message}</span>
  `;

  container.appendChild(toast);

  setTimeout(() => {
    toast.style.animation = 'fadeOut 0.3s ease forwards';
    setTimeout(() => toast.remove(), 300);
  }, duration);
}

window.showCenterPopup = function(message, type = 'success') {
  console.log('Center popup triggered:', message, type);
  const overlay = document.createElement('div');
  overlay.className = 'center-popup-overlay';
  
  const icons = {
    success: '<div class="popup-icon-circle success">✓</div>',
    video: '<div class="popup-icon-circle video">📺</div>'
  };

  overlay.innerHTML = `
    <div class="center-popup-card">
      ${icons[type] || icons.success}
      <h2 class="popup-title">${message}</h2>
      <button class="popup-close-btn">Done</button>
    </div>
  `;

  document.body.appendChild(overlay);
  
  const close = () => {
    overlay.classList.add('closing');
    setTimeout(() => overlay.remove(), 300);
  };

  overlay.querySelector('.popup-close-btn').addEventListener('click', close);
  overlay.addEventListener('click', (e) => {
    if (e.target === overlay) close();
  });
}

// ─── File Size Formatter ──────────────────────────────────────────────────────

function formatSize(bytes) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

// ─── Date Formatter ───────────────────────────────────────────────────────────

function formatDate(dateStr) {
  const d = new Date(dateStr);
  return d.toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' });
}

// ─── HTML Escape ──────────────────────────────────────────────────────────────

function escapeHTML(str) {
  const div = document.createElement('div');
  div.appendChild(document.createTextNode(str));
  return div.innerHTML;
}

function initNavDropdown() {
  document.querySelectorAll('.nav-dropdown').forEach(dropdown => {
    const trigger = dropdown.querySelector('.nav-link');
    const menu = dropdown.querySelector('.dropdown-menu');

    if (!trigger || !menu) return;

    trigger.addEventListener('click', (event) => {
      event.preventDefault();
      event.stopPropagation();
      const isOpen = dropdown.classList.contains('open');
      document.querySelectorAll('.nav-dropdown.open').forEach(el => {
        el.classList.remove('open');
        const triggerEl = el.querySelector('.nav-link');
        if (triggerEl) triggerEl.setAttribute('aria-expanded', 'false');
      });
      if (!isOpen) {
        dropdown.classList.add('open');
        trigger.setAttribute('aria-expanded', 'true');
      }
    });
  });

  document.addEventListener('click', (event) => {
    if (!event.target.closest('.nav-dropdown')) {
      document.querySelectorAll('.nav-dropdown.open').forEach(el => {
        el.classList.remove('open');
        const triggerEl = el.querySelector('.nav-link');
        if (triggerEl) triggerEl.setAttribute('aria-expanded', 'false');
      });
    }
  });
}

function initUserProfile() {
  const userSection = document.getElementById('user-profile-section');

  // We inject the Supabase SDK dynamically so it's available on all 15+ pages
  // without having to edit every single HTML file.
  if (!window.supabaseClient) {
    const script = document.createElement('script');
    script.src = "https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2";
    script.onload = () => {
      const SUPABASE_URL = 'https://pbicghsmejqlnksdtjzo.supabase.co';
      const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InBiaWNnaHNtZWpxbG5rc2R0anpvIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzY2NjM2MjEsImV4cCI6MjA5MjIzOTYyMX0.sI38ou9HZHK7vjLF8dTaEtvBvmMNx6u8LxBvOKFlwew';
      window.supabaseClient = supabase.createClient(SUPABASE_URL, SUPABASE_KEY);
      
      // Native Supabase Session Management
      window.supabaseClient.auth.onAuthStateChange((event, session) => {
        console.log('Supabase Auth Event:', event);
        if (session && session.user) {
          const user = session.user;
          const fullName = user.user_metadata?.fullname || user.email;
          localStorage.setItem('gantec_auth', 'true');
          localStorage.setItem('gantec_user_name', fullName);
          localStorage.setItem('gantec_user_email', user.email);
          if (userSection) renderUserProfileUI(userSection, fullName, user.email);
        } else {
          localStorage.removeItem('gantec_auth');
          if (userSection) renderGuestUI(userSection);
        }
      });

      // --- REAL-TIME SYNC ---
      // Listen for any changes in the database and refresh the UI automatically
      const syncChannel = window.supabaseClient.channel('db-sync');
      
      // Watch all relevant tables
      syncChannel
        .on('postgres_changes', { event: '*', schema: 'public', table: 'user_documents' }, (payload) => {
          console.log('Real-time: user_documents change', payload);
          if (typeof window.loadFolders === 'function') window.loadFolders();
        })
        .on('postgres_changes', { event: '*', schema: 'public', table: 'resource_uploads' }, (payload) => {
          console.log('Real-time: resource_uploads change', payload);
          if (typeof window.loadFolders === 'function') window.loadFolders();
        })
        .on('postgres_changes', { event: '*', schema: 'public', table: 'resource_links' }, (payload) => {
          console.log('Real-time: resource_links change', payload);
          if (typeof window.loadFolders === 'function') window.loadFolders();
        })
        .subscribe();
    };
    document.head.appendChild(script);
  }
}

function renderUserProfileUI(userSection, userName, userEmail) {
  const customProfile = localStorage.getItem('gantec_user_profile');
  const defaultProfile = 'images/default-avatar.png';
  const profileImgSrc = customProfile || defaultProfile;
  
  userSection.innerHTML = `
      <div class="user-profile-wrap nav-dropdown" id="profile-dropdown-wrap" style="display: flex; align-items: center; gap: 12px; margin-left: 12px; padding-left: 12px; border-left: 1px solid var(--border); cursor: pointer; position: relative;">
        <img src="${profileImgSrc}" alt="Profile" id="profile-trigger-img" style="width: 36px; height: 36px; border-radius: 50%; object-fit: cover; border: 2px solid var(--primary-glow);">
        <div class="user-info-text" style="display: flex; flex-direction: column; line-height: 1.2;">
          <span class="user-name" style="font-size: 0.85rem; font-weight: 700; color: var(--text-primary);">${userName}</span>
          <span class="user-email" style="font-size: 0.7rem; color: var(--text-muted); opacity: 0.8;">${userEmail}</span>
        </div>
        
        <div class="dropdown-menu profile-menu right" style="min-width: 135px; width: max-content;">
          <a href="#" class="dropdown-item" id="view-profile-btn">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" class="icon-xs"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>
            View Profile
          </a>
          <a href="#" class="dropdown-item" id="edit-profile-btn">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" class="icon-xs"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
            Edit Profile
          </a>
          <a href="#" class="dropdown-item" id="logout-profile-btn" style="color: var(--danger); border-top: 1px solid var(--border); margin-top: 8px; padding-top: 12px;">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" class="icon-xs"><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><polyline points="16 17 21 12 16 7"/><line x1="21" y1="12" x2="9" y2="12"/></svg>
            Logout
          </a>
        </div>
      </div>
    `;

    const wrap = document.getElementById('profile-dropdown-wrap');
    const editBtn = document.getElementById('edit-profile-btn');
    const viewBtn = document.getElementById('view-profile-btn');
    const logoutBtn = document.getElementById('logout-profile-btn');

    wrap.addEventListener('click', (e) => {
      e.stopPropagation();
      const isOpen = wrap.classList.contains('open');
      
      document.querySelectorAll('.nav-dropdown.open').forEach(el => {
        if (el !== wrap) el.classList.remove('open');
      });
      
      if (!isOpen) wrap.classList.add('open');
      else wrap.classList.remove('open');
    });

    viewBtn.addEventListener('click', (e) => {
      e.preventDefault(); e.stopPropagation();
      wrap.classList.remove('open');
      showProfileModal(profileImgSrc);
    });

    editBtn.addEventListener('click', (e) => {
      e.preventDefault(); e.stopPropagation();
      wrap.classList.remove('open');
      showEditProfileModal(userName, profileImgSrc);
    });

    logoutBtn.addEventListener('click', async (e) => {
      e.preventDefault(); e.stopPropagation();
      if (window.supabaseClient) {
        await window.supabaseClient.auth.signOut();
      }
      localStorage.removeItem('gantec_auth');
      localStorage.removeItem('gantec_user_name');
      localStorage.removeItem('gantec_user_email');
      window.location.href = 'login.html';
    });
}

function renderGuestUI(userSection) {
    // Session not found - show Sign In button
    userSection.innerHTML = `
      <a href="login.html" class="btn btn-primary btn-sm" style="display:flex; align-items:center; gap:8px; padding:10px 20px; background:#1a2b4b; border-radius:30px; border:none; box-shadow:0 4px 12px rgba(0,0,0,0.15); font-weight:700; color:white; text-decoration:none;">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" class="icon-xs"><path d="M15 3h4a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2h-4"/><polyline points="10 17 15 12 10 7"/><line x1="15" y1="12" x2="3" y2="12"/></svg>
        Sign In
      </a>
    `;
}

function showEditProfileModal(currentName, currentImg) {
  // For testing, use dummy data instead of API call
  const userData = {
    fullname: currentName || 'Test User',
    email: localStorage.getItem('gantec_user_email') || 'test@example.com'
  };

  createEditProfileModal(userData, currentImg);
}

function createEditProfileModal(userData, currentImg) {
  let modal = document.getElementById('profile-edit-modal');

  if (!modal) {
    modal = document.createElement('div');
    modal.id = 'profile-edit-modal';
    modal.className = 'confirm-overlay hidden'; // Start hidden
    modal.style.cssText = 'position: fixed; inset: 0; background: rgba(0,0,0,0.5); backdrop-filter: blur(5px); z-index: 9999; display: flex; align-items: center; justify-content: center; padding: 24px;';
    document.body.appendChild(modal);
  } else {
    // Ensure modal starts hidden
    modal.classList.add('hidden');
  }

  modal.innerHTML = `
    <div class="glass-card" style="padding: 24px; max-width: 500px; width: 90%; position: relative; z-index: 1000; background: white; border: 1px solid #ddd; border-radius: 12px; box-shadow: 0 10px 25px rgba(0,0,0,0.2);">
      <h3 style="margin-bottom: 20px; font-size: 1.25rem; font-weight: 700; color: #2563eb;">Edit Profile</h3>
      
      <div style="background: #f0f9ff; border: 1px solid #0ea5e9; border-radius: 8px; padding: 12px; margin-bottom: 20px; font-size: 0.9rem; color: #0c4a6e;">
        <strong>Note:</strong> Changes to email or password require your current login password for security. Name changes can be made without a password.
      </div>
      
      <div style="display: flex; flex-direction: column; align-items: center; gap: 16px; margin-bottom: 24px;">
        <div style="position: relative;">
          <img src="${currentImg}" id="edit-preview-img" style="width: 100px; height: 100px; border-radius: 50%; object-fit: cover; border: 2px solid var(--primary);">
          <button id="change-photo-trigger" style="position: absolute; bottom: 0; right: 0; background: var(--primary); color: white; border: none; width: 32px; height: 32px; border-radius: 50%; cursor: pointer; display: flex; align-items: center; justify-content: center; box-shadow: var(--shadow);">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" style="width: 16px; height: 16px;"><path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z"/><circle cx="12" cy="13" r="4"/></svg>
          </button>
        </div>
        <input type="file" id="edit-photo-input" style="display: none;" accept="image/*">
      </div>

      <div style="display: flex; flex-direction: column; gap: 16px;">
        <div class="form-group">
          <label class="form-label">Full Name</label>
          <input type="text" id="edit-name-input" class="text-input" value="${userData.fullname}" style="width: 100%;">
        </div>

        <div class="form-group">
          <label class="form-label">Current Email</label>
          <input type="email" id="edit-current-email-display" class="text-input" value="${userData.email}" style="width: 100%; background: #f5f5f5; color: #666;" readonly>
        </div>

        <div class="form-group">
          <label class="form-label">New Email <span style="color: var(--text-muted); font-weight: normal;">(leave empty to keep current)</span></label>
          <input type="email" id="edit-email-input" class="text-input" placeholder="Enter new email address" style="width: 100%;">
        </div>

        <div class="form-group">
          <label class="form-label">Current Password <span style="color: var(--text-muted); font-weight: normal;">(required for email/password changes - use your login password)</span></label>
          <input type="password" id="edit-current-password-input" class="text-input" placeholder="Enter your login password" style="width: 100%;">
        </div>

        <div class="form-group">
          <label class="form-label">New Password <span style="color: var(--text-muted); font-weight: normal;">(leave empty to keep current)</span></label>
          <input type="password" id="edit-new-password-input" class="text-input" placeholder="Enter new password" style="width: 100%;">
        </div>
      </div>

      <div style="display: flex; gap: 12px; justify-content: flex-end; margin-top: 24px;">
        <button id="cancel-edit-btn" class="btn btn-secondary" style="padding: 8px 16px;">Cancel</button>
        <button id="save-profile-btn" class="btn btn-primary" style="padding: 8px 16px;">Save Changes</button>
      </div>
    </div>
  `;

  const photoInput = document.getElementById('edit-photo-input');
  const trigger = document.getElementById('change-photo-trigger');
  const nameInput = document.getElementById('edit-name-input');
  const emailInput = document.getElementById('edit-email-input');
  const currentPasswordInput = document.getElementById('edit-current-password-input');
  const newPasswordInput = document.getElementById('edit-new-password-input');
  const saveBtn = document.getElementById('save-profile-btn');
  const cancelBtn = document.getElementById('cancel-edit-btn');
  const preview = document.getElementById('edit-preview-img');

  console.log('Modal elements after creation:', {
    photoInput: !!photoInput,
    trigger: !!trigger,
    nameInput: !!nameInput,
    emailInput: !!emailInput,
    currentPasswordInput: !!currentPasswordInput,
    newPasswordInput: !!newPasswordInput,
    saveBtn: !!saveBtn,
    cancelBtn: !!cancelBtn,
    preview: !!preview
  });

  trigger.onclick = () => photoInput.click();

  photoInput.onchange = (e) => {
    const file = e.target.files[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = (ev) => preview.src = ev.target.result;
      reader.readAsDataURL(file);
    }
  };

  saveBtn.onclick = async () => {
    const newName = nameInput.value.trim();
    const newEmail = emailInput.value.trim() || userData.email; // Use current email if new email is empty
    const currentPassword = currentPasswordInput.value;
    const newPassword = newPasswordInput.value;

    if (!newName) {
      showToast('Name is required', 'error');
      return;
    }

    if (newEmail && !newEmail.endsWith('@gantecusa.com')) {
      showToast('Email must be an official @gantecusa.com address.', 'error');
      return;
    }

    // Check if email or password is being changed
    const originalEmail = userData.email;
    const isEmailChanged = newEmail !== originalEmail && newEmail !== '';
    const isPasswordChanged = newPassword && newPassword.length > 0;

    // Require current password for email or password changes
    if ((isEmailChanged || isPasswordChanged) && (!currentPassword || currentPassword.length < 1)) {
      showToast('Current password is required to change email or password', 'error');
      return;
    }

    // Password Complexity Validation for new password
    if (isPasswordChanged) {
      if (newPassword.length < 8) {
        showToast('New password must be at least 8 characters long.', 'error');
        return;
      }
      if (!/[A-Z]/.test(newPassword)) {
        showToast('New password must contain at least one uppercase letter (A-Z).', 'error');
        return;
      }
      if (!/[a-z]/.test(newPassword)) {
        showToast('New password must contain at least one lowercase letter (a-z).', 'error');
        return;
      }
      if (!/[0-9]/.test(newPassword)) {
        showToast('New password must contain at least one number (0-9).', 'error');
        return;
      }
      if (!/[!@#$%^&*(),.?":{}|<>]/.test(newPassword)) {
        showToast('New password must contain at least one special character (e.g., @#$%).', 'error');
        return;
      }
    }

    try {
      const updateData = {
        currentEmail: userData.email, // Use the current email from userData
        fullname: newName,
        email: newEmail
      };

      // Only include passwords if provided
      if (currentPassword) {
        updateData.currentPassword = currentPassword;
      }
      if (newPassword) {
        updateData.newPassword = newPassword;
      }

      console.log('Making API call to update profile');

      const res = await fetch(`${API_BASE}/auth/profile`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(updateData)
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || 'Failed to update profile');
      }

      // Update localStorage only after successful API call
      localStorage.setItem('gantec_user_name', newName);
      localStorage.setItem('gantec_user_email', newEmail);
      if (newPassword) {
        // Note: We don't store the new password in localStorage for security
        console.log('Password updated on server');
      }
      localStorage.setItem('gantec_user_profile', preview.src);
      
      // Update UI immediately
      document.querySelector('.user-name').textContent = newName;
      document.getElementById('profile-trigger-img').src = preview.src;
      
      showToast('Profile updated successfully!', 'success');
      modal.classList.add('hidden');
    } catch (err) {
      console.error('Save failed:', err);
      showToast('Failed to update profile: ' + err.message, 'error');
    }
  };

  cancelBtn.onclick = () => {
    modal.classList.add('hidden');
  };

  // Add click outside to close
  modal.addEventListener('click', (e) => {
    if (e.target === modal) {
      modal.classList.add('hidden');
    }
  });

  modal.classList.remove('hidden');
}

function showProfileModal(src) {
  let modal = document.getElementById('profile-view-modal');
  const isDefault = src.includes('default-avatar.png');

  if (!modal) {
    modal = document.createElement('div');
    modal.id = 'profile-view-modal';
    modal.className = 'confirm-overlay';
    document.body.appendChild(modal);
  }

  modal.innerHTML = `
    <div class="glass-card" style="padding: 24px; position: relative; max-width: 400px; width: 90%; display: flex; flex-direction: column; align-items: center; gap: 16px;">
      <button id="close-profile-modal" style="position: absolute; top: 12px; right: 12px; background: none; border: none; font-size: 1.5rem; cursor: pointer; color: var(--text-muted);">&times;</button>
      <img src="${src}" id="modal-profile-img" style="width: 100%; aspect-ratio: 1; object-fit: cover; border-radius: 12px; border: 1px solid var(--border);">
      
      ${!isDefault ? `
        <button id="remove-profile-pic-btn" class="btn btn-secondary" style="width: 100%; display: flex; align-items: center; justify-content: center; gap: 8px; color: var(--danger); border-color: rgba(239, 68, 68, 0.2);">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="width: 16px; height: 16px;"><path d="M3 6h18M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></svg>
          Remove Profile Photo
        </button>
      ` : ''}
    </div>
  `;

  modal.addEventListener('click', (e) => { if (e.target === modal) modal.classList.add('hidden'); });
  document.getElementById('close-profile-modal').addEventListener('click', () => modal.classList.add('hidden'));

  const removeBtn = document.getElementById('remove-profile-pic-btn');
  if (removeBtn) {
    removeBtn.addEventListener('click', () => {
      localStorage.removeItem('gantec_user_profile');
      const defaultAvatar = 'images/default-avatar.png';
      
      // Update UI elements immediately
      const profileImgs = document.querySelectorAll('#profile-trigger-img, #modal-profile-img');
      profileImgs.forEach(img => { if (img) img.src = defaultAvatar; });
      
      // Update header profile display
      const currentLabel = document.querySelector('.user-name');
      if (currentLabel) {
        showToast('Profile photo removed', 'info');
      }
      
      modal.classList.add('hidden');
    });
  }

  modal.classList.remove('hidden');
}

function initSidebarLogic() {
  // Seek sidebar by ID, then by common classes
  const sidebar = document.querySelector('#sidebar, .app-sidebar, .sidebar');
  const main = document.querySelector('.app-main, #main-content');
  const brand = document.querySelector('.sidebar-header h2, .sidebar-brand, .header-brand');
  
  if (!sidebar) {
    console.warn("Sidebar element not found accurately.");
    return;
  }

  const toggleSidebar = () => {
    const isCollapsed = sidebar.classList.toggle('collapsed');
    if (main) main.classList.toggle('expanded');
    localStorage.setItem('sidebar_collapsed', isCollapsed);
  };

  // 1. Restore Sidebar State from storage
  const savedState = localStorage.getItem('sidebar_collapsed');
  if (savedState === 'true') {
    sidebar.classList.add('collapsed');
    if (main) main.classList.add('expanded');
  }

  // 2. Identify active section reliably
  const links = document.querySelectorAll('.sidebar-link, .submenu-link');
  const fullPath = window.location.pathname.toLowerCase();
  const pageName = fullPath.split('/').pop() || 'home.html';

  links.forEach(link => {
    const hrefAttr = link.getAttribute('href')?.toLowerCase();
    if (!hrefAttr) return;

    // Check if filename matches or it's a path match
    const isMatch = (hrefAttr === pageName) || 
                    (pageName === hrefAttr) || 
                    (fullPath.endsWith('/' + hrefAttr)) ||
                    (fullPath.endsWith(hrefAttr) && hrefAttr.length > 3);

    if (isMatch) {
      link.classList.add('active');
      const dropdown = link.closest('.sidebar-dropdown');
      if (dropdown) {
        const trigger = dropdown.querySelector('.sidebar-dropdown-trigger');
        if (trigger) trigger.classList.add('active-child');
        dropdown.classList.add('open');
      }
    }
  });

  // 3. Brand click toggle (Symbols-only toggle)
  if (brand) {
    brand.style.cursor = 'pointer';
    brand.addEventListener('click', (e) => {
      e.preventDefault();
      toggleSidebar();
    });
  }

  // 4. Link Click Handler (Navigate vs Symbols-only Toggle)
  links.forEach(link => {
    link.addEventListener('click', (e) => {
      const isDropdownTrigger = link.classList.contains('sidebar-dropdown-trigger');
      const isActive = link.classList.contains('active');
      const hasActiveChild = link.classList.contains('active-child');
      const isSidebarCollapsed = sidebar.classList.contains('collapsed');

      // If collapsed and clicking a dropdown, expand first
      if (isSidebarCollapsed && isDropdownTrigger) {
        e.preventDefault();
        toggleSidebar();
        const parent = link.closest('.sidebar-dropdown');
        if (parent) parent.classList.add('open');
        return;
      }

      if (isActive || hasActiveChild) {
        // ALREADY ON THIS PAGE
        e.preventDefault();

        if (isSidebarCollapsed) {
          toggleSidebar();
          if (isDropdownTrigger) {
            const parent = link.closest('.sidebar-dropdown');
            if (parent) parent.classList.add('open');
          }
        } else {
          // If we click the triangle part specifically (on the right), 
          // we might just want to toggle the dropdown menu.
          const rect = link.getBoundingClientRect();
          const clickX = e.clientX - rect.left;
          const isTriangleClick = isDropdownTrigger && (clickX > rect.width - 45);

          if (isTriangleClick) {
            const parent = link.closest('.sidebar-dropdown');
            if (parent) parent.classList.toggle('open');
          } else {
            // Clicked the text/icon of the active page -> collapse
            toggleSidebar();
          }
        }
      } else {
        // NAVIGATING TO NEW PAGE
        const href = link.getAttribute('href');
        if (href === '#') {
          e.preventDefault();
          if (isDropdownTrigger) {
            const parent = link.closest('.sidebar-dropdown');
            if (parent) parent.classList.toggle('open');
          }
        } else {
          localStorage.setItem('sidebar_collapsed', 'false');
        }
      }
    });
  });
}

function initFolderSidebarToggle() {
  const folderSidebars = document.querySelectorAll('.folder-sidebar');
  if (folderSidebars.length === 0) return;

  folderSidebars.forEach(sidebar => {
    const title = sidebar.querySelector('.sidebar-title');
    if (title) {
      title.style.cursor = 'pointer';
      title.addEventListener('click', () => {
        const isCollapsed = sidebar.classList.toggle('collapsed');
        const pageKey = location.pathname.includes('locker') ? 'folder_sidebar_locker' : 'folder_sidebar_viewer';
        localStorage.setItem(pageKey, isCollapsed);
      });
      
      const pageKey = location.pathname.includes('locker') ? 'folder_sidebar_locker' : 'folder_sidebar_viewer';
      if (localStorage.getItem(pageKey) === 'true') {
        sidebar.classList.add('collapsed');
      }
    }
  });
}

document.addEventListener('DOMContentLoaded', () => {
  initNavDropdown();
  initUserProfile();
  initSidebarLogic();
  initFolderSidebarToggle();
});
