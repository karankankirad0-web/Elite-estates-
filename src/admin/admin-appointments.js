import { supabase } from '../lib/supabaseClient.js';
import {
  $, escapeHTML, formatDate, debounce, showToast, confirmDialog,
  loadingStateHTML, emptyStateHTML, errorStateHTML
} from './admin-common.js';

const STATUSES = ['Pending', 'Confirmed', 'Completed', 'Cancelled'];
let state = { search: '', status: 'all' };

export async function render(container) {
  container.innerHTML = `
    <div class="panel">
      <div class="panel-toolbar">
        <h2>Appointments</h2>
        <div class="toolbar-filters">
          <input type="text" id="apptSearch" placeholder="Search name or email">
          <select id="apptStatusFilter">
            <option value="all">All statuses</option>
            ${STATUSES.map((s) => `<option value="${s}">${s}</option>`).join('')}
          </select>
        </div>
      </div>
      <div class="table-scroll">
        <table class="data-table">
          <thead><tr><th>Visitor</th><th>Property</th><th>Preferred</th><th>Status</th><th></th></tr></thead>
          <tbody id="apptTableBody"><tr><td colspan="5">${loadingStateHTML('Loading appointments…')}</td></tr></tbody>
        </table>
      </div>
    </div>`;

  $('#apptSearch').addEventListener('input', debounce((e) => { state.search = e.target.value.trim(); load(); }, 300));
  $('#apptStatusFilter').addEventListener('change', (e) => { state.status = e.target.value; load(); });
  await load();
}

async function load() {
  const tbody = $('#apptTableBody');
  tbody.innerHTML = `<tr><td colspan="5">${loadingStateHTML()}</td></tr>`;

  let query = supabase
    .from('appointments')
    .select('*, properties(title)')
    .order('preferred_date', { ascending: true });
  if (state.status !== 'all') query = query.eq('status', state.status);
  if (state.search) query = query.or(`name.ilike.%${state.search}%,email.ilike.%${state.search}%`);

  const { data, error } = await query;
  if (error) { tbody.innerHTML = `<tr><td colspan="5">${errorStateHTML('Could not load appointments: ' + error.message)}</td></tr>`; return; }
  if (!data || data.length === 0) { tbody.innerHTML = `<tr><td colspan="5">${emptyStateHTML('fa-calendar-xmark', 'No appointments match your filters.')}</td></tr>`; return; }

  tbody.innerHTML = data.map(rowHTML).join('');
  tbody.onclick = onClick;
}

function rowHTML(a) {
  return `
    <tr data-id="${a.id}">
      <td>
        <div class="cell-title">${escapeHTML(a.name)}</div>
        <div class="cell-sub">${escapeHTML(a.email || '—')}${a.phone ? ' · ' + escapeHTML(a.phone) : ''}</div>
      </td>
      <td class="cell-sub">${a.properties ? escapeHTML(a.properties.title) : '—'}</td>
      <td class="cell-sub">${escapeHTML(a.preferred_date)} ${a.preferred_time ? 'at ' + escapeHTML(a.preferred_time.slice(0, 5)) : ''}</td>
      <td>${statusBadge(a.status)}</td>
      <td>
        <div class="row-actions">
          ${a.status !== 'Confirmed' ? `<button class="icon-btn" data-status="${a.id}:Confirmed" aria-label="Confirm appointment for ${escapeHTML(a.name)}"><i class="fa-solid fa-check" aria-hidden="true"></i></button>` : ''}
          ${a.status !== 'Completed' ? `<button class="icon-btn" data-status="${a.id}:Completed" aria-label="Mark completed"><i class="fa-solid fa-flag-checkered" aria-hidden="true"></i></button>` : ''}
          ${a.status !== 'Cancelled' ? `<button class="icon-btn" data-status="${a.id}:Cancelled" aria-label="Cancel appointment"><i class="fa-solid fa-ban" aria-hidden="true"></i></button>` : ''}
          <button class="icon-btn danger" data-delete="${a.id}" aria-label="Delete appointment for ${escapeHTML(a.name)}"><i class="fa-solid fa-trash" aria-hidden="true"></i></button>
        </div>
      </td>
    </tr>`;
}

function statusBadge(status) {
  const map = { Pending: 'badge-warn', Confirmed: 'badge-teal', Completed: 'badge-success', Cancelled: 'badge-danger' };
  return `<span class="badge ${map[status] || 'badge-neutral'}">${status}</span>`;
}

async function onClick(e) {
  const statusSpec = e.target.closest('[data-status]')?.getAttribute('data-status');
  if (statusSpec) {
    const [id, newStatus] = statusSpec.split(':');
    const { error } = await supabase.from('appointments').update({ status: newStatus }).eq('id', id);
    if (error) { showToast('Update failed: ' + error.message, 'error'); return; }
    showToast(`Appointment marked ${newStatus.toLowerCase()}.`);
    load();
    return;
  }
  const deleteId = e.target.closest('[data-delete]')?.getAttribute('data-delete');
  if (deleteId) {
    const ok = await confirmDialog({ title: 'Delete this appointment?', message: 'This cannot be undone.', confirmLabel: 'Delete' });
    if (!ok) return;
    const { error } = await supabase.from('appointments').delete().eq('id', deleteId);
    if (error) { showToast('Delete failed: ' + error.message, 'error'); return; }
    showToast('Appointment deleted.');
    load();
  }
}
