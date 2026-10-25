// Post-build: adds a strict Content-Security-Policy <meta> to every exported page.
// Next.js inlines small bootstrap scripts; because the pages are static we can allow exactly
// those scripts by hash instead of 'unsafe-inline'. Works on any static host.
// Usage: node scripts/csp-meta.mjs [outDir]
import { createHash } from "node:crypto";
import { readdirSync, readFileSync, statSync, writeFileSync } from "node:fs";
import { join } from "node:path";

const outDir = process.argv[2] ?? "out";
const TURNSTILE = "https://challenges.cloudflare.com";

function htmlFiles(dir) {
  return readdirSync(dir).flatMap((name) => {
    const p = join(dir, name);
    return statSync(p).isDirectory() ? htmlFiles(p) : p.endsWith(".html") ? [p] : [];
  });
}

let pages = 0;
for (const file of htmlFiles(outDir)) {
  let html = readFileSync(file, "utf8");
  if (html.includes('http-equiv="Content-Security-Policy"')) continue;

  const hashes = new Set();
  for (const [, attrs, body] of html.matchAll(/<script([^>]*)>([\s\S]*?)<\/script>/g)) {
    if (/\bsrc=/.test(attrs) || body.length === 0) continue;
    hashes.add(`'sha256-${createHash("sha256").update(body, "utf8").digest("base64")}'`);
  }

  const csp = [
    "default-src 'self'",
    `script-src 'self' ${[...hashes].join(" ")} ${TURNSTILE}`,
    "style-src 'self' 'unsafe-inline'",
    "img-src 'self' data:",
    "font-src 'self'",
    "connect-src 'self'",
    `frame-src ${TURNSTILE}`,
    "object-src 'none'",
    "base-uri 'self'",
    "form-action 'self'",
  ].join("; ");

  const meta = `<meta http-equiv="Content-Security-Policy" content="${csp}"/>`;
  // Must come before any script so it applies to all of them.
  const at = html.indexOf("<head>");
  if (at === -1) throw new Error(`No <head> in ${file}`);
  html = html.slice(0, at + 6) + meta + html.slice(at + 6);
  writeFileSync(file, html);
  pages++;
}
console.log(`csp-meta: added script hashes to ${pages} page(s) in ${outDir}/`);
