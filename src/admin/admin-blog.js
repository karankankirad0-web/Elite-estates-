import { supabase } from '../lib/supabaseClient.js';
import {
  $, escapeHTML, formatDate, slugify, showToast, openModal, closeModal, confirmDialog,
  uploadImageToBucket, deleteImageFromBucket, pathFromPublicUrl,
  loadingStateHTML, emptyStateHTML, errorStateHTML
} from './admin-common.js';

const BUCKET = 'blog-images';

export async function render(container) {
  container.innerHTML = `
    <div class="panel">
      <div class="panel-toolbar">
        <h2>Blog Posts</h2>
        <button class="btn btn-primary" id="addPostBtn"><i class="fa-solid fa-plus" aria-hidden="true"></i> New Post</button>
      </div>
      <div class="table-scroll">
        <table class="data-table">
          <thead><tr><th>Post</th><th>Created</th><th>Published</th><th></th></tr></thead>
          <tbody id="postTableBody"><tr><td colspan="4">${loadingStateHTML('Loading posts…')}</td></tr></tbody>
        </table>
      </div>
    </div>`;

  $('#addPostBtn').addEventListener('click', () => openForm(null));
  await load();
}

async function load() {
  const tbody = $('#postTableBody');
  tbody.innerHTML = `<tr><td colspan="4">${loadingStateHTML()}</td></tr>`;
  const { data, error } = await supabase.from('blog_posts').select('*').order('created_at', { ascending: false });
  if (error) { tbody.innerHTML = `<tr><td colspan="4">${errorStateHTML('Could not load posts: ' + error.message)}</td></tr>`; return; }
  if (!data || data.length === 0) { tbody.innerHTML = `<tr><td colspan="4">${emptyStateHTML('fa-newspaper', 'No blog posts yet.')}</td></tr>`; return; }
  tbody.innerHTML = data.map(rowHTML).join('');
  tbody.onclick = onClick;
}

function rowHTML(p) {
  return `
    <tr data-id="${p.id}">
      <td>
        <div style="display:flex;align-items:center;gap:10px;">
          <img class="thumb" src="${p.image_url || ''}" alt="" onerror="this.style.visibility='hidden'">
          <div><div class="cell-title">${escapeHTML(p.title)}</div><div class="cell-sub">/${escapeHTML(p.slug)}</div></div>
        </div>
      </td>
      <td class="cell-sub">${formatDate(p.created_at)}</td>
      <td>${p.published ? '<span class="badge badge-success">Published</span>' : '<span class="badge badge-neutral">Draft</span>'}</td>
      <td>
        <div class="row-actions">
          <button class="icon-btn" data-toggle="${p.id}:${!p.published}" aria-label="${p.published ? 'Unpublish' : 'Publish'} ${escapeHTML(p.title)}">
            <i class="fa-solid ${p.published ? 'fa-eye-slash' : 'fa-eye'}" aria-hidden="true"></i>
          </button>
          <button class="icon-btn" data-edit="${p.id}" aria-label="Edit ${escapeHTML(p.title)}"><i class="fa-solid fa-pen" aria-hidden="true"></i></button>
          <button class="icon-btn danger" data-delete="${p.id}" aria-label="Delete ${escapeHTML(p.title)}"><i class="fa-solid fa-trash" aria-hidden="true"></i></button>
        </div>
      </td>
    </tr>`;
}

async function onClick(e) {
  const toggleSpec = e.target.closest('[data-toggle]')?.getAttribute('data-toggle');
  if (toggleSpec) {
    const [id, next] = toggleSpec.split(':');
    const { error } = await supabase.from('blog_posts').update({ published: next === 'true' }).eq('id', id);
    if (error) { showToast('Update failed: ' + error.message, 'error'); return; }
    showToast(next === 'true' ? 'Post published.' : 'Post unpublished.');
    load();
    return;
  }
  const editId = e.target.closest('[data-edit]')?.getAttribute('data-edit');
  if (editId) {
    const { data, error } = await supabase.from('blog_posts').select('*').eq('id', editId).single();
    if (error) { showToast('Could not load post: ' + error.message, 'error'); return; }
    openForm(data);
    return;
  }
  const deleteId = e.target.closest('[data-delete]')?.getAttribute('data-delete');
  if (deleteId) {
    const ok = await confirmDialog({ title: 'Delete this post?', message: 'This cannot be undone.', confirmLabel: 'Delete' });
    if (!ok) return;
    const { data } = await supabase.from('blog_posts').select('image_url').eq('id', deleteId).single();
    const path = pathFromPublicUrl(BUCKET, data?.image_url);
    if (path) await deleteImageFromBucket(BUCKET, path);
    const { error } = await supabase.from('blog_posts').delete().eq('id', deleteId);
    if (error) { showToast('Delete failed: ' + error.message, 'error'); return; }
    showToast('Post deleted.');
    load();
  }
}

function openForm(existing) {
  const isEdit = Boolean(existing);
  const p = existing || { title: '', excerpt: '', content: '', image_url: '', published: false };

  const { body } = openModal({
    title: isEdit ? 'Edit Post' : 'New Post',
    wide: true,
    bodyHTML: `
      <form id="postForm" novalidate>
        <div class="form-field"><label for="bp-title">Title *</label><input type="text" id="bp-title" value="${escapeHTML(p.title)}" required><div class="form-error" id="err-bp-title"></div></div>
        <div class="form-field"><label for="bp-excerpt">Excerpt</label><input type="text" id="bp-excerpt" value="${escapeHTML(p.excerpt || '')}" placeholder="One or two sentences shown on the blog card"></div>
        <div class="form-field"><label for="bp-content">Content *</label><textarea id="bp-content" style="min-height:160px;" required>${escapeHTML(p.content || '')}</textarea><div class="form-error" id="err-bp-content"></div></div>
        <div class="form-field">
          <label>Cover Image</label>
          <div style="display:flex;align-items:center;gap:12px;">
            <img id="bpPhotoPreview" src="${p.image_url || ''}" alt="" class="thumb" style="width:60px;height:60px;${p.image_url ? '' : 'visibility:hidden;'}">
            <label class="upload-dropzone" style="flex:1;padding:12px;">
              <i class="fa-solid fa-cloud-arrow-up" aria-hidden="true"></i> Upload cover image
              <input type="file" id="bpImageInput" accept="image/jpeg,image/png,image/webp">
            </label>
          </div>
        </div>
        <label class="checkbox-row" style="margin-top:6px;"><input type="checkbox" id="bp-published" ${p.published ? 'checked' : ''}> Published (visible on the public site)</label>
      </form>`,
    footHTML: `
      <button type="button" class="btn btn-outline" id="bpCancelBtn">Cancel</button>
      <button type="submit" form="postForm" class="btn btn-primary" id="bpSaveBtn">${isEdit ? 'Save Changes' : 'Create Post'}</button>`
  });

  let pendingImageUrl = p.image_url || '';
  $('#bpCancelBtn').addEventListener('click', closeModal);
  $('#bpImageInput').addEventListener('change', async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    try {
      const { url } = await uploadImageToBucket(BUCKET, file);
      pendingImageUrl = url;
      const preview = $('#bpPhotoPreview');
      preview.src = url;
      preview.style.visibility = 'visible';
      showToast('Image uploaded.');
    } catch (err) {
      showToast('Upload failed: ' + err.message, 'error');
    }
  });

  body.querySelector('#postForm').addEventListener('submit', async (e) => {
    e.preventDefault();
    $('#err-bp-title').textContent = '';
    $('#err-bp-content').textContent = '';
    const title = $('#bp-title').value.trim();
    const content = $('#bp-content').value.trim();
    let hasError = false;
    if (!title) { $('#err-bp-title').textContent = 'Title is required.'; hasError = true; }
    if (!content) { $('#err-bp-content').textContent = 'Content is required.'; hasError = true; }
    if (hasError) return;

    const payload = {
      title,
      excerpt: $('#bp-excerpt').value.trim(),
      content,
      image_url: pendingImageUrl || null,
      published: $('#bp-published').checked
    };

    const saveBtn = $('#bpSaveBtn');
    saveBtn.disabled = true;
    saveBtn.textContent = 'Saving…';
    try {
      if (isEdit) {
        const { error } = await supabase.from('blog_posts').update(payload).eq('id', existing.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from('blog_posts').insert({ ...payload, slug: await uniqueSlug(title) });
        if (error) throw error;
      }
      showToast(isEdit ? 'Post updated.' : 'Post created.');
      closeModal();
      load();
    } catch (err) {
      showToast('Save failed: ' + err.message, 'error');
      saveBtn.disabled = false;
      saveBtn.textContent = isEdit ? 'Save Changes' : 'Create Post';
    }
  });
}

async function uniqueSlug(title) {
  const base = slugify(title);
  const { data } = await supabase.from('blog_posts').select('slug').ilike('slug', `${base}%`);
  const taken = new Set((data || []).map((r) => r.slug));
  if (!taken.has(base)) return base;
  let i = 2;
  while (taken.has(`${base}-${i}`)) i++;
  return `${base}-${i}`;
}
