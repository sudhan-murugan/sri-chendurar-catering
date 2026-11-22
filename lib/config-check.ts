// Pure validation of the app's public configuration. Used by next.config.ts to
// FAIL a production build that would otherwise silently run in demo mode
// (data kept only on the phone, never synced).

export interface PublicConfig {
  supabaseUrl?: string;
  supabaseKey?: string;
  demoMode?: string;
}

export function configProblems(c: PublicConfig): string[] {
  if (c.demoMode === "1") return [];
  const problems: string[] = [];
  const url = c.supabaseUrl?.trim();
  const key = c.supabaseKey?.trim();

  if (!url) problems.push("NEXT_PUBLIC_SUPABASE_URL is not set.");
  else {
    try {
      const u = new URL(url);
      if (u.protocol !== "https:") problems.push("NEXT_PUBLIC_SUPABASE_URL must start with https://");
    } catch {
      problems.push(`NEXT_PUBLIC_SUPABASE_URL is not a valid URL: "${url}"`);
    }
  }

  if (!key) problems.push("NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY (or the older NEXT_PUBLIC_SUPABASE_ANON_KEY) is not set.");
  else if (key.startsWith("sb_secret_") || jwtRole(key) === "service_role")
    // a secret key in a NEXT_PUBLIC_ variable would be published to every visitor
    problems.push("The Supabase key is a SECRET key. Use the publishable key (sb_publishable_…) – never a secret/service_role key.");

  return problems;
}

/** Role claim of a legacy JWT key (anon / service_role), or null. */
function jwtRole(key: string): string | null {
  const parts = key.split(".");
  if (parts.length !== 3) return null;
  try {
    const json = JSON.parse(Buffer.from(parts[1].replace(/-/g, "+").replace(/_/g, "/"), "base64").toString("utf8"));
    return typeof json.role === "string" ? json.role : null;
  } catch {
    return null;
  }
}
