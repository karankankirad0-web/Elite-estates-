import { supabase } from '../lib/supabaseClient.js';
import { tableHasColumn } from '../lib/schemaCapabilities.js';
import {
  $, $all, escapeHTML, formatMoney, formatDate, slugify, debounce,
  showToast, openModal, closeModal, confirmDialog,
  uploadImageToBucket, deleteImageFromBucket, pathFromPublicUrl,
  loadingStateHTML, emptyStateHTML, errorStateHTML
} from './admin-common.js';
const BUCKET = 'property-images';
const PROPERTY_TYPES = ['Villa', 'Apartment', 'Penthouse', 'House', 'Commercial'];
const STATUSES = ['active', 'inactive', 'sold', 'rented'];
let state = { search: '', status: 'all', featured: 'all' };
let containerRef;
let hasDealType = false; // set on render() — see supabase/03_optional_deal_type.sql
export async function render(container) {
  containerRef = container;
  hasDealType = await tableHasColumn('properties', 'deal_type');
  container.innerHTML = `
    <div class="panel">
      <div class="panel-toolbar">
        <h2>Properties</h2>
        <div class="toolbar-filters">
          <input type="text" id="propSearch" placeholder="Search by title or location">
          <select id="propStatusFilter">
            <option value="all">All statuses</option>
            ${STATUSES.map((s) => `<option value="${s}">${cap(s)}</option>`).join('')}
          </select>
          <select id="propFeaturedFilter">
            <option value="all">All properties</option>
            <option value="true">Featured only</option>
            <option value="false">Not featured</option>
          </select>
          <button class="btn btn-primary" id="addPropertyBtn"><i class="fa-solid fa-plus" aria-hidden="true"></i> Add Property</button>
        </div>
      </div>
      <div class="table-scroll">
        <table class="data-table">
          <thead>
            <tr><th>Property</th><th>Type</th><th>Price</th><th>Beds/Baths</th><th>Status</th><th>Featured</th><th></th></tr>
          </thead>
          <tbody id="propertyTableBody">
            <tr><td colspan="7">${loadingStateHTML('Loading properties…')}</td></tr>
          </tbody>
        </table>
      </div>
    </div>
  `;
  $('#addPropertyBtn').addEventListener('click', () => openPropertyForm(null));
  $('#propSearch').addEventListener('input', debounce((e) => { state.search = e.target.value.trim(); loadTable(); }, 300));
  $('#propStatusFilter').addEventListener('change', (e) => { state.status = e.target.value; loadTable(); });
  $('#propFeaturedFilter').addEventListener('change', (e) => { state.featured = e.target.value; loadTable(); });
  await loadTable();
}
async function loadTable() {
  const tbody = $('#propertyTableBody');
  tbody.innerHTML = `<tr><td colspan="7">${loadingStateHTML()}</td></tr>`;
  let query = supabase.from('properties').select('*').order('created_at', { ascending: false });
  if (state.status !== 'all') query = query.eq('status', state.status);
  if (state.featured !== 'all') query = query.eq('featured', state.featured === 'true');
  if (state.search) query = query.or(`title.ilike.%${state.search}%,location.ilike.%${state.search}%`);
  const { data, error } = await query;
  if (error) {
    tbody.innerHTML = `<tr><td colspan="7">${errorStateHTML('Could not load properties: ' + error.message)}</td></tr>`;
    return;
  }
  if (!data || data.length === 0) {
    tbody.innerHTML = `<tr><td colspan="7">${emptyStateHTML('fa-house-circle-xmark', 'No properties match your filters yet.')}</td></tr>`;
    return;
  }
  tbody.innerHTML = data.map(rowHTML).join('');
  tbody.onclick = onTableClick;
}
function rowHTML(p) {
  return `
    <tr data-id="${p.id}">
      <td>
        <div class="cell-title">${escapeHTML(p.title)}</div>
        <div class="cell-sub">${escapeHTML(p.location)}</div>
      </td>
      <td>${escapeHTML(p.property_type || '—')}${hasDealType ? ' · ' + (p.deal_type === 'rent' ? 'Rent' : 'Sale') : ''}</td>
      <td>${formatMoney(p.price)}${hasDealType && p.deal_type === 'rent' ? '/mo' : ''}</td>
      <td>${p.bedrooms} bd / ${p.bathrooms} ba</td>
      <td>${statusBadge(p.status)}</td>
      <td>${p.featured ? '<span class="badge badge-teal">Featured</span>' : '<span class="badge badge-neutral">—</span>'}</td>
      <td>
        <div class="row-actions">
          <button class="icon-btn" data-toggle-featured="${p.id}:${!p.featured}" aria-label="${p.featured ? 'Unfeature' : 'Feature'} ${escapeHTML(p.title)}"><i class="fa-solid fa-star" aria-hidden="true"></i></button>
          <button class="icon-btn" data-toggle-active="${p.id}:${p.status === 'active' ? 'inactive' : 'active'}" aria-label="${p.status === 'active' ? 'Deactivate' : 'Activate'} ${escapeHTML(p.title)}"><i class="fa-solid fa-power-off" aria-hidden="true"></i></button>
          <button class="icon-btn" data-edit="${p.id}" aria-label="Edit ${escapeHTML(p.title)}"><i class="fa-solid fa-pen" aria-hidden="true"></i></button>
          <button class="icon-btn danger" data-delete="${p.id}" aria-label="Delete ${escapeHTML(p.title)}"><i class="fa-solid fa-trash" aria-hidden="true"></i></button>
        </div>
      </td>
    </tr>`;
}
function statusBadge(status) {
  const map = { active: 'badge-success', inactive: 'badge-neutral', sold: 'badge-warn', rented: 'badge-warn' };
  return `<span class="badge ${map[status] || 'badge-neutral'}">${cap(status)}</span>`;
}
function cap(s) { return s.charAt(0).toUpperCase() + s.slice(1); }
async function onTableClick(e) {
  const featSpec = e.target.closest('[data-toggle-featured]')?.getAttribute('data-toggle-featured');
  if (featSpec) {
    const [id, next] = featSpec.split(':');
    const { error } = await supabase.from('properties').update({ featured: next === 'true' }).eq('id', id);
    if (error) { showToast('Update failed: ' + error.message, 'error'); return; }
    showToast(next === 'true' ? 'Marked as featured.' : 'Removed from featured.');
    loadTable();
    return;
  }
  const activeSpec = e.target.closest('[data-toggle-active]')?.getAttribute('data-toggle-active');
  if (activeSpec) {
    const [id, next] = activeSpec.split(':');
    const { error } = await supabase.from('properties').update({ status: next }).eq('id', id);
    if (error) { showToast('Update failed: ' + error.message, 'error'); return; }
    showToast(next === 'active' ? 'Property activated.' : 'Property deactivated.');
    loadTable();
    return;
  }
  const editId = e.target.closest('[data-edit]')?.getAttribute('data-edit');
  if (editId) {
    const { data, error } = await supabase.from('properties').select('*').eq('id', editId).single();
    if (error) { showToast('Could not load property: ' + error.message, 'error'); return; }
    openPropertyForm(data);
    return;
  }
  const deleteId = e.target.closest('[data-delete]')?.getAttribute('data-delete');
  if (deleteId) {
    const row = e.target.closest('tr');
    const title = row.querySelector('.cell-title').textContent;
    const ok = await confirmDialog({
      title: 'Delete this property?',
      message: `"${title}" and all of its photos will be permanently deleted. This cannot be undone.`,
      confirmLabel: 'Delete Property'
    });
    if (!ok) return;
    await deleteProperty(deleteId);
  }
}
async function deleteProperty(id) {
  const { data: images } = await supabase.from('property_images').select('image_url').eq('property_id', id);
  await Promise.all((images || []).map((img) => {
    const path = pathFromPublicUrl(BUCKET, img.image_url);
    return path ? deleteImageFromBucket(BUCKET, path) : Promise.resolve();
  }));
  // property_images rows cascade-delete automatically via the FK.
  const { error } = await supabase.from('properties').delete().eq('id', id);
  if (error) { showToast('Delete failed: ' + error.message, 'error'); return; }
  showToast('Property deleted.');
  loadTable();
}
/* =========================================================
   ADD / EDIT FORM
   ========================================================= */
function openPropertyForm(existing) {
  const isEdit = Boolean(existing);
  const p = existing || {
    title: '', slug: '', location: '', city: '', property_type: 'Villa', deal_type: 'sale',
    price: '', bedrooms: '', bathrooms: '', area: '', description: '', amenities: [],
    featured: false, status: 'inactive'
  };
  const amenitiesArray = Array.isArray(p.amenities) ? p.amenities : [];
  const { body, foot } = openModal({
    title: isEdit ? 'Edit Property' : 'Add Property',
    wide: true,
    bodyHTML: `
      <form id="propertyForm" novalidate>
        <div class="form-grid">
          <div class="form-field full">
            <label for="pf-title">Title *</label>
            <input type="text" id="pf-title" value="${escapeHTML(p.title)}" required>
            <div class="form-error" id="err-pf-title"></div>
          </div>
          <div class="form-field">
            <label for="pf-location">Location / Area *</label>
            <input type="text" id="pf-location" value="${escapeHTML(p.location)}" required>
            <div class="form-error" id="err-pf-location"></div>
          </div>
          <div class="form-field">
            <label for="pf-city">City *</label>
            <input type="text" id="pf-city" value="${escapeHTML(p.city)}" required>
            <div class="form-error" id="err-pf-city"></div>
          </div>
          <div class="form-field">
            <label for="pf-type">Property Type</label>
            <select id="pf-type">${PROPERTY_TYPES.map((t) => `<option value="${t}" ${p.property_type === t ? 'selected' : ''}>${t}</option>`).join('')}</select>
          </div>
          <div class="form-field">
            <label for="pf-deal">Buy / Rent</label>
            ${hasDealType
              ? `<select id="pf-deal">
                   <option value="sale" ${p.deal_type === 'sale' ? 'selected' : ''}>For Sale</option>
                   <option value="rent" ${p.deal_type === 'rent' ? 'selected' : ''}>For Rent</option>
                 </select>`
              : `<select id="pf-deal" disabled><option>For Sale (run 03_optional_deal_type.sql to enable Rent)</option></select>`}
          </div>
          <div class="form-field">
            <label for="pf-price">Price *</label>
            <input type="number" id="pf-price" min="0" step="1" value="${p.price}" required>
            <div class="form-error" id="err-pf-price"></div>
          </div>
          <div class="form-field">
            <label for="pf-status">Status</label>
            <select id="pf-status">${STATUSES.map((s) => `<option value="${s}" ${p.status === s ? 'selected' : ''}>${cap(s)}</option>`).join('')}</select>
          </div>
          <div class="form-field">
            <label for="pf-beds">Bedrooms</label>
            <input type="number" id="pf-beds" min="0" step="1" value="${p.bedrooms}">
          </div>
          <div class="form-field">
            <label for="pf-baths">Bathrooms</label>
            <input type="number" id="pf-baths" min="0" step="1" value="${p.bathrooms}">
          </div>
          <div class="form-field">
            <label for="pf-area">Area (sqft)</label>
            <input type="number" id="pf-area" min="0" step="1" value="${p.area}">
          </div>
          <div class="form-field">
            <label class="checkbox-row" style="margin-top:26px;"><input type="checkbox" id="pf-featured" ${p.featured ? 'checked' : ''}> Featured on homepage</label>
          </div>
          <div class="form-field full">
            <label for="pf-description">Description</label>
            <textarea id="pf-description">${escapeHTML(p.description || '')}</textarea>
          </div>
          <div class="form-field full">
            <label for="pf-amenities">Amenities (comma-separated)</label>
            <input type="text" id="pf-amenities" value="${escapeHTML(amenitiesArray.join(', '))}" placeholder="Swimming Pool, Smart Home System, 24/7 Security">
          </div>
        </div>
        <div class="form-field full">
          <label>Photos</label>
          ${isEdit
            ? `<div class="image-manager" id="imageManager"></div>
               <label class="upload-dropzone" id="uploadDropzone">
                 <i class="fa-solid fa-cloud-arrow-up" aria-hidden="true"></i> Click to upload JPG/PNG/WEBP, up to 5MB each
                 <input type="file" id="imageInput" accept="image/jpeg,image/png,image/webp" multiple>
               </label>`
            : `<p style="font-size:13px;color:var(--ink-soft);">Save the property first, then you'll be able to upload photos here.</p>`}
        </div>
      </form>
    `,
    footHTML: `
      <button type="button" class="btn btn-outline" id="pfCancelBtn">Cancel</button>
      <button type="submit" form="propertyForm" class="btn btn-primary" id="pfSaveBtn">${isEdit ? 'Save Changes' : 'Create Property'}</button>
    `
  });
  $('#pfCancelBtn').addEventListener('click', closeModal);
  if (isEdit) loadImageManager(existing.id);
  $('#propertyForm').addEventListener('submit', async (e) => {
    e.preventDefault();
    await savePropertyForm(existing);
  });
}
function readFormValues() {
  const values = {
    title: $('#pf-title').value.trim(),
    location: $('#pf-location').value.trim(),
    city: $('#pf-city').value.trim(),
    property_type: $('#pf-type').value,
    price: parseFloat($('#pf-price').value),
    status: $('#pf-status').value,
    bedrooms: parseInt($('#pf-beds').value, 10) || 0,
    bathrooms: parseInt($('#pf-baths').value, 10) || 0,
    area: parseFloat($('#pf-area').value) || 0,
    featured: $('#pf-featured').checked,
    description: $('#pf-description').value.trim(),
    amenities: $('#pf-amenities').value.split(',').map((a) => a.trim()).filter(Boolean)
  };
  if (hasDealType) values.deal_type = $('#pf-deal').value;
  return values;
}
async function savePropertyForm(existing) {
  ['title', 'location', 'city', 'price'].forEach((f) => { const el = document.getElementById(`err-pf-${f}`); if (el) el.textContent = ''; });
  const values = readFormValues();
  let hasError = false;
  if (!values.title) { $('#err-pf-title').textContent = 'Title is required.'; hasError = true; }
  if (!values.location) { $('#err-pf-location').textContent = 'Location is required.'; hasError = true; }
  if (!values.city) { $('#err-pf-city').textContent = 'City is required.'; hasError = true; }
  if (Number.isNaN(values.price) || values.price < 0) { $('#err-pf-price').textContent = 'Enter a valid price.'; hasError = true; }
  if (hasError) return;
  const saveBtn = $('#pfSaveBtn');
  saveBtn.disabled = true;
  saveBtn.innerHTML = '<span class="spinner on-dark" style="border-color:rgba(255,255,255,.3);border-top-color:#fff;"></span> Saving…';
  try {
    if (existing) {
      const { error } = await supabase.from('properties').update(values).eq('id', existing.id);
      if (error) throw error;
      showToast('Property updated.');
      closeModal();
    } else {
      const slug = await uniqueSlug(values.title);
      const { data, error } = await supabase.from('properties').insert({ ...values, slug }).select().single();
      if (error) throw error;
      showToast('Property created — now add some photos.');
      openPropertyForm(data); // reopen in edit mode so images can be added immediately
    }
    loadTable();
  } catch (err) {
    showToast('Save failed: ' + err.message, 'error');
    saveBtn.disabled = false;
    saveBtn.textContent = existing ? 'Save Changes' : 'Create Property';
  }
}
async function uniqueSlug(title) {
  const base = slugify(title);
  const { data } = await supabase.from('properties').select('slug').ilike('slug', `${base}%`);
  const taken = new Set((data || []).map((r) => r.slug));
  if (!taken.has(base)) return base;
  let i = 2;
  while (taken.has(`${base}-${i}`)) i++;
  return `${base}-${i}`;
}
/* =========================================================
   IMAGE MANAGER (inside the edit modal)
   ========================================================= */
async function loadImageManager(propertyId) {
  const manager = document.getElementById('imageManager');
  if (!manager) return;
  manager.innerHTML = '<span class="spinner"></span>';
  const { data, error } = await supabase.from('property_images').select('*').eq('property_id', propertyId).order('sort_order');
  if (error) { manager.innerHTML = ''; showToast('Could not load images: ' + error.message, 'error'); return; }
  renderImageManager(propertyId, data || []);
  const input = document.getElementById('imageInput');
  if (input) {
    input.addEventListener('change', async () => {
      const files = Array.from(input.files || []);
      input.value = '';
      for (const file of files) {
        try {
          const { url } = await uploadImageToBucket('property-images', file);
          const nextOrder = (data || []).length;
          const { error: insertErr } = await supabase.from('property_images').insert({
            property_id: propertyId, image_url: url, sort_order: nextOrder
          });
          if (insertErr) throw insertErr;
        } catch (err) {
          showToast('Upload failed: ' + err.message, 'error');
        }
      }
      loadImageManager(propertyId);
    });
  }
}
function renderImageManager(propertyId, images) {
  const manager = document.getElementById('imageManager');
  if (!manager) return;
  if (images.length === 0) {
    manager.innerHTML = '<p style="font-size:12.5px;color:var(--ink-soft);">No photos yet.</p>';
  } else {
    manager.innerHTML = images.map((img, i) => `
      <div class="img-item" data-image-id="${img.id}">
        <img src="${img.image_url}" alt="Property photo ${i + 1}" loading="lazy">
        <button type="button" class="img-remove" data-remove-image="${img.id}" aria-label="Remove this photo"><i class="fa-solid fa-xmark" aria-hidden="true"></i></button>
        <div class="img-move">
          <button type="button" data-move="${img.id}:up" ${i === 0 ? 'disabled' : ''} aria-label="Move earlier"><i class="fa-solid fa-arrow-left" aria-hidden="true"></i></button>
          <button type="button" data-move="${img.id}:down" ${i === images.length - 1 ? 'disabled' : ''} aria-label="Move later"><i class="fa-solid fa-arrow-right" aria-hidden="true"></i></button>
        </div>
      </div>`).join('');
  }
  manager.onclick = async (e) => {
    const removeId = e.target.closest('[data-remove-image]')?.getAttribute('data-remove-image');
    if (removeId) {
      const img = images.find((i) => i.id === removeId);
      const ok = await confirmDialog({ title: 'Remove this photo?', message: 'This photo will be permanently deleted.', confirmLabel: 'Remove' });
      if (!ok) return;
      const path = pathFromPublicUrl('property-images', img.image_url);
      if (path) await deleteImageFromBucket('property-images', path);
      await supabase.from('property_images').delete().eq('id', removeId);
      showToast('Photo removed.');
      loadImageManager(propertyId);
      return;
    }
    const moveSpec = e.target.closest('[data-move]')?.getAttribute('data-move');
    if (moveSpec) {
      const [id, dir] = moveSpec.split(':');
      await reorderImage(propertyId, images, id, dir);
    }
  };
}

async function reorderImage(propertyId, images, id, dir) {
  const idx = images.findIndex((i) => i.id === id);
  const swapWith = dir === 'up' ? idx - 1 : idx + 1;
  if (swapWith < 0 || swapWith >= images.length) return;

  const a = images[idx], b = images[swapWith];
  const updates = [
    supabase.from('property_images').update({ sort_order: b.sort_order }).eq('id', a.id),
    supabase.from('property_images').update({ sort_order: a.sort_order }).eq('id', b.id)
  ];
  const results = await Promise.all(updates);
  const failed = results.find((r) => r.error);
  if (failed) { showToast('Reorder failed: ' + failed.error.message, 'error'); return; }
  loadImageManager(propertyId);
}
