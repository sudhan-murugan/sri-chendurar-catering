import type { SupabaseClient } from "@supabase/supabase-js";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

/** True when no Supabase project is configured: data stays on this phone only. */
export const DEMO_MODE = !url || !key;

let client: Promise<SupabaseClient> | null = null;

/**
 * Supabase client, loaded lazily so its ~60 KB never delays the first screen.
 * The app renders from local data first; sync starts afterwards.
 */
export function supabase(): Promise<SupabaseClient> | null {
  if (DEMO_MODE) return null;
  client ??= import("@supabase/supabase-js").then(({ createClient }) =>
    createClient(url!, key!, { auth: { persistSession: true, autoRefreshToken: true, storageKey: "scc-auth" } }),
  );
  return client;
}
