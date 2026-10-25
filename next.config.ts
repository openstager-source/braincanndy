import type { NextConfig } from "next";

// Static export: the whole site is plain files served from the CDN. The only server code
// is the live AI, a Netlify Function in netlify/functions/answer.mts.
// Security headers are set in netlify.toml; a strict script CSP is added to each page
// at build time by scripts/csp-meta.mjs.
const config: NextConfig = {
  output: "export",
  // For hosting under a sub-path, e.g. NEXT_BASE_PATH=/braincanndy on GitHub Pages.
  basePath: process.env.NEXT_BASE_PATH || undefined,
  images: { unoptimized: true },
  reactStrictMode: true,
  poweredByHeader: false,
};

export default config;
