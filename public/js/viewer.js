/**
 * viewer.js – Document viewer logic
 */

let allFolders = [];
let activeFolder = '__all__';
let isGridView = true;
let searchQuery = '';

// ─── DOM References ───────────────────────────────────────────────────────────
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
const modalDownload   = document.getElementById('modal-download');
const modalClose      = document.getElementById('modal-close');

// ─── Load Data ────────────────────────────────────────────────────────────────
async function loadFolders() {
  try {
    const data = await fetchFolders();
    allFolders = data.folders;
    renderSidebar();
    renderDocs();
  } catch (err) {
    docsGrid.innerHTML = `<p style="color:var(--danger);padding:20px;">Could not connect to server. Make sure it's running on port 3000.</p>`;
  }
}

// ─── Sidebar ──────────────────────────────────────────────────────────────────
function renderSidebar() {
  const total = allFolders.reduce((s, f) => s + f.files.length, 0);
  countAll.textContent = total;

  sidebarFolders.innerHTML = '';
  allFolders.forEach(folder => {
    const item = document.createElement('div');
    item.className = 'sidebar-item';
    item.dataset.folder = folder.name;
    if (activeFolder === folder.name) item.classList.add('active');
    item.innerHTML = `
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" class="icon-xs">
        <path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"/>
      </svg>
      <span>${escapeHTML(folder.name)}</span>
      <span class="folder-count">${folder.files.length}</span>
    `;
    item.addEventListener('click', () => setActiveFolder(folder.name));
    sidebarFolders.appendChild(item);
  });
}

// ─── Folder Selection ─────────────────────────────────────────────────────────
function setActiveFolder(name) {
  activeFolder = name;
  searchInput.value = '';
  searchQuery = '';

  // Update sidebar UI
  document.querySelectorAll('.sidebar-item').forEach(el => el.classList.remove('active'));
  if (name === '__all__') {
    folderAll.classList.add('active');
  } else {
    const item = sidebarFolders.querySelector(`[data-folder="${name}"]`);
    if (item) item.classList.add('active');
    folderAll.classList.remove('active');
  }

  renderDocs();
}

folderAll.addEventListener('click', () => setActiveFolder('__all__'));

// ─── Document Rendering ───────────────────────────────────────────────────────
function getFilteredDocs() {
  let docs = [];
  if (activeFolder === '__all__') {
    allFolders.forEach(folder => {
      folder.files.forEach(file => {
        docs.push({ ...file, folder: folder.name });
      });
    });
  } else {
    const folder = allFolders.find(f => f.name === activeFolder);
    if (folder) {
      docs = folder.files.map(file => ({ ...file, folder: folder.name }));
    }
  }

  if (searchQuery) {
    const q = searchQuery.toLowerCase();
    docs = docs.filter(d =>
      d.name.toLowerCase().includes(q) ||
      d.folder.toLowerCase().includes(q)
    );
  }

  return docs;
}

function renderDocs() {
  const docs = getFilteredDocs();

  // Update heading
  const label = activeFolder === '__all__' ? 'All Documents' : activeFolder;
  viewerHeading.textContent = label;

  const q = searchQuery ? ` · "${searchQuery}"` : '';
  docCountBadge.textContent = `${docs.length} file${docs.length !== 1 ? 's' : ''}${q}`;

  docsGrid.innerHTML = '';

  if (docs.length === 0) {
    emptyState.classList.remove('hidden');
    return;
  }
  emptyState.classList.add('hidden');

  docsGrid.className = isGridView ? 'docs-grid' : 'docs-grid list-view';

  docs.forEach(doc => {
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
    <div class="doc-actions">
      <button class="doc-action-btn delete" data-folder="${escapeHTML(doc.folder)}" data-name="${escapeHTML(doc.name)}" title="Delete">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <polyline points="3 6 5 6 21 6"/>
          <path d="M19 6l-1 14H6L5 6"/>
          <path d="M10 11v6M14 11v6"/>
        </svg>
      </button>
    </div>
  `;
  card.addEventListener('click', (e) => {
    if (e.target.closest('.delete')) return;
    openPdf(doc.folder, doc.name);
  });
  card.querySelector('.delete').addEventListener('click', (e) => {
    e.stopPropagation();
    confirmDelete(doc.folder, doc.name);
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
    <div class="doc-actions">
      <button class="doc-action-btn delete" title="Delete">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <polyline points="3 6 5 6 21 6"/>
          <path d="M19 6l-1 14H6L5 6"/>
        </svg>
      </button>
    </div>
  `;
  card.addEventListener('click', (e) => {
    if (e.target.closest('.delete')) return;
    openPdf(doc.folder, doc.name);
  });
  card.querySelector('.delete').addEventListener('click', (e) => {
    e.stopPropagation();
    confirmDelete(doc.folder, doc.name);
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

// ─── PDF Modal ────────────────────────────────────────────────────────────────
function openPdf(folder, filename) {
  const url = getFileUrl(folder, filename);
  pdfIframe.src = url;
  modalFilename.textContent = filename;
  modalDownload.href = url;
  modalDownload.download = filename;
  pdfModal.classList.remove('hidden');
  document.body.style.overflow = 'hidden';
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
function confirmDelete(folder, filename) {
  if (!confirm(`Delete "${filename}" from "${folder}"?\n\nThis cannot be undone.`)) return;
  performDelete(folder, filename);
}

async function performDelete(folder, filename) {
  try {
    await deleteFile(folder, filename);
    showToast(`"${filename}" deleted`, 'success');
    await loadFolders();
  } catch (err) {
    showToast(err.message, 'error');
  }
}

// ─── Helpers ──────────────────────────────────────────────────────────────────
function escapeHTML(str) {
  const div = document.createElement('div');
  div.appendChild(document.createTextNode(str));
  return div.innerHTML;
}

// ─── Init ─────────────────────────────────────────────────────────────────────
loadFolders();
// Refresh every 30s in case files are uploaded from another tab
setInterval(loadFolders, 30000);
