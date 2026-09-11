import { adminSignIn, getSession, isCurrentUserAdmin } from '../lib/adminAuth.js';
import { $ } from './admin-common.js';

const DASHBOARD_PATH = '/admin/dashboard.html';

// Already signed in as admin? Skip the login screen.
(async () => {
  const session = await getSession();
  if (session && (await isCurrentUserAdmin())) {
    window.location.replace(DASHBOARD_PATH);
  }
})();

const form = $('#loginForm');
const statusEl = $('#loginStatus');
let submitting = false;

form.addEventListener('submit', async (e) => {
  e.preventDefault();
  if (submitting) return;

  const email = $('#loginEmail').value.trim();
  const password = $('#loginPassword').value;
  $('#err-loginEmail').textContent = '';
  $('#err-loginPassword').textContent = '';
  statusEl.className = 'login-status';

  let ok = true;
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    $('#err-loginEmail').textContent = 'Enter a valid email address.';
    ok = false;
  }
  if (!password) {
    $('#err-loginPassword').textContent = 'Enter your password.';
    ok = false;
  }
  if (!ok) return;

  submitting = true;
  const btn = $('#loginSubmitBtn');
  btn.disabled = true;
  $('#loginSubmitLabel').innerHTML = '<span class="spinner on-dark" style="border-top-color:#fff;border-color:rgba(255,255,255,.3);"></span> Signing in…';

  const result = await adminSignIn(email, password);

  if (!result.ok) {
    statusEl.className = 'login-status show error';
    statusEl.textContent = result.error || 'Sign-in failed. Please try again.';
    $('#loginSubmitLabel').textContent = 'Sign In';
    btn.disabled = false;
    submitting = false;
    return;
  }

  statusEl.className = 'login-status show success';
  statusEl.textContent = 'Signed in — redirecting…';
  window.location.href = DASHBOARD_PATH;
});
