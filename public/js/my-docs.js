/**
 * my-docs.js – Personal Document Vault (per-user, DB-backed, hashed filenames)
 */

const userEmail = localStorage.getItem('gantec_user_email');
if (!userEmail) { window.location.href = 'login.html'; }

// ─── State ───────────────────────────────────────────────────────────────────
let allFolders = [];
let activeFolder = '__all__';
let isGridView = true;
let searchQuery = '';
let expandedFolders = new Set();
let selectedFolder = null;
let selectedFile = null;
let modalFolder = null;

/**
 * Resets the dashboard to its initial landing state
 */
function resetDashboard() {
  activeFolder = '__all__';
  searchQuery = '';
  selectedFolder = null;
  selectedFile = null;
  if (searchInput) searchInput.value = '';

  // Reset sidebar active states
  document.querySelectorAll('.sidebar-item').forEach(el => el.classList.remove('active', 'open'));
  document.getElementById('folder-all')?.classList.add('active');

  // Re-render
  renderSidebar();
  renderDocs();

  // Close any open modals
  pdfModal?.classList.remove('active');
  confirmOverlay?.classList.add('hidden');
  deleteConfirmModal?.classList.remove('active');

  console.log('Dashboard reset to default state');
}

// Sidebar Link Navigation Logic
document.addEventListener('DOMContentLoaded', () => {
  const sidebarLinks = document.querySelectorAll('.sidebar-link');
  
  sidebarLinks.forEach(link => {
    // Only handle Document Locker specific behavior here
    // Transitions and toggling are handled globally in app.js
    if (link.textContent.trim().includes('Document Locker')) {
      link.addEventListener('click', (e) => {
        if (window.location.pathname.endsWith('document-locker.html')) {
          // Reset dashboard state when clicking Document Locker while already active
          resetDashboard();
        }
      });
    }
  });
});

// ─── DOM ─────────────────────────────────────────────────────────────────────
const sidebar = document.getElementById('sidebar');
const sidebarFolders = document.getElementById('sidebar-folders');
const folderAll = document.getElementById('folder-all');
const countAll = document.getElementById('count-all');
const docsGrid = document.getElementById('docs-grid');
const emptyState = document.getElementById('empty-state');
const viewerHeading = document.getElementById('viewer-heading');
const docCountBadge = document.getElementById('doc-count-badge');
const searchInput = document.getElementById('search-input');
const gridBtn = document.getElementById('grid-btn');
const listBtn = document.getElementById('list-btn');
const vaultFolderTree = document.getElementById('vault-folder-tree');

// Upload triggers
const fileInput = document.getElementById('file-input');
const newFolderInput = document.getElementById('new-folder-input') || document.getElementById('new-folder-input-top');
const createFolderBtn = document.getElementById('create-folder-btn') || document.getElementById('create-folder-btn-top');
const createSubBtn = document.getElementById('create-subfolder-btn');
const mainUploadCard = document.getElementById('main-upload-card');

// Viewer Modal
const pdfModal = document.getElementById('pdf-modal');
const pdfIframe = document.getElementById('pdf-iframe');
const modalFilename = document.getElementById('modal-filename');
const modalIcon = document.getElementById('modal-icon');
const modalDownload = document.getElementById('modal-download');
const previewFallback = document.getElementById('preview-fallback');
const modalClose = document.getElementById('modal-close');

// Confirm Upload Modal
const confirmOverlay = document.getElementById('confirm-overlay');
const confirmOrigName = document.getElementById('confirm-orig-name');
const confirmFileMeta = document.getElementById('confirm-file-meta');
const renameInput = document.getElementById('rename-input');
const confirmFolderList = document.getElementById('confirm-folder-list');
const confirmNewFolderInput = document.getElementById('confirm-new-folder-input');
const confirmCreateFolderBtn = document.getElementById('confirm-create-folder-btn');
const confirmCreateSubBtn = document.getElementById('confirm-create-subfolder-btn');
const confirmProgressWrap = document.getElementById('confirm-progress-wrap');
const confirmProgressFill = document.getElementById('confirm-progress-fill');
const confirmProgressText = document.getElementById('confirm-progress-text');
const confirmUploadBtn = document.getElementById('confirm-upload-btn');
const confirmCloseBtn = document.getElementById('confirm-close-btn');
const confirmCancelBtn = document.getElementById('confirm-cancel-btn');
const confirmExt = document.getElementById('confirm-ext');

// Delete modal
const deleteConfirmModal = document.getElementById('delete-confirm-modal');
const deleteConfirmOkBtn = document.getElementById('delete-confirm-ok-btn');
const deleteConfirmCancelBtn = document.getElementById('delete-confirm-cancel-btn');
const deleteConfirmMsg = document.getElementById('delete-confirm-msg');

// ─── API Helpers ──────────────────────────────────────────────────────────────
const API = '/api/my-documents';

async function apiFetch(path, opts = {}) {
  const res = await fetch(API + path, opts);
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || 'Request failed');
  return data;
}

function getMyFileUrl(folder, file) {
  return `${API}/file?email=${encodeURIComponent(userEmail)}&folder=${encodeURIComponent(folder)}&file=${encodeURIComponent(file)}`;
}

// ─── Load Data ────────────────────────────────────────────────────────────────
async function loadFolders() {
  try {
    const data = await apiFetch(`/folders?email=${userEmail}`);
    allFolders = data.folders;
    renderFoldersTree();
    renderDocs();
  } catch (err) {
    docsGrid.innerHTML = `<p style="color:var(--danger);padding:24px;">Could not load documents: ${escapeHTML(err.message)}</p>`;
  }
}

// ─── Tree Builder ────────────────────────────────────────────────────────────
function buildTree(folders) {
  const root = { children: {} };
  folders.forEach(f => {
    const parts = f.name.split('/');
    let cur = root;
    parts.forEach((part, i) => {
      if (!cur.children[part]) {
        cur.children[part] = { name: part, fullPath: parts.slice(0, i + 1).join('/'), files: [], children: {} };
      }
      cur = cur.children[part];
    });
    cur.files = f.files;
  });
  return root;
}

function renderFoldersTree() {
  if (!vaultFolderTree) return;
  vaultFolderTree.innerHTML = '';

  // "All Files" option
  const allItem = document.createElement('li');
  allItem.className = `vault-tree-item ${activeFolder === '__all__' ? 'active' : ''}`;
  allItem.innerHTML = `
    <div class="vault-tree-info">
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" class="vault-tree-icon"><rect x="2" y="3" width="20" height="14" rx="2" ry="2"/><line x1="8" y1="21" x2="16" y2="21"/><line x1="12" y1="17" x2="12" y2="21"/></svg>
      <span>All Private Files</span>
    </div>
  `;
  allItem.addEventListener('click', () => {
    activeFolder = '__all__';
    renderDocs();
    renderFoldersTree();
  });
  vaultFolderTree.appendChild(allItem);

  const tree = buildTree(allFolders);
  buildTreeSidebar(tree, vaultFolderTree);
}

function buildTreeSidebar(node, container, level = 0) {
  const children = Object.values(node.children);
  children.sort((a, b) => a.name.localeCompare(b.name));

  children.forEach(child => {
    const isExpanded = expandedFolders.has(child.fullPath);
    const hasItems = child.files.length > 0 || Object.keys(child.children).length > 0;

    const li = document.createElement('li');
    li.className = `vault-tree-item ${activeFolder === child.fullPath ? 'active' : ''}`;
    li.style.paddingLeft = `${level * 16 + 12}px`;

    // Folder icon based on expansion
    const folderIcon = isExpanded
      ? `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" class="vault-tree-icon"><path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"/><line x1="12" y1="11" x2="12" y2="17"/><line x1="9" y1="14" x2="15" y2="14"/></svg>`
      : `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" class="vault-tree-icon"><path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"/></svg>`;

    const chevron = hasItems
      ? `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" class="vault-tree-chevron" style="width:12px; height:12px; transition: transform 0.2s; transform: ${isExpanded ? 'rotate(90deg)' : 'rotate(0deg)'}; opacity: 0.5; cursor: pointer;"><polyline points="9 18 15 12 9 6"/></svg>`
      : `<div style="width:12px;"></div>`;

    li.innerHTML = `
      <div class="vault-tree-info">
        ${chevron}
        ${folderIcon}
        <span class="vault-tree-label">${escapeHTML(child.name)}</span>
      </div>
      <div class="vault-tree-actions">
        <button class="tree-delete-btn delete-folder" title="Delete Folder">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M3 6h18"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/><line x1="10" y1="11" x2="10" y2="17"/><line x1="14" y1="11" x2="14" y2="17"/></svg>
        </button>
      </div>
    `;

    let clickTimeout;

    li.addEventListener('click', (e) => {
      e.stopPropagation();
      if (e.target.closest('.tree-delete-btn')) return;
      if (e.target.closest('.rename-input-inline')) return;

      const isChevron = e.target.closest('.vault-tree-chevron');
      if (isChevron) {
        if (isExpanded) expandedFolders.delete(child.fullPath);
        else expandedFolders.add(child.fullPath);
        renderFoldersTree();
        return;
      }

      clearTimeout(clickTimeout);
      clickTimeout = setTimeout(() => {
        if (activeFolder !== child.fullPath) {
          activeFolder = child.fullPath;
          renderDocs();
          document.querySelectorAll('#vault-folder-tree .vault-tree-item').forEach(el => el.classList.remove('active'));
          li.classList.add('active');
        }
      }, 250);
    });

    const label = li.querySelector('.vault-tree-label');
    label.addEventListener('dblclick', e => {
      e.stopPropagation();
      clearTimeout(clickTimeout);
      makeEditable(label, 'folder', child.fullPath);
    });

    li.querySelector('.delete-folder').addEventListener('click', e => {
      e.stopPropagation();
      confirmDeleteFolder(child.fullPath);
    });

    container.appendChild(li);

    // Render children ONLY if expanded
    if (isExpanded) {
      // Sub-files
      child.files.forEach(file => {
        const fileLi = document.createElement('li');
        fileLi.className = 'vault-tree-item vault-tree-file';
        fileLi.style.paddingLeft = `${(level + 1) * 16 + 24}px`;
        const icon = getFileIcon(file.name);
        fileLi.innerHTML = `
          <div class="vault-tree-info">
            <span style="font-size: 13px; width: 14px; text-align:center;">${icon}</span>
            <span class="vault-tree-label" style="font-size: 0.8rem; opacity: 0.8;">${escapeHTML(file.name)}</span>
          </div>
          <div class="vault-tree-actions">
            <button class="tree-delete-btn delete-file" title="Delete File">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M3 6h18"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/><line x1="10" y1="11" x2="10" y2="17"/><line x1="14" y1="11" x2="14" y2="17"/></svg>
            </button>
          </div>
        `;
        let fileClickTimeout;
        const fileLabel = fileLi.querySelector('.vault-tree-label');
        
        fileLabel.addEventListener('dblclick', e => {
          e.stopPropagation();
          clearTimeout(fileClickTimeout);
          makeEditable(fileLabel, 'file', file.name, child.fullPath);
        });

        fileLi.addEventListener('click', e => {
          e.stopPropagation();
          if (e.target.closest('.tree-delete-btn')) return;
          if (e.target.closest('.rename-input-inline')) return;

          clearTimeout(fileClickTimeout);
          fileClickTimeout = setTimeout(() => {
            openFile(child.fullPath, file.name);
          }, 250);
        });
        
        fileLi.querySelector('.delete-file').addEventListener('click', e => {
          e.stopPropagation();
          confirmDelete(child.fullPath, file.name);
        });
        container.appendChild(fileLi);
      });

      // Recurse for nested folders
      if (Object.keys(child.children).length > 0) {
        buildTreeSidebar(child, container, level + 1);
      }
    }
  });
}

function buildTreeDOM(node, container, level = 0, isModal = false) {
  const children = Object.values(node.children);

  children.forEach(child => {
    const wrap = document.createElement('div');
    wrap.className = 'tree-node-wrap';

    const row = document.createElement('div');
    row.className = isModal ? 'modal-folder-pick' : 'sidebar-item';
    row.style.paddingLeft = `${level * 20 + 12}px`;

    // Check if this folder or any of its children are currently active
    if (!isModal && activeFolder === child.fullPath) row.classList.add('active');
    if (isModal && modalFolder === child.fullPath) row.classList.add('selected');
    row.dataset.folder = child.fullPath;

    const hasChildren = Object.keys(child.children).length > 0;
    const isExpanded = expandedFolders.has(child.fullPath);

    const chevron = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" class="tree-chevron ${isExpanded ? 'active' : ''}" style="transition:transform .2s;transform:${isExpanded ? 'rotate(90deg)' : 'rotate(0deg)'};opacity:${hasChildren ? '1' : '0.2'};pointer-events:${hasChildren ? 'auto' : 'none'};width:14px;height:14px;flex-shrink:0;"><polyline points="9 18 15 12 9 6"/></svg>`;

    row.innerHTML = `
      ${chevron}
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" class="icon-xs folder-icon" style="margin-right:8px; width:16px; height:16px;">
        <path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"/>
      </svg>
      <span class="tree-label-text" style="flex:1; overflow:hidden; text-overflow:ellipsis; white-space:nowrap;">${escapeHTML(child.name)}</span>
      <span class="${isModal ? 'modal-folder-count' : 'folder-count'}">${child.files.length}</span>
      ${!isModal ? `<button class="folder-delete-btn" title="Delete Folder" style="padding:4px; opacity:0.6;">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" style="width:12px; height:12px;">
          <path d="M3 6h18"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/>
        </svg>
      </button>` : ''}
    `;

    if (!isModal) {
      const label = row.querySelector('.tree-label-text');
      label.addEventListener('dblclick', e => {
        e.stopPropagation();
        makeEditable(label, 'folder', child.fullPath);
      });
    }

    const childrenDiv = document.createElement('div');
    childrenDiv.className = 'tree-children';
    childrenDiv.style.display = isExpanded ? 'block' : 'none';

    row.addEventListener('click', e => {
      if (!isModal && e.target.closest('.folder-delete-btn')) {
        e.stopPropagation();
        confirmDeleteFolder(child.fullPath);
        return;
      }
      // ONLY chevron toggles expand/collapse — folder click just navigates
      if (e.target.closest('.tree-chevron')) {
        e.stopPropagation();
        if (expandedFolders.has(child.fullPath)) {
          expandedFolders.delete(child.fullPath);
        } else {
          expandedFolders.add(child.fullPath);
        }
        if (isModal) {
          populateModalFolders();
        } else {
          renderSidebar();
        }
        return;
      }
      if (isModal) pickModalFolder(child.fullPath);
      else setActiveFolder(child.fullPath);
    });

    wrap.appendChild(row);
    wrap.appendChild(childrenDiv);
    container.appendChild(wrap);

    if (hasChildren) {
      buildTreeDOM(child, childrenDiv, level + 1, isModal);
    }
  });
}

// ─── Sidebar ─────────────────────────────────────────────────────────────────
function renderSidebar() {
  if (!sidebarFolders) return;
  sidebarFolders.innerHTML = '';

  if (!allFolders || allFolders.length === 0) {
    sidebarFolders.innerHTML = `
      <div style="padding: 20px 10px; text-align: center; border: 1px dashed var(--border); border-radius: 8px; margin: 10px;">
        <p style="color: var(--text-muted); font-size: 0.75rem; margin-bottom: 4px;">No folders found</p>
        <p style="color: var(--text-muted); font-size: 0.65rem;">Create a Main Folder below to begin.</p>
      </div>
    `;
    return;
  }

  const tree = buildTree(allFolders);
  buildTreeDOM(tree, sidebarFolders, 0, false);

  // Highlighting active folder
  if (activeFolder !== '__all__') {
    const activeEl = sidebarFolders.querySelector(`[data-folder="${activeFolder.replace(/"/g, '\\"')}"]`);
    if (activeEl) activeEl.classList.add('active');
  }

  const total = allFolders.reduce((s, f) => s + f.files.length, 0);
  if (countAll) countAll.textContent = total;
}

function setActiveFolder(name) {
  activeFolder = name;
  searchQuery = '';
  if (searchInput) searchInput.value = '';

  // Update sidebar active state
  document.querySelectorAll('.sidebar-item').forEach(el => el.classList.remove('active'));
  if (name === '__all__') {
    folderAll?.classList.add('active');
    if (createSubBtn) createSubBtn.disabled = true; // Cannot create subfolder in "All Documents"
  } else {
    folderAll?.classList.remove('active');
    if (sidebarFolders) {
      const item = sidebarFolders.querySelector(`[data-folder="${name.replace(/"/g, '\\"')}"]`);
      if (item) item.classList.add('active');
    }
    if (createSubBtn) createSubBtn.disabled = false; // Enable subfolder creation for specific folder
  }

  // Toggle hamburger icon visibility based on folder selection
  const sidebarHeader = document.querySelector('.sidebar-header');
  if (name !== '__all__') {
    sidebarHeader?.classList.add('folder-selected');
  } else {
    sidebarHeader?.classList.remove('folder-selected');
  }

  renderDocs();
}

folderAll?.addEventListener('click', (e) => {
  e.preventDefault();
  setActiveFolder('__all__');
});

// (Redundant listener removed, handled in DOMContentLoaded block above)

// ─── Create Folder (Sidebar) ──────────────────────────────────────────────────
async function createSidebarFolder(mode) {
  const rawName = newFolderInput ? newFolderInput.value.trim() : '';
  if (!rawName) { showToast('Enter a folder name', 'warning'); return; }
  let fullPath = rawName;
  if (mode === 'sub') {
    if (!activeFolder || activeFolder === '__all__') { showToast('Select a parent folder first', 'warning'); return; }
    fullPath = `${activeFolder}/${rawName}`;
  }

  if (allFolders.some(f => f.name.toLowerCase() === fullPath.toLowerCase())) {
    showToast('Choose any other folder name, the folder already exists', 'warning');
    return;
  }
  if (createFolderBtn) createFolderBtn.disabled = true;
  if (createSubBtn) createSubBtn.disabled = true;
  try {
    const result = await apiFetch('/folders', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: userEmail, name: fullPath })
    });
    if (newFolderInput) newFolderInput.value = '';
    await loadFolders();
    showToast(`Folder "${result.name}" created`, 'success');
    setActiveFolder(result.name);
  } catch (err) {
    showToast(err.message, 'error');
  } finally {
    if (createFolderBtn) createFolderBtn.disabled = false;
    if (createSubBtn) createSubBtn.disabled = false;
  }
}

createFolderBtn?.addEventListener('click', () => createSidebarFolder('main'));
createSubBtn?.addEventListener('click', () => createSidebarFolder('sub'));
newFolderInput?.addEventListener('keydown', e => { if (e.key === 'Enter') createSidebarFolder('main'); });

// ─── Rendering ────────────────────────────────────────────────────────────────
function getFilteredItems() {
  let files = [];
  const q = searchQuery.toLowerCase();
  if (q) {
    allFolders.forEach(folder => {
      const fm = folder.name.toLowerCase().includes(q);
      folder.files.forEach(file => {
        if (fm || file.name.toLowerCase().includes(q)) files.push({ ...file, folder: folder.name });
      });
    });
  } else if (activeFolder === '__all__') {
    allFolders.forEach(folder => folder.files.forEach(file => files.push({ ...file, folder: folder.name })));
  } else {
    const folder = allFolders.find(f => f.name === activeFolder);
    if (folder) files = folder.files.map(file => ({ ...file, folder: folder.name }));
  }
  return files;
}

function getFileIcon(name) {
  const ext = (name.split('.').pop() || '').toLowerCase();
  if (['jpg', 'jpeg', 'png', 'gif', 'svg', 'webp'].includes(ext)) return '🖼️';
  if (['mp4', 'webm', 'ogg', 'mov'].includes(ext)) return '🎬';
  if (ext === 'pdf') return '📕';
  if (['mp3', 'wav', 'm4a', 'flac', 'ogg'].includes(ext)) return '🎵';
  if (['doc', 'docx', 'rtf', 'txt', 'odt'].includes(ext)) return '📝';
  if (['xls', 'xlsx', 'csv', 'ods'].includes(ext)) return '📊';
  if (['ppt', 'pptx', 'key', 'odp'].includes(ext)) return '📽️';
  if (['zip', 'rar', '7z', 'tar', 'gz', 'iso'].includes(ext)) return '🗜️';
  if (['exe', 'msi', 'dmg', 'apk'].includes(ext)) return '⚙️';
  if (['js', 'py', 'java', 'html', 'css', 'json', 'sql'].includes(ext)) return '📁';
  return '📄';
}

function renderDocs() {
  const files = getFilteredItems();
  viewerHeading.textContent = activeFolder === '__all__' ? 'All My Documents' : activeFolder;
  docCountBadge.textContent = `${files.length} file${files.length !== 1 ? 's' : ''}${searchQuery ? ` · "${searchQuery}"` : ''}`;
  docsGrid.innerHTML = '';

  if (files.length === 0) {
    emptyState.style.opacity = '0.12';
  } else {
    emptyState.style.opacity = '0.05'; // Even more subtle when files exist
  }

  emptyState.classList.remove('hidden');
  docsGrid.className = isGridView ? 'docs-grid' : 'docs-grid list-view';
  files.forEach(doc => docsGrid.appendChild(isGridView ? buildGridCard(doc) : buildListCard(doc)));
}

function buildGridCard(doc) {
  const card = document.createElement('div');
  card.className = 'doc-card';
  const icon = getFileIcon(doc.name);
  card.innerHTML = `
    <div class="doc-thumb">${icon}</div>
    <div class="doc-info">
      <div class="doc-name" title="${escapeHTML(doc.name)}">${escapeHTML(doc.name)}</div>
      <div class="doc-meta">
        <span>${formatSize(doc.size)}</span>
        <span class="doc-folder-tag">${escapeHTML(doc.folder)}</span>
      </div>
    </div>
    <div class="doc-actions" style="opacity:1;display:flex;justify-content:flex-end;margin-top:8px;">
      <button class="doc-action-btn view-doc" title="View/Download">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>
      </button>
      <button class="doc-action-btn delete" title="Delete">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M3 6h18"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/><line x1="10" y1="11" x2="10" y2="17"/><line x1="14" y1="11" x2="14" y2="17"/></svg>
      </button>
    </div>
  `;
  card.querySelector('.view-doc').addEventListener('click', e => { e.stopPropagation(); openFile(doc.folder, doc.name); });
  card.querySelector('.delete').addEventListener('click', e => { e.stopPropagation(); confirmDelete(doc.folder, doc.name); });
  card.querySelector('.doc-name').addEventListener('dblclick', e => { e.stopPropagation(); makeEditable(card.querySelector('.doc-name'), 'file', doc.name, doc.folder); });
  return card;
}

function buildListCard(doc) {
  const card = document.createElement('div');
  card.className = 'doc-card list-card';
  const icon = getFileIcon(doc.name);
  card.innerHTML = `
    <div class="doc-thumb">${icon}</div>
    <div class="doc-info">
      <div class="doc-name" title="${escapeHTML(doc.name)}">${escapeHTML(doc.name)}</div>
      <div class="doc-meta">
        <span>${formatSize(doc.size)}</span> <span>·</span>
        <span>${formatDate(doc.uploadedAt)}</span>
        <span class="doc-folder-tag">${escapeHTML(doc.folder)}</span>
      </div>
    </div>
    <div class="doc-actions" style="opacity:1;">
      <button class="doc-action-btn view-doc" title="View/Download">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>
      </button>
      <button class="doc-action-btn delete" title="Delete">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M3 6h18"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/><line x1="10" y1="11" x2="10" y2="17"/><line x1="14" y1="11" x2="14" y2="17"/></svg>
      </button>
    </div>
  `;
  card.querySelector('.view-doc').addEventListener('click', e => { e.stopPropagation(); openFile(doc.folder, doc.name); });
  card.querySelector('.delete').addEventListener('click', e => { e.stopPropagation(); confirmDelete(doc.folder, doc.name); });
  card.querySelector('.doc-name').addEventListener('dblclick', e => { e.stopPropagation(); makeEditable(card.querySelector('.doc-name'), 'file', doc.name, doc.folder); });
  return card;
}

// ─── Search & View Toggle ──────────────────────────────────────────────────────
searchInput.addEventListener('input', () => { searchQuery = searchInput.value.trim(); renderDocs(); });
gridBtn.addEventListener('click', () => { isGridView = true; gridBtn.classList.add('active'); listBtn.classList.remove('active'); renderDocs(); });
listBtn.addEventListener('click', () => { isGridView = false; listBtn.classList.add('active'); gridBtn.classList.remove('active'); renderDocs(); });

// ─── File Viewer Modal ────────────────────────────────────────────────────────
function openFile(folder, filename) {
  const url = getMyFileUrl(folder, filename);
  
  // Award points for viewing
  const authEmail = localStorage.getItem('gantec_user_email');
  if (authEmail) {
    // Only award once per file per session
    const viewKey = `viewed_private_${folder}_${filename}`;
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

  const ext = filename.split('.').pop().toLowerCase();
  const icon = getFileIcon(filename);

  pdfIframe.src = '';
  pdfIframe.classList.remove('hidden');
  previewFallback.classList.add('hidden');
  previewFallback.innerHTML = '';
  modalFilename.textContent = filename;
  modalDownload.href = url;
  modalDownload.download = filename;
  modalIcon.textContent = icon;

  const imgExts = ['jpg', 'jpeg', 'png', 'gif', 'svg', 'webp'];
  const nativeExts = ['mp4', 'webm', 'ogg', 'mov', 'pdf', 'mp3', 'wav', 'm4a'];
  const officeExts = ['doc', 'docx', 'ppt', 'pptx', 'xls', 'xlsx'];

  previewFallback.style.background = '';

  if (imgExts.includes(ext)) {
    pdfIframe.classList.add('hidden');
    previewFallback.classList.remove('hidden');
    previewFallback.style.background = '#111';
    previewFallback.innerHTML = `
      <div style="position:relative; width:100%; height:100%; display:flex; flex-direction:column; background:#111;" id="img-viewer-container">
        <div style="position:absolute; bottom:24px; left:50%; transform:translateX(-50%); z-index:10; background:rgba(0,0,0,0.7); padding:8px 16px; border-radius:30px; display:flex; gap:16px; align-items:center; backdrop-filter:blur(8px); box-shadow:0 10px 25px rgba(0,0,0,0.5); border:1px solid rgba(255,255,255,0.1);">
          <button id="img-zoom-out" style="background:rgba(255,255,255,0.1); color:#fff; border:none; width:36px; height:36px; border-radius:50%; cursor:pointer; font-size:20px; display:flex; align-items:center; justify-content:center; transition:background 0.2s;">−</button>
          <span id="img-zoom-txt" style="color:#fff; font-size:14px; font-weight:700; min-width:54px; text-align:center; font-family:monospace;">100%</span>
          <button id="img-zoom-in" style="background:rgba(255,255,255,0.1); color:#fff; border:none; width:36px; height:36px; border-radius:50%; cursor:pointer; font-size:20px; display:flex; align-items:center; justify-content:center; transition:background 0.2s;">+</button>
          <div style="width:1px; height:20px; background:rgba(255,255,255,0.2);"></div>
          <button id="img-zoom-reset" style="background:transparent; color:#4ade80; border:none; cursor:pointer; font-size:14px; font-weight:700; text-transform:uppercase; letter-spacing:0.5px;">Reset</button>
        </div>
        <div id="img-scroll-box" style="flex:1; overflow:auto; position:relative; display:flex; align-items:center; justify-content:center;">
          <img id="viewed-image" src="${url}" style="max-height:100%; max-width:100%; object-fit:contain; transition: width 0.15s ease-out;" alt="${filename}">
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

  } else if (nativeExts.includes(ext)) {
    // Browser natively handles these — show in iframe
    pdfIframe.src = url;
  } else if (officeExts.includes(ext)) {
    // Try local rendering via mammoth (docx) / jszip (pptx)
    renderLocalDoc(url, filename, ext, icon);
  } else {
    showFallbackCard(url, filename, icon);
  }

  pdfModal.classList.remove('hidden');
  document.body.style.overflow = 'hidden';
}

async function renderLocalDoc(url, filename, ext, icon) {
  pdfIframe.classList.add('hidden');
  previewFallback.classList.remove('hidden');
  previewFallback.innerHTML = `
    <div class="fallback-card">
      <div class="fallback-icon animate-pulse">${icon}</div>
      <div class="fallback-info"><h3>Preparing Preview…</h3><p>Processing your document.</p></div>
    </div>`;

  try {
    const response = await fetch(url);
    if (!response.ok) throw new Error('Could not fetch file');
    const arrayBuffer = await response.arrayBuffer();

    if (ext === 'docx' && typeof mammoth !== 'undefined') {
      const result = await mammoth.convertToHtml({ arrayBuffer });
      previewFallback.innerHTML = `
        <div style="padding:40px;background:#fff;width:100%;height:100%;overflow-y:auto;">
          <div style="max-width:800px;margin:0 auto;box-shadow:0 0 20px rgba(0,0,0,0.05);padding:60px;line-height:1.6;color:#333;">
            ${result.value}
          </div>
        </div>`;
    } else if (ext === 'pptx' && typeof JSZip !== 'undefined') {
      await renderPPTX(arrayBuffer, filename, icon);
    } else {
      showFallbackCard(url, filename, icon);
    }
  } catch (err) {
    showFallbackCard(url, filename, icon, `Could not preview: ${err.message}`);
  }
}

async function renderPPTX(arrayBuffer, filename, icon) {
  const zip = await JSZip.loadAsync(arrayBuffer);
  const slideFiles = Object.keys(zip.files)
    .filter(p => p.startsWith('ppt/slides/slide') && p.endsWith('.xml'))
    .sort((a, b) => parseInt(a.match(/slide(\d+)\.xml/)[1]) - parseInt(b.match(/slide(\d+)\.xml/)[1]));

  const slides = [];
  for (let i = 0; i < slideFiles.length; i++) {
    const xml = await zip.file(slideFiles[i]).async('string');
    const doc = new DOMParser().parseFromString(xml, 'text/xml');
    const texts = Array.from(doc.getElementsByTagName('a:t')).map(n => n.textContent).filter(t => t.trim());
    slides.push(texts.length
      ? `<div class="slide-card"><div class="slide-number">Slide ${i + 1}</div><div class="slide-title">${escapeHTML(texts[0])}</div><div class="slide-body"><p>${escapeHTML(texts.slice(1).join(' '))}</p></div></div>`
      : `<div class="slide-card"><div class="slide-number">Slide ${i + 1}</div><div class="slide-placeholder">Image/graphic slide</div></div>`);
  }

  previewFallback.innerHTML = `
    <div class="presentation-filmstrip">
      <div style="max-width:900px;margin:0 auto;padding-bottom:20px;display:flex;align-items:center;justify-content:space-between;">
        <h2 style="margin:0;font-weight:800;">${escapeHTML(filename)}</h2>
        <span style="background:var(--primary-glow);color:var(--primary);padding:5px 15px;border-radius:20px;font-weight:700;font-size:.8rem;">${slides.length} Slides</span>
      </div>
      ${slides.join('')}
    </div>`;
}

function showFallbackCard(url, filename, icon, msg) {
  pdfIframe.classList.add('hidden');
  previewFallback.classList.remove('hidden');
  previewFallback.innerHTML = `
    <div class="fallback-card">
      <div class="fallback-icon">${icon}</div>
      <div class="fallback-info">
        <h3>${escapeHTML(filename)}</h3>
        <p>${msg || 'This file cannot be previewed in the browser.'}<br>Download it to view locally.</p>
      </div>
      <a href="${url}" download="${escapeHTML(filename)}" class="btn-open-local">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" style="width:20px;height:20px;"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>
        Download to View
      </a>
    </div>`;
}

function closePdf() {
  pdfModal.classList.add('hidden');
  pdfIframe.src = '';
  document.body.style.overflow = '';
}

modalClose?.addEventListener('click', closePdf);
pdfModal?.addEventListener('click', e => { if (e.target === pdfModal) closePdf(); });
document.addEventListener('keydown', e => { if (e.key === 'Escape' && pdfModal && !pdfModal.classList.contains('hidden')) closePdf(); });

function triggerFilePick() { if (fileInput) fileInput.click(); }

mainUploadCard?.addEventListener('click', triggerFilePick);
document.getElementById('empty-upload-btn')?.addEventListener('click', triggerFilePick);

fileInput?.addEventListener('change', () => { if (fileInput.files.length > 0) handleFileSelect(fileInput.files[0]); });

// Drag-and-drop onto the main content area
const viewerMain = document.querySelector('.viewer-main');
if (viewerMain) {
  viewerMain.addEventListener('dragover', e => { e.preventDefault(); viewerMain.style.outline = '2px dashed var(--primary)'; });
  viewerMain.addEventListener('dragleave', () => viewerMain.style.outline = '');
  viewerMain.addEventListener('drop', e => {
    e.preventDefault(); viewerMain.style.outline = '';
    if (e.dataTransfer.files.length > 0) handleFileSelect(e.dataTransfer.files[0]);
  });
}

function handleFileSelect(file) {
  selectedFile = file;
  openConfirmModal(file);
}

function clearFile() {
  selectedFile = null;
  fileInput.value = '';
}

// ─── Confirm Upload Modal ─────────────────────────────────────────────────────
function openConfirmModal(file) {
  confirmOrigName.textContent = file.name;
  confirmFileMeta.textContent = formatSize(file.size);
  const dotIdx = file.name.lastIndexOf('.');
  renameInput.value = dotIdx > -1 ? file.name.substring(0, dotIdx) : file.name;
  if (confirmExt) confirmExt.textContent = dotIdx > -1 ? file.name.substring(dotIdx) : '';

  // Use currently active folder if it's not "All Files", otherwise default to null (will be "General")
  modalFolder = (activeFolder && activeFolder !== '__all__') ? activeFolder : null;

  populateModalFolders();
  confirmProgressWrap.classList.add('hidden');
  confirmProgressFill.style.width = '0%';
  confirmProgressText.textContent = 'Uploading…';
  confirmOverlay.classList.remove('hidden');
  document.body.style.overflow = 'hidden';
  setTimeout(() => renameInput.focus(), 80);
}

function closeConfirmModal(reset = true) {
  confirmOverlay.classList.add('hidden');
  document.body.style.overflow = '';
  if (reset) clearFile();
  modalFolder = null;
  if (confirmNewFolderInput) confirmNewFolderInput.value = '';
}

confirmCloseBtn.addEventListener('click', () => closeConfirmModal(true));
confirmCancelBtn.addEventListener('click', () => closeConfirmModal(true));
confirmOverlay.addEventListener('click', e => { if (e.target === confirmOverlay) closeConfirmModal(true); });

function populateModalFolders() {
  confirmFolderList.innerHTML = '';
  if (allFolders.length === 0) {
    confirmFolderList.innerHTML = '<p class="empty-text">No folders yet — create one below.</p>';
    updateConfirmBtn();
    return;
  }
  const tree = buildTree(allFolders);
  buildTreeDOM(tree, confirmFolderList, 0, true);
  if (modalFolder) {
    const btn = confirmFolderList.querySelector(`[data-folder="${modalFolder.replace(/"/g, '\\"')}"]`);
    if (btn) btn.classList.add('selected');
  }
  updateConfirmBtn();
}

function pickModalFolder(name) {
  modalFolder = name;
  confirmFolderList.querySelectorAll('.modal-folder-pick').forEach(b => b.classList.remove('selected'));
  const btn = confirmFolderList.querySelector(`[data-folder="${name.replace(/"/g, '\\"')}"]`);
  if (btn) btn.classList.add('selected');
  updateConfirmBtn();
}

function updateConfirmBtn() {
  // Logic: Upload button is enabled only if a file is selected (which is always true when the modal is open)
  // and we show a validation message on click if modalFolder is missing.
  // Enable upload button only if modalFolder is selected
  // This enforces the "Select folder first" rule
  if (confirmUploadBtn) {
    confirmUploadBtn.disabled = !modalFolder;
    confirmUploadBtn.title = modalFolder ? 'Start Upload' : 'Please select a folder below first';
    confirmUploadBtn.style.opacity = modalFolder ? '1' : '0.5';
    confirmUploadBtn.style.cursor = modalFolder ? 'pointer' : 'not-allowed';
  }

  if (confirmCreateSubBtn) confirmCreateSubBtn.disabled = !modalFolder;
}

async function createModalFolder(mode) {
  const rawName = confirmNewFolderInput.value.trim();
  if (!rawName) { showToast('Enter a folder name', 'warning'); return; }
  let fullPath = rawName;
  if (mode === 'sub') {
    if (!modalFolder) { showToast('Select a parent folder first', 'warning'); return; }
    fullPath = `${modalFolder}/${rawName}`;
  }

  if (allFolders.some(f => f.name.toLowerCase() === fullPath.toLowerCase())) {
    showToast('Choose any other folder name, the folder already exists', 'warning');
    return;
  }
  confirmCreateFolderBtn.disabled = true;
  if (confirmCreateSubBtn) confirmCreateSubBtn.disabled = true;
  try {
    const result = await apiFetch('/folders', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: userEmail, name: fullPath })
    });
    confirmNewFolderInput.value = '';
    const d = await apiFetch(`/folders?email=${encodeURIComponent(userEmail)}`);
    allFolders = d.folders;
    renderSidebar();
    populateModalFolders();
    pickModalFolder(result.name);
    showToast(`Folder "${result.name}" created`, 'success');
  } catch (err) {
    showToast(err.message, 'error');
  } finally {
    confirmCreateFolderBtn.disabled = false;
    if (confirmCreateSubBtn) confirmCreateSubBtn.disabled = !modalFolder;
  }
}

confirmCreateFolderBtn?.addEventListener('click', () => createModalFolder('main'));
confirmCreateSubBtn?.addEventListener('click', () => createModalFolder('sub'));
confirmNewFolderInput?.addEventListener('keydown', e => { if (e.key === 'Enter') createModalFolder('main'); });

confirmUploadBtn?.addEventListener('click', async () => {
  if (!selectedFile) {
    showToast('Please select a file to upload', 'warning');
    return;
  }

  if (!modalFolder) {
    showToast('Please select a folder to upload the files', 'warning');
    return;
  }

  const targetFolder = modalFolder;

  let customName = renameInput.value.trim();
  const ext = confirmExt ? confirmExt.textContent : '';
  if (!customName) {
    const d = selectedFile.name.lastIndexOf('.');
    customName = d > -1 ? selectedFile.name.substring(0, d) : selectedFile.name;
  }

  // Sanitize filename
  customName = customName.replace(/[^a-zA-Z0-9_\-\. ]/g, '_');
  if (!customName.endsWith(ext)) {
    customName += ext;
  }

  const customNameLower = customName.toLowerCase();
  const folderData = allFolders.find(f => f.name === targetFolder);
  if (folderData && folderData.files.some(f => f.name.toLowerCase() === customNameLower)) {
    showToast('Choose any other file name, the file name already exists', 'warning');
    return;
  }

  confirmUploadBtn.disabled = true;
  if (confirmCancelBtn) confirmCancelBtn.disabled = true;
  confirmProgressWrap?.classList.remove('hidden');

  let prog = 0;
  const interval = setInterval(() => {
    prog = Math.min(prog + Math.random() * 15, 88);
    if (confirmProgressFill) confirmProgressFill.style.width = `${prog}%`;
  }, 180);

  const formData = new FormData();
  formData.append('email', userEmail);
  formData.append('folder', targetFolder);
  formData.append('file', selectedFile, customName); // Passing customName as third arg is cleaner

  try {
    const res = await fetch(`${API}/upload`, { method: 'POST', body: formData });
    const data = await res.json();
    clearInterval(interval);

    if (!res.ok) throw new Error(data.error || 'Upload failed');

    if (confirmProgressFill) confirmProgressFill.style.width = '100%';
    if (confirmProgressText) confirmProgressText.textContent = 'Upload complete! ✓';

    showToast(`"${data.filename}" uploaded to "${data.folder}"`, 'success');

    // Refresh and close
    await loadFolders();
    setTimeout(() => {
      closeConfirmModal(true);
      // If we uploaded to a specific folder, maybe switch to it?
      // setActiveFolder(data.folder); 
    }, 800);
  } catch (err) {
    clearInterval(interval);
    if (confirmProgressWrap) confirmProgressWrap.classList.add('hidden');
    if (confirmProgressFill) confirmProgressFill.style.width = '0%';
    showToast(err.message, 'error');
    confirmUploadBtn.disabled = false;
    if (confirmCancelBtn) confirmCancelBtn.disabled = false;
  }
});

// ─── Delete File ──────────────────────────────────────────────────────────────
let deleteCallback = null;

function confirmDelete(folder, filename) {
  deleteConfirmMsg.textContent = `Delete "${filename}"? This cannot be undone.`;
  deleteCallback = () => performDelete(folder, filename);
  deleteConfirmModal.classList.add('active');
}

async function performDelete(folder, filename) {
  try {
    const result = await apiFetch(`/file?email=${encodeURIComponent(userEmail)}&folder=${encodeURIComponent(folder)}&file=${encodeURIComponent(filename)}`, {
      method: 'DELETE'
    });

    if (result.success) {
      showToast(`"${filename}" deleted successfully`, 'success');
      // Instant UI update: remove the file from allFolders without full reload if possible, 
      // or just reload which is safer
      await loadFolders();
    }
  } catch (err) {
    showToast(err.message, 'error');
  }
}

function confirmDeleteFolder(folderPath) {
  deleteConfirmMsg.textContent = `Delete entire folder "${folderPath}" and all its files?`;
  deleteCallback = () => performDeleteFolder(folderPath);
  deleteConfirmModal.classList.add('active');
}

async function performDeleteFolder(folderPath) {
  try {
    const res = await fetch(`${API}/folder`, {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: userEmail, folder: folderPath })
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Delete failed');
    showToast(`Folder "${folderPath}" deleted`, 'success');
    if (activeFolder.startsWith(folderPath)) setActiveFolder('__all__');
    await loadFolders();
  } catch (err) {
    showToast(err.message, 'error');
  }
}

deleteConfirmOkBtn.addEventListener('click', () => { if (deleteCallback) deleteCallback(); closeDeleteModal(); });
deleteConfirmCancelBtn.addEventListener('click', closeDeleteModal);
deleteConfirmModal.addEventListener('click', e => { if (e.target === deleteConfirmModal) closeDeleteModal(); });
function closeDeleteModal() { deleteConfirmModal.classList.remove('active'); deleteCallback = null; }

// ─── Inline Rename ────────────────────────────────────────────────────────────
async function makeEditable(el, type, oldName, folder = '') {
  const original = el.textContent;
  const input = document.createElement('input');
  input.type = 'text';
  input.value = original;
  input.className = 'rename-input-inline';
  el.replaceWith(input);
  input.focus();
  if (type === 'file') {
    const dot = original.lastIndexOf('.');
    if (dot > 0) input.setSelectionRange(0, dot); else input.select();
  } else { input.select(); }

  let done = false;
  const save = async () => {
    if (done) return; done = true;
    const newName = input.value.trim();
    if (!newName || newName === original) { input.replaceWith(el); return; }
    try {
      let endpoint, body;
      if (type === 'file') {
        endpoint = '/rename-file';
        body = { email: userEmail, folder, oldName, newName };
      } else {
        endpoint = '/rename-folder';
        body = { email: userEmail, oldPath: oldName, newName };
      }
      const res = await fetch(API + endpoint, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Rename failed');
      showToast(`${type === 'file' ? 'File' : 'Folder'} renamed`, 'success');
      if (type === 'folder' && activeFolder.startsWith(oldName)) {
        activeFolder = data.newPath || newName;
      }
      await loadFolders();
    } catch (err) {
      showToast(err.message, 'error');
      input.replaceWith(el);
    }
  };
  const cancel = () => { if (done) return; done = true; input.replaceWith(el); };
  input.addEventListener('keydown', e => { if (e.key === 'Enter') save(); if (e.key === 'Escape') cancel(); });
  input.addEventListener('blur', save);
}

// ─── Sidebar Toggle ────────────────────────────────────────────────────────────
function initSidebarToggle() {
  // Logic handled in DOMContentLoaded
}

// ─── Init ─────────────────────────────────────────────────────────────────────
document.addEventListener('DOMContentLoaded', () => {
  loadFolders();
  initSidebarToggle();

  // Close PDF Modal
  if (modalClose) {
    modalClose.addEventListener('click', () => {
      pdfModal.classList.add('hidden');
      pdfIframe.src = '';
      document.body.style.overflow = '';
    });
  }

  // Removed duplicate legacy inline folder creation listener
});
setInterval(loadFolders, 30000);
