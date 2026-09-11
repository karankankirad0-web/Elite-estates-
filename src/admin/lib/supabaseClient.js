import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  // Fails loudly in dev rather than silently making requests to "undefined".
  // See .env.example for what needs to be set.
  console.error(
    '[supabaseClient] Missing VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY. ' +
    'Copy .env.example to .env and fill in your project values.'
  );
}

// Single shared client for the whole app (public site + admin).
// Only the public "anon" key is ever used here — it is safe to ship because
// every table is protected by Row Level Security (see supabase/01_schema.sql
// and supabase/04_admin_security.sql for the admin authorization layer).
export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: true
  }
});

export const isSupabaseConfigured = Boolean(supabaseUrl && supabaseAnonKey);
