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
fs.mkdirSync(path.join(THEME, 'assets'), { recursive: true });
fs.mkdirSync(path.join(THEME, 'templates'), { recursive: true });
for (const p of assets) {
  const from = path.join(ROOT, p);
  if (!fs.existsSync(from)) { console.warn('MISSING asset:', p); continue; }
  const flat = path.basename(p).replace(/\s+/g, '-');
  const to = path.join(THEME, 'assets', flat);
  if (fs.existsSync(to) && fs.statSync(to).size !== fs.statSync(from).size)
    throw new Error('asset name collision after flattening: ' + flat);
  const mb = fs.statSync(from).size / 1048576;
  if (mb > 10) { console.warn(`SKIPPED >10MB (upload to Shopify Files): ${p} (${mb.toFixed(1)}MB)`); continue; }
  fs.copyFileSync(from, to);
}

fs.writeFileSync(path.join(THEME, 'templates', `${tpl}.liquid`), out);
console.log(`wrote theme/templates/${tpl}.liquid — ${assets.size} assets referenced`);
