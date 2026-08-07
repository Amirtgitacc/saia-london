/* SEO regression guard.
 *
 * The 2026-07-22 Shopify migration lost several things that are invisible in the browser but
 * decide whether pages rank: the home page shipped titled just "SAÏA London", with two meta
 * descriptions, ~29 legacy pages rendering with no nav, and the blog linked from nowhere.
 * These checks make that class of regression fail the build instead of being noticed months
 * later in Search Console.
 *
 * Deliberately dependency-free (regex, not a DOM parser) to match the rest of the suite —
 * the markup here is static and hand-written, so regex is sufficient and adds nothing to install.
 */
const test = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const path = require('node:path');

const ROOT = path.join(__dirname, '..');
const read = (p) => fs.readFileSync(path.join(ROOT, p), 'utf8');

/* The public, indexable pages of the static build. The sample boards (samples.html,
 * sample-film.html, sample-hybrid.html) are design-direction artefacts, not public pages —
 * they redirect to the live store and are excluded on purpose. */
const PAGES = [
  'index.html',
  'events.html',
  'story.html',
  'contact-us.html',
  'pilates-with-cristina.html',
  'terms-and-conditions.html',
  'event-book-club-petersham.html',
  'event-morena-self-love.html',
  'event-mortimer-house.html',
  'event-the-nest.html',
  'event-watercolour-regents-park.html',
];

const headOf = (html) => (html.match(/<head[^>]*>([\s\S]*?)<\/head>/i) || [, ''])[1];
const titleOf = (html) => (headOf(html).match(/<title>([\s\S]*?)<\/title>/i) || [, ''])[1].trim();
const descOf = (html) => {
  const m = headOf(html).match(/<meta\s+name="description"\s+content="([^"]*)"/i);
  return m ? m[1].trim() : '';
};

// ---------------------------------------------------------------- metadata

test('every public page has a non-empty title', () => {
  for (const p of PAGES) assert.ok(titleOf(read(p)).length > 0, `${p} has no <title>`);
});

test('titles are a sensible length for search results', () => {
  for (const p of PAGES) {
    const t = titleOf(read(p));
    assert.ok(t.length >= 15, `${p} title is too short to be descriptive: "${t}"`);
    assert.ok(t.length <= 70, `${p} title will be truncated in results (${t.length} chars): "${t}"`);
  }
});

test('titles are unique across pages', () => {
  const seen = new Map();
  for (const p of PAGES) {
    const t = titleOf(read(p));
    assert.ok(!seen.has(t), `duplicate title on ${p} and ${seen.get(t)}: "${t}"`);
    seen.set(t, p);
  }
});

test('every public page has a meta description', () => {
  for (const p of PAGES) assert.ok(descOf(read(p)).length > 0, `${p} has no meta description`);
});

test('meta descriptions are unique and a sensible length', () => {
  const seen = new Map();
  for (const p of PAGES) {
    const d = descOf(read(p));
    assert.ok(d.length >= 50, `${p} description is too short (${d.length}): "${d}"`);
    assert.ok(d.length <= 200, `${p} description will be truncated (${d.length} chars)`);
    assert.ok(!seen.has(d), `duplicate description on ${p} and ${seen.get(d)}`);
    seen.set(d, p);
  }
});

test('exactly one meta description per page (a second one in <body> is invisible to crawlers)', () => {
  for (const p of PAGES) {
    const n = (read(p).match(/<meta\s+name="description"/gi) || []).length;
    assert.strictEqual(n, 1, `${p} has ${n} meta descriptions`);
  }
});

// ---------------------------------------------------------------- structure

test('exactly one h1 per page', () => {
  for (const p of PAGES) {
    const n = (read(p).match(/<h1[\s>]/gi) || []).length;
    assert.strictEqual(n, 1, `${p} has ${n} <h1> elements`);
  }
});

test('every img has an alt attribute', () => {
  for (const p of PAGES) {
    for (const tag of read(p).match(/<img\b[^>]*>/gi) || []) {
      assert.match(tag, /\salt=/i, `${p} has an <img> with no alt: ${tag.slice(0, 90)}`);
    }
  }
});

test('pages declare a language', () => {
  for (const p of PAGES) assert.match(read(p), /<html[^>]+lang="en"/i, `${p} is missing lang="en"`);
});

// ---------------------------------------------------------------- links

test('internal .html links point at files that exist', () => {
  for (const p of PAGES) {
    const links = [...read(p).matchAll(/href="([a-z0-9-]+\.html)(?:#[^"]*)?"/gi)].map((m) => m[1]);
    for (const target of new Set(links)) {
      assert.ok(fs.existsSync(path.join(ROOT, target)), `${p} links to missing page: ${target}`);
    }
  }
});

// ---------------------------------------------------------------- migration integrity

test('every ported page has a Vercel redirect to its Shopify URL', () => {
  // Guards the migration's weakest joint: the static build and the live store both answer on
  // their own hostname, so any page without a redirect becomes a duplicate of the live one.
  const port = read('tools/shopify-port/port.mjs');
  const block = port.match(/const LINKS = \{([\s\S]*?)\};/)[1];
  const links = [...block.matchAll(/'([^']+\.html)':\s*'([^']+)'/g)].map((m) => [m[1], m[2]]);
  assert.ok(links.length >= 13, 'LINKS map looks truncated');

  const redirects = JSON.parse(read('vercel.json')).redirects || [];
  const bySource = new Map(redirects.map((r) => [r.source, r]));

  for (const [page, shopifyPath] of links) {
    const r = bySource.get(`/${page}`);
    assert.ok(r, `no vercel.json redirect for /${page}`);
    assert.strictEqual(r.permanent, true, `/${page} redirect must be permanent (301/308)`);
    assert.strictEqual(
      r.destination,
      `https://www.saialondon.com${shopifyPath === '/' ? '/' : shopifyPath}`,
      `/${page} redirect does not point at its ported Shopify URL`,
    );
  }
});

test('the concierge API is never redirected away from Vercel', () => {
  // The live Shopify theme calls https://saia-london.vercel.app/api/concierge. A redirect
  // matching /api/* would take the Tier-2 assistant down site-wide.
  for (const r of JSON.parse(read('vercel.json')).redirects || []) {
    assert.ok(!r.source.startsWith('/api'), `redirect would break the API: ${r.source}`);
  }
});

test('robots.txt lets crawlers reach the redirects', () => {
  // A blanket "Disallow: /" here would stop crawlers fetching these URLs at all, so they would
  // never see the 301s and the old authority would never reach the live store.
  const robots = read('robots.txt');
  assert.match(robots, /^Allow: \/$/m, 'robots.txt must allow crawling so the 301s are followed');
  assert.doesNotMatch(robots, /^Disallow: \/$/m, 'a blanket Disallow would hide the redirects');
});

// ---------------------------------------------------------------- theme (what actually ships)

test('the theme layout emits exactly one title, description and canonical', () => {
  const layout = read('theme/layout/theme.liquid');
  const seo = read('theme/snippets/seo-meta.liquid');
  assert.match(layout, /\{%\s*render 'seo-meta'\s*%\}/, 'layout must render the seo-meta snippet');

  // strip Liquid comments first — the snippet's own docs mention <title> in prose
  const stripComments = (s) => s.replace(/\{%-?\s*comment\s*-?%\}[\s\S]*?\{%-?\s*endcomment\s*-?%\}/g, '');
  const combined = stripComments(layout) + stripComments(seo);
  assert.strictEqual((combined.match(/<title>/g) || []).length, 1, 'more than one <title> in the head');
  assert.strictEqual(
    (combined.match(/<meta name="description"/g) || []).length, 1,
    'more than one meta description in the head',
  );
  assert.strictEqual(
    (combined.match(/rel="canonical"/g) || []).length, 1,
    'more than one canonical link',
  );
});

test('the home route carries the redesign title and description, not the shop default', () => {
  const seo = read('theme/snippets/seo-meta.liquid');
  const home = read('index.html');
  assert.ok(seo.includes(titleOf(home)), 'seo-meta.liquid has drifted from index.html <title>');
  assert.ok(seo.includes(descOf(home)), 'seo-meta.liquid has drifted from index.html description');
});

test('only the checkout-plumbing products are noindexed', () => {
  const seo = read('theme/snippets/seo-meta.liquid');
  assert.doesNotMatch(
    seo, /request\.page_type == 'product'\s*%\}[\s\S]{0,80}noindex/,
    'noindex must not apply to every product — it would deindex /products/yoga-mat-hire',
  );
  // Exact membership, not substring: "refundable-cleaning-deposit-yoga-mat-hire" is a plumbing
  // handle that legitimately ends in "yoga-mat-hire".
  const handles = seo.match(/plumbing_handles = '([^']*)'/)[1].split(',').map((h) => h.trim());
  assert.ok(handles.includes('courier-delivery'), 'plumbing handle allowlist is missing');
  assert.ok(
    !handles.includes('yoga-mat-hire'),
    '/products/yoga-mat-hire must not be in the noindex list',
  );
});

test('no .html links survive in the ported theme (they would 404 on Shopify)', () => {
  const dirs = ['theme/templates', 'theme/snippets', 'theme/layout'];
  for (const dir of dirs) {
    for (const f of fs.readdirSync(path.join(ROOT, dir)).filter((n) => n.endsWith('.liquid'))) {
      const rel = path.join(dir, f);
      const bad = read(rel).match(/href="[a-z0-9-]+\.html"/gi);
      assert.ok(!bad, `${rel} still links to ${bad && bad[0]}`);
    }
  }
});

test('the blog is reachable — it is not orphaned again', () => {
  // 28 legacy articles live at /blogs/*; before this they had zero internal links pointing at them.
  const foot = read('theme/snippets/blog-chrome-foot.liquid');
  assert.match(foot, /href="\/blogs\/news"/, 'the shared footer must link to the blog');

  const home = read('theme/templates/index.liquid');
  assert.match(home, /href="\/blogs\/news"/, 'the home page footer must link to the blog');
});

test('unported legacy pages render with site chrome, not bare', () => {
  // /pages/about, /pages/faq, /pages/yoga-mat-rentals and ~26 more fall through to the else branch.
  const page = read('theme/templates/page.liquid');
  const fallback = page.split('{% else %}')[1] || '';
  assert.match(fallback, /render 'blog-chrome-head'/, 'the fallback must render the header/nav');
  assert.match(fallback, /render 'blog-chrome-foot'/, 'the fallback must render the footer');
});

test('no template renders an empty page (a 200 with no content reads as a soft 404)', () => {
  for (const f of ['list-collections.liquid', 'collection.liquid', 'product.liquid']) {
    const body = read(path.join('theme/templates', f))
      .replace(/\{%\s*comment\s*%\}[\s\S]*?\{%\s*endcomment\s*%\}/g, '')
      .replace(/<[^>]+>/g, ' ')
      .replace(/\{\{[\s\S]*?\}\}|\{%[\s\S]*?%\}/g, ' ')
      .trim();
    assert.ok(body.length > 40, `theme/templates/${f} renders almost nothing`);
  }
});
