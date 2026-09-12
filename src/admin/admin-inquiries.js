import { supabase } from '../lib/supabaseClient.js';
import {
  $, escapeHTML, formatDate, debounce, showToast,
  openModal, closeModal, confirmDialog,
  loadingStateHTML, emptyStateHTML, errorStateHTML
} from './admin-common.js';

const STATUSES = ['New', 'Contacted', 'Closed'];
let state = { search: '', status: 'all' };

export async function render(container) {
  container.innerHTML = `
    <div class="panel">
      <div class="panel-toolbar">
        <h2>Inquiries</h2>
        <div class="toolbar-filters">
          <input type="text" id="inqSearch" placeholder="Search name, email, or message">
          <select id="inqStatusFilter">
            <option value="all">All statuses</option>
            ${STATUSES.map((s) => `<option value="${s}">${s}</option>`).join('')}
          </select>
        </div>
      </div>
      <div class="table-scroll">
        <table class="data-table">
          <thead><tr><th>From</th><th>Message</th><th>Property</th><th>Received</th><th>Status</th><th></th></tr></thead>
          <tbody id="inqTableBody"><tr><td colspan="6">${loadingStateHTML('Loading inquiries…')}</td></tr></tbody>
        </table>
      </div>
    </div>`;

  $('#inqSearch').addEventListener('input', debounce((e) => { state.search = e.target.value.trim(); load(); }, 300));
  $('#inqStatusFilter').addEventListener('change', (e) => { state.status = e.target.value; load(); });
  await load();
}

async function load() {
  const tbody = $('#inqTableBody');
  tbody.innerHTML = `<tr><td colspan="6">${loadingStateHTML()}</td></tr>`;

  let query = supabase
    .from('inquiries')
    .select('*, properties(title)')
    .order('created_at', { ascending: false });
  if (state.status !== 'all') query = query.eq('status', state.status);
  if (state.search) query = query.or(`name.ilike.%${state.search}%,email.ilike.%${state.search}%,message.ilike.%${state.search}%`);

  const { data, error } = await query;
  if (error) { tbody.innerHTML = `<tr><td colspan="6">${errorStateHTML('Could not load inquiries: ' + error.message)}</td></tr>`; return; }
  if (!data || data.length === 0) { tbody.innerHTML = `<tr><td colspan="6">${emptyStateHTML('fa-inbox', 'No inquiries match your filters.')}</td></tr>`; return; }

  tbody.innerHTML = data.map(rowHTML).join('');
  tbody.onclick = onClick;
  tbody.onchange = onStatusChange;
}

function rowHTML(r) {
  return `
    <tr data-id="${r.id}">
      <td>
        <div class="cell-title">${escapeHTML(r.name)}</div>
        <div class="cell-sub">${escapeHTML(r.email || '—')}${r.phone ? ' · ' + escapeHTML(r.phone) : ''}</div>
      </td>
      <td style="max-width:280px;"><span class="cell-sub" style="display:block;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;max-width:280px;">${escapeHTML(r.message || '—')}</span></td>
      <td class="cell-sub">${r.properties ? escapeHTML(r.properties.title) : '—'}</td>
      <td class="cell-sub">${formatDate(r.created_at)}</td>
      <td>
        <select class="status-select" data-status-id="${r.id}">
          ${STATUSES.map((s) => `<option value="${s}" ${r.status === s ? 'selected' : ''}>${s}</option>`).join('')}
        </select>
      </td>
      <td>
        <div class="row-actions">
          <button class="icon-btn" data-view="${r.id}" aria-label="View full message"><i class="fa-solid fa-eye" aria-hidden="true"></i></button>
          <button class="icon-btn danger" data-delete="${r.id}" aria-label="Delete inquiry from ${escapeHTML(r.name)}"><i class="fa-solid fa-trash" aria-hidden="true"></i></button>
        </div>
      </td>
    </tr>`;
}

async function onStatusChange(e) {
  const id = e.target.closest('[data-status-id]')?.getAttribute('data-status-id');
  if (!id) return;
  const { error } = await supabase.from('inquiries').update({ status: e.target.value }).eq('id', id);
  if (error) { showToast('Could not update status: ' + error.message, 'error'); return; }
  showToast('Status updated.');
}

async function onClick(e) {
  const viewId = e.target.closest('[data-view]')?.getAttribute('data-view');
  if (viewId) {
    const { data, error } = await supabase.from('inquiries').select('*, properties(title)').eq('id', viewId).single();
    if (error) { showToast('Could not load inquiry: ' + error.message, 'error'); return; }
    openModal({
      title: 'Inquiry from ' + data.name,
      bodyHTML: `
        <p class="cell-sub" style="margin-bottom:14px;">
          ${escapeHTML(data.email || '')}${data.phone ? ' · ' + escapeHTML(data.phone) : ''}<br>
          ${data.properties ? 'Regarding: ' + escapeHTML(data.properties.title) : ''}<br>
          Received ${formatDate(data.created_at)}
        </p>
        <p style="font-size:14px;line-height:1.8;color:var(--ink);white-space:pre-wrap;">${escapeHTML(data.message || '')}</p>`,
      footHTML: `<button type="button" class="btn btn-outline" id="closeInqModal">Close</button>`
    });
    $('#closeInqModal').addEventListener('click', closeModal);
    return;
  }
  const deleteId = e.target.closest('[data-delete]')?.getAttribute('data-delete');
  if (deleteId) {
    const ok = await confirmDialog({ title: 'Delete this inquiry?', message: 'This cannot be undone.', confirmLabel: 'Delete' });
    if (!ok) return;
    const { error } = await supabase.from('inquiries').delete().eq('id', deleteId);
    if (error) { showToast('Delete failed: ' + error.message, 'error'); return; }
    showToast('Inquiry deleted.');
    load();
  }
}
