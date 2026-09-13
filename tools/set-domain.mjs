/* set-domain — point the whole site at a different hostname.
 *
 *   node tools/set-domain.mjs example.com
 *
 * The canonical URL, the Open Graph and Twitter image/URL tags, robots.txt,
 * sitemap.xml and the README all have to agree on one hostname. Doing that by
 * hand across five files is how a site ends up canonicalising to a domain it no
 * longer serves — which quietly tells Google to index the wrong host.
 *
 * Prints what it changed and exits non-zero if the old host survives anywhere.
 */
import { readFile, writeFile } from "node:fs/promises";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");

const FILES = [
  "public/index.html",
  "public/404.html",
  "public/robots.txt",
  "public/sitemap.xml",
  "README.md",
];

const next = (process.argv[2] || "").trim().replace(/^https?:\/\//, "").replace(/\/$/, "");
if (!next || !/^[a-z0-9.-]+\.[a-z]{2,}$/i.test(next)) {
  console.error("usage: node tools/set-domain.mjs <hostname>   e.g. anti-xor.com");
  process.exit(2);
}

/* Find the host currently in use rather than assuming it, so this works no
   matter how many times the domain has changed. */
const canonical = await readFile(join(ROOT, "public/index.html"), "utf8");
const found = canonical.match(/<link rel="canonical" href="https:\/\/([^/"]+)/);
if (!found) {
  console.error("could not find the canonical tag in public/index.html");
  process.exit(1);
}
const prev = found[1];

if (prev === next) {
  console.log(`already pointing at ${next} — nothing to do`);
  process.exit(0);
}

let changed = 0;
for (const rel of FILES) {
  const path = join(ROOT, rel);
  const before = await readFile(path, "utf8");
  const after = before.split(prev).join(next);
  if (after !== before) {
    await writeFile(path, after);
    const hits = before.split(prev).length - 1;
    console.log(`  ${rel}  ${hits} replaced`);
    changed += hits;
  }
}

/* sitemap lastmod should reflect the change, not the original publish date. */
const smPath = join(ROOT, "public/sitemap.xml");
const sm = await readFile(smPath, "utf8");
const today = new Date().toISOString().slice(0, 10);
await writeFile(smPath, sm.replace(/<lastmod>[^<]*<\/lastmod>/, `<lastmod>${today}</lastmod>`));

console.log(`\n${prev} -> ${next}  (${changed} references)`);
console.log(`
Still to do by hand, because they live outside this repo:
  1. Cloudflare Pages -> anti-xor -> Custom domains -> add ${next}
  2. GA4 -> Admin -> Data streams -> "Anti-xor site" -> set stream URL to https://${next}
  3. Search Console -> add URL-prefix property https://${next}/ and submit sitemap.xml
     (the old pages.dev property keeps working; leave it or remove it)
  4. npm run deploy`);
