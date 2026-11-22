import type { NextConfig } from "next";
import { PHASE_PRODUCTION_BUILD } from "next/constants";
import { configProblems } from "./lib/config-check";

// Static export: the whole app is client-side (data lives in IndexedDB and
// syncs to Supabase), so it can be served from any static host's CDN and cached
// fully by the service worker for offline use.
const nextConfig: NextConfig = {
  output: "export",
  trailingSlash: true,
  images: { unoptimized: true },
  reactStrictMode: true,
};

export default function config(phase: string): NextConfig {
  if (phase === PHASE_PRODUCTION_BUILD) {
    const problems = configProblems({
      supabaseUrl: process.env.NEXT_PUBLIC_SUPABASE_URL,
      supabaseKey: process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
      demoMode: process.env.NEXT_PUBLIC_DEMO_MODE,
    });
    if (problems.length) {
      // Fail loudly: a build without these would keep all data on the phone only.
      throw new Error(
        "\n\nProduction build stopped – configuration problem:\n  • " +
          problems.join("\n  • ") +
          "\n\nSet the variables in the hosting dashboard (or .env.local), see .env.example.\n" +
          "For a local demo build without Supabase set NEXT_PUBLIC_DEMO_MODE=1.\n",
      );
    }
  }
  return nextConfig;
}
