// Builds a single self-contained HTML file of the demo (scoring runs in the browser).
// Usage: node scripts/build-static.mjs [outFile]
import { build } from "esbuild";
import { readFileSync, writeFileSync } from "node:fs";

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

const html = `<title>Foolproof</title>
<meta name="claude:viewport-fit-sides" content="cover">
<meta name="description" content="An AI restaurant assistant that fake reviews can't fool.">
<style>${css}</style>
<main class="wrap">
  <header>
    <span class="tag">Sandbox · 30 fictional Hyderabad restaurants</span>
    <h1>Foolproof</h1>
    <p class="muted">An AI “where should I eat?” assistant that fake reviews can’t fool. Inject fake reviews below and watch which ranking changes its answer.</p>
  </header>
  <div id="root"><p class="muted">Loading the sandbox…</p></div>
  <footer>All restaurants and reviews are fictional and generated. Flags show suspicious signals, not proof of fraud. This preview runs the scoring in your browser; the live AI explanation is in the full app.</footer>
</main>
<script>${js}</script>
`;
import("node:fs").then(({ mkdirSync }) => mkdirSync(out.split("/").slice(0, -1).join("/") || ".", { recursive: true }));
writeFileSync(out, html);
console.log(`Wrote ${out} (${(html.length / 1024).toFixed(0)} KB)`);
