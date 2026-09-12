import { supabase } from '../lib/supabaseClient.js';
import {
  $, escapeHTML, formatDate, debounce, showToast, confirmDialog,
  loadingStateHTML, emptyStateHTML, errorStateHTML
} from './admin-common.js';

let state = { search: '' };
let currentRows = [];

export async function render(container) {
  container.innerHTML = `
    <div class="panel">
      <div class="panel-toolbar">
        <h2>Newsletter Subscribers</h2>
        <div class="toolbar-filters">
          <input type="text" id="subSearch" placeholder="Search email">
          <button class="btn btn-outline" id="exportCsvBtn"><i class="fa-solid fa-file-csv" aria-hidden="true"></i> Export CSV</button>
        </div>
      </div>
      <div class="table-scroll">
        <table class="data-table">
          <thead><tr><th>Email</th><th>Subscribed</th><th></th></tr></thead>
          <tbody id="subTableBody"><tr><td colspan="3">${loadingStateHTML('Loading subscribers…')}</td></tr></tbody>
        </table>
      </div>
    </div>`;

  $('#subSearch').addEventListener('input', debounce((e) => { state.search = e.target.value.trim(); load(); }, 300));
  $('#exportCsvBtn').addEventListener('click', exportCsv);
  await load();
}

async function load() {
  const tbody = $('#subTableBody');
  tbody.innerHTML = `<tr><td colspan="3">${loadingStateHTML()}</td></tr>`;

  let query = supabase.from('newsletter_subscribers').select('*').order('created_at', { ascending: false });
  if (state.search) query = query.ilike('email', `%${state.search}%`);

  const { data, error } = await query;
  if (error) { tbody.innerHTML = `<tr><td colspan="3">${errorStateHTML('Could not load subscribers: ' + error.message)}</td></tr>`; return; }
  currentRows = data || [];
  if (currentRows.length === 0) { tbody.innerHTML = `<tr><td colspan="3">${emptyStateHTML('fa-at', 'No subscribers yet.')}</td></tr>`; return; }

  tbody.innerHTML = currentRows.map((s) => `
    <tr data-id="${s.id}">
      <td class="cell-title">${escapeHTML(s.email)}</td>
      <td class="cell-sub">${formatDate(s.created_at)}</td>
      <td><div class="row-actions"><button class="icon-btn danger" data-delete="${s.id}" aria-label="Delete subscriber ${escapeHTML(s.email)}"><i class="fa-solid fa-trash" aria-hidden="true"></i></button></div></td>
    </tr>`).join('');
  tbody.onclick = onClick;
}

async function onClick(e) {
  const deleteId = e.target.closest('[data-delete]')?.getAttribute('data-delete');
  if (!deleteId) return;
  const ok = await confirmDialog({ title: 'Remove this subscriber?', message: 'This cannot be undone.', confirmLabel: 'Remove' });
  if (!ok) return;
  const { error } = await supabase.from('newsletter_subscribers').delete().eq('id', deleteId);
  if (error) { showToast('Delete failed: ' + error.message, 'error'); return; }
  showToast('Subscriber removed.');
  load();
}

function exportCsv() {
  if (currentRows.length === 0) { showToast('No subscribers to export.', 'error'); return; }
  const header = 'email,subscribed_at\n';
  const rows = currentRows.map((s) => `${csvEscape(s.email)},${csvEscape(s.created_at)}`).join('\n');
  const blob = new Blob([header + rows], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `elite-estates-subscribers-${new Date().toISOString().slice(0, 10)}.csv`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}
function csvEscape(v) {
  const s = String(v ?? '');
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}
