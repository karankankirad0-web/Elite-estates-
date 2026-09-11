import { supabase } from './supabaseClient.js';

/**
 * Admin-only authentication.
 *
 * Security model: the real authorization boundary is the database. Every
 * admin table's RLS policy checks `public.is_admin()`, which in turn checks
 * whether the signed-in user's id exists in `public.admin_users` (see
 * supabase/04_admin_security.sql). A row in a JWT alone is never enough --
 * only rows present in admin_users can read/write admin data, no matter
 * what a compromised or modified frontend does.
 *
 * VITE_ADMIN_EMAILS below is a UX convenience layered on top of that (so a
 * signed-in-but-not-admin account gets a clear "not authorized" message and
 * is signed out immediately, without waiting on a query to fail) -- it is
 * NOT the security boundary itself. If left unset, admin status is decided
 * purely by admin_users via the is_admin() RPC below.
 */

const ADMIN_EMAILS = (import.meta.env.VITE_ADMIN_EMAILS || '')
  .split(',')
  .map((e) => e.trim().toLowerCase())
  .filter(Boolean);

function isAllowedAdminEmail(email) {
  // If no allow-list is configured, this check is skipped (returns true)
  // and admin status is decided entirely by the is_admin() database check
  // below. Configuring VITE_ADMIN_EMAILS is optional but gives faster,
  // friendlier feedback for a wrong account.
  if (ADMIN_EMAILS.length === 0) return true;
  return ADMIN_EMAILS.includes((email || '').toLowerCase());
}

/** The real authorization check: is this user's id in admin_users? */
async function isAdminInDatabase() {
  const { data, error } = await supabase.rpc('is_admin');
  if (error) {
    console.error('[adminAuth] is_admin() check failed:', error.message);
    return false;
  }
  return data === true;
}

export async function adminSignIn(email, password) {
  const { data, error } = await supabase.auth.signInWithPassword({ email, password });
  if (error) return { ok: false, error: error.message };

  if (!isAllowedAdminEmail(data.user.email)) {
    await supabase.auth.signOut();
    return { ok: false, error: 'This account is not authorized for admin access.' };
  }

  if (!(await isAdminInDatabase())) {
    await supabase.auth.signOut();
    return { ok: false, error: 'This account is not authorized for admin access.' };
  }

  return { ok: true, session: data.session };
}

export async function adminSignOut() {
  await supabase.auth.signOut();
}

export async function getSession() {
  const { data } = await supabase.auth.getSession();
  return data.session || null;
}

export async function isCurrentUserAdmin() {
  const session = await getSession();
  if (!session) return false;
  if (!isAllowedAdminEmail(session.user.email)) return false;
  return isAdminInDatabase();
}

/** Call at the top of every admin page. Redirects if not a valid admin session. */
export async function requireAdminSession(loginPath = '/admin/login.html') {
  const session = await getSession();
  if (!session) {
    window.location.replace(loginPath);
    return null;
  }
  if (!isAllowedAdminEmail(session.user.email)) {
    await supabase.auth.signOut();
    window.location.replace(loginPath);
    return null;
  }
  if (!(await isAdminInDatabase())) {
    await supabase.auth.signOut();
    window.location.replace(loginPath);
    return null;
  }
  return session;
}

/** Keeps the dashboard in sync if the admin logs out in another tab. */
export function watchSessionAcrossTabs(loginPath = '/admin/login.html') {
  supabase.auth.onAuthStateChange((event) => {
    if (event === 'SIGNED_OUT') {
      window.location.replace(loginPath);
    }
  });
}
