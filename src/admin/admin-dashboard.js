import { requireAdminSession, adminSignOut, watchSessionAcrossTabs, getSession } from '../lib/adminAuth.js';
import { $, $all, showToast } from './admin-common.js';

const LOGIN_PATH = '/admin/login.html';

const SECTIONS = {
  overview: { title: 'Overview', loader: () => import('./admin-overview.js') },
  properties: { title: 'Properties', loader: () => import('./admin-properties.js') },
  inquiries: { title: 'Inquiries', loader: () => import('./admin-inquiries.js') },
  appointments: { title: 'Appointments', loader: () => import('./admin-appointments.js') },
  testimonials: { title: 'Testimonials', loader: () => import('./admin-testimonials.js') },
  blog: { title: 'Blog', loader: () => import('./admin-blog.js') },
  newsletter: { title: 'Newsletter', loader: () => import('./admin-newsletter.js') },
  settings: { title: 'Website Settings', loader: () => import('./admin-settings.js') }
};

const contentEl = $('#adminContent');
const pageTitleEl = $('#pageTitle');
const navLinks = $all('.admin-nav-link[data-section]');

function currentSectionKey() {
  const key = (window.location.hash || '#overview').replace('#', '');
  return SECTIONS[key] ? key : 'overview';
}

async function renderSection(key) {
  const section = SECTIONS[key];
  pageTitleEl.textContent = section.title;
  navLinks.forEach((link) => link.classList.toggle('active', link.getAttribute('data-section') === key));
  contentEl.innerHTML = '<div class="state-block"><span class="spinner"></span></div>';
  try {
    const mod = await section.loader();
    await mod.render(contentEl);
  } catch (err) {
    console.error(`[admin-dashboard] failed to load section "${key}":`, err);
    contentEl.innerHTML = `<div class="state-block error"><i class="fa-solid fa-triangle-exclamation" aria-hidden="true"></i><p>Couldn't load this section. Check the browser console for details.</p></div>`;
  }
}

function goToSection(key) {
  if (window.location.hash !== `#${key}`) {
    window.location.hash = key;
  } else {
    renderSection(key);
  }
}

navLinks.forEach((link) => {
  link.addEventListener('click', () => goToSection(link.getAttribute('data-section')));
});
window.addEventListener('hashchange', () => renderSection(currentSectionKey()));

/* ---------- sidebar toggle (mobile) ---------- */
const sidebar = $('#adminSidebar');
const sidebarToggle = $('#sidebarToggle');
sidebarToggle.addEventListener('click', () => {
  const open = sidebar.classList.toggle('open');
  sidebarToggle.setAttribute('aria-expanded', String(open));
});
document.addEventListener('click', (e) => {
  if (!sidebar.classList.contains('open')) return;
  if (sidebar.contains(e.target) || sidebarToggle.contains(e.target)) return;
  sidebar.classList.remove('open');
  sidebarToggle.setAttribute('aria-expanded', 'false');
});
navLinks.forEach((link) => link.addEventListener('click', () => sidebar.classList.remove('open')));

/* ---------- logout ---------- */
$('#logoutBtn').addEventListener('click', async () => {
  await adminSignOut();
  window.location.replace(LOGIN_PATH);
});

/* ---------- boot ---------- */
(async () => {
  const session = await requireAdminSession(LOGIN_PATH);
  if (!session) return; // requireAdminSession already redirected

  $('#adminEmailLabel').textContent = session.user.email || 'Admin';
  watchSessionAcrossTabs(LOGIN_PATH);

  if (!window.location.hash) window.location.hash = 'overview';
  renderSection(currentSectionKey());
})();

// Surface otherwise-silent promise rejections instead of a blank dashboard.
window.addEventListener('unhandledrejection', (e) => {
  console.error('[admin-dashboard] unhandled rejection:', e.reason);
  showToast('Something went wrong — check the console for details.', 'error');
});
