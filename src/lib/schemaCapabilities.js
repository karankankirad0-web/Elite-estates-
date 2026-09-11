import { supabase } from './supabaseClient.js';

const cache = new Map();

/**
 * Cheaply checks whether a column exists by attempting to select it with
 * a zero-row limit. Result is cached for the lifetime of the page so this
 * only ever runs once per column per session.
 *
 * Used for the OPTIONAL `properties.deal_type` column — see
 * supabase/03_optional_deal_type.sql. Everything else in this app maps
 * directly to columns that are always present in the exact schema, so this
 * helper is intentionally only used for that one optional field.
 */
export async function tableHasColumn(table, column) {
  const key = `${table}.${column}`;
  if (cache.has(key)) return cache.get(key);

  const { error } = await supabase.from(table).select(column).limit(0);
  const exists = !error;
  cache.set(key, exists);
  if (error && error.code !== '42703' /* undefined_column */) {
    // Some other error (network, RLS, etc) — don't cache a false negative.
    cache.delete(key);
  }
  return exists;
}
