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
let expandedFolders = new Set(['General']); // Independent expanded state
let sidebarIsCollapsed = false;

// ─── Sidebar DOM ─────────────────────────────────────────────────────────────
const sidebar           = document.querySelector('.upload-sidebar');
const recentList        = document.getElementById('recent-list');
const folderList        = document.getElementById('main-folder-list');

const newFolderInput    = document.getElementById('new-folder-input');
const createFolderBtn   = document.getElementById('create-folder-btn');
const createSubfolderBtn = document.getElementById('create-subfolder-btn');
const selectedFolderName= document.getElementById('selected-folder-name');
const dropZone          = document.getElementById('drop-zone');
const fileInput         = document.getElementById('file-input');
const dropContent       = document.getElementById('drop-content');
const filePreview       = document.getElementById('file-preview');
const previewName       = document.getElementById('preview-name');
const previewSize       = document.getElementById('preview-size');
const removeFileBtn     = document.getElementById('remove-file-btn');
const uploadBtn         = document.getElementById('upload-btn');

// Links will be initialized in DOMContentLoaded

// ─── Modal DOM ──────────────────────────────────────────────────────────────
const confirmOverlay       = document.getElementById('confirm-overlay');
const confirmOrigName      = document.getElementById('confirm-orig-name');
const confirmFileMeta      = document.getElementById('confirm-file-meta');
const renameInput          = document.getElementById('rename-input');
const confirmFolderList    = document.getElementById('confirm-folder-list');
const confirmNewFolderInput= document.getElementById('confirm-new-folder-input');
const confirmCreateFolderBtn=document.getElementById('confirm-create-folder-btn');
const confirmCreateSubfolderBtn=document.getElementById('confirm-create-subfolder-btn');
const confirmProgressWrap  = document.getElementById('confirm-progress-wrap');
const confirmProgressFill  = document.getElementById('confirm-progress-fill');
const confirmProgressText  = document.getElementById('confirm-progress-text');
const confirmUploadBtn     = document.getElementById('confirm-upload-btn');
const confirmCloseBtn      = document.getElementById('confirm-close-btn');
const confirmCancelBtn     = document.getElementById('confirm-cancel-btn');

// --- Delete Confirm Modal ---
const deleteConfirmModal   = document.getElementById('delete-confirm-modal');
const deleteConfirmOkBtn   = document.getElementById('delete-confirm-ok-btn');
const deleteConfirmCancelBtn = document.getElementById('delete-confirm-cancel-btn');
const deleteConfirmMsg     = document.getElementById('delete-confirm-msg');

// ═══════════════════════════════════════════════════════════════════════════
// SIDEBAR FOLDER LIST
// ═══════════════════════════════════════════════════════════════════════════

async function loadFolders() {
  window.loadFolders = loadFolders; // Make it globally accessible for Real-time sync
  if (!allFolders) allFolders = [];
  try {
    const data = await fetchFolders();
    allFolders = data.folders || [];
    folderList.innerHTML = '';
    
    if (allFolders.length === 0) {
      folderList.innerHTML = `
        <div class="empty-state-sidebar" style="padding: 20px; text-align: center; opacity: 0.6;">
          <p style="font-size: 0.85rem; color: var(--text-muted);">No folders found.</p>
        </div>
      `;
      selectedFolder = null;
      selectedFolderName.textContent = 'None';
      if (createSubfolderBtn) createSubfolderBtn.disabled = true;
      return;
    }
    renderFoldersSidebar();
  } catch (err) {
    console.error('Folder load error:', err);
    folderList.innerHTML = `<p class="empty-text" style="color:var(--danger); padding:20px; text-align:center;">Could not load folders.</p>`;
  }
}

function buildTree(folders) {
  const root = { children: {} };
  
  if (!folders || !Array.isArray(folders)) return root;

  folders.forEach(f => {
    if (!f || !f.name) return;
    const parts = f.name.split('/');
    let current = root;
    parts.forEach((part, i) => {
      if (!part) return; // skip empty parts
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
    current.files = f.files || [];
  });
  
  return root;
}

function buildTreeDOM(node, container, level = 0, isModal = false) {
  const sortedChildren = Object.values(node.children).sort((a, b) => a.name.localeCompare(b.name));
  
  sortedChildren.forEach(child => {
    const hasChildren = Object.keys(child.children).length > 0;
    const hasFiles = child.files && child.files.length > 0;
    const isExpanded = expandedFolders.has(child.fullPath);
    const canExpand = hasChildren || hasFiles;

    const wrap = document.createElement('div');
    wrap.className = 'tree-node-wrap';

    const row = document.createElement('div');
    row.className = isModal ? 'modal-folder-pick' : 'folder-option';
    row.style.paddingLeft = `${(level * 20) + 12}px`;

    if (!isModal && child.fullPath === selectedFolder) row.classList.add('selected');
    if (isModal && child.fullPath === modalFolder) row.classList.add('selected');
    
    row.dataset.name = child.fullPath;

    const chevronHtml = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" class="tree-chevron ${isExpanded ? 'active' : ''}" style="transition: transform 0.2s; transform: ${isExpanded ? 'rotate(90deg)' : 'rotate(0deg)'}; opacity: ${canExpand ? '1' : '0.15'}; pointer-events: ${canExpand ? 'auto' : 'none'}; width: 14px; height: 14px; flex-shrink: 0; cursor: pointer;"><polyline points="9 18 15 12 9 6"></polyline></svg>`;

    row.innerHTML = `
      ${chevronHtml}
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" class="icon-xs folder-icon" style="margin-right: 8px;">
        <path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"/>
      </svg>
      <span class="${isModal ? '' : 'folder-opt-name'}" style="flex:1; overflow:hidden; text-overflow:ellipsis; white-space:nowrap;">${escapeHTML(child.name)}</span>
      ${child.files.length > 0 ? `<span class="${isModal ? 'modal-folder-count' : 'folder-file-count'}">${child.files.length}</span>` : ''}
      ${!isModal ? `
      <button class="folder-delete-btn" title="Delete Folder" style="padding:4px; opacity:0.8;">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" style="width:14px; height:14px;">
          <path d="M3 6h18"></path>
          <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path>
        </svg>
      </button>` : ''}
    `;

    if (!isModal) {
      const label = row.querySelector('.folder-opt-name');
      if (label) {
        label.addEventListener('dblclick', (e) => {
          e.stopPropagation();
          makeEditable(label, 'folder', child.fullPath);
        });
      }
    }

    // Children container holds both files and subfolders
    const childrenContainer = document.createElement('div');
    childrenContainer.className = 'tree-children';
    childrenContainer.style.display = isExpanded ? 'block' : 'none';

    // Render files inside the children container when expanded
    if (!isModal && isExpanded && hasFiles) {
      child.files.forEach(file => {
        const fileRow = document.createElement('div');
        fileRow.className = 'tree-file-row';
        fileRow.style.cssText = `padding-left: ${((level + 1) * 20) + 12}px; display: flex; align-items: center; gap: 4px; padding-top: 4px; padding-bottom: 4px;`;
        fileRow.innerHTML = `
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="width:14px; height:14px; margin-right: 8px; opacity: 0.5; flex-shrink:0;">
            <path d="M13 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V9z"></path>
            <polyline points="13 2 13 9 20 9"></polyline>
          </svg>
          <span style="flex:1; overflow:hidden; text-overflow:ellipsis; white-space:nowrap; font-size:0.8rem; opacity:0.7;">${escapeHTML(file.name)}</span>
          <button class="file-delete-btn" data-folder="${escapeHTML(child.fullPath)}" data-file="${escapeHTML(file.name)}" title="Delete File" style="padding:4px; opacity:0.6; background:none; border:none; color:var(--text-muted); cursor:pointer; flex-shrink:0;">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="width:12px; height:12px;">
              <path d="M3 6h18"></path>
              <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path>
            </svg>
          </button>
        `;
        fileRow.querySelector('.file-delete-btn').addEventListener('click', (e) => {
          e.stopPropagation();
          confirmDeleteFile(child.fullPath, file.name);
        });
        childrenContainer.appendChild(fileRow);
      });
    }

    // Recursively render subfolders inside the same children container
    if (hasChildren && isExpanded) {
      buildTreeDOM(child, childrenContainer, level + 1, isModal);
    }

    row.addEventListener('click', (e) => {
      if (e.target.closest('.folder-delete-btn')) {
        e.stopPropagation();
        confirmDeleteFolder(child.fullPath);
        return;
      }
      
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
  });
}

// ─── Sidebar Toggle Logic ──────────────────────────────────────────────────
// (Handled via app.js)

function renderFoldersSidebar() {
  if (folderList) {
    folderList.innerHTML = '';
    const tree = buildTree(allFolders);
    buildTreeDOM(tree, folderList, 0, false);
  }
  if (confirmFolderList) populateModalFolders();
}

function selectFolder(name, btn) {
  const isAlreadySelected = (selectedFolder === name);
  
  document.querySelectorAll('.folder-option').forEach(b => {
    b.classList.remove('selected');
  });

  if (isAlreadySelected) {
    selectedFolder = null;
    selectedFolderName.textContent = 'None';
    if (createSubfolderBtn) createSubfolderBtn.disabled = true;
  } else {
    btn.classList.add('selected');
    selectedFolder = name;
    updateSelectedFolderDisplays(name);
    if (createSubfolderBtn) createSubfolderBtn.disabled = !name;
  }
}

function updateSelectedFolderDisplays(name) {
  const displayValue = name || '⚠️ Please select a folder from the sidebar';
  
  // Update both the main uploader name and the link section name
  if (selectedFolderName) selectedFolderName.textContent = displayValue;
  
  const linkFolderDisplays = document.querySelectorAll('.selected-folder-name-display');
  linkFolderDisplays.forEach(el => el.textContent = displayValue);
  
  updateConfirmUploadBtn();
  updateAddLinkBtnState();
}

// Add unselect by clicking background
folderList?.addEventListener('click', (e) => {
  if (e.target === folderList) {
    document.querySelectorAll('.folder-option').forEach(b => b.classList.remove('selected'));
    selectedFolder = null;
    updateSelectedFolderDisplays(null);
    if (createSubfolderBtn) createSubfolderBtn.disabled = true;
  }
});

// ─── Create Folder (sidebar) ─────────────────────────────────────────────────
async function createSidebarFolder(mode) {
  if (!newFolderInput) return;
  const rawName = newFolderInput.value.trim();

  if (!rawName) {
    showToast('Enter a folder name first', 'warning');
    return;
  }

  let fullPath = rawName;

  if (mode === 'sub') {
    if (!selectedFolder) {
      showToast('Select a parent folder first', 'warning');
      return;
    }
    fullPath = `${selectedFolder}/${rawName}`;
  }

  if (allFolders.some(f => f.name.toLowerCase() === fullPath.toLowerCase())) {
    showToast('Choose any other folder name, the folder already exists', 'warning');
    return;
  }

  createFolderBtn.disabled = true;
  if (createSubfolderBtn) createSubfolderBtn.disabled = true;

  try {
    const result = await createFolder(fullPath);
    const createdPath = result.name;
    const parentPath = selectedFolder;
    newFolderInput.value = '';

    const fresh = await fetchFolders();
    allFolders = fresh.folders;
    renderFoldersSidebar();

    const btn = folderList.querySelector(`[data-name="${createdPath.replace(/"/g, '\"')}"]`);

    if (btn) {
      selectFolder(createdPath, btn);
    } else {
      selectedFolder = createdPath;
      updateSelectedFolderDisplays(createdPath);
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

createFolderBtn?.addEventListener('click', () => {
  if (newFolderInput) createSidebarFolder('main');
});
createSubfolderBtn?.addEventListener('click', () => {
  if (newFolderInput) createSidebarFolder('sub');
});

newFolderInput?.addEventListener('keydown', e => {
  if (e.key === 'Enter') {
    createSidebarFolder('main');
  }
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

function getFileIcon(filename) {
  const ext = filename.split('.').pop().toLowerCase();
  if (['jpg', 'jpeg', 'png', 'gif', 'svg', 'webp'].includes(ext)) return '🖼️';
  if (ext === 'pdf') return '📕';
  if (['mp4', 'webm', 'ogg', 'mov'].includes(ext)) return '🎬';
  if (['doc', 'docx'].includes(ext)) return '📘';
  if (['xls', 'xlsx'].includes(ext)) return '📗';
  if (['ppt', 'pptx'].includes(ext)) return '📙';
  return '📄';
}

function handleFileSelect(file) {
  selectedFile = file;
  previewName.textContent = file.name;
  previewSize.textContent = formatSize(file.size);
  
  const thumb = document.querySelector('.file-thumb');
  if (thumb) thumb.textContent = getFileIcon(file.name);
  
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
  uploadBtn.addEventListener('click', () => {
    if (selectedFile) openConfirmModal(selectedFile);
  });
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
  confirmOverlay?.classList.add('hidden');
  document.body.style.overflow = '';
  if (resetFile) clearFile();
  modalFolder = null;
  if(confirmNewFolderInput) confirmNewFolderInput.value = '';
}

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
  
  const tree = buildTree(allFolders);
  buildTreeDOM(tree, confirmFolderList, 0, true);
  
  updateConfirmUploadBtn();
}

// Add unselect by clicking background in modal
confirmFolderList?.addEventListener('click', (e) => {
  if (e.target === confirmFolderList) {
    modalFolder = null;
    document.querySelectorAll('.modal-folder-pick').forEach(b => b.classList.remove('selected'));
    updateConfirmUploadBtn();
  }
});

function pickModalFolder(name) {
  modalFolder = name;
  selectedFolder = name;
  updateSelectedFolderDisplays(name);

  document.querySelectorAll('.folder-option').forEach(b => {
    b.classList.remove('selected');
  });

  const sidebarBtn = folderList.querySelector(`[data-name="${name.replace(/"/g, '\"')}"]`);
  if (sidebarBtn) {
    sidebarBtn.classList.add('selected');
  }

  confirmFolderList.querySelectorAll('.modal-folder-pick').forEach(b => {
    b.classList.remove('selected');
  });

  const modalBtn = confirmFolderList.querySelector(`[data-name="${name.replace(/"/g, '\"')}"]`);
  if (modalBtn) {
    modalBtn.classList.add('selected');
  }

  updateConfirmUploadBtn();
}

function updateConfirmUploadBtn() {
  confirmUploadBtn.disabled = !modalFolder;
  if (confirmCreateSubfolderBtn) confirmCreateSubfolderBtn.disabled = !modalFolder;
}

// ─── Create Folder (inside modal) ────────────────────────────────────────
async function createModalFolder(mode) {
  if (!confirmNewFolderInput) return;
  const rawName = confirmNewFolderInput.value.trim();

  if (!rawName) {
    showToast('Enter a folder name', 'warning');
    return;
  }

  let fullPath = rawName;

  if (mode === 'sub') {
    if (!modalFolder) {
      showToast('Select a parent folder first', 'warning');
      return;
    }
    fullPath = `${modalFolder}/${rawName}`;
  }

  if (allFolders.some(f => f.name.toLowerCase() === fullPath.toLowerCase())) {
    showToast('Choose any other folder name, the folder already exists', 'warning');
    return;
  }

  confirmCreateFolderBtn.disabled = true;
  if (confirmCreateSubfolderBtn) confirmCreateSubfolderBtn.disabled = true;

  try {
    const result = await createFolder(fullPath);
    const parentPath = modalFolder;
    confirmNewFolderInput.value = '';

    const fresh = await fetchFolders();
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
    if (confirmCreateSubfolderBtn) {
      confirmCreateSubfolderBtn.disabled = !modalFolder;
    }
  }
}

confirmCreateFolderBtn?.addEventListener('click', () => {
  if (confirmNewFolderInput) createModalFolder('main');
});
confirmCreateSubfolderBtn?.addEventListener('click', () => {
  if (confirmNewFolderInput) createModalFolder('sub');
});

confirmNewFolderInput?.addEventListener('keydown', e => {
  if (e.key === 'Enter') {
    createModalFolder('main');
  }
});

// ─── Confirm Upload ───────────────────────────────────────────────────────
confirmUploadBtn.addEventListener('click', async () => {
  if (!selectedFile || !modalFolder) return;

  let customName = renameInput.value.trim();
  const confirmExt = document.getElementById('confirm-ext');
  const ext = confirmExt ? confirmExt.textContent : '';

  if (!customName) {
    const dotIndex = selectedFile.name.lastIndexOf('.');
    customName = dotIndex > -1 ? selectedFile.name.substring(0, dotIndex) : selectedFile.name;
  }

  customName = customName.replace(/[^a-zA-Z0-9_\-\. ]/g, '_');
  customName += ext;

  const customNameLower = customName.toLowerCase();
  const folderData = allFolders.find(f => f.name === modalFolder);
  if (folderData && folderData.files.some(f => f.name.toLowerCase() === customNameLower)) {
    let errorEl = document.getElementById('rename-error-msg');
    if (!errorEl) {
      errorEl = document.createElement('div');
      errorEl.id = 'rename-error-msg';
      errorEl.style.cssText = 'color: #ef4444; font-size: 0.85rem; margin-top: 8px; font-weight: 500; background: rgba(239, 68, 68, 0.1); padding: 8px 12px; border-radius: 6px; border: 1px solid rgba(239,68,68,0.2);';
      const wrap = renameInput.closest('.confirm-rename-wrap') || renameInput;
      wrap.insertAdjacentElement('afterend', errorEl);
    }
    errorEl.textContent = '⚠️ Choose any other file name, the file name already exists';
    return;
  }
  
  let existingError = document.getElementById('rename-error-msg');
  if (existingError) existingError.remove();

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
  formData.append('folder', modalFolder);
  formData.append('file', renamedFile);
  const userEmail = localStorage.getItem('gantec_user_email');
  if (userEmail) {
    formData.append('email', userEmail);
  }

  try {
    const res  = await fetch('/api/upload', { method: 'POST', body: formData });
    const data = await res.json();

    clearInterval(progInterval);
    if (!res.ok) throw new Error(data.error || 'Upload failed');

    confirmProgressFill.style.width = '100%';
    confirmProgressText.textContent = 'Upload complete! ✓';
    showToast('File is uploaded', 'success');

    addRecentUpload(data.filename, data.folder, selectedFile.size);

    const folderData = await fetchFolders();
    allFolders = folderData.folders;
    folderList.innerHTML = '';
    renderFoldersSidebar();
    
    const sidebarBtn = folderList.querySelector(`[data-name="${modalFolder.replace(/"/g, '\"')}"]`);
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

// ─── Delete Modal Helper ──────────────────────────────────────────────────────
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

deleteConfirmCancelBtn.addEventListener('click', () => {
  closeDeleteConfirmModal();
});

function closeDeleteConfirmModal() {
  deleteConfirmModal.classList.remove('active');
  deleteCallback = null;
}

deleteConfirmModal.addEventListener('click', (e) => {
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

  recentList.querySelectorAll('.recent-item').forEach(itemDiv => {
    const nameEl = itemDiv.querySelector('.recent-name');
    const idx = itemDiv.querySelector('.remove-file-btn').dataset.idx;
    const item = recentUploads[idx];

    nameEl.addEventListener('dblclick', (e) => {
      e.stopPropagation();
      makeEditable(nameEl, 'file', item.filename, item.folder);
    });

    itemDiv.querySelector('.remove-file-btn').addEventListener('click', (e) => {
      const currentIdx = e.currentTarget.dataset.idx;
      const currentItem = recentUploads[currentIdx];
      showDeleteConfirm(`Should I need to delete this?`, async () => {
        try {
          await deleteFile(currentItem.folder, currentItem.filename);
          recentUploads.splice(currentIdx, 1);
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

function confirmDeleteFolder(folderPath) {
  deleteConfirmMsg.textContent = `Are you sure? This will delete the entire "${folderPath}" folder and all its contents forever.`;
  deleteCallback = () => performDeleteFolder(folderPath);
  deleteConfirmModal.classList.add('active');
}

async function performDeleteFolder(folderPath) {
  try {
    const email = localStorage.getItem('gantec_user_email');
    const res = await fetch('/api/delete-folder', {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ folder: folderPath, email })
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

function confirmDeleteFile(folder, filename) {
  deleteConfirmMsg.textContent = `Are you sure you want to delete "${filename}"? This cannot be undone.`;
  deleteCallback = () => performDeleteFile(folder, filename);
  deleteConfirmModal.classList.add('active');
}

async function performDeleteFile(folder, filename) {
  try {
    const res = await fetch(`/api/file?folder=${encodeURIComponent(folder)}&file=${encodeURIComponent(filename)}`, {
      method: 'DELETE'
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Failed to delete file');

    showToast(`File "${filename}" deleted`, 'success');
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
document.addEventListener('DOMContentLoaded', () => {
  const sectionFile = document.getElementById('section-file');
  const sectionLink = document.getElementById('section-link');
  const youtubeUrlInput = document.getElementById('youtube-url');
  const youtubeTitleInput = document.getElementById('youtube-title');
  const addLinkBtn = document.getElementById('add-link-btn');
  const toggleFile = document.getElementById('toggle-file');
  const toggleLink = document.getElementById('toggle-link');

  // --- Toggle Logic ---
  toggleFile?.addEventListener('click', () => {
    toggleFile.classList.add('active');
    toggleLink.classList.remove('active');
    sectionFile.classList.remove('hidden');
    sectionLink.classList.add('hidden');
  });
  
  toggleLink?.addEventListener('click', () => {
    toggleLink.classList.add('active');
    toggleFile.classList.remove('active');
    sectionFile.classList.add('hidden');
    sectionLink.classList.remove('hidden');
  });

  // --- YouTube Link Logic ---
  const handleLinkInput = () => updateAddLinkBtnState();
  youtubeUrlInput?.addEventListener('input', handleLinkInput);
  youtubeTitleInput?.addEventListener('input', handleLinkInput);

  addLinkBtn?.addEventListener('click', async () => {
    const url = youtubeUrlInput.value.trim();
    const title = youtubeTitleInput.value.trim();
    const folder = selectedFolder;

    console.log('Attempting to add link:', { url, title, folder });

    addLinkBtn.disabled = true;

    if (!url.startsWith('http://') && !url.startsWith('https://')) {
      showToast('Invalid URL: Please include http:// or https://', 'error');
      addLinkBtn.disabled = false;
      return;
    }

    try {
      const res = await fetch('/api/resources/links', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          url, 
          title, 
          folder,
          email: localStorage.getItem('gantec_user_email') || ''
        })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to add link');

      showToast('Video is uploaded', 'success');
      youtubeUrlInput.value = '';
      youtubeTitleInput.value = '';
      updateAddLinkBtnState();
      await loadFolders();
    } catch (err) {
      showToast(err.message, 'error');
      addLinkBtn.disabled = false;
    }
  });

});

function updateAddLinkBtnState() {
  const addLinkBtn = document.getElementById('add-link-btn');
  const youtubeUrlInput = document.getElementById('youtube-url');
  const youtubeTitleInput = document.getElementById('youtube-title');
  if (!addLinkBtn) return;
  const url = youtubeUrlInput?.value.trim();
  const title = youtubeTitleInput?.value.trim();
  addLinkBtn.disabled = !(url && title && selectedFolder);
}

document.addEventListener('DOMContentLoaded', () => {
  loadFolders();
  initSidebarToggle();
});
