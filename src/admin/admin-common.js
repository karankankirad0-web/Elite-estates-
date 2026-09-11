import { supabase } from '../lib/supabaseClient.js';

export function $(sel, ctx) { return (ctx || document).querySelector(sel); }
export function $all(sel, ctx) { return Array.from((ctx || document).querySelectorAll(sel)); }

export function escapeHTML(str) {
  const d = document.createElement('div');
  d.textContent = str == null ? '' : String(str);
  return d.innerHTML;
}

export function formatMoney(n) {
  const num = Number(n) || 0;
  return '$' + num.toLocaleString('en-US');
}

export function formatDate(iso) {
  if (!iso) return '—';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '—';
  return d.toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' });
}

export function slugify(text) {
  return String(text)
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)+/g, '')
    .slice(0, 80) || 'item-' + Date.now();
}

export function debounce(fn, wait) {
  let t;
  return function debounced(...args) {
    clearTimeout(t);
    t = setTimeout(() => fn.apply(this, args), wait);
  };
}

/* ============ TOAST ============ */
function toastRoot() {
  let root = document.getElementById('adminToastRoot');
  if (!root) {
    root = document.createElement('div');
    root.id = 'adminToastRoot';
    root.setAttribute('aria-live', 'polite');
    document.body.appendChild(root);
  }
  return root;
}
export function showToast(message, type = 'success') {
  const root = toastRoot();
  const el = document.createElement('div');
  el.className = 'toast ' + type;
  const icon = type === 'error' ? 'fa-circle-exclamation' : 'fa-circle-check';
  el.innerHTML = `<i class="fa-solid ${icon}" aria-hidden="true"></i><span></span>`;
  el.querySelector('span').textContent = message;
  root.appendChild(el);
  setTimeout(() => {
    el.style.transition = 'opacity .3s ease';
    el.style.opacity = '0';
    setTimeout(() => el.remove(), 300);
  }, 4000);
}

/* ============ MODAL ============ */
let modalOverlay, modalBox, modalHead, modalBody, modalFoot, lastFocused;

function ensureModal() {
  if (modalOverlay) return;
  modalOverlay = document.createElement('div');
  modalOverlay.className = 'modal-overlay';
  modalOverlay.innerHTML = `
    <div class="modal-box" role="dialog" aria-modal="true" aria-labelledby="adminModalTitle">
      <div class="modal-head">
        <h3 id="adminModalTitle"></h3>
        <button type="button" class="icon-btn" id="adminModalClose" aria-label="Close dialog"><i class="fa-solid fa-xmark" aria-hidden="true"></i></button>
      </div>
      <div class="modal-body" id="adminModalBody"></div>
      <div class="modal-foot" id="adminModalFoot" hidden></div>
    </div>`;
  document.body.appendChild(modalOverlay);
  modalBox = modalOverlay.querySelector('.modal-box');
  modalHead = modalOverlay.querySelector('#adminModalTitle');
  modalBody = modalOverlay.querySelector('#adminModalBody');
  modalFoot = modalOverlay.querySelector('#adminModalFoot');
  modalOverlay.querySelector('#adminModalClose').addEventListener('click', closeModal);
  modalOverlay.addEventListener('click', (e) => { if (e.target === modalOverlay) closeModal(); });
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && modalOverlay.classList.contains('open')) closeModal();
  });
}

export function openModal({ title, bodyHTML, footHTML, wide = false }) {
  ensureModal();
  lastFocused = document.activeElement;
  modalHead.textContent = title || '';
  modalBody.innerHTML = bodyHTML || '';
  modalBox.classList.toggle('wide', wide);
  if (footHTML) { modalFoot.innerHTML = footHTML; modalFoot.hidden = false; }
  else { modalFoot.innerHTML = ''; modalFoot.hidden = true; }
  modalOverlay.classList.add('open');
  document.body.style.overflow = 'hidden';
  const firstFocusable = modalBody.querySelector('input,select,textarea,button');
  (firstFocusable || modalOverlay.querySelector('#adminModalClose')).focus();
  return { body: modalBody, foot: modalFoot };
}

export function closeModal() {
  if (!modalOverlay) return;
  modalOverlay.classList.remove('open');
  document.body.style.overflow = '';
  if (lastFocused && typeof lastFocused.focus === 'function') lastFocused.focus();
  setTimeout(() => { modalBody.innerHTML = ''; modalFoot.innerHTML = ''; }, 200);
}

/** Custom confirm dialog (never uses window.confirm, matches the app style). */
export function confirmDialog({ title = 'Are you sure?', message = '', confirmLabel = 'Delete', danger = true }) {
  return new Promise((resolve) => {
    const { foot } = openModal({
      title,
      bodyHTML: `<p style="font-size:14px;line-height:1.7;color:var(--ink-soft);">${escapeHTML(message)}</p>`,
      footHTML: `
        <button type="button" class="btn btn-outline" id="confirmCancelBtn">Cancel</button>
        <button type="button" class="btn ${danger ? 'btn-danger' : 'btn-primary'}" id="confirmOkBtn">${escapeHTML(confirmLabel)}</button>`
    });
    $('#confirmCancelBtn').addEventListener('click', () => { closeModal(); resolve(false); });
    $('#confirmOkBtn').addEventListener('click', () => { closeModal(); resolve(true); });
  });
}

/* ============ IMAGE UPLOAD ============ */
const MAX_FILE_BYTES = 5 * 1024 * 1024; // 5MB, matches the storage bucket limit
const ALLOWED_TYPES = ['image/jpeg', 'image/png', 'image/webp'];

function safeFileName(file) {
  const ext = (file.name.split('.').pop() || 'jpg').toLowerCase().replace(/[^a-z0-9]/g, '');
  const random = Math.random().toString(36).slice(2, 10);
  return `${Date.now()}-${random}.${ext || 'jpg'}`;
}

/**
 * Validates and uploads a single image file to a Supabase Storage bucket,
 * returning its public URL. Throws with a user-readable message on failure.
 */
export async function uploadImageToBucket(bucket, file) {
  if (!file) throw new Error('No file selected.');
  if (!ALLOWED_TYPES.includes(file.type)) {
    throw new Error('Only JPG, PNG, or WEBP images are allowed.');
  }
  if (file.size > MAX_FILE_BYTES) {
    throw new Error('Image is too large — please use a file under 5MB.');
  }
  const path = safeFileName(file);
  const { error: uploadError } = await supabase.storage.from(bucket).upload(path, file, {
    cacheControl: '3600',
    upsert: false,
    contentType: file.type
  });
  if (uploadError) throw new Error(uploadError.message);
  const { data } = supabase.storage.from(bucket).getPublicUrl(path);
  return { url: data.publicUrl, path };
}

export async function deleteImageFromBucket(bucket, path) {
  if (!path) return;
  const { error } = await supabase.storage.from(bucket).remove([path]);
  if (error) console.error('[admin-common] failed to delete storage object:', error.message);
}

/** Extracts the storage object path from a Supabase public URL, for cleanup on delete. */
export function pathFromPublicUrl(bucket, publicUrl) {
  if (!publicUrl) return null;
  const marker = `/object/public/${bucket}/`;
  const idx = publicUrl.indexOf(marker);
  return idx === -1 ? null : publicUrl.slice(idx + marker.length);
}

/* ============ LOADING / EMPTY / ERROR STATE HTML ============ */
export function loadingStateHTML(label = 'Loading…') {
  return `<div class="state-block"><span class="spinner"></span><p style="margin-top:12px;">${escapeHTML(label)}</p></div>`;
}
export function emptyStateHTML(icon, label) {
  return `<div class="state-block"><i class="fa-solid ${icon}" aria-hidden="true"></i><p>${escapeHTML(label)}</p></div>`;
}
export function errorStateHTML(message) {
  return `<div class="state-block error"><i class="fa-solid fa-triangle-exclamation" aria-hidden="true"></i><p>${escapeHTML(message)}</p></div>`;
}
