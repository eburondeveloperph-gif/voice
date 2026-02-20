import { createBrowserClient } from "@supabase/ssr";
import { type SupabaseClient } from "@supabase/supabase-js";

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SUPABASE_ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

function hasValue(value: string | undefined): value is string {
  return typeof value === "string" && value.length > 0;
}

/**
 * Returns true when baseline Supabase project settings are available.
 */
export function isSupabaseEnabled(): boolean {
  return hasValue(SUPABASE_URL) && hasValue(SUPABASE_ANON_KEY);
}

/**
 * Returns true when service-role credentials are available for server-only
 * operations such as unrestricted storage uploads.
 */
export function isSupabaseAdminEnabled(): boolean {
  return hasValue(SUPABASE_URL) && hasValue(SUPABASE_SERVICE_ROLE_KEY);
}

/**
 * Public-key Supabase client for use in Client Components (Browser).
 */
export function createClient(): SupabaseClient | null {
  if (!hasValue(SUPABASE_URL) || !hasValue(SUPABASE_ANON_KEY)) return null;
  return createBrowserClient(SUPABASE_URL, SUPABASE_ANON_KEY);
}

/**
 * Backward-compatible alias. Will log a warning and return the browser client
 * but shouldn't be used going forward in standard routes.
 */
export function getSupabase(): SupabaseClient | null {
  console.warn("getSupabase() is deprecated. Use createClient() (browser) or createClientServer() (server) instead.");
  return createClient();
}
