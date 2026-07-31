/**
 * ESM entry for bundlers / Next.js
 * Usage:
 *   import { createClient } from '@supabase/supabase-js'
 *   import { getSupabase, getSession, signIn, signUp, signOut } from '../lib/supabase.js'
 *
 * Env (required):
 *   NEXT_PUBLIC_SUPABASE_URL
 *   NEXT_PUBLIC_SUPABASE_ANON_KEY
 */

import { createClient } from "@supabase/supabase-js";

let _client;

export function getSupabaseEnv() {
  const url =
    (typeof process !== "undefined" && process.env?.NEXT_PUBLIC_SUPABASE_URL) ||
    (typeof import.meta !== "undefined" && import.meta.env?.NEXT_PUBLIC_SUPABASE_URL) ||
    "";
  const anonKey =
    (typeof process !== "undefined" && process.env?.NEXT_PUBLIC_SUPABASE_ANON_KEY) ||
    (typeof import.meta !== "undefined" && import.meta.env?.NEXT_PUBLIC_SUPABASE_ANON_KEY) ||
    "";
  return { url, anonKey, enabled: Boolean(url && anonKey) };
}

export function getSupabase() {
  if (_client) return _client;
  const { url, anonKey, enabled } = getSupabaseEnv();
  if (!enabled) {
    throw new Error(
      "Missing NEXT_PUBLIC_SUPABASE_URL or NEXT_PUBLIC_SUPABASE_ANON_KEY"
    );
  }
  _client = createClient(url, anonKey, {
    auth: {
      persistSession: true,
      autoRefreshToken: true,
      detectSessionInUrl: true,
    },
  });
  return _client;
}

export async function getSession() {
  const { data, error } = await getSupabase().auth.getSession();
  return { session: data?.session ?? null, error };
}

export async function getUser() {
  const { session, error } = await getSession();
  return { user: session?.user ?? null, error };
}

export async function signUp(email, password, metadata = {}) {
  return getSupabase().auth.signUp({
    email,
    password,
    options: { data: metadata },
  });
}

export async function signIn(email, password) {
  return getSupabase().auth.signInWithPassword({ email, password });
}

export async function signOut() {
  return getSupabase().auth.signOut();
}

export async function resetPassword(email, redirectTo) {
  return getSupabase().auth.resetPasswordForEmail(email, {
    redirectTo: redirectTo || undefined,
  });
}

export function onAuthStateChange(callback) {
  return getSupabase().auth.onAuthStateChange(callback);
}
