const API_BASE = '/api';
window.getSupabase = () => {
  if (window.supabaseClient) return Promise.resolve(window.supabaseClient);
  return new Promise(resolve => { window._sbResolve = resolve; });
};

// ─── API Helpers ──────────────────────────────────────────────────────────────

async function fetchFolders() {
  const res = await fetch(`${API_BASE}/folders?t=${Date.now()}`);
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
  if (bytes === undefined || bytes === null || isNaN(bytes)) return '—';
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

/**
 * Centralized File Icon Generator
 * Used across viewer.html and document-locker.html
 */
function getFileIconHtml(filename, size = 36, type = 'file', internalPath = '') {
  const ext = (filename || '').toLowerCase().split('.').pop();
  const internalExt = (internalPath || '').toLowerCase().split('.').pop();
  const isYt = ext === 'ytlink' || internalExt === 'ytlink' || type === 'link' || (filename || '').toLowerCase().includes('youtube.com') || (filename || '').toLowerCase().includes('youtu.be') || (internalPath || '').toLowerCase().includes('youtube.com');
  
  const style = `width: ${size}px; height: ${size}px;`;

  if (isYt) {
    return `
      <svg viewBox="0 0 24 24" style="${style}">
        <rect width="24" height="24" rx="5" fill="#FF0000" />
        <path d="M9.5 8.5l6.5 3.5-6.5 3.5v-7z" fill="white" />
      </svg>`;
  }

  // PDF Icon
  if (ext === 'pdf') {
    return `
      <svg viewBox="0 0 24 24" style="${style}">
        <path d="M4 18h16v2H4z" fill="#E53935" />
        <path d="M4 4h16v14H4z" fill="#F44336" />
        <text x="12" y="14" fill="white" font-size="6" font-weight="900" text-anchor="middle" font-family="Inter, Arial">PDF</text>
      </svg>`;
  }

  // Office Docs (Blue)
  if (['doc', 'docx'].includes(ext)) {
    return `<svg viewBox="0 0 24 24" style="${style}"><path d="M4 2h16v20H4z" fill="#2B579A"/><text x="12" y="15" fill="white" font-size="6" font-weight="900" text-anchor="middle">DOC</text></svg>`;
  }

  // Excel (Green)
  if (['xls', 'xlsx'].includes(ext)) {
    return `<svg viewBox="0 0 24 24" style="${style}"><path d="M4 2h16v20H4z" fill="#217346"/><text x="12" y="15" fill="white" font-size="6" font-weight="900" text-anchor="middle">XLS</text></svg>`;
  }

  // PPT (Orange)
  if (['ppt', 'pptx'].includes(ext)) {
    return `<svg viewBox="0 0 24 24" style="${style}"><path d="M4 2h16v20H4z" fill="#D24726"/><text x="12" y="15" fill="white" font-size="6" font-weight="900" text-anchor="middle">PPT</text></svg>`;
  }

  // Images
  if (['jpg', 'jpeg', 'png', 'gif', 'webp'].includes(ext)) {
    return `<svg viewBox="0 0 24 24" style="${style}"><path d="M4 2h16v20H4z" fill="#27AE60"/><path d="M8 14l3-3 4 4" stroke="white" stroke-width="1.5" fill="none"/></svg>`;
  }

  // Default Gray File
  return `
    <svg viewBox="0 0 24 24" style="${style}">
      <path d="M6 2h12v20H6z" fill="#94A3B8" />
      <path d="M12 2v6h6" fill="#64748B" />
    </svg>`;
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
  if (!userSection) return;
  
  // 1. Immediate render from localStorage for zero-latency UI
  const cachedName = localStorage.getItem('gantec_user_name');
  const cachedEmail = localStorage.getItem('gantec_user_email');
  
  if (cachedName && cachedEmail) {
    renderUserProfileUI(userSection, cachedName, cachedEmail);
  } else {
    // If no local data, show Guest UI (Sign In button) immediately
    renderGuestUI(userSection);
  }

  // We inject the Supabase SDK dynamically so it's available on all 15+ pages
  // without having to edit every single HTML file.
  if (!window.supabaseClient) {
    const script = document.createElement('script');
    script.src = "https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2";
    script.onload = () => {
      const SUPABASE_URL = 'https://pbicghsmejqlnksdtjzo.supabase.co';
      const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InBiaWNnaHNtZWpxbG5rc2R0anpvIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzY2NjM2MjEsImV4cCI6MjA5MjIzOTYyMX0.sI38ou9HZHK7vjLF8dTaEtvBvmMNx6u8LxBvOKFlwew';
      window.supabaseClient = supabase.createClient(SUPABASE_URL, SUPABASE_KEY);
      
      if (window._sbResolve) window._sbResolve(window.supabaseClient);

      // Native Supabase Session Management
      window.supabaseClient.auth.onAuthStateChange((event, session) => {
        console.log('Supabase Auth Event:', event);
        if (session && session.user) {
          const user = session.user;
          const cachedName = localStorage.getItem('gantec_user_name');
          // Only use session metadata if we don't already have a name, to prevent stale overrides
          const fullName = cachedName || user.user_metadata?.fullname || user.email;
          localStorage.setItem('gantec_auth', 'true');
          localStorage.setItem('gantec_user_name', fullName);
          localStorage.setItem('gantec_user_email', user.email);
          
          fetch(`/api/auth/profile?email=${encodeURIComponent(user.email)}&t=${Date.now()}`)
            .then(r => r.json())
            .then(data => {
              if (data.success && data.user) {
                localStorage.setItem('gantec_user_role', data.user.role || 'employee');
                localStorage.setItem('gantec_user_name', data.user.fullname);
                if (data.user.profile_image) {
                  localStorage.setItem('gantec_user_profile', data.user.profile_image);
                }
                if (userSection) renderUserProfileUI(userSection, data.user.fullname, data.user.email);
              }
            }).catch(err => {
              console.warn('Failed to fetch role:', err);
              if (userSection) renderUserProfileUI(userSection, fullName, user.email);
            });
        } else if (event === 'SIGNED_OUT') {
          // Only wipe data on explicit SIGNED_OUT event
          ['gantec_auth', 'gantec_user_name', 'gantec_user_email',
           'gantec_user_profile', 'gantec_user_role'].forEach(k => localStorage.removeItem(k));
          if (userSection) renderGuestUI(userSection);
        } else if (!localStorage.getItem('gantec_user_name')) {
          // If no local session AND no cloud session, then show Guest UI
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

  // Sidebar Profile Button Listener
  const sidebarProfileBtn = document.getElementById('sidebar-profile-btn');
  if (sidebarProfileBtn) {
    sidebarProfileBtn.addEventListener('click', (e) => {
      e.preventDefault();
      const name = localStorage.getItem('gantec_user_name');
      const email = localStorage.getItem('gantec_user_email');
      const profileImg = localStorage.getItem('gantec_user_profile') || 'images/default-avatar.png';
      
      if (name && email) {
        showProfileModal(name, email, profileImg);
      } else {
        window.location.href = 'login.html';
      }
    });
  }
}

function renderUserProfileUI(userSection, userName, userEmail) {
  const customProfile = localStorage.getItem('gantec_user_profile');
  const defaultProfile = 'images/default-avatar.png';
  const profileImgSrc = customProfile || defaultProfile;
  
  userSection.style.display = 'flex';
  userSection.style.alignItems = 'center';
  
  userSection.innerHTML = `
      <div class="user-profile-wrap nav-dropdown" id="profile-dropdown-wrap" style="display: flex; align-items: center; gap: 12px; margin-left: 12px; padding-left: 12px; border-left: 1px solid var(--border); cursor: pointer; position: relative;">
        <img src="${profileImgSrc}" alt="Profile" id="profile-trigger-img" class="header-profile-img" style="width: 36px; height: 36px; border-radius: 50%; object-fit: cover; border: 2px solid var(--primary-glow);">
        <div class="user-info-text" style="display: flex; flex-direction: column; line-height: 1.2;">
          <span class="user-name" style="font-size: 0.85rem; font-weight: 700; color: var(--text-primary);">${userName}</span>
          <span class="user-email" style="font-size: 0.7rem; color: var(--text-muted); opacity: 0.8;">${userEmail}</span>
        </div>
        
        <div class="dropdown-menu profile-menu right" style="min-width: 160px; width: max-content;">
          <a href="#" class="dropdown-item" id="view-profile-btn">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" class="icon-xs"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>
            View Profile
          </a>
          <a href="#" class="dropdown-item" id="edit-profile-btn">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" class="icon-xs"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
            Edit Profile
          </a>
          <a href="#" class="dropdown-item" id="logout-profile-btn" style="color: var(--danger); border-top: 1px solid var(--border); margin-top: 4px; padding-top: 8px;">
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
      const latestName = localStorage.getItem('gantec_user_name') || userName;
      const latestEmail = localStorage.getItem('gantec_user_email') || userEmail;
      const latestImg = localStorage.getItem('gantec_user_profile') || 'images/default-avatar.png';
      showProfileModal(latestName, latestEmail, latestImg);
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
      // Clear ALL user data to prevent profile bleed to next user
      ['gantec_auth', 'gantec_user_name', 'gantec_user_email',
       'gantec_user_profile', 'gantec_user_role'].forEach(k => localStorage.removeItem(k));
      window.location.href = 'login.html';
    });

    // Initialize manager notifications — injected as a sibling element, no profile code touched
    fetchManagerNotifications(userEmail);
}

async function fetchManagerNotifications(email) {
  if (!email) return;
  try {
    const month = document.getElementById('month-picker')?.value;
    const periodParam = month ? `&period=${encodeURIComponent(month)}` : '';
    const res = await fetch(`/api/notifications?email=${encodeURIComponent(email)}${periodParam}`);
    const data = await res.json();

    // Always inject the bell element next to the profile dropdown (if not already present)
    const profileWrap = document.getElementById('profile-dropdown-wrap');
    if (!profileWrap) return;

    // Remove any previously injected bell to avoid duplicates
    const existingBell = document.getElementById('manager-notification-bell');
    if (existingBell) existingBell.remove();

    if (!data.success || data.count === 0) return;

    // Create bell element
    const bell = document.createElement('div');
    bell.id = 'manager-notification-bell';
    bell.title = 'Notifications';
    // Style the bell to match UI theme
    bell.style.cssText = 'position: relative; cursor: pointer; display: flex; align-items: center; justify-content: center; width: 36px; height: 36px; border-radius: 50%; transition: background 0.2s; flex-shrink: 0; color: var(--text-primary); margin-left: 8px;';
    bell.innerHTML = `
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="width: 20px; height: 20px;">
        <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"></path>
        <path d="M13.73 21a2 2 0 0 1-3.46 0"></path>
      </svg>
      `;
    
    // Create badge element
    const badge = document.createElement('span');
    badge.id = 'notification-badge';
    badge.textContent = data.count;
    badge.style.cssText = 'position:absolute; top:-4px; right:-4px; background:#e53e3e; color:white; border-radius:50%; min-width:18px; height:18px; font-size:0.75rem; display:flex; align-items:center; justify-content:center; line-height:1;';
    
    // Insert bell and badge
    profileWrap.parentNode.insertBefore(bell, profileWrap.nextSibling);
    bell.appendChild(badge);

    // Hover effect
    bell.addEventListener('mouseenter', () => { bell.style.background = 'rgba(0,0,0,0.06)'; });
    bell.addEventListener('mouseleave', () => { bell.style.background = 'transparent'; });

    // Click handler
    bell.addEventListener('click', async (e) => {
      e.stopPropagation();
      try {
        await fetch('/api/notifications/read', {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ email })
        });

        // Remove badge
        const badge = document.getElementById('notification-badge');
        if (badge) badge.remove();

        // Show toast
        const msg = data.count === 1
          ? data.notifications[0].message
          : `${data.count} new reportees have been assigned to you.`;
        showToast(msg, 'info', 5000);

        // Redirect
        setTimeout(() => { window.location.href = 'insights.html'; }, 800);
      } catch (err) {
        console.error('Failed to mark notifications read:', err);
      }
    });

  } catch (err) {
    console.error('Failed to fetch manager notifications:', err);
  }
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
  const userData = {
    fullname: localStorage.getItem('gantec_user_name') || currentName || '',
    email: localStorage.getItem('gantec_user_email') || ''
  };

  if (!userData.email) {
    showToast('Please sign in to edit your profile', 'error');
    return;
  }

  createEditProfileModal(userData, currentImg);
}

function createEditProfileModal(userData, currentImg) {
  let modal = document.getElementById('profile-edit-modal');

  if (!modal) {
    modal = document.createElement('div');
    modal.id = 'profile-edit-modal';
    modal.className = 'confirm-overlay hidden'; // Start hidden
    modal.style.cssText = 'position: fixed; inset: 0; background: rgba(0,0,0,0.5); backdrop-filter: blur(5px); z-index: 9999; display: flex; align-items: flex-start; justify-content: center; padding: 40px 24px; overflow-y: auto;';
    document.body.appendChild(modal);
  } else {
    // Ensure modal starts hidden
    modal.classList.add('hidden');
  }

  modal.innerHTML = `
    <div class="glass-card" style="padding: 24px; max-width: 500px; width: 90%; position: relative; z-index: 1000; background: white; border: 1px solid #ddd; border-radius: 12px; box-shadow: 0 10px 25px rgba(0,0,0,0.2); margin: auto;">
      <h3 style="margin-bottom: 20px; font-size: 1.25rem; font-weight: 700; color: #2563eb;">Edit Profile</h3>
      
      <div style="background: #f0f9ff; border: 1px solid #0ea5e9; border-radius: 8px; padding: 12px; margin-bottom: 20px; font-size: 0.9rem; color: #0c4a6e;">
        <strong>Note:</strong> Changes can be made to your password only.
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
          <label class="form-label">Email Address <span style="color: var(--text-muted); font-weight: normal;">(cannot be changed)</span></label>
          <input type="email" id="edit-email-input" class="text-input" value="${userData.email}" style="width: 100%; opacity: 0.7; cursor: not-allowed;" readonly>
        </div>

        <div class="form-group">
          <label class="form-label">Verify Current Password <span style="color: var(--text-muted); font-weight: normal;">(only if changing password)</span></label>
          <div style="position: relative;">
            <input type="password" id="edit-current-password-input" class="text-input" placeholder="Enter your current password to verify" style="width: 100%; padding-right: 40px;">
            <button type="button" class="password-toggle-btn" data-target="edit-current-password-input" style="position: absolute; right: 12px; top: 50%; transform: translateY(-50%); background: none; border: none; padding: 0; cursor: pointer; color: #94a3b8; display: flex; align-items: center; justify-content: center;">
              <svg class="eye-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="width: 18px; height: 18px;"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>
            </button>
          </div>
        </div>

        <div class="form-group">
          <label class="form-label">New Password <span style="color: var(--text-muted); font-weight: normal;">(leave empty to keep current)</span></label>
          <div style="position: relative;">
            <input type="password" id="edit-new-password-input" class="text-input" placeholder="Enter new password" style="width: 100%; padding-right: 40px;">
            <button type="button" class="password-toggle-btn" data-target="edit-new-password-input" style="position: absolute; right: 12px; top: 50%; transform: translateY(-50%); background: none; border: none; padding: 0; cursor: pointer; color: #94a3b8; display: flex; align-items: center; justify-content: center;">
              <svg class="eye-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="width: 18px; height: 18px;"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>
            </button>
          </div>
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


  // Password toggle logic
  modal.querySelectorAll('.password-toggle-btn').forEach(btn => {
    btn.onclick = () => {
      const targetId = btn.getAttribute('data-target');
      const input = document.getElementById(targetId);
      const icon = btn.querySelector('.eye-icon');
      
      if (input.type === 'password') {
        input.type = 'text';
        // Eye-off icon
        icon.innerHTML = '<path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24"/><line x1="1" y1="1" x2="23" y2="23"/>';
      } else {
        input.type = 'password';
        // Eye-on icon
        icon.innerHTML = '<path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/>';
      }
    };
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
    const newEmail = emailInput.value.trim();
    const currentPassword = currentPasswordInput.value;
    const newPassword = newPasswordInput.value;

    const isEmailChanged = newEmail && newEmail !== userData.email;
    const isPasswordChanged = newPassword && newPassword.length > 0;

    if (!newName) {
      showToast('Name is required', 'error');
      return;
    }

    // Security check: If changing sensitive data, we need current password
    if ((isEmailChanged || isPasswordChanged) && !currentPassword) {
      showToast('Current password is required to change email or password', 'warning');
      currentPasswordInput.focus();
      currentPasswordInput.style.borderColor = 'var(--danger)';
      return;
    }

    if (isEmailChanged && !newEmail.toLowerCase().endsWith('@gantecusa.com')) {
      showToast('Email must be an official @gantecusa.com address.', 'error');
      return;
    }

    // 1. Save changes to localStorage immediately for instant UI update
    localStorage.setItem('gantec_user_name', newName);
    if (isEmailChanged) localStorage.setItem('gantec_user_email', newEmail);

    if (preview.src && !preview.src.includes('default-avatar.png')) {
      const profileImgs = document.querySelectorAll('#profile-trigger-img, #modal-profile-img, #edit-preview-img');
      profileImgs.forEach(img => { if (img) img.src = preview.src; });
      localStorage.setItem('gantec_user_profile', preview.src);
    }

    // Update UI labels immediately
    const nameLabels = document.querySelectorAll('.user-name');
    const emailLabels = document.querySelectorAll('.user-email');
    nameLabels.forEach(el => el.textContent = newName);
    if (isEmailChanged) emailLabels.forEach(el => el.textContent = newEmail);

    // 2. Sync to server in the background
    try {
      saveBtn.disabled = true;
      saveBtn.textContent = 'Saving...';

      const updateData = {
        currentEmail: userData.email,
        fullname: newName,
        email: isEmailChanged ? newEmail : userData.email,
        profile_image: (preview.src && !preview.src.includes('default-avatar.png')) ? preview.src : undefined
      };
      if (currentPassword) updateData.currentPassword = currentPassword;
      if (newPassword) updateData.newPassword = newPassword;

      const res = await fetch(`${API_BASE}/auth/profile`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(updateData)
      });

      const data = await res.json();
      if (!res.ok) {
        showToast(data.error || 'Server update failed', 'error');
        saveBtn.disabled = false;
        saveBtn.textContent = 'Save Changes';
      } else {
        showToast('Profile updated successfully!', 'success');
        modal.classList.add('hidden');
      }
    } catch (err) {
      console.warn('Could not sync profile to server:', err.message);
      showToast('Could not reach server to save changes.', 'warning');
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

function showProfileModal(name, email, src) {
  let modal = document.getElementById('profile-view-modal');
  const isDefault = src.includes('default-avatar.png');

  if (!modal) {
    modal = document.createElement('div');
    modal.id = 'profile-view-modal';
    modal.className = 'confirm-overlay';
    document.body.appendChild(modal);
  }

  modal.innerHTML = `
    <div class="glass-card" style="padding: 32px; position: relative; max-width: 400px; width: 90%; display: flex; flex-direction: column; align-items: center; gap: 20px; background: white; border-radius: 20px; border: 1px solid var(--border); box-shadow: var(--shadow-lg);">
      <button id="close-profile-modal" style="position: absolute; top: 16px; right: 16px; background: none; border: none; font-size: 1.5rem; cursor: pointer; color: var(--text-muted); line-height: 1;">&times;</button>
      
      <div style="position: relative; width: 140px; height: 140px; margin-bottom: 8px;">
        <img src="${src}" id="modal-profile-img" style="width: 100%; height: 100%; object-fit: cover; border-radius: 50%; border: 4px solid #f0f4f8; box-shadow: 0 4px 10px rgba(0,0,0,0.1);">
        <button id="modal-change-photo-btn" style="position: absolute; bottom: 4px; right: 4px; background: var(--primary); color: white; border: none; width: 36px; height: 36px; border-radius: 50%; cursor: pointer; display: flex; align-items: center; justify-content: center; box-shadow: 0 2px 8px rgba(0,0,0,0.2); border: 2px solid white;">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" style="width: 18px; height: 18px;"><path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z"/><circle cx="12" cy="13" r="4"/></svg>
        </button>
        <input type="file" id="modal-photo-input" style="display: none;" accept="image/*">
      </div>

      <div style="text-align: center;">
        <h3 style="font-size: 1.5rem; font-weight: 800; color: var(--primary); margin: 0;">${name}</h3>
        <p style="font-size: 0.95rem; color: var(--text-muted); margin: 4px 0 0;">${email}</p>
      </div>

      <div style="width: 100%; height: 1px; background: #eee; margin: 8px 0;"></div>
      
      <div style="width: 100%; display: flex; flex-direction: column; gap: 10px;">
        <button id="explicit-upload-btn" class="btn btn-primary" style="width: 100%; display: flex; align-items: center; justify-content: center; gap: 10px; padding: 12px; border-radius: 12px; font-weight: 700; background: var(--primary); border: none; color: white; cursor: pointer; transition: all 0.2s;">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" style="width: 20px; height: 20px;"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" y1="3" x2="12" y2="15"/></svg>
          Upload New Photo
        </button>

        <button id="remove-profile-pic-btn" class="btn btn-secondary" style="width: 100%; display: ${isDefault ? 'none' : 'flex'}; align-items: center; justify-content: center; gap: 10px; color: var(--danger); border: 1px solid rgba(239, 68, 68, 0.2); background: rgba(239, 68, 68, 0.05); padding: 12px; border-radius: 12px; font-weight: 600; cursor: pointer;">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="width: 18px; height: 18px;"><path d="M3 6h18M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></svg>
          Remove Current Photo
        </button>
      </div>
    </div>
  `;

  modal.addEventListener('click', (e) => { if (e.target === modal) modal.classList.add('hidden'); });
  document.getElementById('close-profile-modal').addEventListener('click', () => modal.classList.add('hidden'));

  const photoInput = document.getElementById('modal-photo-input');
  const changeBtn = document.getElementById('modal-change-photo-btn');
  const explicitUploadBtn = document.getElementById('explicit-upload-btn');
  const modalImg = document.getElementById('modal-profile-img');

  changeBtn.onclick = () => photoInput.click();
  explicitUploadBtn.onclick = () => photoInput.click();

  photoInput.onchange = async (e) => {
    const file = e.target.files[0];
    if (!file) return;

    // Validate file size (max 2MB)
    if (file.size > 2 * 1024 * 1024) {
      showToast('Image too large. Please use an image under 2MB.', 'error');
      return;
    }

    const reader = new FileReader();
    reader.onload = async (ev) => {
      const base64 = ev.target.result;

      // 1. Save to localStorage immediately — instant update, no server needed
      localStorage.setItem('gantec_user_profile', base64);

      // 2. Update UI immediately everywhere
      // We target all profile images, especially the one in the current modal
      const profileImgs = document.querySelectorAll('#profile-trigger-img, #modal-profile-img, #edit-preview-img, .header-profile-img');
      profileImgs.forEach(img => { 
        if (img) {
          img.src = base64;
          // Force a reflow/re-render for some browsers
          img.style.display = 'none';
          img.offsetHeight; 
          img.style.display = 'block';
        }
      });

      const removeBtn = document.getElementById('remove-profile-pic-btn');
      if (removeBtn) {
        removeBtn.style.display = 'flex';
        removeBtn.style.opacity = '1';
      }

      showToast('Profile photo updated', 'success');

      // 3. Try to sync to server in the background (best-effort)
      const userEmail = email || localStorage.getItem('gantec_user_email');
      if (userEmail) {
        try {
          const res = await fetch(`${API_BASE}/auth/profile`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ currentEmail: userEmail, profile_image: base64 })
          });
          if (!res.ok) {
            console.warn('Background server sync for photo failed — image still saved locally.');
          }
        } catch (err) {
          console.warn('Could not sync photo to server:', err.message);
        }
      }
    };
    reader.readAsDataURL(file);
  };


  const removeBtn = document.getElementById('remove-profile-pic-btn');
  if (removeBtn) {
    removeBtn.addEventListener('click', async () => {
      // Create custom confirm modal if it doesn't exist
      let confirmModal = document.getElementById('custom-confirm-modal');
      if (!confirmModal) {
        confirmModal = document.createElement('div');
        confirmModal.id = 'custom-confirm-modal';
        confirmModal.className = 'confirm-overlay';
        confirmModal.style.zIndex = '9999';
        confirmModal.innerHTML = `
          <div class="glass-card" style="padding: 24px; max-width: 400px; width: 90%; background: white; border-radius: 16px; border: 1px solid var(--border); box-shadow: var(--shadow-lg); text-align: center;">
            <div style="width: 48px; height: 48px; border-radius: 50%; background: rgba(239, 68, 68, 0.1); color: var(--danger); display: flex; align-items: center; justify-content: center; margin: 0 auto 16px;">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="width: 24px; height: 24px;"><path d="M3 6h18M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></svg>
            </div>
            <h3 style="margin-top: 0; color: var(--text-primary); font-size: 1.25rem; font-weight: 700; margin-bottom: 8px;">Remove Profile Photo</h3>
            <p style="color: var(--text-secondary); margin-bottom: 24px; font-size: 0.95rem;">// Removed Add Reportee modal functionality per user request.
em;">Are you sure you want to remove your profile photo? This action cannot be undone.</p>
            <div style="display: flex; gap: 12px; justify-content: center;">
              <button id="confirm-cancel-btn" class="btn btn-secondary" style="flex: 1; text-align: center; justify-content: center;">Cancel</button>
              <button id="confirm-ok-btn" class="btn btn-primary" style="flex: 1; background: var(--danger); border-color: var(--danger); text-align: center; justify-content: center;">Remove</button>
            </div>
          </div>
        `;
        document.body.appendChild(confirmModal);
      }
      confirmModal.classList.remove('hidden');

      const confirmed = await new Promise((resolve) => {
        const handleCancel = () => {
          confirmModal.classList.add('hidden');
          cleanup();
          resolve(false);
        };
        const handleOk = () => {
          confirmModal.classList.add('hidden');
          cleanup();
          resolve(true);
        };
        const cleanup = () => {
          document.getElementById('confirm-cancel-btn').removeEventListener('click', handleCancel);
          document.getElementById('confirm-ok-btn').removeEventListener('click', handleOk);
        };
        document.getElementById('confirm-cancel-btn').addEventListener('click', handleCancel);
        document.getElementById('confirm-ok-btn').addEventListener('click', handleOk);
      });

      if (!confirmed) return;

      try {
        const email = localStorage.getItem('gantec_user_email');
        const res = await fetch(`${API_BASE}/auth/profile`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ currentEmail: email, profile_image: null })
        });

        if (res.ok) {
          localStorage.removeItem('gantec_user_profile');
          const defaultAvatar = 'images/default-avatar.png';
          
          // Update UI elements immediately
          const profileImgs = document.querySelectorAll('#profile-trigger-img, #modal-profile-img, #edit-preview-img');
          profileImgs.forEach(img => { if (img) img.src = defaultAvatar; });
          
          // Hide remove button dynamically
          if (removeBtn) removeBtn.style.display = 'none';
          
          showToast('Profile photo removed', 'success');
          // Optionally don't close modal so user can see it's removed
          // modal.classList.add('hidden');
        } else {
          throw new Error('Failed to remove photo');
        }
      } catch (err) {
        showToast('Error removing photo: ' + err.message, 'error');
      }
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

  // 4. Link Click Handler (Navigate vs Symbols-only Toggle) using Event Delegation
  const navContainer = document.querySelector('.sidebar-nav');
  if (navContainer) {
    navContainer.addEventListener('click', (e) => {
      const link = e.target.closest('.sidebar-link, .submenu-link');
      if (!link) return;

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
          // If it's a dropdown trigger, toggle the dropdown regardless of where it's clicked
          // This makes it much easier for users to open/close submenus.
          if (isDropdownTrigger) {
            const parent = link.closest('.sidebar-dropdown');
            if (parent) parent.classList.toggle('open');
          } else {
            // Clicked the text/icon of a non-dropdown active page -> collapse sidebar
            toggleSidebar();
          }
        }
      } else {
        // NAVIGATING TO NEW PAGE
        const href = link.getAttribute('href');
        if (href === '#' || !href) {
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
  }
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

async function syncLeavePortalLink() {
  const email = localStorage.getItem('gantec_user_email');
  if (!email) return;

  try {
    const res = await fetch(`${API_BASE}/leave/settings?email=${encodeURIComponent(email)}`);
    const data = await res.json();

    if (data.success && data.power_apps_link) {
      const userLink = data.power_apps_link;
      console.log('Syncing Leave Portal link for user:', email);

      // 1. Update Sidebar Links
      const sidebarLinks = document.querySelectorAll('.sidebar-link, .submenu-link');
      sidebarLinks.forEach(link => {
        if (link.textContent.includes('Leave Portal')) {
          link.href = userLink;
          link.target = '_blank';
        }
      });

      // 2. Update Feature Cards (Home Page)
      const leaveCard = document.querySelector('.feature-card[data-module="leave"]');
      if (leaveCard) {
        // Update onclick to use the user's specific link
        leaveCard.setAttribute('onclick', `window.open('${userLink}', '_blank')`);
      }
    }
  } catch (err) {
    console.warn('Failed to sync individual Leave Portal link:', err);
  }
}

function injectAdminHRInbox() {
  try {
    const role = localStorage.getItem('gantec_user_role') || 'employee';
    const email = localStorage.getItem('gantec_user_email');
    
    // Non-blocking background check to ensure role is in sync with server's config
    if (email) {
      fetch(`/api/auth/profile?email=${encodeURIComponent(email)}&t=${Date.now()}`)
        .then(res => res.json())
        .then(data => {
          if (data.success && data.user) {
            const currentCachedRole = localStorage.getItem('gantec_user_role');
            const actualRole = data.user.role || 'employee';
            if (currentCachedRole !== actualRole) {
              localStorage.setItem('gantec_user_role', actualRole);
              // Dynamically rebuild sidebar links
              renderAdminSidebarLinks(actualRole);
            }
          }
        }).catch(err => console.warn("Background role sync failed:", err));
    }

    renderAdminSidebarLinks(role);
  } catch (err) {
    console.warn('Failed to dynamically inject Admin links:', err);
  }
}

function renderAdminSidebarLinks(role) {
  const nav = document.querySelector('.sidebar-nav');
  if (!nav) return;

  if (role === 'admin') {
    // 1. (Removed HR Inbox link)

    // 2. Inject Submission Tracker Dropdown
    if (!document.getElementById('nav-submission-tracker-dropdown')) {
      const dropdown = document.createElement('div');
      dropdown.id = 'nav-submission-tracker-dropdown';
      dropdown.className = 'sidebar-dropdown';
      
      const path = window.location.pathname;
      const isSupportActive = path.endsWith('support-queries.html');
      const isHrActive = path.endsWith('hr-queries.html');

      dropdown.innerHTML = `
        <a href="#" class="sidebar-link sidebar-dropdown-trigger" id="nav-submission-tracker">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" />
            <polyline points="22 4 12 14.01 9 11.01" />
            <path d="M3 12h3l2-3 2 6 2-3h3" opacity="0.65" />
          </svg>
          <span class="link-text">Submission Tracker</span>
        </a>
        <div class="sidebar-submenu">
          <a href="support-queries.html" class="submenu-link ${isSupportActive ? 'active' : ''}">Support Queries</a>
          <a href="hr-queries.html" class="submenu-link ${isHrActive ? 'active' : ''}">HR Queries</a>
        </div>
      `;

      if (isSupportActive || isHrActive) {
        dropdown.classList.add('open');
        const trigger = dropdown.querySelector('.sidebar-dropdown-trigger');
        if (trigger) trigger.classList.add('active-child');
      }

      // Insert right before "Contact HR"
      const contactLink = nav.querySelector('a[href="contact-hr.html"]');
      if (contactLink) {
        nav.insertBefore(dropdown, contactLink);
      } else {
        nav.appendChild(dropdown);
      }
    }
  } else {
    // If the role is not admin (e.g. standard employee), ensure all admin links are cleaned up if present
    const trackerDropdown = document.getElementById('nav-submission-tracker-dropdown');
    
    // Cleanup old standalone links just in case
    const trackerLink = document.getElementById('nav-submission-tracker');
    const supportLink = document.getElementById('nav-support-queries');
    const hrQueriesLink = document.getElementById('nav-hr-queries');
    
    if (trackerDropdown) trackerDropdown.remove();
    // Only remove standalone tracker if it's an anchor (not the trigger inside the dropdown)
    if (trackerLink && trackerLink.parentElement === nav) trackerLink.remove();
    if (supportLink) supportLink.remove();
    if (hrQueriesLink) hrQueriesLink.remove();
  }
}
function syncFeedbackMenu() {
  try {
    // Find Monthly Feedback dropdown submenu in the sidebar
    const trigger = document.querySelector('#nav-feedback') || 
                    document.querySelector('.sidebar-link[href*="feedback"]') || 
                    Array.from(document.querySelectorAll('.sidebar-link')).find(el => el.textContent.includes('Feedback'));
    
    if (trigger) {
      const dropdown = trigger.closest('.sidebar-dropdown');
      if (dropdown) {
        const submenu = dropdown.querySelector('.sidebar-submenu');
        if (submenu) {
          const path = window.location.pathname;
          const isDashboardActive = path.endsWith('feedback-dashboard.html');
          const isFeedbackActive = path.endsWith('monthly-feedback.html');
          const isInsightsActive = path.endsWith('insights.html');
          const isAnalysisActive = path.endsWith('analysis.html');

          // Preserve the sub-email URL search parameter if it exists
          const params = new URLSearchParams(window.location.search);
          const emailParam = params.get('email');
          const suffix = emailParam ? `?email=${encodeURIComponent(emailParam)}` : '';

          submenu.innerHTML = `
            <a href="monthly-feedback.html${suffix}" class="submenu-link ${isFeedbackActive ? 'active' : ''}">Feedback Insights</a>
            <a href="insights.html${suffix}" class="submenu-link ${isInsightsActive ? 'active' : ''}">Reportee Insights</a>
            <a href="feedback-dashboard.html${suffix}" class="submenu-link ${isDashboardActive ? 'active' : ''}">Dashboard</a>
            <a href="analysis.html${suffix}" class="submenu-link ${isAnalysisActive ? 'active' : ''}">Performance Analysis</a>
          `;
        }
      }
    }
  } catch (err) {
    console.warn('Failed to dynamically sync Monthly Feedback submenu:', err);
  }
}

document.addEventListener('DOMContentLoaded', () => {
  initNavDropdown();
  initUserProfile();
  initSidebarLogic();
  initFolderSidebarToggle();
  syncLeavePortalLink(); // Initialize dynamic links
  injectAdminHRInbox(); // Inject Admin HR Inbox dynamically
  syncFeedbackMenu(); // Standardize Monthly Feedback links across all pages

  // --- Background Real-time Count Sync ---
  // Periodically updates counts and folder contents in the background every 3 seconds
  setInterval(() => {
    if (typeof window.loadFolders === 'function') {
      window.loadFolders();
    }
  }, 3000);
});
