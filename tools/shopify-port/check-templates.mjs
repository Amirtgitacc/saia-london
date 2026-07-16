#!/usr/bin/env node
// Static sanity check for ported page.*.liquid templates (and index.liquid), reusable
// across future port batches. Checks, per template:
//   (a) zero relative asset refs left over (src="css/…"/"js/…"/"assets/…"/"vendor/…"/
//       "photos/…", both src="…" / href="…" and quoted-string forms, single or double quotes)
//   (b) zero internal *.html links outside HTML comments (nav should route to /pages/…)
//   (c) every {{ 'flat-name' | asset_url }} reference resolves to a real file in theme/assets/
//
// Usage: node tools/shopify-port/check-templates.mjs [glob-relative-to theme/templates]
//   defaults to page.*.liquid + index.liquid
import fs from 'node:fs';
import path from 'node:path';

const ROOT = process.cwd();
const THEME = path.join(ROOT, 'theme');
const TPL_DIR = path.join(THEME, 'templates');
const ASSETS_DIR = path.join(THEME, 'assets');

const pattern = process.argv[2];
let files;
if (pattern) {
  files = [path.join(TPL_DIR, pattern)];
} else {
  files = fs.readdirSync(TPL_DIR)
    .filter(f => f.startsWith('page.') || f === 'index.liquid')
    .map(f => path.join(TPL_DIR, f));
}

// source names from port.mjs's LINKS map — kept in sync manually (small, stable list)
const LINKS_SOURCE_NAMES = [
  'index.html', 'events.html', 'story.html', 'pilates-with-cristina.html',
  'contact-us.html', 'guest-list.html', 'terms-and-conditions.html',
  'event-book-club-petersham.html', 'event-morena-self-love.html',
  'event-mortimer-house.html', 'event-the-nest.html',
  'event-watercolour-regents-park.html', 'checkout.html',
];

const FIVE_DIRS = '(?:css|js|assets|vendor|photos)';
// (a) both attribute form (src="css/x") and quoted-string form ('js/x.js', "photos/x.png")
const REL_ATTR_RE = new RegExp(`(?:src|href)=(["'])(?:\\./)?${FIVE_DIRS}/[^"']*\\1`, 'g');
const REL_STR_RE = new RegExp(`(["'])(?:\\./)?${FIVE_DIRS}/[^"']*\\1`, 'g');
// (b) internal .html links — href="foo.html" or 'foo.html' — anywhere, then we filter out
// matches that fall inside an HTML comment <!-- ... -->
const HTML_LINK_RE = /(?:href=)?(["'])[a-z0-9\-\/]+\.html(?:#[^"']*)?\1/gi;
const ASSET_URL_RE = /\{\{\s*'([^']+)'\s*\|\s*asset_url\s*\}\}/g;

function commentRanges(text) {
  const ranges = [];
  const re = /<!--[\s\S]*?-->/g;
  let m;
  while ((m = re.exec(text))) ranges.push([m.index, m.index + m[0].length]);
  return ranges;
}
function inRanges(idx, ranges) {
  return ranges.some(([a, b]) => idx >= a && idx < b);
}

let failCount = 0;
const results = [];

for (const file of files) {
  if (!fs.existsSync(file)) {
    results.push({ file, ok: false, issues: [`FILE NOT FOUND: ${file}`] });
    failCount++;
    continue;
  }
  const text = fs.readFileSync(file, 'utf8');
  const name = path.basename(file);
  const issues = [];

  // (a) relative refs
  const relAttrHits = [...text.matchAll(REL_ATTR_RE)].map(m => m[0]);
  const relStrHits = [...text.matchAll(REL_STR_RE)].map(m => m[0]);
  const relHits = [...new Set([...relAttrHits, ...relStrHits])];
  if (relHits.length) issues.push(`relative refs left: ${relHits.join(', ')}`);

  // (b) internal .html links outside comments
  const ranges = commentRanges(text);
  const htmlHits = [...text.matchAll(HTML_LINK_RE)].filter(m => !inRanges(m.index, ranges)).map(m => m[0]);
  if (htmlHits.length) issues.push(`internal .html link(s) outside comments: ${htmlHits.join(', ')}`);

  // (c) asset_url targets exist
  const missingAssets = [];
  for (const m of text.matchAll(ASSET_URL_RE)) {
    const flat = m[1];
    if (!fs.existsSync(path.join(ASSETS_DIR, flat))) missingAssets.push(flat);
  }
  if (missingAssets.length) issues.push(`asset_url target(s) missing from theme/assets/: ${missingAssets.join(', ')}`);

  const ok = issues.length === 0;
  if (!ok) failCount++;
  results.push({ file: name, ok, issues });
}

// (d) copied JS assets — quoted *.html literals matching a LINKS source name mean a page
// navigation (window.location.href = 'foo.html', etc.) never got rewritten to its Shopify
// route by port.mjs; it'll be dead on Shopify. Scan every theme/assets/*.js file.
const jsResults = [];
let jsFailCount = 0;
if (fs.existsSync(ASSETS_DIR)) {
  const jsFiles = fs.readdirSync(ASSETS_DIR).filter(f => f.endsWith('.js'));
  for (const f of jsFiles) {
    const text = fs.readFileSync(path.join(ASSETS_DIR, f), 'utf8');
    const hits = [];
    for (const name of LINKS_SOURCE_NAMES) {
      const re = new RegExp(`(['"])${name.replace(/\./g, '\\.')}(#[^'"]*)?\\1`, 'g');
      if (re.test(text)) hits.push(name);
    }
    const ok = hits.length === 0;
    if (!ok) jsFailCount++;
    jsResults.push({ file: f, ok, issues: ok ? [] : [`unrewritten .html literal(s): ${hits.join(', ')}`] });
  }
}

for (const r of results) {
  if (r.ok) {
    console.log(`OK   ${r.file}`);
  } else {
    console.log(`FAIL ${r.file}`);
    for (const i of r.issues) console.log(`       - ${i}`);
  }
}
for (const r of jsResults) {
  if (r.ok) {
    console.log(`OK   assets/${r.file}`);
  } else {
    console.log(`FAIL assets/${r.file}`);
    for (const i of r.issues) console.log(`       - ${i}`);
  }
}

failCount += jsFailCount;
console.log(`\n${results.length - (failCount - jsFailCount)}/${results.length} templates clean, ${jsResults.length - jsFailCount}/${jsResults.length} JS assets clean`);
process.exit(failCount ? 1 : 0);
