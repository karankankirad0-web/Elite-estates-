import { supabase } from '../lib/supabaseClient.js';
import {
  $, escapeHTML, formatDate, showToast, openModal, closeModal, confirmDialog,
  uploadImageToBucket, deleteImageFromBucket, pathFromPublicUrl,
  loadingStateHTML, emptyStateHTML, errorStateHTML
} from './admin-common.js';

const BUCKET = 'testimonial-images';

export async function render(container) {
  container.innerHTML = `
    <div class="panel">
      <div class="panel-toolbar">
        <h2>Testimonials</h2>
        <button class="btn btn-primary" id="addTestimonialBtn"><i class="fa-solid fa-plus" aria-hidden="true"></i> Add Testimonial</button>
      </div>
      <div class="table-scroll">
        <table class="data-table">
          <thead><tr><th>Reviewer</th><th>Message</th><th>Rating</th><th>Published</th><th></th></tr></thead>
          <tbody id="testTableBody"><tr><td colspan="5">${loadingStateHTML('Loading testimonials…')}</td></tr></tbody>
        </table>
      </div>
    </div>`;

  $('#addTestimonialBtn').addEventListener('click', () => openForm(null));
  await load();
}

async function load() {
  const tbody = $('#testTableBody');
  tbody.innerHTML = `<tr><td colspan="5">${loadingStateHTML()}</td></tr>`;
  const { data, error } = await supabase.from('testimonials').select('*').order('created_at', { ascending: false });
  if (error) { tbody.innerHTML = `<tr><td colspan="5">${errorStateHTML('Could not load testimonials: ' + error.message)}</td></tr>`; return; }
  if (!data || data.length === 0) { tbody.innerHTML = `<tr><td colspan="5">${emptyStateHTML('fa-comment-slash', 'No testimonials yet.')}</td></tr>`; return; }
  tbody.innerHTML = data.map(rowHTML).join('');
  tbody.onclick = onClick;
}

function rowHTML(t) {
  return `
    <tr data-id="${t.id}">
      <td>
        <div style="display:flex;align-items:center;gap:10px;">
          <img class="thumb" src="${t.image_url || ''}" alt="" onerror="this.style.visibility='hidden'">
          <div><div class="cell-title">${escapeHTML(t.name)}</div><div class="cell-sub">${escapeHTML(t.role || '')}</div></div>
        </div>
      </td>
      <td style="max-width:280px;"><span class="cell-sub" style="display:block;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;max-width:280px;">${escapeHTML(t.message)}</span></td>
      <td class="cell-sub">${'★'.repeat(t.rating)}${'☆'.repeat(5 - t.rating)}</td>
      <td>${t.published ? '<span class="badge badge-success">Published</span>' : '<span class="badge badge-neutral">Draft</span>'}</td>
      <td>
        <div class="row-actions">
          <button class="icon-btn" data-toggle="${t.id}:${!t.published}" aria-label="${t.published ? 'Unpublish' : 'Publish'} testimonial from ${escapeHTML(t.name)}">
            <i class="fa-solid ${t.published ? 'fa-eye-slash' : 'fa-eye'}" aria-hidden="true"></i>
          </button>
          <button class="icon-btn" data-edit="${t.id}" aria-label="Edit testimonial from ${escapeHTML(t.name)}"><i class="fa-solid fa-pen" aria-hidden="true"></i></button>
          <button class="icon-btn danger" data-delete="${t.id}" aria-label="Delete testimonial from ${escapeHTML(t.name)}"><i class="fa-solid fa-trash" aria-hidden="true"></i></button>
        </div>
      </td>
    </tr>`;
}

async function onClick(e) {
  const toggleSpec = e.target.closest('[data-toggle]')?.getAttribute('data-toggle');
  if (toggleSpec) {
    const [id, next] = toggleSpec.split(':');
    const { error } = await supabase.from('testimonials').update({ published: next === 'true' }).eq('id', id);
    if (error) { showToast('Update failed: ' + error.message, 'error'); return; }
    showToast(next === 'true' ? 'Testimonial published.' : 'Testimonial unpublished.');
    load();
    return;
  }
  const editId = e.target.closest('[data-edit]')?.getAttribute('data-edit');
  if (editId) {
    const { data, error } = await supabase.from('testimonials').select('*').eq('id', editId).single();
    if (error) { showToast('Could not load testimonial: ' + error.message, 'error'); return; }
    openForm(data);
    return;
  }
  const deleteId = e.target.closest('[data-delete]')?.getAttribute('data-delete');
  if (deleteId) {
    const ok = await confirmDialog({ title: 'Delete this testimonial?', message: 'This cannot be undone.', confirmLabel: 'Delete' });
    if (!ok) return;
    const { data } = await supabase.from('testimonials').select('image_url').eq('id', deleteId).single();
    const path = pathFromPublicUrl(BUCKET, data?.image_url);
    if (path) await deleteImageFromBucket(BUCKET, path);
    const { error } = await supabase.from('testimonials').delete().eq('id', deleteId);
    if (error) { showToast('Delete failed: ' + error.message, 'error'); return; }
    showToast('Testimonial deleted.');
    load();
  }
}

function openForm(existing) {
  const isEdit = Boolean(existing);
  const t = existing || { name: '', role: '', message: '', rating: 5, image_url: '', published: false };

  const { body } = openModal({
    title: isEdit ? 'Edit Testimonial' : 'Add Testimonial',
    bodyHTML: `
      <form id="testForm" novalidate>
        <div class="form-field"><label for="tf-name">Name *</label><input type="text" id="tf-name" value="${escapeHTML(t.name)}" required><div class="form-error" id="err-tf-name"></div></div>
        <div class="form-field"><label for="tf-role">Role / Location</label><input type="text" id="tf-role" value="${escapeHTML(t.role || '')}" placeholder="e.g. Purchased in Bangalore, 2025"></div>
        <div class="form-field"><label for="tf-message">Message *</label><textarea id="tf-message" required>${escapeHTML(t.message)}</textarea><div class="form-error" id="err-tf-message"></div></div>
        <div class="form-field">
          <label for="tf-rating">Rating</label>
          <select id="tf-rating">${[5, 4, 3, 2, 1].map((n) => `<option value="${n}" ${t.rating === n ? 'selected' : ''}>${n} star${n > 1 ? 's' : ''}</option>`).join('')}</select>
        </div>
        <div class="form-field">
          <label>Photo</label>
          <div style="display:flex;align-items:center;gap:12px;">
            <img id="tfPhotoPreview" src="${t.image_url || ''}" alt="" class="thumb" style="width:60px;height:60px;${t.image_url ? '' : 'visibility:hidden;'}">
            <label class="upload-dropzone" style="flex:1;padding:12px;">
              <i class="fa-solid fa-cloud-arrow-up" aria-hidden="true"></i> Upload photo
              <input type="file" id="tfImageInput" accept="image/jpeg,image/png,image/webp">
            </label>
          </div>
        </div>
        <label class="checkbox-row" style="margin-top:6px;"><input type="checkbox" id="tf-published" ${t.published ? 'checked' : ''}> Published (visible on the public site)</label>
      </form>`,
    footHTML: `
      <button type="button" class="btn btn-outline" id="tfCancelBtn">Cancel</button>
      <button type="submit" form="testForm" class="btn btn-primary" id="tfSaveBtn">${isEdit ? 'Save Changes' : 'Add Testimonial'}</button>`
  });

  let pendingImageUrl = t.image_url || '';
  $('#tfCancelBtn').addEventListener('click', closeModal);
  $('#tfImageInput').addEventListener('change', async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    try {
      const { url } = await uploadImageToBucket(BUCKET, file);
      pendingImageUrl = url;
      const preview = $('#tfPhotoPreview');
      preview.src = url;
      preview.style.visibility = 'visible';
      showToast('Photo uploaded.');
    } catch (err) {
      showToast('Upload failed: ' + err.message, 'error');
    }
  });

  body.querySelector('#testForm').addEventListener('submit', async (e) => {
    e.preventDefault();
    $('#err-tf-name').textContent = '';
    $('#err-tf-message').textContent = '';
    const name = $('#tf-name').value.trim();
    const message = $('#tf-message').value.trim();
    let hasError = false;
    if (!name) { $('#err-tf-name').textContent = 'Name is required.'; hasError = true; }
    if (!message) { $('#err-tf-message').textContent = 'Message is required.'; hasError = true; }
    if (hasError) return;

    const payload = {
      name,
      role: $('#tf-role').value.trim(),
      message,
      rating: parseInt($('#tf-rating').value, 10),
      image_url: pendingImageUrl || null,
      published: $('#tf-published').checked
    };

    const saveBtn = $('#tfSaveBtn');
    saveBtn.disabled = true;
    saveBtn.textContent = 'Saving…';
    const query = isEdit
      ? supabase.from('testimonials').update(payload).eq('id', existing.id)
      : supabase.from('testimonials').insert(payload);
    const { error } = await query;
    if (error) { showToast('Save failed: ' + error.message, 'error'); saveBtn.disabled = false; saveBtn.textContent = isEdit ? 'Save Changes' : 'Add Testimonial'; return; }
    showToast(isEdit ? 'Testimonial updated.' : 'Testimonial added.');
    closeModal();
    load();
  });
}
