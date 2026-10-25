// Builds a single self-contained HTML file of the demo (scoring runs in the browser, no live AI).
// Usage: node scripts/build-static.mjs [outFile]
import { build } from "esbuild";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname } from "node:path";

const out = process.argv[2] ?? "dist/foolproof.html";
const res = await build({
  entryPoints: ["scripts/static-entry.tsx"],
  bundle: true,
  minify: true,
  write: false,
  format: "iife",
  jsx: "automatic",
  target: "es2020",
  define: { "process.env.NODE_ENV": '"production"', "process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY": "undefined" },
  logLevel: "error",
});
const js = res.outputFiles[0].text.replaceAll("</script", "<\\/script");
const css = readFileSync("src/app/globals.css", "utf8");
// The Next.js site self-hosts these fonts; the single-file preview loads the same families from Google Fonts.
const fonts = "https://fonts.googleapis.com/css2?family=Bricolage+Grotesque:wght@200..800&family=Instrument+Sans:wght@400..700&family=JetBrains+Mono:wght@400..800&display=swap";

const html = `<title>Foolproof</title>
<meta name="claude:viewport-fit-sides" content="cover">
<meta name="description" content="An AI restaurant assistant that fake reviews can't fool. Play the attacker and try to fool it.">
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link rel="stylesheet" href="${fonts}">
<style>${css}</style>
<main class="wrap">
  <header class="hero">
    <div class="brand">
      <svg class="mark" viewBox="0 0 32 32" aria-hidden="true"><circle cx="13.5" cy="13.5" r="9" fill="none" stroke="var(--ink)" stroke-width="3"/><path d="M20.5 20.5 28 28" stroke="var(--ink)" stroke-width="3.4" stroke-linecap="round"/><path d="m13.5 8.6 1.5 3.1 3.4.5-2.5 2.4.6 3.4-3-1.6-3 1.6.6-3.4-2.5-2.4 3.4-.5z" fill="var(--saffron)"/></svg>
      <span class="eyebrow">Sandbox · 30 fictional Hyderabad restaurants</span>
    </div>
    <h1>Foolproof</h1>
    <p class="lede">An AI “where should I eat?” assistant that fake reviews can’t fool. <b>Play the attacker:</b> buy fake reviews, clear the missions, and try to change its answer.</p>
  </header>
  <div id="root"><p class="muted">Loading the sandbox…</p></div>
  <footer><span>All restaurants and reviews are fictional and generated. Flags show suspicious signals, not proof of fraud. This preview runs everything in your browser; the live AI is on the full site.</span></footer>
</main>
<script>${js}</script>
`;
mkdirSync(dirname(out), { recursive: true });
writeFileSync(out, html);
console.log(`Wrote ${out} (${(html.length / 1024).toFixed(0)} KB)`);
