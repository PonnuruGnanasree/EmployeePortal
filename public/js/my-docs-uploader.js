/**
 * my-docs-uploader.js – My Documents upload logic
 * Uses /api/my-documents/* endpoints (per-user, email-authenticated)
 */

const MY_DOCS_API = '/api/my-documents';

function getMyEmail() {
  return localStorage.getItem('gantec_user_email') || '';
}

let selectedFolder       = null;
let modalFolder          = null;
let selectedFile         = null;
let allFolders           = [];
const recentUploads      = [];
let expandedFolders      = new Set(['General']);
let sidebarIsCollapsed   = false;

// ─── Sidebar DOM ─────────────────────────────────────────────────────────────
const sidebar             = document.querySelector('.upload-sidebar');
const folderList          = document.getElementById('folder-list');
const newFolderInput      = document.getElementById('new-folder-input');
const createFolderBtn     = document.getElementById('create-folder-btn');
const createSubfolderBtn  = document.getElementById('create-subfolder-btn');
const selectedFolderName  = document.getElementById('selected-folder-name');
const dropZone            = document.getElementById('drop-zone');
const fileInput           = document.getElementById('file-input');
const dropContent         = document.getElementById('drop-content');
const filePreview         = document.getElementById('file-preview');
const previewName         = document.getElementById('preview-name');
const previewSize         = document.getElementById('preview-size');
const removeFileBtn       = document.getElementById('remove-file-btn');
const uploadBtn           = document.getElementById('upload-btn');
const recentList          = document.getElementById('recent-list');

// ─── Modal DOM ──────────────────────────────────────────────────────────────
const confirmOverlay          = document.getElementById('confirm-overlay');
const confirmOrigName         = document.getElementById('confirm-orig-name');
const confirmFileMeta         = document.getElementById('confirm-file-meta');
const renameInput             = document.getElementById('rename-input');
const confirmFolderList       = document.getElementById('confirm-folder-list');
const confirmNewFolderInput   = document.getElementById('confirm-new-folder-input');
const confirmCreateFolderBtn  = document.getElementById('confirm-create-folder-btn');
const confirmCreateSubfolderBtn = document.getElementById('confirm-create-subfolder-btn');
const confirmProgressWrap     = document.getElementById('confirm-progress-wrap');
const confirmProgressFill     = document.getElementById('confirm-progress-fill');
const confirmProgressText     = document.getElementById('confirm-progress-text');
const confirmUploadBtn        = document.getElementById('confirm-upload-btn');
const confirmCloseBtn         = document.getElementById('confirm-close-btn');
const confirmCancelBtn        = document.getElementById('confirm-cancel-btn');

const deleteConfirmModal      = document.getElementById('delete-confirm-modal');
const deleteConfirmOkBtn      = document.getElementById('delete-confirm-ok-btn');
const deleteConfirmCancelBtn  = document.getElementById('delete-confirm-cancel-btn');
const deleteConfirmMsg        = document.getElementById('delete-confirm-msg');

// ─── API Helpers ──────────────────────────────────────────────────────────────
async function myFetchFolders() {
  const email = getMyEmail();
  if (!email) throw new Error('Not logged in');
  const res = await fetch(`${MY_DOCS_API}/folders?email=${encodeURIComponent(email)}`);
  if (!res.ok) throw new Error('Failed to fetch folders');
  return res.json();
}

async function myCreateFolder(name) {
  const email = getMyEmail();
  const res = await fetch(`${MY_DOCS_API}/folders`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, name })
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || 'Failed to create folder');
  return data;
}

// ═══════════════════════════════════════════════════════════════════════════
// SIDEBAR FOLDER LIST
// ═══════════════════════════════════════════════════════════════════════════

async function loadFolders() {
  folderList.innerHTML = '';
  try {
    const data = await myFetchFolders();
    allFolders = data.folders;
    if (data.folders.length === 0) {
      folderList.innerHTML = '<p class="empty-text">No folders yet. Create one below.</p>';
      selectedFolder = null;
      selectedFolderName.textContent = 'None';
      if (createSubfolderBtn) createSubfolderBtn.disabled = true;
      return;
    }
    renderFoldersSidebar();
  } catch (err) {
    folderList.innerHTML = `<p class="empty-text" style="color:var(--danger)">${err.message}</p>`;
  }
}

function buildTree(folders) {
  const root = { children: {} };
  folders.forEach(f => {
    const parts = f.name.split('/');
    let current = root;
    parts.forEach((part, i) => {
      if (!current.children[part]) {
        current.children[part] = {
          name: part,
          fullPath: parts.slice(0, i + 1).join('/'),
          isTarget: false,
          files: [],
          children: {}
        };
      }
      current = current.children[part];
    });
    current.isTarget = true;
    current.files = f.files;
  });
  return root;
}

function buildTreeDOM(node, container, level = 0, isModal = false) {
  Object.values(node.children).forEach(child => {
    const wrap = document.createElement('div');
    wrap.className = 'tree-node-wrap';

    const row = document.createElement('div');
    row.className = isModal ? 'modal-folder-pick' : 'folder-option';
    row.style.paddingLeft = `${(level * 20) + 12}px`;

    if (!isModal && child.fullPath === selectedFolder) row.classList.add('selected');
    if (isModal && child.fullPath === modalFolder) row.classList.add('selected');
    row.dataset.name = child.fullPath;

    const hasChildren = Object.keys(child.children).length > 0;
    const isExpanded = expandedFolders.has(child.fullPath);

    const chevronHtml = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" class="tree-chevron ${isExpanded ? 'active' : ''}" style="transition: transform 0.2s; transform: ${isExpanded ? 'rotate(90deg)' : 'rotate(0deg)'}; opacity: ${hasChildren ? '1' : '0.15'}; pointer-events: ${hasChildren ? 'auto' : 'none'}; width: 14px; height: 14px; flex-shrink: 0;"><polyline points="9 18 15 12 9 6"></polyline></svg>`;

    row.innerHTML = `
      ${chevronHtml}
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" class="icon-xs folder-icon" style="margin-right: 8px;">
        <path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"/>
      </svg>
      <span class="${isModal ? '' : 'folder-opt-name'}" style="flex:1;">${escapeHTML(child.name)}</span>
      <span class="${isModal ? 'modal-folder-count' : 'folder-file-count'}">${child.files.length}</span>
      ${!isModal ? `
      <button class="folder-delete-btn" title="Delete Folder">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5">
          <path d="M3 6h18"></path>
          <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path>
        </svg>
      </button>` : ''}
    `;

    if (!isModal) {
      const label = row.querySelector('.folder-opt-name');
      label.addEventListener('dblclick', e => {
        e.stopPropagation();
        makeEditable(label, 'folder', child.fullPath);
      });
    }

    const childrenContainer = document.createElement('div');
    childrenContainer.className = 'tree-children';
    childrenContainer.style.display = isExpanded ? 'block' : 'none';

    row.addEventListener('click', e => {
      if (e.target.closest('.folder-delete-btn')) {
        e.stopPropagation();
        confirmDeleteFolder(child.fullPath);
        return;
      }
      if (e.target.closest('.tree-chevron')) {  // only chevron toggles expand/collapse
        e.stopPropagation();
        if (expandedFolders.has(child.fullPath)) {
          expandedFolders.delete(child.fullPath);
        } else {
          expandedFolders.add(child.fullPath);
        }
        if (isModal) {
          populateModalFolders();
        } else {
          renderFoldersSidebar();
        }
        return;
      }
      if (isModal) pickModalFolder(child.fullPath);
      else selectFolder(child.fullPath, row);
    });

    wrap.appendChild(row);
    wrap.appendChild(childrenContainer);
    container.appendChild(wrap);
    if (hasChildren) buildTreeDOM(child, childrenContainer, level + 1, isModal);
  });
}

// ─── Sidebar Toggle ──────────────────────────────────────────────────────────
// (Sidebar toggle is now handled globally in app.js)

function renderFoldersSidebar() {
  folderList.innerHTML = '';
  const tree = buildTree(allFolders);
  buildTreeDOM(tree, folderList, 0, false);
}

function selectFolder(name, btn) {
  const isAlreadySelected = (selectedFolder === name);
  document.querySelectorAll('.folder-option').forEach(b => b.classList.remove('selected'));
  if (isAlreadySelected) {
    selectedFolder = null;
    selectedFolderName.textContent = 'None';
    if (createSubfolderBtn) createSubfolderBtn.disabled = true;
  } else {
    btn.classList.add('selected');
    selectedFolder = name;
    selectedFolderName.textContent = name;
    if (createSubfolderBtn) createSubfolderBtn.disabled = !name;
  }
}

folderList.addEventListener('click', e => {
  if (e.target === folderList) {
    document.querySelectorAll('.folder-option').forEach(b => b.classList.remove('selected'));
    selectedFolder = null;
    selectedFolderName.textContent = 'None';
    if (createSubfolderBtn) createSubfolderBtn.disabled = true;
  }
});

// ─── Create Folder (sidebar) ─────────────────────────────────────────────────
async function createSidebarFolder(mode) {
  const rawName = newFolderInput.value.trim();
  if (!rawName) { showToast('Enter a folder name first', 'warning'); return; }

  let fullPath = rawName;
  if (mode === 'sub') {
    if (!selectedFolder) { showToast('Select a parent folder first', 'warning'); return; }
    fullPath = `${selectedFolder}/${rawName}`;
  }

  createFolderBtn.disabled = true;
  if (createSubfolderBtn) createSubfolderBtn.disabled = true;

  try {
    const result = await myCreateFolder(fullPath);
    const createdPath = result.name;
    const parentPath = selectedFolder;
    newFolderInput.value = '';

    const fresh = await myFetchFolders();
    allFolders = fresh.folders;
    renderFoldersSidebar();

    const btn = folderList.querySelector(`[data-name="${createdPath.replace(/"/g, '\\"')}"]`);
    if (btn) {
      selectFolder(createdPath, btn);
    } else {
      selectedFolder = createdPath;
      selectedFolderName.textContent = createdPath;
      if (createSubfolderBtn) createSubfolderBtn.disabled = false;
    }

    showToast(
      mode === 'main'
        ? `Main folder "${createdPath}" created`
        : `Subfolder "${rawName}" created inside "${parentPath}"`,
      'success'
    );
  } catch (err) {
    showToast(err.message, 'error');
  } finally {
    createFolderBtn.disabled = false;
    if (createSubfolderBtn) createSubfolderBtn.disabled = !selectedFolder;
  }
}

createFolderBtn.addEventListener('click', () => createSidebarFolder('main'));
createSubfolderBtn?.addEventListener('click', () => createSidebarFolder('sub'));
newFolderInput.addEventListener('keydown', e => { if (e.key === 'Enter') createSidebarFolder('main'); });

// ═══════════════════════════════════════════════════════════════════════════
// DROP ZONE
// ═══════════════════════════════════════════════════════════════════════════

dropZone.addEventListener('click', e => {
  if (e.target === removeFileBtn || removeFileBtn.contains(e.target)) return;
  if (!selectedFile) fileInput.click();
});
dropZone.addEventListener('dragover', e => { e.preventDefault(); dropZone.classList.add('dragover'); });
dropZone.addEventListener('dragleave', () => dropZone.classList.remove('dragover'));
dropZone.addEventListener('drop', e => {
  e.preventDefault();
  dropZone.classList.remove('dragover');
  if (e.dataTransfer.files.length > 0) handleFileSelect(e.dataTransfer.files[0]);
});
fileInput.addEventListener('change', () => {
  if (fileInput.files.length > 0) handleFileSelect(fileInput.files[0]);
});
removeFileBtn.addEventListener('click', e => { e.stopPropagation(); clearFile(); });

function handleFileSelect(file) {
  selectedFile = file;
  previewName.textContent = file.name;
  previewSize.textContent = formatSize(file.size);
  dropContent.classList.add('hidden');
  filePreview.classList.remove('hidden');
  openConfirmModal(file);
}

function clearFile() {
  selectedFile = null;
  fileInput.value = '';
  dropContent.classList.remove('hidden');
  filePreview.classList.add('hidden');
}

if (uploadBtn) {
  uploadBtn.addEventListener('click', () => { if (selectedFile) openConfirmModal(selectedFile); });
}

// ═══════════════════════════════════════════════════════════════════════════
// CONFIRM MODAL
// ═══════════════════════════════════════════════════════════════════════════

function openConfirmModal(file) {
  modalFolder = selectedFolder;
  confirmOrigName.textContent = file.name;
  confirmFileMeta.textContent = formatSize(file.size);

  const dotIndex = file.name.lastIndexOf('.');
  const nameBase = dotIndex > -1 ? file.name.substring(0, dotIndex) : file.name;
  const ext = dotIndex > -1 ? file.name.substring(dotIndex) : '';

  renameInput.value = nameBase;
  const confirmExt = document.getElementById('confirm-ext');
  if (confirmExt) confirmExt.textContent = ext;

  populateModalFolders();

  confirmProgressWrap.classList.add('hidden');
  confirmProgressFill.style.width = '0%';
  confirmProgressText.textContent = 'Uploading…';

  confirmOverlay.classList.remove('hidden');
  document.body.style.overflow = 'hidden';
  setTimeout(() => renameInput.focus(), 80);
}

function closeConfirmModal(resetFile = true) {
  confirmOverlay.classList.add('hidden');
  document.body.style.overflow = '';
  if (resetFile) clearFile();
  modalFolder = null;
  confirmNewFolderInput.value = '';
}

confirmCloseBtn.addEventListener('click', () => closeConfirmModal(true));
confirmCancelBtn.addEventListener('click', () => closeConfirmModal(true));
confirmOverlay.addEventListener('click', e => { if (e.target === confirmOverlay) closeConfirmModal(true); });

// ─── Modal Folder List ────────────────────────────────────────────────────
function populateModalFolders() {
  confirmFolderList.innerHTML = '';
  if (allFolders.length === 0) {
    confirmFolderList.innerHTML = '<p class="empty-text">No folders yet — create one below.</p>';
    updateConfirmUploadBtn();
    return;
  }
  const tree = buildTree(allFolders);
  buildTreeDOM(tree, confirmFolderList, 0, true);
  updateConfirmUploadBtn();
}

confirmFolderList.addEventListener('click', e => {
  if (e.target === confirmFolderList) {
    modalFolder = null;
    document.querySelectorAll('.modal-folder-pick').forEach(b => b.classList.remove('selected'));
    updateConfirmUploadBtn();
  }
});

function pickModalFolder(name) {
  modalFolder = name;
  selectedFolder = name;
  selectedFolderName.textContent = name;

  document.querySelectorAll('.folder-option').forEach(b => b.classList.remove('selected'));
  const sidebarBtn = folderList.querySelector(`[data-name="${name.replace(/"/g, '\\"')}"]`);
  if (sidebarBtn) sidebarBtn.classList.add('selected');

  confirmFolderList.querySelectorAll('.modal-folder-pick').forEach(b => b.classList.remove('selected'));
  const modalBtn = confirmFolderList.querySelector(`[data-name="${name.replace(/"/g, '\\"')}"]`);
  if (modalBtn) modalBtn.classList.add('selected');

  updateConfirmUploadBtn();
}

function updateConfirmUploadBtn() {
  confirmUploadBtn.disabled = !modalFolder;
  if (confirmCreateSubfolderBtn) confirmCreateSubfolderBtn.disabled = !modalFolder;
}

// ─── Create Folder (inside modal) ────────────────────────────────────────
async function createModalFolder(mode) {
  const rawName = confirmNewFolderInput.value.trim();
  if (!rawName) { showToast('Enter a folder name', 'warning'); return; }

  let fullPath = rawName;
  if (mode === 'sub') {
    if (!modalFolder) { showToast('Select a parent folder first', 'warning'); return; }
    fullPath = `${modalFolder}/${rawName}`;
  }

  confirmCreateFolderBtn.disabled = true;
  if (confirmCreateSubfolderBtn) confirmCreateSubfolderBtn.disabled = true;

  try {
    const result = await myCreateFolder(fullPath);
    const parentPath = modalFolder;
    confirmNewFolderInput.value = '';

    const fresh = await myFetchFolders();
    allFolders = fresh.folders;

    renderFoldersSidebar();
    populateModalFolders();
    pickModalFolder(result.name);

    showToast(
      mode === 'main'
        ? `Main folder "${result.name}" created`
        : `Subfolder "${rawName}" created inside "${parentPath}"`,
      'success'
    );
  } catch (err) {
    showToast(err.message, 'error');
  } finally {
    confirmCreateFolderBtn.disabled = false;
    if (confirmCreateSubfolderBtn) confirmCreateSubfolderBtn.disabled = !modalFolder;
  }
}

confirmCreateFolderBtn.addEventListener('click', () => createModalFolder('main'));
confirmCreateSubfolderBtn?.addEventListener('click', () => createModalFolder('sub'));
confirmNewFolderInput.addEventListener('keydown', e => { if (e.key === 'Enter') createModalFolder('main'); });

// ─── Confirm Upload ───────────────────────────────────────────────────────
confirmUploadBtn.addEventListener('click', async () => {
  if (!selectedFile || !modalFolder) return;
  const email = getMyEmail();
  if (!email) { showToast('Please log in first', 'error'); return; }

  let customName = renameInput.value.trim();
  const confirmExt = document.getElementById('confirm-ext');
  const ext = confirmExt ? confirmExt.textContent : '';

  if (!customName) {
    const dotIndex = selectedFile.name.lastIndexOf('.');
    customName = dotIndex > -1 ? selectedFile.name.substring(0, dotIndex) : selectedFile.name;
  }

  customName = customName.replace(/[^a-zA-Z0-9_\-\. ]/g, '_');
  customName += ext;

  confirmUploadBtn.disabled = true;
  confirmCancelBtn.disabled = true;
  confirmProgressWrap.classList.remove('hidden');

  let prog = 0;
  const progInterval = setInterval(() => {
    prog = Math.min(prog + Math.random() * 15, 88);
    confirmProgressFill.style.width = `${prog}%`;
  }, 180);

  const renamedFile = new File([selectedFile], customName, { type: selectedFile.type });
  const formData = new FormData();
  formData.append('email', email);
  formData.append('folder', modalFolder);
  formData.append('file', renamedFile);

  try {
    const res = await fetch(`${MY_DOCS_API}/upload`, { method: 'POST', body: formData });
    const data = await res.json();

    clearInterval(progInterval);
    if (!res.ok) throw new Error(data.error || 'Upload failed');

    confirmProgressFill.style.width = '100%';
    confirmProgressText.textContent = 'Upload complete! ✓';
    showToast(`"${data.filename}" uploaded to "${data.folder}"`, 'success');

    addRecentUpload(data.filename, data.folder, selectedFile.size);

    const folderData = await myFetchFolders();
    allFolders = folderData.folders;
    folderList.innerHTML = '';
    renderFoldersSidebar();

    const sidebarBtn = folderList.querySelector(`[data-name="${modalFolder.replace(/"/g, '\\"')}"]`);
    if (sidebarBtn) selectFolder(modalFolder, sidebarBtn);

    setTimeout(() => closeConfirmModal(true), 1000);
  } catch (err) {
    clearInterval(progInterval);
    confirmProgressWrap.classList.add('hidden');
    confirmProgressFill.style.width = '0%';
    showToast(err.message, 'error');
    confirmUploadBtn.disabled = false;
    confirmCancelBtn.disabled = false;
  }
});

// ═══════════════════════════════════════════════════════════════════════════
// RECENT UPLOADS
// ═══════════════════════════════════════════════════════════════════════════

function addRecentUpload(filename, folder, size) {
  recentUploads.unshift({ filename, folder, size });
  renderRecentList();
}

// ─── Delete Confirm Modal ──────────────────────────────────────────────────
let deleteCallback = null;

function showDeleteConfirm(msg, onConfirm) {
  deleteConfirmMsg.textContent = msg;
  deleteCallback = onConfirm;
  deleteConfirmModal.classList.add('active');
}

deleteConfirmOkBtn.addEventListener('click', () => {
  if (deleteCallback) deleteCallback();
  closeDeleteConfirmModal();
});
deleteConfirmCancelBtn.addEventListener('click', () => closeDeleteConfirmModal());

function closeDeleteConfirmModal() {
  deleteConfirmModal.classList.remove('active');
  deleteCallback = null;
}
deleteConfirmModal.addEventListener('click', e => {
  if (e.target === deleteConfirmModal) closeDeleteConfirmModal();
});

function renderRecentList() {
  if (!recentList) return;
  if (recentUploads.length === 0) {
    recentList.innerHTML = '<p class="empty-text">No recent uploads yet.</p>';
    return;
  }

  recentList.innerHTML = recentUploads.map((item, idx) => `
    <div class="recent-item" style="position: relative; display: flex; align-items: center; gap: 12px;">
      <span class="recent-pdf-icon">📄</span>
      <div class="recent-info" style="flex: 1; min-width: 0;">
        <div style="display: flex; align-items: center; gap: 8px; flex-wrap: wrap;">
          <div class="recent-name" style="white-space: nowrap; overflow: hidden; text-overflow: ellipsis;">${escapeHTML(item.filename)}</div>
          <span class="recent-folder-badge">${escapeHTML(item.folder)}</span>
        </div>
        <div class="recent-meta">${formatSize(item.size)} · Recent</div>
      </div>
      <button class="remove-file-btn" data-idx="${idx}" style="flex-shrink: 0; background: transparent; border: none; cursor: pointer; color: var(--danger); padding: 4px;" title="Delete File">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="width: 16px; height: 16px;">
          <polyline points="3 6 5 6 21 6"/>
          <path d="M19 6l-1 14H6L5 6"/>
        </svg>
      </button>
    </div>
  `).join('');

  recentList.querySelectorAll('.remove-file-btn').forEach(btn => {
    btn.addEventListener('click', e => {
      const idx = e.currentTarget.dataset.idx;
      const item = recentUploads[idx];
      const email = getMyEmail();
      showDeleteConfirm('Should I need to delete this?', async () => {
        try {
          const res = await fetch(`${MY_DOCS_API}/file?email=${encodeURIComponent(email)}&folder=${encodeURIComponent(item.folder)}&file=${encodeURIComponent(item.filename)}`, {
            method: 'DELETE'
          });
          const data = await res.json();
          if (!res.ok) throw new Error(data.error || 'Delete failed');
          recentUploads.splice(idx, 1);
          renderRecentList();
          loadFolders();
          showToast('File deleted successfully', 'success');
        } catch (err) {
          showToast(err.message, 'error');
        }
      });
    });
  });
}

// ─── Delete Folder ────────────────────────────────────────────────────────────
function confirmDeleteFolder(folderPath) {
  deleteConfirmMsg.textContent = `Are you sure? This will delete the entire "${folderPath}" folder and all its contents forever.`;
  deleteCallback = () => performDeleteFolder(folderPath);
  deleteConfirmModal.classList.add('active');
}

async function performDeleteFolder(folderPath) {
  const email = getMyEmail();
  try {
    const res = await fetch(`${MY_DOCS_API}/folder`, {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, folder: folderPath })
    });
    const data = await res.json();
    if (data.error) throw new Error(data.error);
    showToast(`Folder "${folderPath}" deleted`, 'success');
    if (selectedFolder === folderPath) {
      selectedFolder = null;
      selectedFolderName.textContent = 'None';
      if (createSubfolderBtn) createSubfolderBtn.disabled = true;
    }
    await loadFolders();
  } catch (err) {
    showToast(err.message, 'error');
  }
}

// ─── Inline Renaming ──────────────────────────────────────────────────────────
async function makeEditable(el, type, oldName, folder = '') {
  const email = getMyEmail();
  const originalText = el.textContent;
  const input = document.createElement('input');
  input.type = 'text';
  input.value = originalText;
  input.className = 'rename-input-inline';
  el.replaceWith(input);
  input.focus();

  if (type === 'file') {
    const lastDot = originalText.lastIndexOf('.');
    if (lastDot > 0) input.setSelectionRange(0, lastDot);
    else input.select();
  } else {
    input.select();
  }

  let finished = false;

  const save = async () => {
    if (finished) return;
    finished = true;
    const newName = input.value.trim();
    if (!newName || newName === originalText) { input.replaceWith(el); return; }

    try {
      const endpoint = type === 'file' ? `${MY_DOCS_API}/rename-file` : `${MY_DOCS_API}/rename-folder`;
      const body = type === 'file'
        ? { email, folder, oldName, newName }
        : { email, oldPath: oldName, newName };

      const res = await fetch(endpoint, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body)
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Rename failed');

      showToast(`${type.charAt(0).toUpperCase() + type.slice(1)} renamed successfully`, 'success');
      if (type === 'folder' && selectedFolder === oldName) {
        selectedFolder = data.newPath;
        selectedFolderName.textContent = data.newPath;
      }
      await loadFolders();
    } catch (err) {
      showToast(err.message, 'error');
      input.replaceWith(el);
    }
  };

  const cancel = () => { if (finished) return; finished = true; input.replaceWith(el); };
  input.addEventListener('keydown', e => { if (e.key === 'Enter') save(); if (e.key === 'Escape') cancel(); });
  input.addEventListener('blur', save);
}

// ─── Init ─────────────────────────────────────────────────────────────────────
document.addEventListener('DOMContentLoaded', () => {
  const email = getMyEmail();
  if (!email) {
    folderList.innerHTML = '<p class="empty-text" style="color:var(--danger)">Please <a href="login.html">log in</a> to manage your documents.</p>';
    return;
  }
  loadFolders();
  // initSidebarToggle removed (handled in app.js)
});
