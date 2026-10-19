#!/usr/bin/env node
'use strict';
// Static checks for the built site. No dependencies. Run: node tests/check-site.js
const fs = require('fs');
const path = require('path');

const root = path.resolve(__dirname, '..');
const BASE = fs.readFileSync(path.join(root, 'scripts', 'base-url.txt'), 'utf8').trim();
const errors = [];
const warn = [];
let checks = 0;
const ok = (cond, msg) => { checks++; if (!cond) errors.push(msg); };

function walk(dir, out = []) {
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    if (['.git', 'node_modules', 'tests', 'scripts'].includes(e.name)) continue;
    const full = path.join(dir, e.name);
    if (e.isDirectory()) walk(full, out); else out.push(full);
  }
  return out;
}
const files = walk(root);
const htmlFiles = files.filter((f) => f.endsWith('.html'));
const rel = (f) => path.relative(root, f).split(path.sep).join('/');
const pageUrlPath = (f) => rel(f).replace(/index\.html$/, '');

const attr = (html, re) => { const m = html.match(re); return m ? m[1] : null; };
const decode = (s) => s.replace(/&amp;/g, '&').replace(/&quot;/g, '"').replace(/&lt;/g, '<').replace(/&gt;/g, '>');
const idsCache = {};
function idsOf(file) {
  if (!idsCache[file]) idsCache[file] = new Set([...fs.readFileSync(file, 'utf8').matchAll(/\sid="([^"]+)"/g)].map((m) => m[1]));
  return idsCache[file];
}

function resolveTarget(fromFile, url) {
  let target;
  if (url.startsWith(BASE + '/')) target = path.join(root, decodeURI(url.slice(BASE.length + 1)));
  else target = path.resolve(path.dirname(fromFile), decodeURI(url));
  if (url.endsWith('/') || (fs.existsSync(target) && fs.statSync(target).isDirectory())) target = path.join(target, 'index.html');
  return target;
}

const titles = new Map();
const descs = new Map();
const indexable = [];

for (const f of htmlFiles) {
  const html = fs.readFileSync(f, 'utf8');
  const name = rel(f);
  ok(/^<!doctype html>/i.test(html), `${name}: missing doctype`);
  ok(/<html lang="[a-z-]+"/.test(html), `${name}: missing lang`);
  ok(/<meta name="viewport"/.test(html), `${name}: missing viewport`);
  const title = attr(html, /<title>([^<]+)<\/title>/);
  const desc = attr(html, /<meta name="description" content="([^"]+)"/);
  ok(title, `${name}: missing title`);
  ok(desc, `${name}: missing description`);
  if (title) { ok(!titles.has(title), `${name}: duplicate title with ${titles.get(title)}`); titles.set(title, name); ok(decode(title).length <= 70, `${name}: title over 70 chars (${decode(title).length})`); }
  if (desc) { ok(!descs.has(desc), `${name}: duplicate description`); descs.set(desc, name); const L = decode(desc).length; ok(L >= 70 && L <= 170, `${name}: description length ${L} outside 70-170`); }
  ok((html.match(/<h1[\s>]/g) || []).length === 1, `${name}: should have exactly one h1`);
  const noindex = /<meta name="robots" content="noindex">/.test(html);
  const canonical = attr(html, /<link rel="canonical" href="([^"]+)"/);
  if (!noindex) {
    indexable.push(pageUrlPath(f));
    ok(canonical === `${BASE}/${pageUrlPath(f)}`, `${name}: canonical ${canonical} != ${BASE}/${pageUrlPath(f)}`);
  } else {
    ok(!canonical, `${name}: noindex page should not have canonical`);
  }
  // No external scripts, styles, fonts or iframes
  for (const m of html.matchAll(/<(script|link|iframe|img)\b[^>]*\s(?:src|href)="(https?:[^"]+)"/g)) {
    if (m[1] === 'link' && /rel="canonical"/.test(m[0])) continue;
    ok(m[2].startsWith(BASE), `${name}: external resource ${m[2]}`);
  }
  ok(!/adsbygoogle|googlesyndication|google-adsense-account|gtag\(|googletagmanager/.test(html), `${name}: contains ad/analytics code`);
  // JSON-LD
  for (const m of html.matchAll(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/g)) {
    let data;
    try { data = JSON.parse(m[1]); } catch (e) { ok(false, `${name}: JSON-LD does not parse: ${e.message}`); continue; }
    ok(data['@context'] === 'https://schema.org', `${name}: JSON-LD @context`);
    ok(['WebApplication', 'BreadcrumbList'].includes(data['@type']), `${name}: unexpected JSON-LD type ${data['@type']}`);
    if (data['@type'] === 'BreadcrumbList') {
      data.itemListElement.forEach((it, i) => {
        ok(it['@type'] === 'ListItem' && it.position === i + 1 && it.name && it.item, `${name}: breadcrumb item ${i}`);
        ok(it.item.startsWith(BASE + '/'), `${name}: breadcrumb url`);
        ok(fs.existsSync(resolveTarget(f, it.item)), `${name}: breadcrumb target missing ${it.item}`);
      });
      ok(data.itemListElement[data.itemListElement.length - 1].item === canonical, `${name}: last breadcrumb should equal canonical`);
    }
    if (data['@type'] === 'WebApplication') {
      ok(data.name && data.url === canonical && data.applicationCategory && data.offers && data.offers.price === '0', `${name}: WebApplication fields`);
    }
  }
  // Links and assets
  for (const m of html.matchAll(/\s(href|src)="([^"]+)"/g)) {
    const url = decode(m[2]);
    if (/^(mailto:|https?:)/.test(url) && !url.startsWith(BASE)) continue;
    if (url.startsWith('#')) { ok(url === '#' || idsOf(f).has(url.slice(1)), `${name}: missing anchor ${url}`); continue; }
    const [p, hash] = url.split('#');
    const target = resolveTarget(f, p || '.');
    ok(fs.existsSync(target), `${name}: broken link ${url} -> ${rel(target)}`);
    if (hash && fs.existsSync(target)) ok(idsOf(target).has(hash), `${name}: missing anchor #${hash} in ${rel(target)}`);
    if (!url.startsWith(BASE) && name !== '404.html') ok(!url.startsWith('/'), `${name}: root-absolute link ${url} breaks on GitHub project sites`);
  }
  // Form controls have labels
  for (const m of html.matchAll(/<(input|textarea|select)\b([^>]*)>/g)) {
    if (/type="hidden"/.test(m[2])) continue;
    const id = attr(m[2], /\sid="([^"]+)"/);
    ok(id && new RegExp(`<label[^>]*for="${id}"`).test(html), `${name}: ${m[1]}#${id} has no <label for>`);
  }
}

// sitemap & robots
const sm = fs.readFileSync(path.join(root, 'sitemap.xml'), 'utf8');
ok(/^<\?xml version="1.0" encoding="UTF-8"\?>\n<urlset xmlns="http:\/\/www.sitemaps.org\/schemas\/sitemap\/0.9">/.test(sm), 'sitemap header');
const locs = [...sm.matchAll(/<loc>([^<]+)<\/loc>/g)].map((m) => m[1]);
ok((sm.match(/<url>/g) || []).length === locs.length && (sm.match(/<\/url>/g) || []).length === locs.length, 'sitemap url/loc balance');
ok(locs.length === new Set(locs).size, 'sitemap duplicate locs');
for (const l of locs) ok(fs.existsSync(resolveTarget(path.join(root, 'index.html'), l)), `sitemap loc missing file: ${l}`);
for (const p of indexable) ok(locs.includes(`${BASE}/${p}`), `indexable page not in sitemap: ${p}`);
ok(!locs.some((l) => l.includes('404')), 'sitemap must not include 404');
const robots = fs.readFileSync(path.join(root, 'robots.txt'), 'utf8');
ok(robots.includes(`Sitemap: ${BASE}/sitemap.xml`), 'robots.txt sitemap line');
ok(!/Disallow:\s*\/\s*$/m.test(robots), 'robots.txt blocks everything');
ok(!fs.existsSync(path.join(root, 'ads.txt')), 'ads.txt must not exist until an ad account is approved');

// Total size
const total = files.reduce((a, f) => a + fs.statSync(f).size, 0);

// Pre-launch gate: node tests/check-site.js --launch fails while any placeholder or template notice remains.
if (process.argv.includes('--launch')) {
  ok(!BASE.includes('YOUR-DOMAIN'), `launch: base URL is still the placeholder ${BASE}`);
  for (const f of htmlFiles) {
    const html = fs.readFileSync(f, 'utf8');
    const n = (html.match(/PLACEHOLDER/g) || []).length;
    ok(n === 0, `launch: ${rel(f)} still has ${n} PLACEHOLDER marker(s)`);
    ok(!/Template: review before publishing|Before publishing:/.test(html), `launch: ${rel(f)} still shows the "review before publishing" notice`);
  }
}
if (BASE.includes('YOUR-DOMAIN')) warn.push(`Base URL is still the placeholder ${BASE}. Run scripts/set-base-url.js before publishing.`);
console.log(`Checked ${htmlFiles.length} HTML files, ${locs.length} sitemap URLs, ${checks} assertions. Published files: ${files.length}, ${(total / 1024).toFixed(1)} KB.`);
warn.forEach((w) => console.log('WARN: ' + w));
if (errors.length) { console.log(`FAIL: ${errors.length} problem(s)`); errors.forEach((e) => console.log('  - ' + e)); process.exit(1); }
console.log('PASS: no problems found.');
