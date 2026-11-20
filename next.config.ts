import type { NextConfig } from "next";

// Static export: the whole app is client-side (data lives in IndexedDB and
// syncs to Supabase), so it can be served from Vercel's CDN and cached fully
// by the service worker for offline use.
const nextConfig: NextConfig = {
  output: "export",
  trailingSlash: true,
  images: { unoptimized: true },
  reactStrictMode: true,
};

export default nextConfig;
