#!/usr/bin/env node
// Port a static SAÏA page to a Shopify Liquid template.
// Usage: node tools/shopify-port/port.mjs <source.html> <template-name>
//   e.g. node tools/shopify-port/port.mjs index.html index
//        node tools/shopify-port/port.mjs events.html page.events
import fs from 'node:fs';
import path from 'node:path';

const [,, src, tpl] = process.argv;
if (!src || !tpl) { console.error('usage: port.mjs <source.html> <template-name>'); process.exit(1); }

const ROOT = process.cwd();
const THEME = path.join(ROOT, 'theme');
const html = fs.readFileSync(path.join(ROOT, src), 'utf8');

const LINKS = {
  'index.html': '/',
  'events.html': '/pages/events',
  'story.html': '/pages/story',
  'pilates-with-cristina.html': '/pages/pilates-with-cristina',
  'contact-us.html': '/pages/contact-us',
  'guest-list.html': '/pages/guest-list',
  'terms-and-conditions.html': '/pages/terms-and-conditions',
  'event-book-club-petersham.html': '/pages/event-book-club-petersham',
  'event-morena-self-love.html': '/pages/event-morena-self-love',
  'event-mortimer-house.html': '/pages/event-mortimer-house',
  'event-the-nest.html': '/pages/event-the-nest',
  'event-watercolour-regents-park.html': '/pages/event-watercolour-regents-park',
  'checkout.html': '/cart',
};

// 1. keep page-specific <head> extras (styles/scripts); the layout owns meta/title/fonts
const head = (html.match(/<head[^>]*>([\s\S]*?)<\/head>/i) || [, ''])[1]
  .replace(/<meta[^>]*(charset|viewport)[^>]*>\s*/gi, '')
  .replace(/<title>[\s\S]*?<\/title>\s*/i, '')
  .replace(/<link[^>]*fonts\.g(oogleapis|static)[^>]*>\s*/gi, '')
  .replace(/<link[^>]*rel="preconnect"[^>]*>\s*/gi, '');
const body = (html.match(/<body[^>]*>([\s\S]*?)<\/body>/i) || [, ''])[1];
let out = head + '\n' + body;

// 2. drop the local boot-config block — theme/snippets/saia-boot.liquid replaces it
out = out.replace(/<!-- SAÏA boot config[\s\S]*?<\/script>\s*/, '');

// 3. asset paths → {{ 'flat-name' | asset_url }}
const assets = new Set();
out = out.replace(/(src|href)="(?:\.\/)?((?:css|js|assets|vendor|photos)\/[^"?]+)(\?[^"]*)?"/g,
  (m, attr, p) => {
    assets.add(p);
    const flat = path.basename(p).replace(/\s+/g, '-');
    return `${attr}="{{ '${flat}' | asset_url }}"`;
  });

// 4. internal page links → Shopify paths
out = out.replace(/href="([a-z0-9-]+\.html)(#[^"]*)?"/gi,
  (m, page, hash) => LINKS[page] ? `href="${LINKS[page]}${hash || ''}"` : m);

// 4b. asset references inside JS string literals (importmap, dynamic import(), etc.)
// Uses a placeholder token (not real Liquid) so step 5's {{|{% detection isn't tricked
// by asset refs we insert here — real {{ 'x' | asset_url }} liquid is spliced in after
// the raw-wrap step (step 7 below).
out = out.replace(/(['"])(?:\.\/)?((?:css|js|assets|vendor|photos)\/[^'"?]+\.(?:js|css|glb|png|jpe?g|webp|avif|mp4|svg))(\?[^'"]*)?\1/g,
  (m, q, p) => {
    assets.add(p);
    const flat = path.basename(p).replace(/\s+/g, '-');
    return `${q}@@ASSET:${flat}@@${q}`;
  });

// 4c. JS-string page navigations (window.location.href = 'foo.html', etc.)
out = out.replace(/(['"])([a-z0-9-]+\.html)(#[^'"]*)?\1/gi,
  (m, q, page, hash) => LINKS[page] ? `${q}${LINKS[page]}${hash || ''}${q}` : m);

// 5. protect inline JS/CSS containing {{ or {% from Liquid
out = out.replace(/<(script|style)(\s[^>]*)?>([\s\S]*?)<\/\1>/g, (m, tag, at, inner) =>
  /{{|{%/.test(inner) ? `<${tag}${at || ''}>{% raw %}${inner}{% endraw %}</${tag}>` : m);

// 6. resolve @@ASSET:name@@ placeholders to real Liquid (after raw-wrap, so we don't
// trick step 5's {{|{% detection into wrapping script bodies that don't need it)
out = out.replace(/@@ASSET:([^@]+)@@/g, (m, flat) => `{{ '${flat}' | asset_url }}`);

// 6b. safety check: an asset_url that ended up inside a {% raw %} span renders dead
// on Shopify (raw disables Liquid parsing) — warn rather than silently ship it broken
for (const raw of out.matchAll(/{% raw %}([\s\S]*?){% endraw %}/g)) {
  const names = [...raw[1].matchAll(/'([^']+)'\s*\|\s*asset_url/g)].map(x => x[1]);
  if (names.length) console.warn('ASSET INSIDE {% raw %} (will render dead on Shopify):', names.join(', '));
}

// 7. copy referenced assets (flattened); >10MB → warn (Shopify Files by hand)
//
// JS files can import each other with relative specifiers (e.g. a file in js/
// doing `from '../vendor/GLTFLoader.js'`). Those specifiers are invisible to the
// HTML-scanning regexes above (they're inside a *copied* file, not in index.html),
// and once flattened into theme/assets/ every file is a sibling of every other —
// so a '../vendor/x.js' specifier 404s on Shopify unless rewritten to './x.js'.
// We resolve+queue such imports (recursively, since the target may itself import
// relatively) and rewrite the specifier text in the copied file. Bare specifiers
// (e.g. `from 'three'`) are left untouched — those resolve via the page importmap.
fs.mkdirSync(path.join(THEME, 'assets'), { recursive: true });
fs.mkdirSync(path.join(THEME, 'templates'), { recursive: true });
const copiedFrom = new Map(); // flat filename -> source path, for collision reporting
// Anchored to statement boundaries (start of line, optional leading whitespace) so we
// only rewrite real import/export-from/dynamic-import specifiers — not the words
// "from"/"import" appearing incidentally inside a comment or string elsewhere on the line.
const IMPORT_RE = /^[ \t]*(import\s*\(\s*|(?:import|export)\b[^'"\n]*?\bfrom\s*)(['"])(\.\.?\/[^'"]+\.js)\2/gm;

for (const p of assets) {
  const from = path.join(ROOT, p);
  if (!fs.existsSync(from)) { console.warn('MISSING asset:', p); continue; }
  const flat = path.basename(p).replace(/\s+/g, '-');
  const to = path.join(THEME, 'assets', flat);
  const mb = fs.statSync(from).size / 1048576;
  if (mb > 10) { console.warn(`SKIPPED >10MB (upload to Shopify Files): ${p} (${mb.toFixed(1)}MB)`); continue; }

  let buf = fs.readFileSync(from);
  if (/\.js$/i.test(flat)) {
    let text = buf.toString('utf8').replace(IMPORT_RE, (m, pre, q, spec) => {
      const resolved = path.join(path.dirname(p), spec).split(path.sep).join('/');
      if (!fs.existsSync(path.join(ROOT, resolved))) { console.warn('MISSING relative JS import:', resolved, 'from', p); return m; }
      assets.add(resolved); // queued — for..of over a Set visits members added mid-iteration
      const targetFlat = path.basename(resolved).replace(/\s+/g, '-');
      return `${pre}${q}./${targetFlat}${q}`;
    });
    // page navigations inside the copied JS (window.location.href = 'foo.html', etc.) —
    // same LINKS-map rewrite as pass 4c above, applied to the COPY only. The js/ source
    // on disk keeps the .html form (local/Vercel serves flat .html files); this rewritten
    // buffer is what gets compared against/written to theme/assets/ below.
    text = text.replace(/(['"])([a-z0-9-]+\.html)(#[^'"]*)?\1/gi,
      (m, q, page, hash) => LINKS[page] ? `${q}${LINKS[page]}${hash || ''}${q}` : m);
    buf = Buffer.from(text, 'utf8');
  }

  if (fs.existsSync(to)) {
    // same-size checks can't tell two different files apart — compare content
    // (assets here are all ≤10MB, so reading whole files is cheap and safe)
    const identical = Buffer.compare(buf, fs.readFileSync(to)) === 0;
    if (identical) continue; // already staged with the same bytes — nothing to do
    const prevSrc = copiedFrom.get(flat) || '(existing file in theme/assets, source unknown — from a previous port run?)';
    throw new Error(`asset name collision after flattening: ${flat}\n  source 1: ${prevSrc}\n  source 2: ${p}`);
  }
  fs.writeFileSync(to, buf);
  copiedFrom.set(flat, p);
}

fs.writeFileSync(path.join(THEME, 'templates', `${tpl}.liquid`), out);
console.log(`wrote theme/templates/${tpl}.liquid — ${assets.size} assets referenced`);
