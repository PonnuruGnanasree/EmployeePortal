/**
 * uploader.js – Document upload logic
 * Features:
 *  1. "✓ OK" badge next to selected folder
 *  2. Confirm modal after file pick → choose folder + rename
 *  3. Editable filename before upload
 */

let selectedFolder  = null;   // folder chosen in sidebar
let modalFolder     = null;   // folder chosen inside the modal
let selectedFile    = null;
let allFolders      = [];     // cached folder list
const recentUploads = [];

// ─── Sidebar DOM ─────────────────────────────────────────────────────────────
const folderList        = document.getElementById('folder-list');
const newFolderInput    = document.getElementById('new-folder-input');
const createFolderBtn   = document.getElementById('create-folder-btn');
const selectedFolderName= document.getElementById('selected-folder-name');
const dropZone          = document.getElementById('drop-zone');
const fileInput         = document.getElementById('file-input');
const dropContent       = document.getElementById('drop-content');
const filePreview       = document.getElementById('file-preview');
const previewName       = document.getElementById('preview-name');
const previewSize       = document.getElementById('preview-size');
const removeFileBtn     = document.getElementById('remove-file-btn');
const uploadBtn         = document.getElementById('upload-btn');   // main page btn (kept but hidden flow)
const recentList        = document.getElementById('recent-list');

// ─── Modal DOM ──────────────────────────────────────────────────────────────
const confirmOverlay       = document.getElementById('confirm-overlay');
const confirmOrigName      = document.getElementById('confirm-orig-name');
const confirmFileMeta      = document.getElementById('confirm-file-meta');
const renameInput          = document.getElementById('rename-input');
const confirmFolderList    = document.getElementById('confirm-folder-list');
const confirmNewFolderInput= document.getElementById('confirm-new-folder-input');
const confirmCreateFolderBtn=document.getElementById('confirm-create-folder-btn');
const confirmProgressWrap  = document.getElementById('confirm-progress-wrap');
const confirmProgressFill  = document.getElementById('confirm-progress-fill');
const confirmProgressText  = document.getElementById('confirm-progress-text');
const confirmUploadBtn     = document.getElementById('confirm-upload-btn');
const confirmCloseBtn      = document.getElementById('confirm-close-btn');
const confirmCancelBtn     = document.getElementById('confirm-cancel-btn');

// ═══════════════════════════════════════════════════════════════════════════
// SIDEBAR FOLDER LIST
// ═══════════════════════════════════════════════════════════════════════════

async function loadFolders() {
  folderList.innerHTML = '';
  try {
    const data = await fetchFolders();
    allFolders = data.folders;
    if (data.folders.length === 0) {
      folderList.innerHTML = '<p class="empty-text">No folders yet. Create one below.</p>';
      return;
    }
    data.folders.forEach(folder => renderFolderOption(folder));
  } catch (err) {
    folderList.innerHTML = '<p class="empty-text" style="color:var(--danger)">Could not load folders.</p>';
  }
}

function renderFolderOption(folder) {
  const btn = document.createElement('button');
  btn.className = 'folder-option';
  btn.dataset.name = folder.name;
  btn.innerHTML = `
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
      <path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"/>
    </svg>
    <span class="folder-opt-name">${escapeHTML(folder.name)}</span>
    <span class="ok-badge hidden" aria-label="Selected">✓ OK</span>
    <span class="folder-file-count">${folder.files.length}</span>
  `;
  btn.addEventListener('click', () => selectFolder(folder.name, btn));
  folderList.appendChild(btn);
}

function selectFolder(name, btn) {
  // Remove all OK badges
  document.querySelectorAll('.folder-option').forEach(b => {
    b.classList.remove('selected');
    b.querySelector('.ok-badge')?.classList.add('hidden');
  });
  // Mark selected
  btn.classList.add('selected');
  btn.querySelector('.ok-badge')?.classList.remove('hidden');
  selectedFolder = name;
  selectedFolderName.textContent = name;
}

// ─── Create Folder (sidebar) ─────────────────────────────────────────────────
createFolderBtn.addEventListener('click', async () => {
  const name = newFolderInput.value.trim();
  if (!name) { showToast('Enter a folder name first', 'warning'); return; }

  createFolderBtn.disabled = true;
  try {
    const result = await createFolder(name);
    newFolderInput.value = '';
    const fakeFolder = { name: result.name, files: [] };
    allFolders.push(fakeFolder);
    renderFolderOption(fakeFolder);
    const btn = folderList.querySelector(`[data-name="${result.name}"]`);
    if (btn) selectFolder(result.name, btn);
    showToast(`Folder "${result.name}" created`, 'success');
  } catch (err) {
    showToast(err.message, 'error');
  }
  createFolderBtn.disabled = false;
});

newFolderInput.addEventListener('keydown', e => {
  if (e.key === 'Enter') createFolderBtn.click();
});

// ═══════════════════════════════════════════════════════════════════════════
// DROP ZONE
// ═══════════════════════════════════════════════════════════════════════════

dropZone.addEventListener('click', e => {
  if (e.target === removeFileBtn || removeFileBtn.contains(e.target)) return;
  if (!selectedFile) fileInput.click();
});

dropZone.addEventListener('dragover', e => {
  e.preventDefault();
  dropZone.classList.add('dragover');
});
dropZone.addEventListener('dragleave', () => dropZone.classList.remove('dragover'));
dropZone.addEventListener('drop', e => {
  e.preventDefault();
  dropZone.classList.remove('dragover');
  if (e.dataTransfer.files.length > 0) handleFileSelect(e.dataTransfer.files[0]);
});

fileInput.addEventListener('change', () => {
  if (fileInput.files.length > 0) handleFileSelect(fileInput.files[0]);
});

removeFileBtn.addEventListener('click', e => {
  e.stopPropagation();
  clearFile();
});

function handleFileSelect(file) {
  if (file.type !== 'application/pdf') {
    showToast('Only PDF files are allowed', 'error');
    return;
  }
  if (file.size > 500 * 1024 * 1024) {
    showToast('File size exceeds 500MB', 'error');
    return;
  }
  selectedFile = file;
  // Show inline preview in drop zone
  previewName.textContent = file.name;
  previewSize.textContent = formatSize(file.size);
  dropContent.classList.add('hidden');
  filePreview.classList.remove('hidden');

  // Open confirm modal
  openConfirmModal(file);
}

function clearFile() {
  selectedFile = null;
  fileInput.value = '';
  dropContent.classList.remove('hidden');
  filePreview.classList.add('hidden');
}

// Main page upload btn → just open modal if file is set
if (uploadBtn) {
  uploadBtn.addEventListener('click', () => {
    if (selectedFile) openConfirmModal(selectedFile);
  });
}

// ═══════════════════════════════════════════════════════════════════════════
// CONFIRM MODAL
// ═══════════════════════════════════════════════════════════════════════════

function openConfirmModal(file) {
  modalFolder = selectedFolder; // pre-select if already chosen in sidebar

  // Populate file info
  confirmOrigName.textContent = file.name;
  confirmFileMeta.textContent = formatSize(file.size);

  // Pre-fill rename with filename (without .pdf)
  renameInput.value = file.name.replace(/\.pdf$/i, '');

  // Populate folder list in modal
  populateModalFolders();

  // Reset progress
  confirmProgressWrap.classList.add('hidden');
  confirmProgressFill.style.width = '0%';
  confirmProgressText.textContent = 'Uploading…';

  // Show modal
  confirmOverlay.classList.remove('hidden');
  document.body.style.overflow = 'hidden';

  // Focus rename input
  setTimeout(() => renameInput.focus(), 80);
}

function closeConfirmModal(resetFile = true) {
  confirmOverlay.classList.add('hidden');
  document.body.style.overflow = '';
  if (resetFile) clearFile();
  modalFolder = null;
  confirmNewFolderInput.value = '';
}

// Close buttons
confirmCloseBtn.addEventListener('click', () => closeConfirmModal(true));
confirmCancelBtn.addEventListener('click', () => closeConfirmModal(true));
confirmOverlay.addEventListener('click', e => {
  if (e.target === confirmOverlay) closeConfirmModal(true);
});

// ─── Modal Folder List ────────────────────────────────────────────────────
function populateModalFolders() {
  confirmFolderList.innerHTML = '';
  if (allFolders.length === 0) {
    confirmFolderList.innerHTML = '<p class="empty-text">No folders yet — create one below.</p>';
    updateConfirmUploadBtn();
    return;
  }
  allFolders.forEach(folder => {
    const btn = document.createElement('button');
    btn.className = 'modal-folder-pick' + (folder.name === modalFolder ? ' selected' : '');
    btn.dataset.name = folder.name;
    btn.innerHTML = `
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" class="icon-xs">
        <path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"/>
      </svg>
      <span>${escapeHTML(folder.name)}</span>
      <span class="modal-folder-count">${folder.files.length} file${folder.files.length !== 1 ? 's' : ''}</span>
      <span class="modal-ok-badge ${folder.name === modalFolder ? '' : 'hidden'}">✓ OK</span>
    `;
    btn.addEventListener('click', () => pickModalFolder(folder.name));
    confirmFolderList.appendChild(btn);
  });
  updateConfirmUploadBtn();
}

function pickModalFolder(name) {
  modalFolder = name;
  // Update sidebar selection too
  selectedFolder = name;
  selectedFolderName.textContent = name;
  document.querySelectorAll('.folder-option').forEach(b => {
    b.classList.remove('selected');
    b.querySelector('.ok-badge')?.classList.add('hidden');
  });
  const sidebarBtn = folderList.querySelector(`[data-name="${name}"]`);
  if (sidebarBtn) {
    sidebarBtn.classList.add('selected');
    sidebarBtn.querySelector('.ok-badge')?.classList.remove('hidden');
  }
  // Update modal UI
  confirmFolderList.querySelectorAll('.modal-folder-pick').forEach(b => {
    b.classList.remove('selected');
    b.querySelector('.modal-ok-badge')?.classList.add('hidden');
  });
  const modalBtn = confirmFolderList.querySelector(`[data-name="${name}"]`);
  if (modalBtn) {
    modalBtn.classList.add('selected');
    modalBtn.querySelector('.modal-ok-badge')?.classList.remove('hidden');
  }
  updateConfirmUploadBtn();
}

function updateConfirmUploadBtn() {
  confirmUploadBtn.disabled = !modalFolder;
}

// ─── Create Folder (inside modal) ────────────────────────────────────────
confirmCreateFolderBtn.addEventListener('click', async () => {
  const name = confirmNewFolderInput.value.trim();
  if (!name) { showToast('Enter a folder name', 'warning'); return; }

  confirmCreateFolderBtn.disabled = true;
  try {
    const result = await createFolder(name);
    confirmNewFolderInput.value = '';
    const newFolder = { name: result.name, files: [] };
    allFolders.push(newFolder);
    // Also add to sidebar
    renderFolderOption(newFolder);
    // Refresh modal list and auto-pick new folder
    populateModalFolders();
    pickModalFolder(result.name);
    showToast(`Folder "${result.name}" created`, 'success');
  } catch (err) {
    showToast(err.message, 'error');
  }
  confirmCreateFolderBtn.disabled = false;
});

confirmNewFolderInput.addEventListener('keydown', e => {
  if (e.key === 'Enter') confirmCreateFolderBtn.click();
});

// ─── Confirm Upload ───────────────────────────────────────────────────────
confirmUploadBtn.addEventListener('click', async () => {
  if (!selectedFile || !modalFolder) return;

  // Build custom filename
  let customName = renameInput.value.trim();
  if (!customName) customName = selectedFile.name.replace(/\.pdf$/i, '');
  // Sanitise and ensure .pdf extension
  customName = customName.replace(/[^a-zA-Z0-9_\-\. ]/g, '_');
  if (!customName.toLowerCase().endsWith('.pdf')) customName += '.pdf';

  confirmUploadBtn.disabled = true;
  confirmCancelBtn.disabled = true;
  confirmProgressWrap.classList.remove('hidden');

  // Fake progress animation
  let prog = 0;
  const progInterval = setInterval(() => {
    prog = Math.min(prog + Math.random() * 15, 88);
    confirmProgressFill.style.width = `${prog}%`;
  }, 180);

  // Build FormData — rename the file via a Blob
  const renamedFile = new File([selectedFile], customName, { type: 'application/pdf' });
  const formData = new FormData();
  formData.append('file', renamedFile);
  formData.append('folder', modalFolder);

  try {
    const res  = await fetch('/api/upload', { method: 'POST', body: formData });
    const data = await res.json();

    clearInterval(progInterval);
    if (!res.ok) throw new Error(data.error || 'Upload failed');

    confirmProgressFill.style.width = '100%';
    confirmProgressText.textContent = 'Upload complete! ✓';
    showToast(`"${data.filename}" uploaded to "${data.folder}"`, 'success');

    addRecentUpload(data.filename, data.folder, selectedFile.size);

    // Refresh folder list
    const folderData = await fetchFolders();
    allFolders = folderData.folders;
    folderList.innerHTML = '';
    allFolders.forEach(f => renderFolderOption(f));
    // Re-select in sidebar
    const sidebarBtn = folderList.querySelector(`[data-name="${modalFolder}"]`);
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

function renderRecentList() {
  if (recentUploads.length === 0) {
    recentList.innerHTML = '<p class="empty-text">No recent uploads yet.</p>';
    return;
  }
  recentList.innerHTML = recentUploads.map(item => `
    <div class="recent-item">
      <span class="recent-pdf-icon">📄</span>
      <div class="recent-info">
        <div class="recent-name">${escapeHTML(item.filename)}</div>
        <div class="recent-meta">${formatSize(item.size)} · Just now</div>
      </div>
      <span class="recent-folder-badge">${escapeHTML(item.folder)}</span>
    </div>
  `).join('');
}

// ─── Helper ──────────────────────────────────────────────────────────────────
function escapeHTML(str) {
  const div = document.createElement('div');
  div.appendChild(document.createTextNode(str));
  return div.innerHTML;
}

// ─── Init ─────────────────────────────────────────────────────────────────────
loadFolders();
