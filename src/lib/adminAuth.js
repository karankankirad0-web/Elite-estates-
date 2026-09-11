import { supabase } from './supabaseClient.js';

const ADMIN_EMAILS = (import.meta.env.VITE_ADMIN_EMAILS || '')
  .split(',')
  .map(e => e.trim().toLowerCase())
  .filter(Boolean);

export async function isCurrentUserAdmin() {
  const { data: { session } } = await supabase.auth.getSession();
  if (!session) return false;

  try {
    const { data, error } = await supabase.rpc('is_admin');
    if (error) throw error;
    if (data === true) return true;
  } catch (err) {
    console.warn('[adminAuth] is_admin() RPC check failed, falling back to email allowlist:', err.message);
  }

  const email = session.user?.email?.toLowerCase();
  return Boolean(email && ADMIN_EMAILS.includes(email));
}

export async function adminSignIn(email, password) {
  const { data, error } = await supabase.auth.signInWithPassword({ email, password });
  if (error) throw error;

  const ok = await isCurrentUserAdmin();
  if (!ok) {
    await supabase.auth.signOut();
    throw new Error('This account is not authorized as an admin.');
  }

  return data;
}

export async function adminSignOut() {
  await supabase.auth.signOut();
}

export async function getSession() {
  const { data: { session } } = await supabase.auth.getSession();
  return session;
}

export async function requireAdminSession() {
  const session = await getSession();
  if (!session) {
    window.location.href = '/admin/login.html';
    return null;
  }
  const ok = await isCurrentUserAdmin();
  if (!ok) {
    await supabase.auth.signOut();
    window.location.href = '/admin/login.html';
    return null;
  }
  return session;
}

export function watchSessionAcrossTabs(onChange) {
  const { data: listener } = supabase.auth.onAuthStateChange((_event, session) => {
    onChange(session);
  });
  return () => listener.subscription.unsubscribe();
}
