/**
 * my-docs-viewer.js – My Documents viewer logic
 * Uses /api/my-documents/* endpoints (per-user, email-authenticated)
 */

const MY_DOCS_API = 'http://localhost:3000/api/my-documents';

function getMyEmail() {
  return localStorage.getItem('gantec_user_email') || '';
}

let allFolders = [];
let activeFolder = '__all__';
let isGridView = true;
let searchQuery = '';
let expandedFolders = new Set(['General']);
let sidebarIsCollapsed = false;
let currentOpenFolder = null;
let currentOpenFile = null;

// ─── DOM References ───────────────────────────────────────────────────────────
const sidebar         = document.getElementById('sidebar');
const sidebarFolders  = document.getElementById('sidebar-folders');
const folderAll       = document.getElementById('folder-all');
const countAll        = document.getElementById('count-all');
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
const deleteConfirmModal    = document.getElementById('delete-confirm-modal');
const deleteConfirmOkBtn    = document.getElementById('delete-confirm-ok-btn');
const deleteConfirmCancelBtn= document.getElementById('delete-confirm-cancel-btn');
const deleteConfirmMsg      = document.getElementById('delete-confirm-msg');

// ─── API Helpers ──────────────────────────────────────────────────────────────
async function myFetchFolders() {
  const email = getMyEmail();
  if (!email) throw new Error('Not logged in');
  const res = await fetch(`${MY_DOCS_API}/folders?email=${encodeURIComponent(email)}`);
  if (!res.ok) throw new Error('Failed to fetch folders');
  return res.json();
}

function myGetFileUrl(folder, filename) {
  const email = getMyEmail();
  return `${MY_DOCS_API}/file?email=${encodeURIComponent(email)}&folder=${encodeURIComponent(folder)}&file=${encodeURIComponent(filename)}`;
}

async function myDeleteFile(folder, filename) {
  const email = getMyEmail();
  const res = await fetch(`${MY_DOCS_API}/file?email=${encodeURIComponent(email)}&folder=${encodeURIComponent(folder)}&file=${encodeURIComponent(filename)}`, {
    method: 'DELETE'
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || 'Failed to delete file');
  return data;
}

// ─── Load Data ────────────────────────────────────────────────────────────────
async function loadFolders() {
  try {
    const data = await myFetchFolders();
    allFolders = data.folders;
    renderSidebar();
    renderDocs();
  } catch (err) {
    docsGrid.innerHTML = `<p style="color:var(--danger);padding:20px;">${err.message}</p>`;
  }
}

// ─── Sidebar ──────────────────────────────────────────────────────────────────
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

function buildTreeDOM(node, container, level = 0) {
  Object.values(node.children).forEach(child => {
    const wrap = document.createElement('div');
    wrap.className = 'tree-node-wrap';

    const row = document.createElement('div');
    row.className = 'sidebar-item';
    row.style.paddingLeft = `${(level * 20) + 12}px`;
    if (activeFolder === child.fullPath) row.classList.add('active');
    row.dataset.folder = child.fullPath;

    const hasChildren = Object.keys(child.children).length > 0;
    const isExpanded = expandedFolders.has(child.fullPath);

    const chevronHtml = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" class="tree-chevron ${isExpanded ? 'active' : ''}" style="transition: transform 0.2s; transform: ${isExpanded ? 'rotate(90deg)' : 'rotate(0deg)'}; opacity: ${hasChildren ? '1' : '0.15'}; pointer-events: ${hasChildren ? 'auto' : 'none'}; width: 14px; height: 14px; flex-shrink: 0;"><polyline points="9 18 15 12 9 6"></polyline></svg>`;

    row.innerHTML = `
      ${chevronHtml}
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" class="icon-xs folder-icon" style="margin-right: 8px;">
        <path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"/>
      </svg>
      <span style="flex:1;">${escapeHTML(child.name)}</span>
      <span class="folder-count">${child.files.length}</span>
      <button class="folder-delete-btn" title="Delete Folder">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5">
          <path d="M3 6h18"></path>
          <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path>
        </svg>
      </button>
    `;

    const label = row.querySelector('span[style="flex:1;"]');
    label.classList.add('tree-label-text');
    label.addEventListener('dblclick', e => {
      e.stopPropagation();
      makeEditable(label, 'folder', child.fullPath);
    });

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
        renderSidebar();
        return;
      }
      setActiveFolder(child.fullPath);
    });

    wrap.appendChild(row);
    wrap.appendChild(childrenContainer);
    container.appendChild(wrap);

    if (hasChildren) buildTreeDOM(child, childrenContainer, level + 1);
  });
}

function renderSidebar() {
  sidebarFolders.innerHTML = '';
  const tree = buildTree(allFolders);
  buildTreeDOM(tree, sidebarFolders, 0);
  let total = 0;
  allFolders.forEach(f => total += f.files.length);
  countAll.textContent = total;
}

// ─── Sidebar Toggle ────────────────────────────────────────────────────────
// (Sidebar toggle is now handled globally in app.js)

// ─── Folder Selection ─────────────────────────────────────────────────────────
function setActiveFolder(name) {
  activeFolder = name;
  searchInput.value = '';
  searchQuery = '';
  document.querySelectorAll('.sidebar-item').forEach(el => el.classList.remove('active'));
  if (name === '__all__') {
    folderAll.classList.add('active');
  } else {
    const item = sidebarFolders.querySelector(`[data-folder="${name.replace(/"/g, '\\"')}"]`);
    if (item) item.classList.add('active');
    folderAll.classList.remove('active');
  }
  renderDocs();
}

folderAll.addEventListener('click', () => setActiveFolder('__all__'));

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
        folder.files.forEach(file => f_files.push({ ...file, folder: folder.name }));
      });
    } else {
      const folder = allFolders.find(f => f.name === activeFolder);
      if (folder) f_files = folder.files.map(file => ({ ...file, folder: folder.name }));
    }
  }
  return { files: f_files };
}

function renderDocs() {
  const { files } = getFilteredItems();
  const label = activeFolder === '__all__' ? 'All Documents' : activeFolder;
  viewerHeading.textContent = label;
  const badgeText = `${files.length} document${files.length !== 1 ? 's' : ''}`;
  docCountBadge.textContent = badgeText + (searchQuery ? ` · "${searchQuery}"` : '');
  docsGrid.innerHTML = '';

  if (files.length === 0) {
    emptyState.classList.remove('hidden');
    return;
  }
  emptyState.classList.add('hidden');
  docsGrid.className = isGridView ? 'docs-grid' : 'docs-grid list-view';
  files.forEach(doc => {
    const card = isGridView ? buildGridCard(doc) : buildListCard(doc);
    docsGrid.appendChild(card);
  });
}

function buildGridCard(doc) {
  const card = document.createElement('div');
  card.className = 'doc-card';
  card.innerHTML = `
    <div class="doc-thumb">📄</div>
    <div class="doc-info">
      <div class="doc-name" title="${escapeHTML(doc.name)}">${escapeHTML(doc.name)}</div>
      <div class="doc-meta">
        <span>${formatSize(doc.size)}</span>
        <span class="doc-folder-tag">${escapeHTML(doc.folder)}</span>
      </div>
    </div>
    <div class="doc-actions" style="opacity: 1; display: flex; justify-content: flex-end; margin-top: 8px;">
      <button class="doc-action-btn view-doc" title="View">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/>
          <circle cx="12" cy="12" r="3"/>
        </svg>
      </button>
      <button class="doc-action-btn delete" data-folder="${escapeHTML(doc.folder)}" data-name="${escapeHTML(doc.name)}" title="Delete">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <path d="M3 6h18"></path>
          <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path>
          <line x1="10" y1="11" x2="10" y2="17"></line>
          <line x1="14" y1="11" x2="14" y2="17"></line>
        </svg>
      </button>
    </div>
  `;
  card.querySelector('.view-doc').addEventListener('click', e => {
    e.stopPropagation();
    openPdf(doc.folder, doc.name);
  });
  card.querySelector('.delete').addEventListener('click', e => {
    e.stopPropagation();
    confirmDelete(doc.folder, doc.name);
  });
  const nameEl = card.querySelector('.doc-name');
  nameEl.addEventListener('dblclick', e => {
    e.stopPropagation();
    makeEditable(nameEl, 'file', doc.name, doc.folder);
  });
  return card;
}

function buildListCard(doc) {
  const card = document.createElement('div');
  card.className = 'doc-card list-card';
  card.innerHTML = `
    <div class="doc-thumb">📄</div>
    <div class="doc-info">
      <div class="doc-name" title="${escapeHTML(doc.name)}">${escapeHTML(doc.name)}</div>
      <div class="doc-meta">
        <span>${formatSize(doc.size)}</span>
        <span>·</span>
        <span>${formatDate(doc.uploadedAt)}</span>
        <span class="doc-folder-tag">${escapeHTML(doc.folder)}</span>
      </div>
    </div>
    <div class="doc-actions" style="opacity: 1;">
      <button class="doc-action-btn view-doc" title="View">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/>
          <circle cx="12" cy="12" r="3"/>
        </svg>
      </button>
      <button class="doc-action-btn delete" title="Delete">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <path d="M3 6h18"></path>
          <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path>
          <line x1="10" y1="11" x2="10" y2="17"></line>
          <line x1="14" y1="11" x2="14" y2="17"></line>
        </svg>
      </button>
    </div>
  `;
  card.querySelector('.view-doc').addEventListener('click', e => {
    e.stopPropagation();
    openPdf(doc.folder, doc.name);
  });
  card.querySelector('.delete').addEventListener('click', e => {
    e.stopPropagation();
    confirmDelete(doc.folder, doc.name);
  });
  const nameEl = card.querySelector('.doc-name');
  nameEl.addEventListener('dblclick', e => {
    e.stopPropagation();
    makeEditable(nameEl, 'file', doc.name, doc.folder);
  });
  return card;
}

// ─── Search ───────────────────────────────────────────────────────────────────
searchInput.addEventListener('input', () => {
  searchQuery = searchInput.value.trim();
  renderDocs();
});

// ─── View Toggle ──────────────────────────────────────────────────────────────
gridBtn.addEventListener('click', () => {
  isGridView = true;
  gridBtn.classList.add('active');
  listBtn.classList.remove('active');
  renderDocs();
});
listBtn.addEventListener('click', () => {
  isGridView = false;
  listBtn.classList.add('active');
  gridBtn.classList.remove('active');
  renderDocs();
});

// ─── Document Viewer ──────────────────────────────────────────────────────────
function openPdf(folder, filename) {
  currentOpenFolder = folder;
  currentOpenFile = filename;
  const url = myGetFileUrl(folder, filename);

  pdfIframe.src = '';
  pdfIframe.classList.remove('hidden');
  previewFallback.classList.add('hidden');
  previewFallback.innerHTML = '';

  modalFilename.textContent = filename;
  modalDownload.href = url;
  modalDownload.download = filename;

  const ext = filename.split('.').pop().toLowerCase();
  let isNative = false;
  let icon = '📄';

  if (['jpg', 'jpeg', 'png', 'gif', 'svg', 'webp'].includes(ext)) {
    icon = '🖼️'; isNative = true;
  } else if (['mp4', 'webm', 'ogg', 'mov'].includes(ext)) {
    icon = '🎬'; isNative = true;
  } else if (ext === 'pdf') {
    icon = '📕'; isNative = true;
  } else if (['mp3', 'wav', 'm4a'].includes(ext)) {
    icon = '🎵'; isNative = true;
  } else if (['doc', 'docx', 'ppt', 'pptx', 'xls', 'xlsx'].includes(ext)) {
    icon = '📝';
  }

  modalIcon.textContent = icon;

  const isOffice = ['doc', 'docx', 'ppt', 'pptx', 'xls', 'xlsx'].includes(ext);

  if (isNative) {
    pdfIframe.src = url;
  } else if (isOffice) {
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
      <div class="fallback-info">
        <h3>Preparing View...</h3>
        <p>Processing your document for preview.</p>
      </div>
    </div>
  `;

  try {
    const response = await fetch(url);
    if (!response.ok) throw new Error('File fetch failed');
    const arrayBuffer = await response.arrayBuffer();

    if (ext === 'docx') {
      const result = await mammoth.convertToHtml({ arrayBuffer });
      previewFallback.innerHTML = `
        <div class="local-viewer-container" style="padding: 40px; text-align: left; background: #fff; width: 100%; height: 100%; overflow-y: auto;">
          <div class="local-viewer-paper" style="max-width: 800px; margin: 0 auto; box-shadow: 0 0 20px rgba(0,0,0,0.05); padding: 60px; line-height: 1.6; color: #333;">
            ${result.value}
          </div>
        </div>
      `;
    } else if (ext === 'pptx') {
      await renderLocalPPTX(arrayBuffer, filename, icon);
    } else {
      showFallbackCard(url, filename, icon);
    }
  } catch (err) {
    showFallbackCard(url, filename, icon, `Error loading document: ${err.message}`);
  }
}

async function renderLocalPPTX(arrayBuffer, filename, icon) {
  const zip = await JSZip.loadAsync(arrayBuffer);
  const slideFiles = Object.keys(zip.files)
    .filter(p => p.startsWith('ppt/slides/slide') && p.endsWith('.xml'))
    .sort((a, b) => {
      const na = parseInt(a.match(/slide(\d+)\.xml/)[1]);
      const nb = parseInt(b.match(/slide(\d+)\.xml/)[1]);
      return na - nb;
    });

  const slidesHtml = [];
  for (let i = 0; i < slideFiles.length; i++) {
    const slideXml = await zip.file(slideFiles[i]).async('string');
    const parser = new DOMParser();
    const xmlDoc = parser.parseFromString(slideXml, 'text/xml');
    const textNodes = xmlDoc.getElementsByTagName('a:t');
    const texts = Array.from(textNodes).map(n => n.textContent).filter(t => t.trim().length > 0);
    if (texts.length > 0) {
      slidesHtml.push(`
        <div class="slide-card">
          <div class="slide-number">Slide ${i + 1}</div>
          <div class="slide-title">${escapeHTML(texts[0])}</div>
          <div class="slide-body"><p>${escapeHTML(texts.slice(1).join(' '))}</p></div>
        </div>
      `);
    } else {
      slidesHtml.push(`
        <div class="slide-card">
          <div class="slide-number">Slide ${i + 1}</div>
          <div class="slide-placeholder">Image or graphic-only slide.</div>
        </div>
      `);
    }
  }

  previewFallback.innerHTML = `
    <div class="presentation-filmstrip">
      <div style="max-width:900px; margin:0 auto; width:100%; padding-bottom: 20px; display:flex; align-items:center; justify-content:space-between;">
        <h2 style="margin:0; font-weight:800; color:var(--text-primary);">Slide Review: ${escapeHTML(filename)}</h2>
        <span style="background:var(--primary-glow); color:var(--primary); padding: 5px 15px; border-radius: 20px; font-weight:700; font-size:0.8rem;">
          ${slideFiles.length} Slides
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
        <p>${customMsg || 'This file format cannot be previewed in the browser.'}<br>Please download it to view locally.</p>
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
pdfModal.addEventListener('click', e => { if (e.target === pdfModal) closePdf(); });
document.addEventListener('keydown', e => { if (e.key === 'Escape') closePdf(); });

// ─── Delete File ──────────────────────────────────────────────────────────────
let deleteCallback = null;

function confirmDelete(folder, filename) {
  deleteConfirmMsg.textContent = `Should I need to delete this?`;
  deleteCallback = () => performDelete(folder, filename);
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

async function performDelete(folder, filename) {
  try {
    await myDeleteFile(folder, filename);
    showToast(`"${filename}" deleted`, 'success');
    await loadFolders();
  } catch (err) {
    showToast(err.message, 'error');
  }
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
    if (activeFolder.startsWith(folderPath)) activeFolder = '__all__';
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
      if (type === 'folder' && activeFolder.startsWith(oldName)) activeFolder = data.newPath;
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
    docsGrid.innerHTML = `<p style="color:var(--danger);padding:20px;">Please <a href="login.html">log in</a> to view your documents.</p>`;
    return;
  }
  loadFolders();
  // initSidebarToggle removed (handled in app.js)
});

setInterval(() => { if (getMyEmail()) loadFolders(); }, 30000);
