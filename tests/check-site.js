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
  // External scripts/styles/fonts/iframes: only allowlisted third parties
  const AHREFS_SCRIPT = 'https://analytics.ahrefs.com/analytics.js';
  const AHREFS_KEY = 'XCr0oQV20TdnkX+vfv0zKw';
  ok(html.includes(`<script src="${AHREFS_SCRIPT}" data-key="${AHREFS_KEY}" async></script>`), `${name}: missing Ahrefs Web Analytics script`);
  const csp = attr(html, /<meta http-equiv="Content-Security-Policy" content="([^"]+)"/);
  if (csp) {
    ok(/\bscript-src\b[^;]*https:\/\/analytics\.ahrefs\.com/.test(csp), `${name}: CSP script-src must allow https://analytics.ahrefs.com`);
    ok(/\bconnect-src\b[^;]*https:\/\/analytics\.ahrefs\.com/.test(csp), `${name}: CSP connect-src must allow https://analytics.ahrefs.com`);
  } else {
    ok(name === 'index.html', `${name}: expected CSP meta (home page is the intentional exception)`);
  }
  for (const m of html.matchAll(/<(script|link|iframe|img)\b[^>]*\s(?:src|href)="(https?:[^"]+)"/g)) {
    if (m[1] === 'link' && /rel="canonical"/.test(m[0])) continue;
    const allowedHostinger = name === 'index.html' && /^https:\/\/(cdn-reach\.hostinger\.com|reach\.hostinger\.com|reach-forms\.hostingerusercontent\.com)\//.test(m[2]);
    const allowedAhrefs = m[2] === AHREFS_SCRIPT;
    ok(m[2].startsWith(BASE) || allowedHostinger || allowedAhrefs, `${name}: external resource ${m[2]}`);
  }
  ok(!/adsbygoogle|googlesyndication|google-adsense-account|gtag\(|googletagmanager/.test(html), `${name}: contains ad/analytics code`);
  // JSON-LD
  for (const m of html.matchAll(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/g)) {
    let data;
    try { data = JSON.parse(m[1]); } catch (e) { ok(false, `${name}: JSON-LD does not parse: ${e.message}`); continue; }
    ok(data['@context'] === 'https://schema.org', `${name}: JSON-LD @context`);
    ok(['WebApplication', 'BreadcrumbList', 'WebSite', 'Organization', 'Article', 'FAQPage', 'ItemList'].includes(data['@type']), `${name}: unexpected JSON-LD type ${data['@type']}`);
    if (data['@type'] === 'BreadcrumbList') {
      data.itemListElement.forEach((it, i) => {
        ok(it['@type'] === 'ListItem' && it.position === i + 1 && it.name && it.item, `${name}: breadcrumb item ${i}`);
        ok(it.item.startsWith(BASE + '/'), `${name}: breadcrumb url`);
        ok(fs.existsSync(resolveTarget(f, it.item)), `${name}: breadcrumb target missing ${it.item}`);
      });
      ok(data.itemListElement[data.itemListElement.length - 1].item === canonical, `${name}: last breadcrumb should equal canonical`);
    }
    if (data['@type'] === 'WebSite' || data['@type'] === 'Organization') {
      ok(name === 'index.html', `${name}: ${data['@type']} JSON-LD belongs on the home page only`);
      ok(data.name === 'StudyKit Hub' && data.url === `${BASE}/`, `${name}: ${data['@type']} name/url`);
      if (data.logo) ok(data.logo.startsWith(BASE + '/') && fs.existsSync(resolveTarget(f, data.logo)), `${name}: Organization logo missing ${data.logo}`);
      if (data['@type'] === 'Organization') {
        ok(Array.isArray(data.sameAs) && data.sameAs.includes('https://github.com/HamzaXali/studykit-tools') && data.sameAs.includes('https://dev.to/hamzaxali'), `${name}: Organization sameAs GitHub and DEV`);
        ok(data.contactPoint && data.contactPoint['@type'] === 'ContactPoint' && data.contactPoint.contactType === 'customer support' && data.contactPoint.url === `${BASE}/contact/`, `${name}: Organization contactPoint`);
        ok(fs.existsSync(resolveTarget(f, `${BASE}/contact/`)), `${name}: contact page missing`);
      }
    }
    if (data['@type'] === 'ItemList') {
      ok(name === 'tools/index.html', `${name}: ItemList JSON-LD belongs on the tools hub only`);
      ok(Array.isArray(data.itemListElement) && data.itemListElement.length > 0, `${name}: ItemList itemListElement`);
      data.itemListElement.forEach((it, i) => {
        ok(it['@type'] === 'ListItem' && it.position === i + 1 && it.name && it.url, `${name}: ItemList item ${i}`);
        ok(it.url.startsWith(BASE + '/tools/') && fs.existsSync(resolveTarget(f, it.url)), `${name}: ItemList url missing ${it.url}`);
      });
    }
    if (data['@type'] === 'WebApplication') {
      ok(data.name && data.url === canonical && data.applicationCategory && data.offers && data.offers.price === '0', `${name}: WebApplication fields`);
    }
    if (data['@type'] === 'Article') {
      ok(data.headline && data.description && data.datePublished && data.dateModified && data.author && data.publisher && data.mainEntityOfPage, `${name}: Article fields`);
      ok(data.author.name === 'Ali Hamza', `${name}: Article author`);
      ok(data.publisher.name === 'StudyKit Hub', `${name}: Article publisher`);
      ok(data.publisher.logo && data.publisher.logo.startsWith(BASE + '/') && fs.existsSync(resolveTarget(f, data.publisher.logo)), `${name}: Article publisher logo`);
      const canon = attr(html, /<link rel="canonical" href="([^"]+)"/);
      const me = typeof data.mainEntityOfPage === 'string' ? data.mainEntityOfPage : (data.mainEntityOfPage && data.mainEntityOfPage['@id']);
      ok(me === canon, `${name}: Article mainEntityOfPage should equal canonical`);
    }
    if (data['@type'] === 'FAQPage') {
      ok(Array.isArray(data.mainEntity) && data.mainEntity.length > 0, `${name}: FAQPage mainEntity`);
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

// Brand and owner details (StudyKit Hub rebrand)
const BRAND = 'StudyKit Hub';
const OWNER_EMAIL = 'hamzaxali44@gmail.com';
for (const f of files.filter((x) => /\.(html|css|js|xml|txt|svg)$/.test(x))) {
  const txt = fs.readFileSync(f, 'utf8');
  ok(!/StudyKit Tools/.test(txt), `${rel(f)}: old brand name "StudyKit Tools" is still present`);
}
for (const f of htmlFiles) {
  const html = fs.readFileSync(f, 'utf8');
  const name = rel(f);
  const title = decode(attr(html, /<title>([^<]+)<\/title>/) || '');
  // These titles are the requested SEO strings. They intentionally omit the usual "| StudyKit Hub" ending.
  const briefTitles = {
    'tools/reading-time-calculator/index.html': 'Reading Time Calculator - Free',
    'tools/final-grade-calculator/index.html': 'Final Grade Calculator - Free, No Sign-up',
    'tools/weighted-grade-calculator/index.html': 'Weighted Grade Calculator: Course Grade by Category - Free',
    'tools/citation-generator/index.html': 'APA 7 Citation Generator - Free, No Sign-up',
    'tools/percentage-calculator/index.html': 'Percentage Calculator - Free',
    'tools/gpa-cgpa-calculator/index.html': 'GPA Calculator - Free',
    'tools/flashcards/index.html': 'Flashcards Maker - Free',
    'tools/case-converter/index.html': 'Case Converter - Free',
    'guides/harvard-referencing/index.html': 'Harvard Referencing Guide - Examples & Format',
    'grade-tools/index.html': 'GPA, CGPA & Percentage Calculator | Free Grade Tools'
  };
  if (briefTitles[name]) ok(title === briefTitles[name], `${name}: title should match the requested SEO title, got ${title}`);
  else ok(title.startsWith(BRAND + ':') || title.endsWith('| ' + BRAND) || title.endsWith('| ' + BRAND + ' - Free'), `${name}: title should carry the brand: ${title}`);
  ok(!/id="advertising-details"/.test(html), `${name}: hidden advertising placeholder section must not exist`);
  if (name === '404.html') continue;
  const ogImage = attr(html, /<meta property="og:image" content="([^"]+)">/);
  ok(ogImage && ogImage.startsWith(BASE + '/') && fs.existsSync(resolveTarget(f, ogImage)), `${name}: og:image missing or file not found`);
  ok(/<meta name="twitter:card" content="summary_large_image">/.test(html), `${name}: twitter:card`);
  ok(attr(html, /<meta name="twitter:title" content="([^"]+)">/) === attr(html, /<meta property="og:title" content="([^"]+)">/), `${name}: twitter:title should match og:title`);
  ok(attr(html, /<meta name="twitter:description" content="([^"]+)">/) === attr(html, /<meta property="og:description" content="([^"]+)">/), `${name}: twitter:description should match og:description`);
  ok(attr(html, /<meta name="twitter:image" content="([^"]+)">/) === ogImage, `${name}: twitter:image should match og:image`);
  ok(html.includes(`<meta property="og:site_name" content="${BRAND}">`), `${name}: og:site_name should be ${BRAND}`);
  ok(html.includes('<span class="brand-name">StudyKit <span class="brand-hub">Hub</span></span>'), `${name}: header wordmark`);
  ok(html.includes('&copy; 2026 Ali Hamza. All rights reserved.'), `${name}: footer copyright`);
  ok(/<a href="(\.\.\/)*(tools\/|\.\/)"( aria-current="page")?>Study tools<\/a>/.test(html), `${name}: main nav links to the Study tools hub`);
}
for (const p of ['contact/index.html', 'privacy-policy/index.html', 'terms/index.html']) {
  ok(fs.readFileSync(path.join(root, p), 'utf8').includes(`mailto:${OWNER_EMAIL}`), `${p}: contact email link missing`);
}
ok(/20 October 2026/.test(fs.readFileSync(path.join(root, 'terms/index.html'), 'utf8')), 'terms/index.html: effective / last-updated date missing');
ok(/20 October 2026/.test(fs.readFileSync(path.join(root, 'disclaimer/index.html'), 'utf8')), 'disclaimer/index.html: effective / last-updated date missing');
ok(/4 November 2026/.test(fs.readFileSync(path.join(root, 'privacy-policy/index.html'), 'utf8')), 'privacy-policy/index.html: last-updated date missing');
ok(/20 October 2026/.test(fs.readFileSync(path.join(root, 'privacy-policy/index.html'), 'utf8')), 'privacy-policy/index.html: effective date missing');
ok(/Ahrefs Web Analytics/.test(fs.readFileSync(path.join(root, 'privacy-policy/index.html'), 'utf8')), 'privacy-policy/index.html: Ahrefs Web Analytics disclosure missing');
ok(/ahrefs\.com\/legal\/privacy-policy/.test(fs.readFileSync(path.join(root, 'privacy-policy/index.html'), 'utf8')), 'privacy-policy/index.html: Ahrefs privacy policy link missing');


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
    ok(!/class="placeholder"/.test(html), `launch: ${rel(f)} still has a highlighted placeholder`);
  }
  for (const f of files.filter((x) => /\.(html|css|js|xml|txt)$/.test(x))) {
    const txt = fs.readFileSync(f, 'utf8');
    for (const [re, label] of [[/YOUR-DOMAIN/, 'YOUR-DOMAIN'], [/example\.com/, 'example.com'], [/\bTODO\b/, 'TODO'], [/\bFIXME\b/, 'FIXME'], [/\bTBD\b/, 'TBD'], [/lorem ipsum/i, 'lorem ipsum']]) {
      ok(!re.test(txt), `launch: ${rel(f)} contains ${label}`);
    }
  }
}
// Redesign pages: categories, guides, and the three requested tool titles.
ok(!fs.existsSync(path.join(root, 'fix-tools')), 'no /fix-tools/ page (Fix is a home-page filter only)');
const homeHtml = fs.readFileSync(path.join(root, 'index.html'), 'utf8');
ok(homeHtml.includes('<meta name="google-site-verification" content="zqLcBOM9el9CY6rnKVchae06D5l7fZJyEUPQmGQ2HgY">'), 'home: google-site-verification meta unchanged');
ok(homeHtml.includes('data-reach-form="5f5083c1-a068-45ad-8572-30e1910901af"'), 'home: Hostinger Reach form kept');
ok(homeHtml.includes('https://cdn-reach.hostinger.com/js/embed.js'), 'home: Hostinger Reach script kept');
ok((homeHtml.match(/data-finder-item/g) || []).length === 16, 'home: 16 tool cards');
ok(!/Urdu/.test(homeHtml), 'home: no Urdu claim');
const toolsHub = fs.readFileSync(path.join(root, 'tools/index.html'), 'utf8');
ok(toolsHub.includes('<title>Free Study Tools for Students and Teachers | StudyKit Hub</title>'), 'tools hub title unchanged');
ok(toolsHub.includes('Sixteen free tools for everyday study, writing and teaching tasks.'), 'tools hub lead states 16 tools');
for (const slug of ['study-tools', 'write-tools', 'grade-tools', 'plan-tools']) {
  ok(toolsHub.includes(`href="../${slug}/"`), `tools hub links to /${slug}/`);
  const html = fs.readFileSync(path.join(root, slug, 'index.html'), 'utf8');
  ok(html.includes('"@type":"FAQPage"') || html.includes('"@type": "FAQPage"'), `${slug}: FAQPage JSON-LD`);
  ok(html.includes('"@type":"BreadcrumbList"') || html.includes('"@type": "BreadcrumbList"'), `${slug}: BreadcrumbList JSON-LD`);
  ok(html.includes('https://studykithub.online/tools/'), `${slug}: breadcrumb includes study tools hub`);
  ok(!/Urdu/.test(html), `${slug}: no Urdu claim`);
}
const guidePages = fs.readdirSync(path.join(root, 'guides'), { withFileTypes: true })
  .filter((e) => e.isDirectory())
  .map((e) => path.join(root, 'guides', e.name, 'index.html'));
const GUIDE_BYLINE = '<p class="byline">By Ali Hamza · Updated November 2026</p>';
ok(!fs.readFileSync(path.join(root, 'guides/index.html'), 'utf8').includes('class="byline"'), 'guides hub index has no byline');
for (const file of guidePages) {
  const html = fs.readFileSync(file, 'utf8');
  const name = rel(file);
  ok(fs.existsSync(file), `guide page exists: ${name}`);
  const bylines = html.match(/<p class="byline">[\s\S]*?<\/p>/g) || [];
  ok(bylines.length === 1 && bylines[0] === GUIDE_BYLINE, `${name}: expected exactly one byline`);
  const h1At = html.indexOf('<h1');
  const bylineAt = html.indexOf(GUIDE_BYLINE);
  ok(h1At !== -1 && bylineAt > h1At, `${name}: byline should follow the h1`);
  let article;
  const articleMatch = html.match(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/g) || [];
  for (const block of articleMatch) {
    const data = JSON.parse(block.replace(/^<script type="application\/ld\+json">/, '').replace(/<\/script>$/, ''));
    if (data['@type'] !== 'Article') continue;
    article = data;
  }
  ok(article, `${name}: Article JSON-LD`);
  ok(article && article.author && article.author['@type'] === 'Person' && article.author.name === 'Ali Hamza' && article.author.url === `${BASE}/about/`, `${name}: Article author with About url`);
  const expectedModified = name === 'guides/harvard-referencing/index.html' ? '2026-11-11' : '2026-11-09';
  ok(article && article.dateModified === expectedModified, `${name}: dateModified is ${expectedModified}`);
  ok(article && /^\d{4}-\d{2}-\d{2}$/.test(article.datePublished), `${name}: datePublished still set`);
}
const newGuides = ['essay-timer', 'what-do-i-need-on-the-final', 'how-long-to-read-1000-words'];
const guidesIndex = fs.readFileSync(path.join(root, 'guides/index.html'), 'utf8');
for (const slug of newGuides) {
  const file = path.join(root, 'guides', slug, 'index.html');
  ok(fs.existsSync(file), `guide exists: ${slug}`);
  const html = fs.readFileSync(file, 'utf8');
  ok(guidesIndex.includes(`href="./${slug}/"`), `guides index links to ${slug}`);
  ok(html.includes('<p class="byline">By Ali Hamza · Updated November 2026</p>'), `${slug}: visible byline`);
  ok(html.includes('"@type":"Article"'), `${slug}: Article JSON-LD`);
  ok(html.includes('"@type":"FAQPage"'), `${slug}: FAQPage JSON-LD`);
  ok(html.includes('"name":"Ali Hamza"'), `${slug}: Article author Ali Hamza`);
  const article = html.match(/<article[\s\S]*<\/article>/);
  ok(article, `${slug}: article element`);
  const prose = article[0].replace(/<[^>]+>/g, ' ').replace(/&[a-z#0-9]+;/gi, ' ').replace(/\s+/g, ' ').trim();
  const count = prose.split(/\s+/).filter(Boolean).length;
  ok(count >= 800 && count <= 1200, `${slug}: article word count ${count} outside 800-1200`);
  ok(!/Urdu/.test(html), `${slug}: no Urdu claim`);
}
for (const [file, title] of [
  ['tools/reading-time-calculator/index.html', 'Reading Time Calculator - Free'],
  ['tools/final-grade-calculator/index.html', 'Final Grade Calculator - Free, No Sign-up'],
  ['tools/citation-generator/index.html', 'APA 7 Citation Generator - Free, No Sign-up']
]) {
  const html = fs.readFileSync(path.join(root, file), 'utf8');
  ok(html.includes(`<meta property="og:title" content="${title.replace(/&/g, '&amp;')}">`), `${file}: og:title`);
  ok(html.includes(`<meta name="twitter:title" content="${title.replace(/&/g, '&amp;')}">`), `${file}: twitter:title`);
}

if (BASE.includes('YOUR-DOMAIN')) warn.push(`Base URL is still the placeholder ${BASE}. Run scripts/set-base-url.js before publishing.`);
console.log(`Checked ${htmlFiles.length} HTML files, ${locs.length} sitemap URLs, ${checks} assertions. Published files: ${files.length}, ${(total / 1024).toFixed(1)} KB.`);
warn.forEach((w) => console.log('WARN: ' + w));
if (errors.length) { console.log(`FAIL: ${errors.length} problem(s)`); errors.forEach((e) => console.log('  - ' + e)); process.exit(1); }
console.log('PASS: no problems found.');
