/**
 * app.js – Shared utilities for Gantec Document Finder
 */

const API_BASE = 'http://localhost:3000/api';

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
  const res = await fetch(`${API_BASE}/files/${encodeURIComponent(folder)}/${encodeURIComponent(filename)}`, {
    method: 'DELETE'
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || 'Failed to delete file');
  return data;
}

function getFileUrl(folder, filename) {
  return `${API_BASE}/files/${encodeURIComponent(folder)}/${encodeURIComponent(filename)}`;
}

// ─── Toast Notifications ──────────────────────────────────────────────────────

function showToast(message, type = 'info', duration = 3500) {
  const container = document.getElementById('toast-container');
  if (!container) return;

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
