/**
 * viewer.js – Document viewer logic
 */

let allFolders = [];
let activeFolder = '__all__';
let isGridView = true;
let searchQuery = '';
let expandedFolders = new Set(['General']); 
let sidebarIsCollapsed = false;

// ─── Icon Helpers ────────────────────────────────────────────────────────────
// (Now using global getFileIconHtml from app.js)

// ─── DOM References ───────────────────────────────────────────────────────────
const subfoldersBtn = document.getElementById('subfolders-btn');
const dropdownMenu = document.getElementById('dropdown-menu');
const dropdownList = document.getElementById('dropdown-list');
const subfoldersContainer = document.getElementById('subfolders-dropdown-container');

// Toggle Dropdown
subfoldersBtn?.addEventListener('click', (e) => {
  e.stopPropagation();
  subfoldersContainer.classList.toggle('active');
});

// Close dropdown on click outside
document.addEventListener('click', () => {
  subfoldersContainer?.classList.remove('active');
});

// Stop scroll propagation for the dropdown list
dropdownList?.addEventListener('wheel', (e) => {
  const scrollTop = dropdownList.scrollTop;
  const scrollHeight = dropdownList.scrollHeight;
  const height = dropdownList.clientHeight;
  const delta = e.deltaY;

  if ((delta > 0 && scrollTop + height >= scrollHeight) || (delta < 0 && scrollTop <= 0)) {
    e.preventDefault();
  }
}, { passive: false });

const docsGrid        = document.getElementById('docs-grid');
const emptyState      = document.getElementById('empty-state');
const viewerHeading   = document.getElementById('viewer-heading');
const docCountBadge   = document.getElementById('doc-count-badge');
const searchInput     = document.getElementById('search-input');
const gridBtn         = document.getElementById('grid-btn');
const listBtn         = document.getElementById('list-btn');
const pdfModal        = document.getElementById('pdf-modal');
const pdfIframe       = document.getElementById('pdf-iframe');
const modalFilename   = document.getElementById('modal-filename');
const modalIcon       = document.getElementById('modal-icon');
const modalDownload   = document.getElementById('modal-download');
const previewFallback = document.getElementById('preview-fallback');
const modalClose      = document.getElementById('modal-close');
const summarizeBtn    = document.getElementById('modal-summarize');
const summaryOverlay  = document.getElementById('summary-overlay');
const summaryContent  = document.getElementById('summary-content');
const closeSummaryBtn = document.getElementById('close-summary');

const deleteConfirmModal = document.getElementById('delete-confirm-modal');
const deleteConfirmOkBtn = document.getElementById('delete-confirm-ok-btn');
const deleteConfirmCancelBtn = document.getElementById('delete-confirm-cancel-btn');
const deleteConfirmMsg = document.getElementById('delete-confirm-msg');
let currentOpenFolder = '';
let currentOpenFile = '';
let currentOpenDisplayName = '';

// (Listeners moved to initViewer/DOMContentLoaded)

// Upload UI
const fileInput = document.getElementById('file-input');

// Confirm Upload Modal
const confirmOverlay = document.getElementById('confirm-overlay');
const confirmOrigName = document.getElementById('confirm-orig-name');
const confirmFileMeta = document.getElementById('confirm-file-meta');
const renameInput = document.getElementById('rename-input');
const confirmFolderList = document.getElementById('confirm-folder-list');
const confirmProgressWrap = document.getElementById('confirm-progress-wrap');
const confirmProgressFill = document.getElementById('confirm-progress-fill');
const confirmProgressText = document.getElementById('confirm-progress-text');
const confirmUploadBtn = document.getElementById('confirm-upload-btn');
const confirmCloseBtn = document.getElementById('confirm-close-btn');
const confirmCancelBtn = document.getElementById('confirm-cancel-btn');
const confirmExt = document.getElementById('confirm-ext');

let selectedFile = null;
let modalFolder = null;

const youtubeLinkBtn = document.getElementById('youtube-link-btn');
youtubeLinkBtn?.addEventListener('click', () => {
  const title = prompt("Enter a title for the link:");
  const url = prompt("Enter the YouTube URL:");
  if (title && url) {
    const folder = activeFolder === '__all__' ? 'General' : activeFolder;
    fetch('/api/resources/links', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ title, url, folder })
    }).then(res => res.json())
      .then(data => {
        if (data.success) {
          alert('YouTube link added successfully (logged to console)');
          loadFolders();
        }
      });
  }
});

// ─── Load Data ────────────────────────────────────────────────────────────────
async function fetchFolders() {
  const res = await fetch('/api/folders');
  if (!res.ok) throw new Error('Failed to fetch folders');
  return res.json();
}

async function loadFolders() {
  window.loadFolders = loadFolders;
  try {
    const data = await fetchFolders();
    console.log('Folders loaded from API:', data);
    allFolders = data.folders || [];
    renderSidebar();
    renderDocs();
  } catch (err) {
    console.error('Load error:', err);
    docsGrid.innerHTML = `
      <div style="padding:40px; text-align:center;">
        <p style="color:var(--danger); font-weight:600;">Could not connect to server.</p>
        <p style="font-size:0.85rem; color:var(--text-muted); margin-top:8px;">Make sure the portal is running on port 3000.</p>
        <button onclick="loadFolders()" class="btn btn-primary" style="margin-top:16px;">Try Again</button>
      </div>
    `;
  }
}

// ─── Sidebar & Dropdown ───────────────────────────────────────────────────────
function renderSidebar() {
  // We now use the dropdown for navigation
  renderDropdown();
}



function renderDropdown() {
  if (!dropdownList) return;
  dropdownList.innerHTML = '';
  
  // "All Materials" option
  const totalFiles = allFolders.reduce((sum, f) => sum + (f.files ? f.files.length : 0), 0);
  const allItem = document.createElement('li');
  allItem.className = `dropdown-item ${activeFolder === '__all__' ? 'active' : ''}`;
  allItem.innerHTML = `
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" class="chevron-icon" style="opacity:0;"><polyline points="9 18 15 12 9 6"></polyline></svg>
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" class="folder-icon"><path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"/></svg>
    <span class="folder-name">All Materials</span>
    <span class="file-count">${totalFiles}</span>
  `;
  // Removed click listener from All Materials to maintain pure visibility behavior
  allItem.addEventListener('click', (e) => {
    e.stopPropagation();
  });
  dropdownList.appendChild(allItem);

  // Individual Folders
  allFolders.forEach(folder => {
    const isExpanded = expandedFolders.has(folder.name);
    
    // Folder Header
    const folderHeader = document.createElement('li');
    folderHeader.className = `dropdown-item folder-header ${activeFolder === folder.name ? 'active' : ''}`;
    folderHeader.innerHTML = `
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" class="chevron-icon ${isExpanded ? 'expanded' : ''}" style="transition: transform 0.2s; ${isExpanded ? 'transform: rotate(90deg);' : ''}"><polyline points="9 18 15 12 9 6"></polyline></svg>
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" class="folder-icon"><path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"/></svg>
      <span class="folder-name">${escapeHTML(folder.name)}</span>
      <div class="item-right-actions">
        <span class="file-count">${folder.files ? folder.files.length : 0}</span>
        ${(localStorage.getItem('gantec_user_role') === 'admin') ? `
        <button class="delete-folder-btn" title="Delete Folder">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="width: 16px; height: 16px;">
            <path d="M3 6h18"></path>
            <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path>
          </svg>
        </button>` : ''}
      </div>
    `;
    
    // Toggle expansion on chevron click OR folder click
    folderHeader.addEventListener('click', (e) => {
      e.stopPropagation(); // Prevent dropdown from closing on document click
      if (e.target.closest('.delete-folder-btn')) return;
      
      if (isExpanded) {
        expandedFolders.delete(folder.name);
      } else {
        expandedFolders.add(folder.name);
      }
      renderDropdown(); // Only re-render dropdown for visibility, no navigation
    });

    if (folderHeader.querySelector('.delete-folder-btn')) {
      folderHeader.querySelector('.delete-folder-btn').addEventListener('click', (e) => {
        e.stopPropagation();
        confirmDeleteFolder(folder.name);
      });
    }

    dropdownList.appendChild(folderHeader);

    // Files in this folder (only if expanded)
    if (isExpanded && folder.files && folder.files.length > 0) {
      folder.files.forEach(file => {
        const fileItem = document.createElement('li');
        fileItem.className = 'dropdown-item file-item';
        fileItem.innerHTML = `
          <div style="width: 24px; flex-shrink: 0;"></div>
          <span style="margin-right: 12px; display: flex; align-items: center;">${getFileIconHtml(file.name, 20)}</span>
          <span class="file-name" style="cursor: default; user-select: none;">${escapeHTML(file.name)}</span>
          ${((file.uploader_email && file.uploader_email.toLowerCase() === localStorage.getItem('gantec_user_email')?.toLowerCase()) || localStorage.getItem('gantec_user_role') === 'admin') ? `
          <button class="delete-file-btn" title="Delete File">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="width: 16px; height: 16px;">
              <path d="M3 6h18"></path>
              <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path>
            </svg>
          </button>` : ''}
        `;
        
        fileItem.addEventListener('click', (e) => {
          e.stopPropagation(); // Prevent dropdown from closing and avoid any unintended bubbling
        });

        if (fileItem.querySelector('.delete-file-btn')) {
          fileItem.querySelector('.delete-file-btn').addEventListener('click', (e) => {
            e.stopPropagation();
            confirmDelete(folder.name, file.name, file.uploader_email);
          });
        }

        // Removed click listener that opened PDF or filtered view
        dropdownList.appendChild(fileItem);
      });
    }
  });
}

// ─── Folder Selection ─────────────────────────────────────────────────────────
function setActiveFolder(name) {
  activeFolder = name;
  subfoldersContainer?.classList.remove('active');
  renderDropdown();
  renderDocs();
}

// ─── Document Rendering ───────────────────────────────────────────────────────
function getFilteredItems() {
  let f_files = [];

  const q = searchQuery ? searchQuery.toLowerCase() : '';

  if (q) {
    allFolders.forEach(folder => {
      const folderMatch = folder.name.toLowerCase().includes(q);
      folder.files.forEach(file => {
        if (folderMatch || file.name.toLowerCase().includes(q)) {
          f_files.push({ ...file, folder: folder.name });
        }
      });
    });
  } else {
    if (activeFolder === '__all__') {
      allFolders.forEach(folder => {
        folder.files.forEach(file => {
          f_files.push({ ...file, folder: folder.name });
        });
      });
    } else {
      const folder = allFolders.find(f => f.name === activeFolder);
      if (folder) {
        f_files = folder.files.map(file => ({ ...file, folder: folder.name }));
      }
    }
  }


  f_files.sort((a, b) => new Date(b.uploadedAt) - new Date(a.uploadedAt));

  return { files: f_files };
}

function renderDocs() {
  const { files } = getFilteredItems();

  // Update heading
  viewerHeading.textContent = activeFolder === '__all__' ? 'All Documents' : activeFolder;

  // Build badge text
  docCountBadge.textContent = `${files.length} document${files.length !== 1 ? 's' : ''}`;

  docsGrid.innerHTML = '';

  if (files.length === 0) {
    emptyState.classList.remove('hidden');
    return;
  }
  emptyState.classList.add('hidden');

  // Render Files
  files.forEach(doc => {
    docsGrid.appendChild(buildGridCard(doc));
  });
}

function buildGridCard(doc) {
  const card = document.createElement('div');
  card.className = 'doc-card';
  const ext = doc.name.toLowerCase().split('.').pop();
  const internalExt = (doc.hashedName || doc.path || '').toLowerCase().split('.').pop();
  const isYt = ext === 'ytlink' || internalExt === 'ytlink' || doc.type === 'link' || doc.name.toLowerCase().includes('youtube.com') || doc.name.toLowerCase().includes('youtu.be') || (doc.hashedName || '').toLowerCase().includes('youtube.com');
  
  // Small, Clean Icons
  let iconHtml = getFileIconHtml(doc.name, 36, doc.type, doc.hashedName || doc.path);

  const currentUserEmail = (localStorage.getItem('gantec_user_email') || '').toLowerCase();
  const currentUserRole = localStorage.getItem('gantec_user_role') || 'employee';
  const isOwner = (doc.uploader_email && doc.uploader_email.toLowerCase() === currentUserEmail) || (currentUserRole === 'admin');

  card.innerHTML = `
    <div class="doc-thumb">${iconHtml}</div>
    <div class="doc-info">
      <div class="doc-name" title="${escapeHTML(doc.name)}">${escapeHTML(doc.name.replace('.ytlink', ''))}</div>
      <div class="doc-meta">
        ${(isYt || (formatSize(doc.size) !== '—')) ? `<span class="doc-size">${isYt ? 'Video Link' : formatSize(doc.size)}</span>` : ''}
        <span class="doc-folder-tag">${escapeHTML(doc.folder)}</span>
      </div>
    </div>
    <div class="doc-actions">
      <button class="doc-action-btn view-doc" title="${isYt ? 'Open in YouTube' : 'View'}">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" style="width:16px; height:16px;">
          <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/>
          <circle cx="12" cy="12" r="3"/>
        </svg>
      </button>
      ${isOwner ? `
      <button class="doc-action-btn delete" data-folder="${escapeHTML(doc.folder)}" data-name="${escapeHTML(doc.name)}" title="Delete">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" style="width:16px; height:16px;">
          <path d="M3 6h18"></path>
          <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path>
          <line x1="10" y1="11" x2="10" y2="17"></line>
          <line x1="14" y1="11" x2="14" y2="17"></line>
        </svg>
      </button>` : ''}
    </div>
  `;

  const handleYtClick = async (e) => {
    if (e) e.stopPropagation();
    try {
      const url = getFileUrl(doc.folder, doc.hashedName || doc.path || doc.name);
      const res = await fetch(url);
      if (!res.ok) throw new Error('Failed to fetch link data');
      const text = await res.text();
      try {
        const data = JSON.parse(text);
        const finalUrl = data.url || data.link || (typeof data === 'string' ? data : null);
        if (finalUrl && finalUrl.startsWith('http')) {
          window.open(finalUrl, '_blank');
        }
      } catch (err) {
        if (text.trim().startsWith('http')) {
          window.open(text.trim(), '_blank');
        }
      }
    } catch (err) { 
      console.error('YouTube redirect failed', err);
      // Fallback: if it's a known link, just try to open it
      if (doc.name.toLowerCase().includes('youtube.com') || doc.name.toLowerCase().includes('youtu.be')) {
        const query = encodeURIComponent(doc.name);
        window.open(`https://www.youtube.com/results?search_query=${query}`, '_blank');
      }
    }
  };

  card.querySelector('.view-doc').addEventListener('click', (e) => {
    e.stopPropagation();
    if (isYt) {
      handleYtClick(e);
    } else {
      openPdf(doc.folder, doc.hashedName || doc.path || doc.name, doc.name);
    }
  });
  
  if (card.querySelector('.delete')) {
    card.querySelector('.delete').addEventListener('click', (e) => {
      e.stopPropagation();
      confirmDelete(doc.folder, doc.hashedName || doc.name, doc.uploader_email, doc.name);
    });
  }

  if (isYt) {
    card.style.cursor = 'pointer';
    card.addEventListener('click', handleYtClick);
  }

  return card;
}

// ─── Search ───────────────────────────────────────────────────────────────────
searchInput?.addEventListener('input', () => {
  searchQuery = searchInput.value.trim();
  renderDocs();
});

// ─── View Toggle ──────────────────────────────────────────────────────────────
gridBtn?.addEventListener('click', () => {
  isGridView = true;
  gridBtn.classList.add('active');
  listBtn?.classList.remove('active');
  renderDocs();
});
listBtn?.addEventListener('click', () => {
  isGridView = false;
  listBtn.classList.add('active');
  gridBtn?.classList.remove('active');
  renderDocs();
});

// ─── Document Viewer ──────────────────────────────────────────────────────────
function openPdf(folder, diskFilename, displayName, isUserDoc = false) {
  // Store globally for buttons
  window.currentOpenFolder = folder;
  window.currentOpenFile = diskFilename;
  window.currentOpenDisplayName = displayName || diskFilename;
  
  const url = getFileUrl(folder, diskFilename);
  
  // Award points for viewing
  const authEmail = localStorage.getItem('gantec_user_email');
  if (authEmail) {
    // Only award once per file per session to prevent spam
    const viewKey = `viewed_${folder}_${diskFilename}`;
    if (!sessionStorage.getItem(viewKey)) {
        fetch('/api/view-resource', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ email: authEmail })
        }).then(() => {
            sessionStorage.setItem(viewKey, 'true');
        }).catch(err => console.error('Failed to award view points:', err));
    }
  }
  
  const diskExt = diskFilename.split('.').pop().toLowerCase();
  const displayExt = displayName.split('.').length > 1 ? displayName.split('.').pop().toLowerCase() : '';
  const ext = displayExt || diskExt;
  
  const isOffice = ['doc', 'docx', 'ppt', 'pptx', 'xls', 'xlsx', 'csv', 'txt', 'md', 'rtf', 'odt', 'ods', 'odp'].includes(ext);
  const isYt = ext === 'ytlink' || diskExt === 'ytlink';
  
  if (summaryOverlay) summaryOverlay.classList.add('hidden');

  // Reset state
  pdfIframe.src = '';
  pdfIframe.classList.remove('hidden');
  previewFallback.classList.add('hidden');
  previewFallback.innerHTML = '';
  
  modalFilename.textContent = displayName.replace('.ytlink', '');
  modalDownload.href = url;
  modalDownload.download = displayName;

  let isNative = false;

  // Format Determination
  modalIcon.innerHTML = getFileIconHtml(displayName, 24, isYt ? 'link' : 'file', diskFilename);

  if (['jpg', 'jpeg', 'png', 'gif', 'svg', 'webp'].includes(ext)) {
    isNative = true;
  } else if (['mp4', 'webm', 'ogg', 'mov'].includes(ext)) {
    isNative = true;
  } else if (['mp3', 'wav', 'm4a', 'aac'].includes(ext)) {
    isNative = true;
  } else if (['pdf', 'txt', 'html', 'htm'].includes(ext)) {
    isNative = true;
  }

  const isLocal = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1';
  
  const imgExts = ['jpg', 'jpeg', 'png', 'gif', 'svg', 'webp'];
  
  previewFallback.style.background = '';

  if (ext === 'ytlink') {
    pdfIframe.classList.add('hidden');
    previewFallback.classList.remove('hidden');
    previewFallback.innerHTML = '<div style="display:flex; align-items:center; justify-content:center; height:100%; color:var(--text-muted);">Loading video...</div>';
    
    fetch(url)
      .then(r => r.json())
      .then(data => {
        let embedUrl = data.url;
        if (embedUrl.includes('youtube.com/watch?v=')) {
          embedUrl = embedUrl.replace('watch?v=', 'embed/');
        } else if (embedUrl.includes('youtu.be/')) {
          embedUrl = embedUrl.replace('youtu.be/', 'youtube.com/embed/');
        }
        previewFallback.innerHTML = `
          <iframe width="100%" height="100%" src="${embedUrl}" 
            frameborder="0" allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture" 
            allowfullscreen></iframe>
        `;
      })
      .catch(err => {
    console.error('Failed to load document content:', err);
    pdfIframe.classList.add('hidden');
    previewFallback.classList.remove('hidden');
    previewFallback.innerHTML = `
      <div style="padding: 40px; text-align: center; color: var(--text-muted);">
        <div style="font-size: 48px; margin-bottom: 20px;">📂</div>
        <h3 style="color: #fff; margin-bottom: 10px;">Document Unavailable</h3>
        <p style="max-width: 300px; margin: 0 auto 20px;">This file was uploaded by another user and is not currently available in the cloud storage.</p>
        <div style="font-size: 12px; opacity: 0.6; background: rgba(0,0,0,0.3); padding: 10px; border-radius: 8px;">
          Error Code: 404_NOT_FOUND_IN_CLOUD
        </div>
      </div>
    `;
  });
    return;
  }

  if (imgExts.includes(ext)) {
    pdfIframe.classList.add('hidden');
    previewFallback.classList.remove('hidden');
    previewFallback.style.background = '#111';
    previewFallback.innerHTML = `
      <div style="position:relative; width:100%; height:100%; display:flex; flex-direction:column; background:#111;" id="img-viewer-container">
        <div style="position:absolute; bottom:24px; left:50%; transform:translateX(-50%); z-index:10; background:rgba(0,0,0,0.7); padding:8px 16px; border-radius:30px; display:flex; gap:16px; align-items:center; backdrop-filter:blur(8px); box-shadow:0 10px 25px rgba(0,0,0,0.5); border:1px solid rgba(255,255,255,0.1);">
          <button id="img-zoom-out" style="background:rgba(255,255,255,0.1); color:#fff; border:none; width:36px; height:36px; border-radius:50%; cursor:pointer; font-size:20px; display:flex; align-items:center; justify-content:center; transition:background 0.2s;">−</button>
          <span id="img-zoom-txt" style="color:#fff; font-size:14px; font-weight:700; min-width:54px; text-align:center; font-family:monospace;">100%</span>
        <div id="img-scroll-box" style="flex:1; overflow:auto; position:relative; display:flex; align-items:center; justify-content:center;">
          <img id="viewed-image" src="${url}" style="max-height:100%; max-width:100%; object-fit:contain; transition: width 0.15s ease-out;" alt="${displayName}">
        </div>
      </div>
    `;

    setTimeout(() => {
      let currentZoom = 100;
      let baseWidth = 0;
      const img = document.getElementById('viewed-image');
      const box = document.getElementById('img-scroll-box');
      const txt = document.getElementById('img-zoom-txt');
      
      const getBaseWidth = () => {
         if (baseWidth === 0 && img.clientWidth > 0) baseWidth = img.clientWidth;
         return baseWidth || box.clientWidth;
      };

      const updateZoom = (newZoom) => {
        currentZoom = Math.min(Math.max(newZoom, 25), 500); 
        txt.textContent = currentZoom + '%';
        
        if (currentZoom === 100) {
          img.style.maxHeight = '100%';
          img.style.maxWidth = '100%';
          img.style.height = 'auto';
          img.style.width = 'auto';
          baseWidth = 0; 
          box.style.display = 'flex';
        } else {
          const bw = getBaseWidth();
          img.style.maxHeight = 'none';
          img.style.maxWidth = 'none';
          img.style.width = (bw * (currentZoom / 100)) + 'px';
          img.style.height = 'auto';
          box.style.display = 'block';
          img.style.margin = 'auto'; 
        }
      };

      document.getElementById('img-zoom-in')?.addEventListener('click', () => updateZoom(currentZoom + 25));
      document.getElementById('img-zoom-out')?.addEventListener('click', () => updateZoom(currentZoom - 25));
      document.getElementById('img-zoom-reset')?.addEventListener('click', () => updateZoom(100));

      box.addEventListener('wheel', (e) => {
        if (e.ctrlKey || e.metaKey) {
          e.preventDefault();
          updateZoom(currentZoom + (e.deltaY < 0 ? 15 : -15));
        }
      }, { passive: false });
    }, 50);

  } else if (isNative) {
    // Native browser support
    pdfIframe.src = url;
    pdfIframe.onerror = () => {
      pdfIframe.classList.add('hidden');
      previewFallback.classList.remove('hidden');
      previewFallback.innerHTML = `<div style="padding:40px;text-align:center;"><h3>Failed to load preview</h3><p>This file might be too large or not supported for direct viewing.</p></div>`;
    };
  } else if (isOffice) {
    // Attempt local rendering first for high-end "details" feel
    const iconHtml = getFileIconHtml(displayName, 24, isYt ? 'link' : 'file', diskFilename);
    renderLocalDoc(url, displayName, ext, iconHtml);
  } else {
    // Show Vibrant Fallback Card for others (zip, etc)
    const iconHtml = getFileIconHtml(displayName, 24, isYt ? 'link' : 'file', diskFilename);
    showFallbackCard(url, displayName, iconHtml);
  }

  // Show Modal
  pdfModal.classList.remove('hidden');
  document.body.style.overflow = 'hidden';
}

// ─── Local Document Rendering ──────────────────────────────────────────────────
async function renderLocalDoc(url, filename, ext, icon) {
  // Show Loading state
  pdfIframe.classList.add('hidden');
  previewFallback.classList.remove('hidden');
  previewFallback.innerHTML = `
    <div class="fallback-card">
      <div class="fallback-icon animate-pulse">${icon}</div>
      <div class="fallback-info">
        <h3>Preparing View...</h3>
        <p>Gantec is processing your document details for a local preview.</p>
      </div>
    </div>
  `;

  try {
    const response = await fetch(url);
    if (!response.ok) throw new Error('File fetch failed');
    const arrayBuffer = await response.arrayBuffer();

    if (ext === 'docx') {
      const result = await mammoth.convertToHtml({ arrayBuffer: arrayBuffer });
      previewFallback.innerHTML = `
        <div class="local-viewer-container" style="padding: 40px; text-align: left; background: #fff; width: 100%; height: 100%; overflow-y: auto;">
          <div class="local-viewer-paper" style="max-width: 800px; margin: 0 auto; box-shadow: 0 0 20px rgba(0,0,0,0.05); padding: 60px; line-height: 1.6; color: #333;">
            ${result.value}
          </div>
        </div>
      `;
    } else if (ext === 'csv' || ext === 'txt') {
      const decoder = new TextDecoder('utf-8');
      const text = decoder.decode(arrayBuffer);
      
      if (ext === 'csv') {
        const rows = text.split('\n').map(row => row.split(','));
        let tableHtml = '<table style="width:100%; border-collapse: collapse; background:white; font-family: sans-serif; font-size: 0.9rem;">';
        rows.forEach((row, i) => {
          tableHtml += '<tr>';
          row.forEach(cell => {
            tableHtml += `<td style="border: 1px solid #e2e8f0; padding: 12px; ${i === 0 ? 'background:#f8fafc; font-weight:bold;' : ''}">${escapeHTML(cell)}</td>`;
          });
          tableHtml += '</tr>';
        });
        tableHtml += '</table>';
        
        previewFallback.innerHTML = `
          <div style="padding: 20px; height: 100%; overflow: auto; background: #f1f5f9;">
            <div style="background:white; border-radius:12px; box-shadow:0 4px 15px rgba(0,0,0,0.05); overflow:hidden;">
              ${tableHtml}
            </div>
          </div>
        `;
      } else {
        previewFallback.innerHTML = `
          <div style="padding: 40px; height: 100%; overflow: auto; background: #fff;">
            <pre style="white-space: pre-wrap; font-family: monospace; font-size: 0.95rem; line-height: 1.5; color: #334155;">${escapeHTML(text)}</pre>
          </div>
        `;
      }
    } else if (ext === 'pptx') {
      await renderLocalPPTX(arrayBuffer, filename, icon);
    } else {
      // Fallback for xlsx etc on localhost
      const isLocal = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1';
      if (isLocal) {
        previewFallback.innerHTML = `
          <div class="fallback-card">
            <div class="fallback-icon">${icon}</div>
            <div class="fallback-info">
              <h3>${escapeHTML(filename)}</h3>
              <div class="localhost-alert">
                <div class="alert-icon">📄</div>
                <div class="alert-title">Preview Details Mode</div>
                <div class="alert-msg">
                  Localhost restricts online viewing for <b>${ext.toUpperCase()}</b> files. 
                  Please use the button below to view all document details in your local app.
                </div>
              </div>
            </div>
            <a href="${url}" download="${escapeHTML(filename)}" class="btn-open-local">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" style="width: 20px; height: 20px;">
                <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/>
                <polyline points="7 10 12 15 17 10"/>
                <line x1="12" y1="15" x2="12" y2="3"/>
              </svg>
              View Document Details
            </a>
          </div>
        `;
      } else {
        // Online: use real Google Viewer
        pdfIframe.classList.remove('hidden');
        previewFallback.classList.add('hidden');
        const absoluteUrl = new URL(url, window.location.href).href;
        pdfIframe.src = `https://docs.google.com/viewer?url=${encodeURIComponent(absoluteUrl)}&embedded=true`;
      }
    }
  } catch (err) {
    showFallbackCard(url, filename, icon, `Error loading document details: ${err.message}`);
  }
}

async function renderLocalPPTX(arrayBuffer, filename, icon) {
  const zip = await JSZip.loadAsync(arrayBuffer);
  const slideFiles = Object.keys(zip.files)
    .filter(path => path.startsWith('ppt/slides/slide') && path.endsWith('.xml'))
    .sort((a, b) => {
      const na = parseInt(a.match(/slide(\d+)\.xml/)[1]);
      const nb = parseInt(b.match(/slide(\d+)\.xml/)[1]);
      return na - nb;
    });

  const slidesHtml = [];

  for (let i = 0; i < slideFiles.length; i++) {
    const slideXml = await zip.file(slideFiles[i]).async('string');
    const parser = new DOMParser();
    const xmlDoc = parser.parseFromString(slideXml, "text/xml");
    
    // Extract text from <a:t> tags
    const textNodes = xmlDoc.getElementsByTagName("a:t");
    const texts = Array.from(textNodes).map(node => node.textContent).filter(t => t.trim().length > 0);
    
    if (texts.length > 0) {
      const title = texts[0];
      const body = texts.slice(1).join(' ');
      slidesHtml.push(`
        <div class="slide-card">
          <div class="slide-number">Slide ${i + 1}</div>
          <div class="slide-title">${escapeHTML(title)}</div>
          <div class="slide-body">
            <p>${escapeHTML(body)}</p>
          </div>
        </div>
      `);
    } else {
      slidesHtml.push(`
        <div class="slide-card">
          <div class="slide-number">Slide ${i + 1}</div>
          <div class="slide-placeholder">Image or graphic-only slide. Open locally to see full visual details.</div>
        </div>
      `);
    }
  }

  previewFallback.innerHTML = `
    <div class="presentation-filmstrip">
      <div style="max-width:900px; margin:0 auto; width:100%; padding-bottom: 20px; display:flex; align-items:center; justify-content:space-between;">
        <h2 style="margin:0; font-weight:800; color:var(--text-primary);">Slide Review: ${escapeHTML(filename)}</h2>
        <span style="background:var(--primary-glow); color:var(--primary); padding: 5px 15px; border-radius: 20px; font-weight:700; font-size:0.8rem;">
          ${slideFiles.length} Slides Processed
        </span>
      </div>
      ${slidesHtml.join('')}
    </div>
  `;
}

function showFallbackCard(url, filename, icon, customMsg) {
  pdfIframe.classList.add('hidden');
  previewFallback.classList.remove('hidden');
  previewFallback.innerHTML = `
    <div class="fallback-card">
      <div class="fallback-icon">${icon}</div>
      <div class="fallback-info">
        <h3>${escapeHTML(filename)}</h3>
        <p>${customMsg || 'This file format cannot be previewed natively in the browser.'}<br>Please download it to view all details locally.</p>
      </div>
      <a href="${url}" download="${escapeHTML(filename)}" class="btn-open-local">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" style="width: 20px; height: 20px;">
          <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/>
          <polyline points="7 10 12 15 17 10"/>
          <line x1="12" y1="15" x2="12" y2="3"/>
        </svg>
        Download to View
      </a>
    </div>
  `;
}



function closePdf() {
  pdfModal.classList.add('hidden');
  pdfIframe.src = '';
  document.body.style.overflow = '';
}

modalClose.addEventListener('click', closePdf);
pdfModal.addEventListener('click', (e) => {
  if (e.target === pdfModal) closePdf();
});
document.addEventListener('keydown', (e) => {
  if (e.key === 'Escape') closePdf();
});

// ─── Delete ───────────────────────────────────────────────────────────────────
let deleteCallback = null;

function confirmDelete(folder, diskFilename, uploaderEmail, displayName, isUserDoc = false) {
  const currentUserEmail = (localStorage.getItem('gantec_user_email') || '').toLowerCase();
  const currentUserRole = localStorage.getItem('gantec_user_role') || 'employee';
  const ownerEmail = (uploaderEmail || '').toLowerCase();

  console.log('Checking ownership:', { ownerEmail, currentUserEmail, currentUserRole });

  if (currentUserRole !== 'admin' && (!ownerEmail || ownerEmail !== currentUserEmail)) {
    showToast('Access Denied – You do not have permission to delete this resource.', 'error');
    return;
  }

  deleteConfirmMsg.textContent = `Are you sure you want to delete "${displayName || diskFilename}"?`;
  deleteCallback = () => performDelete(folder, diskFilename, isUserDoc, displayName);
  deleteConfirmModal.classList.add('active');
}

deleteConfirmOkBtn.addEventListener('click', () => {
  if (deleteCallback) deleteCallback();
  closeDeleteConfirmModal();
});

deleteConfirmCancelBtn.addEventListener('click', () => {
  closeDeleteConfirmModal();
});

function closeDeleteConfirmModal() {
  deleteConfirmModal.classList.remove('active');
  deleteCallback = null;
}

// Close on backdrop click
deleteConfirmModal.addEventListener('click', (e) => {
  if (e.target === deleteConfirmModal) closeDeleteConfirmModal();
});

async function performDelete(folder, filename, isUserDoc = false, displayName = '') {
  try {
    await deleteFile(folder, filename, isUserDoc);
    showToast(`"${displayName || filename}" deleted`, 'success');
    await loadFolders();
  } catch (err) {
    showToast(err.message, 'error');
  }
}

function confirmDeleteFolder(folderPath) {
  deleteConfirmMsg.textContent = `Are you sure? This will delete the entire "${folderPath}" folder and all its contents forever.`;
  deleteCallback = () => performDeleteFolder(folderPath);
  deleteConfirmModal.classList.add('active');
}

async function performDeleteFolder(folderPath) {
  try {
    const authEmail = localStorage.getItem('gantec_user_email');
    const res = await fetch('/api/delete-folder', {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ 
        folder: folderPath,
        email: authEmail
      })
    });
    const data = await res.json();
    if (data.error) throw new Error(data.error);

    showToast(`Folder "${folderPath}" deleted`, 'success');
    if (activeFolder.startsWith(folderPath)) {
      activeFolder = '__all__';
    }
    await loadFolders();
  } catch (err) {
    showToast(err.message, 'error');
  }
}

// ─── Inline Renaming ──────────────────────────────────────────────────────────
async function makeEditable(el, type, oldName, folder = '') {
  const originalText = el.textContent;
  const input = document.createElement('input');
  input.type = 'text';
  input.value = originalText;
  input.className = 'rename-input-inline';
  
  el.replaceWith(input);
  input.focus();

  // If file, select only the name part (exclude extension)
  if (type === 'file') {
    const lastDot = originalText.lastIndexOf('.');
    if (lastDot > 0) {
      input.setSelectionRange(0, lastDot);
    } else {
      input.select();
    }
  } else {
    input.select();
  }

  let finished = false;

  const save = async () => {
    if (finished) return;
    finished = true;
    const newName = input.value.trim();

    if (!newName || newName === originalText) {
      input.replaceWith(el);
      return;
    }

    try {
      const endpoint = type === 'file' ? '/api/rename-file' : '/api/rename-folder';
      const body = type === 'file' 
        ? { folder, oldName, newName }
        : { oldPath: oldName, newName };

      const res = await fetch(endpoint, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body)
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Rename failed');

      showToast(`${type.charAt(0).toUpperCase() + type.slice(1)} renamed successfully`, 'success');
      
      // Update local state if it's a folder we are in
      if (type === 'folder' && activeFolder.startsWith(oldName)) {
        activeFolder = data.newPath;
      }
      
      await loadFolders();
    } catch (err) {
      showToast(err.message, 'error');
      input.replaceWith(el);
    }
  };

  const cancel = () => {
    if (finished) return;
    finished = true;
    input.replaceWith(el);
  };

  input.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') save();
    if (e.key === 'Escape') cancel();
  });

  input.addEventListener('blur', save);
}

// ─── Init ─────────────────────────────────────────────────────────────────────
// (Sidebar toggle is now handled globally in app.js)
function initViewer() {
  loadFolders();
  // Refresh UI every 30s
  setInterval(loadFolders, 30000);
}

document.addEventListener('DOMContentLoaded', () => {
  initViewer();
  
  modalClose?.addEventListener('click', () => {
    pdfModal.classList.add('hidden');
    if (summaryOverlay) summaryOverlay.classList.add('hidden');
    document.body.style.overflow = '';
  });

  closeSummaryBtn?.addEventListener('click', () => {
    summaryOverlay.classList.add('hidden');
  });

  summarizeBtn?.addEventListener('click', () => {
    const folder = window.currentOpenFolder;
    const file = window.currentOpenFile;
    const name = window.currentOpenDisplayName;
    
    if (!folder || !file) {
      console.error('❌ Cannot summarize: Missing file info', { folder, file });
      showToast('Error: Document info missing. Please close and re-open.', 'error');
      return;
    }
    
    console.log('🚀 Summarize clicked for:', { folder, file, name });
    summarizeDocument(folder, file, name);
  });
  
  modalDownload?.addEventListener('click', (e) => {
    console.log('💾 Download clicked:', modalDownload.href);
  });
});

// ─── Upload Logic ─────────────────────────────────────────────────────────────
function triggerFilePick() { if (fileInput) fileInput.click(); }

document.getElementById('empty-upload-btn')?.addEventListener('click', triggerFilePick);
fileInput?.addEventListener('change', () => { if (fileInput.files.length > 0) handleFileSelect(fileInput.files[0]); });

function handleFileSelect(file) {
  selectedFile = file;
  openConfirmModal(file);
}

function openConfirmModal(file) {
  confirmOrigName.textContent = file.name;
  confirmFileMeta.textContent = formatSize(file.size);
  const dotIdx = file.name.lastIndexOf('.');
  renameInput.value = dotIdx > -1 ? file.name.substring(0, dotIdx) : file.name;
  confirmExt.textContent = dotIdx > -1 ? file.name.substring(dotIdx) : '';
  
  modalFolder = (activeFolder && activeFolder !== '__all__') ? activeFolder : 'General';
  
  populateModalFolders();
  confirmProgressWrap.classList.add('hidden');
  confirmProgressFill.style.width = '0%';
  confirmProgressText.textContent = 'Uploading…';
  confirmOverlay.classList.remove('hidden');
  document.body.style.overflow = 'hidden';
  setTimeout(() => renameInput.focus(), 80);
}

function closeConfirmModal() {
  confirmOverlay.classList.add('hidden');
  document.body.style.overflow = '';
  selectedFile = null;
  fileInput.value = '';
}

confirmCloseBtn?.addEventListener('click', closeConfirmModal);
confirmCancelBtn?.addEventListener('click', closeConfirmModal);

function populateModalFolders() {
  confirmFolderList.innerHTML = '';
  const tree = buildTree(allFolders);
  
  const renderModalTree = (node, container, level = 0) => {
    Object.values(node.children).forEach(child => {
      const btn = document.createElement('div');
      btn.className = 'modal-folder-pick';
      if (modalFolder === child.fullPath) btn.classList.add('selected');
      btn.style.paddingLeft = `${level * 16 + 12}px`;
      btn.innerHTML = `<span>📁 ${child.name}</span>`;
      btn.addEventListener('click', () => {
        modalFolder = child.fullPath;
        confirmFolderList.querySelectorAll('.modal-folder-pick').forEach(b => b.classList.remove('selected'));
        btn.classList.add('selected');
      });
      container.appendChild(btn);
      renderModalTree(child, container, level + 1);
    });
  };

  renderModalTree(tree, confirmFolderList);
}

confirmUploadBtn?.addEventListener('click', async () => {
  if (!selectedFile || !modalFolder) return;

  const targetFolder = modalFolder;
  let customName = renameInput.value.trim();
  const ext = confirmExt.textContent;
  if (!customName) {
    const d = selectedFile.name.lastIndexOf('.');
    customName = d > -1 ? selectedFile.name.substring(0, d) : selectedFile.name;
  }
  customName = customName.replace(/[^a-zA-Z0-9_\-\. ]/g, '_');
  if (!customName.endsWith(ext)) customName += ext;

  confirmUploadBtn.disabled = true;
  confirmCancelBtn.disabled = true;
  confirmProgressWrap.classList.remove('hidden');

  const formData = new FormData();
  formData.append('folder', targetFolder);
  formData.append('file', selectedFile, customName);
  
  const authEmail = localStorage.getItem('gantec_user_email');
  if (authEmail) {
    formData.append('email', authEmail);
  }

  try {
    const xhr = new XMLHttpRequest();
    xhr.open('POST', '/api/upload', true);
    xhr.upload.onprogress = (e) => {
      if (e.lengthComputable) {
        const pct = Math.round((e.loaded / e.total) * 100);
        confirmProgressFill.style.width = `${pct}%`;
        confirmProgressText.textContent = `Uploading… ${pct}%`;
      }
    };

    xhr.onload = async () => {
      if (xhr.status === 200) {
        showToast(`Resource "${customName}" uploaded`, 'success');
        setTimeout(() => {
          closeConfirmModal();
          confirmUploadBtn.disabled = false;
          confirmCancelBtn.disabled = false;
          loadFolders();
        }, 600);
      } else {
        const err = JSON.parse(xhr.responseText);
        showToast(err.error || 'Upload failed', 'error');
        confirmUploadBtn.disabled = false;
        confirmCancelBtn.disabled = false;
      }
    };
    xhr.send(formData);
  } catch (err) {
    showToast(err.message, 'error');
    confirmUploadBtn.disabled = false;
    confirmCancelBtn.disabled = false;
  }
});

// ─── Folder Creation ──────────────────────────────────────────────────────────
const createFolderBtn = document.getElementById('create-folder-btn');
const newFolderInput = document.getElementById('new-folder-input');
if (createFolderBtn) {
  createFolderBtn.addEventListener('click', async () => {
    const name = newFolderInput ? newFolderInput.value.trim() : '';
    if (!name) return;
    try {
      const res = await fetch('/api/folders', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      if (newFolderInput) newFolderInput.value = '';
      showToast(`Folder "${name}" created`, 'success');
      await loadFolders();
    } catch (err) {
      showToast(err.message, 'error');
    }
  });
}

// ─── Init ─────────────────────────────────────────────────────────────────────
document.addEventListener('DOMContentLoaded', () => {
  loadFolders();

  const mainUploadCard = document.getElementById('main-upload-card');
  if (mainUploadCard) {
    mainUploadCard.addEventListener('click', () => {
      window.location.href = 'uploader.html';
    });
  }

  // Create button redirect to uploader.html
  const createBtn = document.getElementById('create-folder-btn');
  if (createBtn) {
    createBtn.addEventListener('click', () => {
      window.location.href = 'uploader.html';
    });
  }
});

// Refresh every 30s in case files are uploaded from another tab
setInterval(loadFolders, 30000);
async function summarizeDocument(folder, filename, originalName) {
  // Expose to window for the 'Try Again' onclick handler
  window.summarizeDocument = summarizeDocument;
  
  const originalBtnContent = summarizeBtn.innerHTML;
  summarizeBtn.disabled = true;
  summarizeBtn.innerHTML = `
    <svg class="animate-spin" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" style="width: 18px; height: 18px;">
      <path d="M21 12a9 9 0 1 1-6.219-8.56" />
    </svg>
    Analyzing...
  `;
  
  console.log('Starting summarize for:', folder, filename, originalName);
  summaryContent.innerHTML = `
    <div style="display: flex; flex-direction: column; align-items: center; justify-content: center; padding: 60px; text-align: center;">
      <div class="animate-pulse" style="font-size: 3.5rem; margin-bottom: 24px; filter: drop-shadow(0 0 15px rgba(59,130,246,0.3));">🧠</div>
      <h3 style="margin: 0; color: var(--primary); font-size: 1.5rem; font-weight: 800;">Gantec AI is Thinking...</h3>
      <p style="color: var(--text-muted); font-size: 1.05rem; margin-top: 12px;">Reading and condensing the key insights for you. This usually takes a few seconds.</p>
      <div style="margin-top: 32px; width: 240px; height: 6px; background: #f1f5f9; border-radius: 10px; overflow: hidden;">
        <div class="loading-bar-progress" style="height: 100%; background: var(--accent); width: 0%; border-radius: 10px;"></div>
      </div>
    </div>
  `;
  
  // Animate the tiny loading bar
  setTimeout(() => {
    const bar = document.querySelector('.loading-bar-progress');
    if (bar) bar.style.transition = 'width 10s cubic-bezier(0.1, 0, 0.2, 1)';
    if (bar) bar.style.width = '90%';
  }, 100);

  summaryOverlay.classList.remove('hidden');

  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 25000); // 25s timeout

    const res = await fetch('/api/summarize', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ folder, filename, originalName }),
      signal: controller.signal
    });
    clearTimeout(timeoutId);
    
    console.log('Summarize fetch response status:', res.status);
    const data = await res.json();
    console.log('Summarize data:', data);

    if (!res.ok) throw new Error(data.error || 'Failed to summarize');
    if (!data.summary) throw new Error('AI returned an empty summary. This usually happens with empty or non-text files.');

    console.log('✅ Summary received, rendering...');
    // Format the summary with better typography
    summaryContent.innerHTML = data.summary
      .split('\n')
      .map(line => {
        line = line.trim();
        if (!line) return '<br>';
        
        // Handle Headers
        if (line.startsWith('###')) {
          return `<h3 style="color: var(--primary); margin: 24px 0 12px 0; font-size: 1.25rem; font-weight: 700;">${line.replace(/^###\s*/, '')}</h3>`;
        }
        
        // Handle Bullet Points
        if (line.startsWith('*') || line.startsWith('-')) {
          let content = line.replace(/^[* -]+\s*/, '');
          // Handle Bold in bullets
          content = content.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>');
          return `<li style="margin-bottom: 12px; padding-left: 8px;">${content}</li>`;
        }
        
        // Handle Bold in paragraphs
        let content = line.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>');
        return `<p style="margin-bottom: 16px;">${content}</p>`;
      })
      .join('');
      
    // Wrap lists in <ul>
    summaryContent.innerHTML = summaryContent.innerHTML.replace(/(<li>.*?<\/li>)+/g, match => `<ul style="margin-bottom: 24px; padding-left: 20px; list-style-type: disc;">${match}</ul>`);

  } catch (err) {
    console.error('Summarization error:', err);
    summaryContent.innerHTML = `
      <div style="background: #fef2f2; border: 1px solid #fee2e2; padding: 32px; border-radius: 20px; color: #991b1b; max-width: 600px; margin: 40px auto; text-align: center;">
        <div style="font-size: 3rem; margin-bottom: 20px;">❌</div>
        <h3 style="margin-top: 0; font-weight: 800; font-size: 1.25rem;">Summarization Failed</h3>
        <p style="margin: 12px 0 24px; line-height: 1.6;">${err.message}</p>
        <button onclick="summarizeDocument('${folder}', '${filename}', '${originalName}')" style="background: #ef4444; color: white; border: none; padding: 12px 24px; border-radius: 12px; cursor: pointer; font-weight: 700; box-shadow: 0 4px 12px rgba(239, 68, 68, 0.3);">Try Again</button>
      </div>
    `;
  } finally {
    summarizeBtn.disabled = false;
    summarizeBtn.innerHTML = originalBtnContent;
  }
}
