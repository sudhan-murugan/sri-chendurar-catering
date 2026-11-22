// The ONLY place the app reads environment variables.
// NEXT_PUBLIC_* values are public by design (protected by database Row Level
// Security) and are baked in at build time: change them in the hosting
// dashboard and redeploy – no code change. Literal process.env.X references are
// required for Next.js to inline them.

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim() || "";
// New Supabase keys are "sb_publishable_…"; the legacy anon key is still accepted.
const supabaseKey = (process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "").trim();

export const config = {
  supabaseUrl,
  supabaseKey,
  /**
   * Demo mode = no server; data stays in this browser only. Used for local
   * development without Supabase. A production build refuses to run in demo
   * mode unless NEXT_PUBLIC_DEMO_MODE=1 is set explicitly (see next.config.ts).
   */
  demoMode: process.env.NEXT_PUBLIC_DEMO_MODE === "1" || !supabaseUrl || !supabaseKey,
} as const;
