#!/usr/bin/env node
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');
const BASE = 'https://studykithub.online';
const DATE = '2026-10-28';
const brandSvg = `<svg class="brand-mark" viewBox="0 0 32 32" aria-hidden="true" focusable="false"><rect width="32" height="32" rx="9" fill="#0f766e"/><path d="M5.5 10.5c3.4-1.7 7-1.6 10.5.9 3.5-2.5 7.1-2.6 10.5-.9v12.2c-3.4-1.7-7-1.6-10.5.9-3.5-2.5-7.1-2.6-10.5-.9z" fill="#fff"/><path d="M16 11.4v12.2" stroke="#0f766e" stroke-width="1.5"/><circle cx="25" cy="7" r="3.2" fill="#fbbf24"/></svg>`;

const wc = (s) => (s.replace(/<[^>]+>/g, ' ').match(/[A-Za-z0-9]+(?:'[A-Za-z]+)?/g) || []).length;
const sid = (t) => t.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
const p = (t) => `<p>${t}</p>`;
const ul = (items) => `<ul>\n${items.map((i) => `<li>${i}</li>`).join('\n')}\n</ul>`;
const ol = (items) => `<ol>\n${items.map((i) => `<li>${i}</li>`).join('\n')}\n</ol>`;

/** @type {Array<object>} */
const guides = [];

function add(g) {
  guides.push(g);
}

// Content loaded from companion JSON for maintainability
const data = JSON.parse(fs.readFileSync(path.join(__dirname, 'guides-content.json'), 'utf8'));
for (const g of data) add(g);

function sectionHtml(sections) {
  return sections.map((s) => {
    let body = '';
    for (const b of s.blocks) {
      if (b.type === 'p') body += p(b.text) + '\n';
      else if (b.type === 'ul') body += ul(b.items) + '\n';
      else if (b.type === 'ol') body += ol(b.items) + '\n';
    }
    return `<h2 id="${sid(s.title)}">${s.title}</h2>\n${body}`;
  }).join('\n');
}

function pageHtml(g) {
  const pageTitle = `${g.metaTitle} | StudyKit Hub`;
  const desc = g.description;
  const canonical = `${BASE}/guides/${g.slug}/`;
  const body = sectionHtml(g.sections);
  const relatedGuides = (g.related || []).map(([slug, title]) =>
    `<li><a href="../${slug}/">${title}</a></li>`).join('');
  const articleLd = {
    '@context': 'https://schema.org',
    '@type': 'Article',
    headline: g.h1,
    description: desc,
    datePublished: DATE,
    dateModified: DATE,
    inLanguage: 'en',
    author: { '@type': 'Person', name: 'Ali Hamza' },
    publisher: { '@type': 'Organization', name: 'StudyKit Hub', url: `${BASE}/` },
    mainEntityOfPage: canonical,
    url: canonical
  };
  const crumbLd = {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: [
      { '@type': 'ListItem', position: 1, name: 'Home', item: `${BASE}/` },
      { '@type': 'ListItem', position: 2, name: 'Guides', item: `${BASE}/guides/` },
      { '@type': 'ListItem', position: 3, name: g.nav, item: canonical }
    ]
  };
  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${pageTitle}</title>
<meta name="description" content="${desc.replace(/"/g, '&quot;')}">
<link rel="canonical" href="${canonical}">
<meta http-equiv="Content-Security-Policy" content="default-src 'self'; script-src 'self'; style-src 'self'; img-src 'self' data:; connect-src 'none'; object-src 'none'; base-uri 'self'; form-action 'none'">
<meta name="referrer" content="strict-origin-when-cross-origin">
<meta name="theme-color" content="#ffffff" media="(prefers-color-scheme: light)">
<meta name="theme-color" content="#111a2e" media="(prefers-color-scheme: dark)">
<meta property="og:type" content="article">
<meta property="og:site_name" content="StudyKit Hub">
<meta property="og:title" content="${g.metaTitle.replace(/"/g, '&quot;')}">
<meta property="og:description" content="${desc.replace(/"/g, '&quot;')}">
<meta property="og:url" content="${canonical}">
<meta property="og:image" content="${BASE}/assets/img/og-image.png">
<meta property="og:image:type" content="image/png">
<meta property="og:image:width" content="1200">
<meta property="og:image:height" content="630">
<meta property="og:image:alt" content="StudyKit Hub: Free Study Tools for Students and Teachers. Learn smarter. Study better.">
<meta name="twitter:card" content="summary_large_image">
<meta name="twitter:title" content="${g.metaTitle.replace(/"/g, '&quot;')}">
<meta name="twitter:description" content="${desc.replace(/"/g, '&quot;')}">
<meta name="twitter:image" content="${BASE}/assets/img/og-image.png">
<meta name="twitter:image:alt" content="StudyKit Hub: Free Study Tools for Students and Teachers. Learn smarter. Study better.">
<link rel="icon" href="../../favicon.svg" type="image/svg+xml">
<link rel="stylesheet" href="../../assets/css/styles.css">
<script type="application/ld+json">${JSON.stringify(articleLd)}</script>
<script type="application/ld+json">${JSON.stringify(crumbLd)}</script>
</head>
<body>
<a class="skip-link" href="#main">Skip to main content</a>
<header class="site-header">
<div class="wrap">
<a class="brand" href="../../">${brandSvg}<span class="brand-name">StudyKit <span class="brand-hub">Hub</span></span></a>
<nav class="site-nav" aria-label="Main"><ul><li><a href="../../">Home</a></li><li><a href="../../tools/">Study tools</a></li><li><a href="../../guides/">Guides</a></li><li><a href="../../about/">About</a></li><li><a href="../../contact/">Contact</a></li></ul></nav>
</div>
</header>
<main id="main" tabindex="-1">
<div class="wrap">
<nav class="breadcrumbs" aria-label="Breadcrumb"><ol><li><a href="../../">Home</a></li><li><a href="../">Guides</a></li><li><span aria-current="page">${g.nav}</span></li></ol></nav>
<article>
<h1>${g.h1}</h1>
<p class="guide-meta">Study guide · Updated ${DATE.replace(/(\d+)-(\d+)-(\d+)/, (_, y, m, d) => `${Number(d)} ${['January','February','March','April','May','June','July','August','September','October','November','December'][Number(m)-1]} ${y}`)}</p>
<p class="lead">${g.lead}</p>
<div class="prose">
${body}
<h2 id="use-the-matching-tool">Use the matching StudyKit tool</h2>
<p>Open the <a href="${g.tool[0]}">${g.tool[1]}</a> while you apply this guide. It runs in your browser: your text stays on your device unless a page says otherwise (for example a draft saved in local storage).</p>
</div>
<section class="related" aria-labelledby="related-guides-heading"><h2 id="related-guides-heading">Related guides</h2><ul>${relatedGuides}</ul></section>
<section class="related" aria-labelledby="related-tools-heading"><h2 id="related-tools-heading">Related tool</h2><ul><li><a href="${g.tool[0]}">${g.tool[1]}</a></li><li><a href="../../tools/">All study tools</a></li></ul></section>
</article>
</div>
</main>
<footer class="site-footer">
<div class="wrap">
<div class="footer-cols">
<section aria-labelledby="ft-tools"><h2 id="ft-tools">Study tools</h2><ul><li><a href="../../tools/word-counter/">Word and Character Counter</a></li><li><a href="../../tools/reading-time-calculator/">Reading Time Calculator</a></li><li><a href="../../tools/case-converter/">Case Converter</a></li><li><a href="../../tools/remove-duplicate-lines/">Duplicate Line Remover</a></li><li><a href="../../tools/whitespace-cleaner/">Whitespace Cleaner</a></li><li><a href="../../tools/study-notes-organizer/">Study Notes Organiser</a></li><li><a href="../../tools/">All study tools</a></li></ul></section>
<section aria-labelledby="ft-site"><h2 id="ft-site">Site</h2><ul>
<li><a href="../../guides/">Guides</a></li>
<li><a href="../../about/">About</a></li>
<li><a href="../../contact/">Contact</a></li>
<li><a href="../../privacy-policy/">Privacy policy</a></li>
<li><a href="../../terms/">Terms of use</a></li>
<li><a href="../../disclaimer/">Disclaimer</a></li>
</ul></section>
<section aria-labelledby="ft-privacy"><h2 id="ft-privacy">Your text stays with you</h2>
<p>The tools on this site process text inside your browser. What you type is not uploaded to a server.</p></section>
</div>
<div class="footer-bottom"><p class="footer-brand"><strong>StudyKit Hub</strong> &middot; Learn smarter. Study better.</p><p>&copy; 2026 Ali Hamza. All rights reserved.</p></div>
</div>
</footer>
</body>
</html>
`;
}

function hubHtml(list) {
  const cards = list.map((g) =>
    `<li><a class="guide-card" href="./${g.slug}/"><h3>${g.nav}</h3><p>${g.description}</p></a></li>`
  ).join('\n');
  const desc = 'Free study guides for university students in the US, UK and Europe: essays, grades, revision methods, citations and more — linked to private browser tools.';
  const pageTitle = 'Study Guides for University Students | StudyKit Hub';
  const canonical = `${BASE}/guides/`;
  const crumbLd = {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: [
      { '@type': 'ListItem', position: 1, name: 'Home', item: `${BASE}/` },
      { '@type': 'ListItem', position: 2, name: 'Guides', item: canonical }
    ]
  };
  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${pageTitle}</title>
<meta name="description" content="${desc}">
<link rel="canonical" href="${canonical}">
<meta http-equiv="Content-Security-Policy" content="default-src 'self'; script-src 'self'; style-src 'self'; img-src 'self' data:; connect-src 'none'; object-src 'none'; base-uri 'self'; form-action 'none'">
<meta name="referrer" content="strict-origin-when-cross-origin">
<meta name="theme-color" content="#ffffff" media="(prefers-color-scheme: light)">
<meta name="theme-color" content="#111a2e" media="(prefers-color-scheme: dark)">
<meta property="og:type" content="website">
<meta property="og:site_name" content="StudyKit Hub">
<meta property="og:title" content="Study Guides for University Students">
<meta property="og:description" content="${desc}">
<meta property="og:url" content="${canonical}">
<meta property="og:image" content="${BASE}/assets/img/og-image.png">
<meta property="og:image:type" content="image/png">
<meta property="og:image:width" content="1200">
<meta property="og:image:height" content="630">
<meta property="og:image:alt" content="StudyKit Hub: Free Study Tools for Students and Teachers. Learn smarter. Study better.">
<meta name="twitter:card" content="summary_large_image">
<meta name="twitter:title" content="Study Guides for University Students">
<meta name="twitter:description" content="${desc}">
<meta name="twitter:image" content="${BASE}/assets/img/og-image.png">
<meta name="twitter:image:alt" content="StudyKit Hub: Free Study Tools for Students and Teachers. Learn smarter. Study better.">
<link rel="icon" href="../favicon.svg" type="image/svg+xml">
<link rel="stylesheet" href="../assets/css/styles.css">
<script type="application/ld+json">${JSON.stringify(crumbLd)}</script>
</head>
<body>
<a class="skip-link" href="#main">Skip to main content</a>
<header class="site-header">
<div class="wrap">
<a class="brand" href="../">${brandSvg}<span class="brand-name">StudyKit <span class="brand-hub">Hub</span></span></a>
<nav class="site-nav" aria-label="Main"><ul><li><a href="../">Home</a></li><li><a href="../tools/">Study tools</a></li><li><a href="./" aria-current="page">Guides</a></li><li><a href="../about/">About</a></li><li><a href="../contact/">Contact</a></li></ul></nav>
</div>
</header>
<main id="main" tabindex="-1">
<div class="wrap">
<nav class="breadcrumbs" aria-label="Breadcrumb"><ol><li><a href="../">Home</a></li><li><span aria-current="page">Guides</span></li></ol></nav>
<h1>Study guides</h1>
<p class="lead">Practical guides for English-speaking university students in the United States, United Kingdom and Europe. Each guide links to a free StudyKit tool that runs in your browser.</p>
<ul class="guide-grid">
${cards}
</ul>
</div>
</main>
<footer class="site-footer">
<div class="wrap">
<div class="footer-cols">
<section aria-labelledby="ft-tools"><h2 id="ft-tools">Study tools</h2><ul><li><a href="../tools/word-counter/">Word and Character Counter</a></li><li><a href="../tools/reading-time-calculator/">Reading Time Calculator</a></li><li><a href="../tools/case-converter/">Case Converter</a></li><li><a href="../tools/remove-duplicate-lines/">Duplicate Line Remover</a></li><li><a href="../tools/whitespace-cleaner/">Whitespace Cleaner</a></li><li><a href="../tools/study-notes-organizer/">Study Notes Organiser</a></li><li><a href="../tools/">All study tools</a></li></ul></section>
<section aria-labelledby="ft-site"><h2 id="ft-site">Site</h2><ul>
<li><a href="./">Guides</a></li>
<li><a href="../about/">About</a></li>
<li><a href="../contact/">Contact</a></li>
<li><a href="../privacy-policy/">Privacy policy</a></li>
<li><a href="../terms/">Terms of use</a></li>
<li><a href="../disclaimer/">Disclaimer</a></li>
</ul></section>
<section aria-labelledby="ft-privacy"><h2 id="ft-privacy">Your text stays with you</h2>
<p>The tools on this site process text inside your browser. What you type is not uploaded to a server.</p></section>
</div>
<div class="footer-bottom"><p class="footer-brand"><strong>StudyKit Hub</strong> &middot; Learn smarter. Study better.</p><p>&copy; 2026 Ali Hamza. All rights reserved.</p></div>
</div>
</footer>
</body>
</html>
`;
}

// Validate and write
const report = [];
for (const g of guides) {
  const toolSectionWords = 40; // approx from template
  const text = g.lead + ' ' + g.sections.map((s) => s.title + ' ' + s.blocks.map((b) => b.text || (b.items || []).join(' ')).join(' ')).join(' ');
  const w = wc(text) + toolSectionWords;
  const pageTitle = `${g.metaTitle} | StudyKit Hub`;
  if (pageTitle.length > 70) throw new Error(`title too long ${g.slug}: ${pageTitle.length}`);
  if (g.description.length < 70 || g.description.length > 170) throw new Error(`desc ${g.slug}: ${g.description.length}`);
  if (w < 800 || w > 1600) throw new Error(`words ${g.slug}: ${w}`);
  const dir = path.join(ROOT, 'guides', g.slug);
  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(path.join(dir, 'index.html'), pageHtml(g));
  report.push({ slug: g.slug, words: w, title: pageTitle });
}
fs.mkdirSync(path.join(ROOT, 'guides'), { recursive: true });
fs.writeFileSync(path.join(ROOT, 'guides', 'index.html'), hubHtml(guides));
console.log(JSON.stringify(report, null, 2));
console.log('Wrote', report.length, 'guides + hub');
