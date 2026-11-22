import type { SupabaseClient } from "@supabase/supabase-js";
import { config } from "./config";

/** True when no Supabase project is configured: data stays on this device only. */
export const DEMO_MODE = config.demoMode;

let client: Promise<SupabaseClient> | null = null;

/**
 * Supabase client, loaded lazily so its ~60 KB never delays the first screen.
 * The app renders from local data first; sync starts afterwards.
 */
export function supabase(): Promise<SupabaseClient> | null {
  if (DEMO_MODE) return null;
  client ??= import("@supabase/supabase-js").then(({ createClient }) =>
    createClient(config.supabaseUrl, config.supabaseKey, { auth: { persistSession: true, autoRefreshToken: true, storageKey: "scc-auth" } }),
  );
  return client;
}
