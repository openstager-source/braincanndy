// Builds a single self-contained HTML file of the search experience (scoring runs in the browser; no
// live AI or web results, which need the server). Usage: node scripts/build-static.mjs [outFile]
import { build } from "esbuild";
import { mkdirSync, writeFileSync } from "node:fs";
import { dirname } from "node:path";

const out = process.argv[2] ?? "dist/foolproof.html";
const res = await build({
  entryPoints: ["scripts/static-entry.tsx"],
  bundle: true,
  minify: true,
  write: false,
  outdir: "dist/static-build", // needed for the CSS output; nothing is written
  format: "iife",
  jsx: "automatic",
  target: "es2020",
  loader: { ".svg": "dataurl" },
  define: { "process.env.NODE_ENV": '"production"', "process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY": "undefined" },
  logLevel: "error",
});
const file = (ext) => res.outputFiles.find((f) => f.path.endsWith(ext))?.text ?? "";
const js = file(".js").replaceAll("</script", "<\\/script");
const css = file(".css").replaceAll("</style", "<\\/style");
// The Next.js site self-hosts these fonts; the single-file preview loads the same families from Google Fonts.
const fonts = "https://fonts.googleapis.com/css2?family=DM+Sans:opsz,wght@9..40,100..1000&family=Unbounded:wght@200..900&display=swap";

const html = `<title>Foolproof</title>
<meta name="claude:viewport-fit-sides" content="cover">
<meta name="description" content="Search places to eat, ranked by how trustworthy their reviews look. Fake reviews can't buy the top spot.">
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link rel="stylesheet" href="${fonts}">
<style>${css}</style>
<div id="root"></div>
<noscript><p style="padding:24px;color:#fff;background:#041A1D;font-family:system-ui,sans-serif">Foolproof needs JavaScript: the ranking runs in your browser.</p></noscript>
<script>${js}</script>
`;
mkdirSync(dirname(out), { recursive: true });
writeFileSync(out, html);
console.log(`Wrote ${out} (${(html.length / 1024).toFixed(0)} KB)`);
