// Browser tests: every page at 375px and 1280px, light and dark, console errors, overflow,
// axe-core scan, keyboard basics, and functional tests of every tool button.
// Run: cd tests/browser && npm install && node run.mjs
// Uses the system Chrome (CHROME_PATH env var, default /usr/bin/google-chrome).
import { chromium } from 'playwright-core';
import { spawn } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';

const require = createRequire(import.meta.url);
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '../..');
const T = require(path.join(ROOT, 'assets/js/text-utils.js'));
const AXE = fs.readFileSync(require.resolve('axe-core/axe.min.js'), 'utf8');
const BASE_URL = fs.readFileSync(path.join(ROOT, 'scripts/base-url.txt'), 'utf8').trim();
const SHOTS = process.env.SHOTS_DIR || path.resolve(ROOT, '..', 'studykit-tools-screenshots');
const PORT = 8765;
// Serve the site under a sub-path, like a GitHub Pages project site (user.github.io/studykit-tools/).
const serveDir = fs.mkdtempSync(path.join(os.tmpdir(), 'sk-serve-'));
fs.symlinkSync(ROOT, path.join(serveDir, 'studykit-tools'));
const SITE = `http://127.0.0.1:${PORT}/studykit-tools/`;
fs.mkdirSync(SHOTS, { recursive: true });

const results = { pass: 0, fail: 0, failures: [], notes: [] };
function check(cond, msg) {
  if (cond) results.pass++;
  else { results.fail++; results.failures.push(msg); console.log('  FAIL ' + msg); }
}

const PAGES = ['', 'about/', 'contact/', 'privacy-policy/', 'terms/', 'disclaimer/', '404.html',
  'tools/word-counter/', 'tools/reading-time-calculator/', 'tools/case-converter/',
  'tools/remove-duplicate-lines/', 'tools/whitespace-cleaner/', 'tools/study-notes-organizer/'];

const server = spawn('python3', ['-m', 'http.server', String(PORT), '--bind', '127.0.0.1', '--directory', serveDir], { stdio: 'ignore' });
await new Promise((r) => setTimeout(r, 800));

const browser = await chromium.launch({ executablePath: process.env.CHROME_PATH || '/usr/bin/google-chrome', args: ['--no-sandbox'] });

async function newPage(width, scheme = 'light') {
  const context = await browser.newContext({
    viewport: { width, height: width < 600 ? 800 : 900 }, colorScheme: scheme, acceptDownloads: true,
    isMobile: width < 600, hasTouch: width < 600, deviceScaleFactor: width < 600 ? 2 : 1
  });
  await context.grantPermissions(['clipboard-read', 'clipboard-write'], { origin: `http://127.0.0.1:${PORT}` });
  // The 404 page uses absolute links to the configured base URL; map those to the local server.
  await context.route(BASE_URL + '/**', async (route) => {
    let rel = decodeURIComponent(new URL(route.request().url()).pathname).replace(/^\/+/, '');
    let file = path.join(ROOT, rel);
    if (rel === '' || rel.endsWith('/')) file = path.join(file, 'index.html');
    if (!fs.existsSync(file)) return route.fulfill({ status: 404, body: 'not found' });
    const types = { '.html': 'text/html', '.css': 'text/css', '.js': 'text/javascript', '.svg': 'image/svg+xml', '.xml': 'application/xml', '.txt': 'text/plain' };
    await route.fulfill({ status: 200, contentType: types[path.extname(file)] || 'application/octet-stream', body: fs.readFileSync(file) });
  });
  const page = await context.newPage();
  const log = { console: [], pageErrors: [], badResponses: [], external: [] };
  page.on('console', (m) => { if (m.type() === 'error' || m.type() === 'warning') log.console.push(`${m.type()}: ${m.text()}`); });
  page.on('pageerror', (e) => log.pageErrors.push(String(e)));
  page.on('response', (r) => { if (r.status() >= 400) log.badResponses.push(`${r.status()} ${r.url()}`); });
  page.on('request', (r) => { const u = r.url(); if (!u.startsWith(`http://127.0.0.1:${PORT}`) && !u.toLowerCase().startsWith(BASE_URL.toLowerCase()) && !u.startsWith('data:') && !u.startsWith('blob:')) log.external.push(u); });
  page.on('dialog', (d) => d.accept());
  return { context, page, log };
}

async function axe(page) {
  // Inject via DevTools evaluate (not a <script> tag) so the page's real CSP stays enforced.
  await page.evaluate(AXE);
  return page.evaluate(async () => {
    const r = await window.axe.run(document, { runOnly: { type: 'tag', values: ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa', 'best-practice'] } });
    return r.violations.map((v) => ({ id: v.id, impact: v.impact, nodes: v.nodes.length, target: v.nodes.slice(0, 3).map((n) => n.target.join(' ')) }));
  });
}

// ---------------- Page sweep ----------------
const axeSummary = [];
for (const width of [375, 1280]) {
  for (const scheme of ['light', 'dark']) {
    for (const p of PAGES) {
      const { context, page, log } = await newPage(width, scheme);
      const label = `${p || 'home'} @${width} ${scheme}`;
      const resp = await page.goto(SITE + p, { waitUntil: 'load' });
      check(resp.status() === 200, `${label}: HTTP ${resp.status()}`);
      await page.waitForTimeout(150);
      const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
      check(overflow <= 0, `${label}: horizontal overflow ${overflow}px`);
      const cssLoaded = p === '404.html' ? true : await page.evaluate(() => getComputedStyle(document.querySelector('.site-header')).borderBottomStyle === 'solid');
      check(cssLoaded, `${label}: stylesheet not applied`);
      const v = await axe(page);
      axeSummary.push({ label, violations: v });
      check(v.length === 0, `${label}: axe violations ${JSON.stringify(v)}`);
      if (scheme === 'light' && p !== '404.html') {
        // Keyboard basics: first Tab lands on the skip link; Enter moves focus to main.
        await page.keyboard.press('Tab');
        const first = await page.evaluate(() => ({ cls: document.activeElement.className, text: document.activeElement.textContent.trim() }));
        check(first.cls === 'skip-link', `${label}: first Tab should focus skip link, got ${JSON.stringify(first)}`);
        const skipVisible = await page.evaluate(() => document.activeElement.getBoundingClientRect().top >= 0);
        check(skipVisible, `${label}: skip link not visible when focused`);
        await page.keyboard.press('Enter');
        const inMain = await page.evaluate(() => document.activeElement.id === 'main' || !!document.activeElement.closest('main'));
        check(inMain, `${label}: skip link did not move focus to main`);
        // Tab through the page: every focused element must be visible, have a name and a visible focus style.
        const seen = [];
        for (let i = 0; i < 60; i++) {
          await page.keyboard.press('Tab');
          const info = await page.evaluate(() => {
            const el = document.activeElement;
            if (!el || el === document.body) return null;
            const r = el.getBoundingClientRect();
            const cs = getComputedStyle(el);
            const name = (el.getAttribute('aria-label') || el.labels?.[0]?.textContent || el.textContent || el.value || el.title || '').trim();
            return { tag: el.tagName, id: el.id, name: name.slice(0, 40), visible: r.width > 0 && r.height > 0 && cs.visibility !== 'hidden', outline: cs.outlineStyle !== 'none' && parseFloat(cs.outlineWidth) >= 2 };
          });
          if (!info) break;
          seen.push(info);
        }
        const bad = seen.filter((s) => !s.visible || !s.name || !s.outline);
        check(seen.length > 3, `${label}: too few tab stops (${seen.length})`);
        check(bad.length === 0, `${label}: tab stops without visible focus/name: ${JSON.stringify(bad.slice(0, 3))}`);
        if (width === 375 && p === 'tools/word-counter/') results.notes.push(`Tab order sample on word counter (375px): ${seen.slice(0, 12).map((s) => s.id || s.name).join(' -> ')}`);
      }
      if (scheme === 'light' && p === '404.html') {
        await page.keyboard.press('Tab');
        const f = await page.evaluate(() => { const el = document.activeElement; const cs = getComputedStyle(el); return { tag: el.tagName, outline: cs.outlineStyle !== 'none' }; });
        check(f.tag === 'A' && f.outline, `${label}: first Tab focuses a link with visible focus`);
        await Promise.all([page.waitForNavigation(), page.keyboard.press('Enter')]);
        check((await page.textContent('h1')).includes('Free text tools'), `${label}: home link works (base URL mapped to local server)`);
      }
      check(log.pageErrors.length === 0, `${label}: page errors ${log.pageErrors.join(' | ')}`);
      check(log.console.length === 0, `${label}: console errors/warnings ${log.console.join(' | ')}`);
      check(log.badResponses.length === 0, `${label}: failed responses ${log.badResponses.join(' | ')}`);
      check(log.external.length === 0, `${label}: external requests ${log.external.join(' | ')}`);
      if (scheme === 'light' && ['', 'tools/word-counter/', 'tools/study-notes-organizer/'].includes(p)) {
        const name = (p ? p.split('/')[1] : 'home') + `-${width === 375 ? 'mobile' : 'desktop'}.png`;
        await page.evaluate(() => window.scrollTo(0, 0));
        if (p === 'tools/word-counter/') { await page.fill('#wc-input', 'Photosynthesis turns light into chemical energy. Plants, algae and some bacteria do it.\n\nIt happens mainly in the leaves. 👋🏽 Café — پاکستان ایک خوبصورت ملک ہے۔'); }
        if (p === 'tools/study-notes-organizer/') {
          await page.fill('#nt-title', 'Cell structure'); await page.fill('#nt-body', 'Nucleus controls the cell.\nMitochondria release energy.'); await page.fill('#nt-tags', 'biology, unit 1'); await page.click('#nt-save');
          await page.fill('#nt-title', 'Moles and mass'); await page.fill('#nt-body', 'n = m / M'); await page.fill('#nt-tags', 'chemistry, unit 1'); await page.click('#nt-save');
        }
        await page.evaluate(() => { document.activeElement && document.activeElement.blur(); window.scrollTo({ top: 0, behavior: 'instant' }); });
        await page.waitForTimeout(100);
        await page.screenshot({ path: path.join(SHOTS, name), fullPage: width !== 375 });
      }
      await context.close();
    }
  }
}
console.log(`Page sweep done: ${PAGES.length} pages x 2 widths x 2 colour schemes.`);

// ---------------- Sitemap / JSON-LD in browser ----------------
{
  const { context, page } = await newPage(1280);
  await page.goto(SITE + 'sitemap.xml');
  const xmlOk = await page.evaluate(async (u) => {
    const txt = await (await fetch(u)).text();
    const doc = new DOMParser().parseFromString(txt, 'application/xml');
    return { error: !!doc.querySelector('parsererror'), urls: doc.getElementsByTagName('url').length };
  }, SITE + 'sitemap.xml');
  check(!xmlOk.error && xmlOk.urls === 12, `sitemap.xml parses in browser with 12 urls: ${JSON.stringify(xmlOk)}`);
  for (const p of PAGES) {
    await page.goto(SITE + p);
    const ld = await page.evaluate(() => [...document.querySelectorAll('script[type="application/ld+json"]')].map((s) => { try { return JSON.parse(s.textContent)['@type']; } catch (e) { return 'PARSE-ERROR'; } }));
    check(!ld.includes('PARSE-ERROR'), `${p}: JSON-LD parse in browser`);
  }
  await context.close();
}

// ---------------- Functional tool tests ----------------
async function status(page, id) {
  await page.waitForTimeout(80);
  return page.textContent(id);
}
async function clip(page) { return page.evaluate(() => navigator.clipboard.readText()); }

for (const width of [375, 1280]) {
  const W = `@${width}`;
  // Word counter
  {
    const { context, page, log } = await newPage(width);
    await page.goto(SITE + 'tools/word-counter/');
    const s = 'Hello world. Café 👋🏽 naïve!\n\nسلام دنیا۔ یہ ٹیسٹ ہے؟\n你好世界。日本語です。';
    await page.fill('#wc-input', s);
    const exp = T.getTextStats(s);
    const got = {};
    for (const k of Object.keys(exp)) got[k] = Number((await page.textContent('#wc-' + k)).replace(/[^\d]/g, ''));
    check(JSON.stringify(got) === JSON.stringify(exp), `word counter ${W}: stats ${JSON.stringify(got)} vs node ${JSON.stringify(exp)}`);
    await page.click('#wc-copy');
    check((await status(page, '#wc-status')).includes('Copied'), `word counter ${W}: copy status`);
    check((await clip(page)) === s, `word counter ${W}: clipboard content`);
    await page.click('#wc-clear');
    check((await page.inputValue('#wc-input')) === '' && (await page.textContent('#wc-words')) === '0', `word counter ${W}: clear`);
    check((await status(page, '#wc-status')).includes('cleared'), `word counter ${W}: clear status`);
    check(await page.evaluate(() => document.activeElement.id === 'wc-input'), `word counter ${W}: focus returns to input after clear`);
    await page.click('#wc-copy');
    check((await status(page, '#wc-status')).includes('Nothing to copy'), `word counter ${W}: copy empty error`);
    await page.fill('#wc-input', '   \n\t ');
    check((await page.textContent('#wc-words')) === '0' && (await page.textContent('#wc-sentences')) === '0', `word counter ${W}: whitespace-only`);
    // 1 MB paste
    const t0 = Date.now();
    await page.evaluate(() => { const el = document.getElementById('wc-input'); el.value = 'The quick brown fox jumps over the lazy dog. '.repeat(23302); el.dispatchEvent(new Event('input')); });
    await page.waitForFunction(() => document.getElementById('wc-words').textContent !== '0', null, { timeout: 30000 });
    const ms = Date.now() - t0;
    const words = await page.textContent('#wc-words');
    check(words.replace(/\D/g, '') === '209718', `word counter ${W}: 1 MB words = ${words}`);
    results.notes.push(`Word counter @${width}, 1 MB paste: counts shown after ${ms} ms (includes the 800 ms typing-pause delay).`);
    check(log.pageErrors.length + log.console.length === 0, `word counter ${W}: console ${log.console.concat(log.pageErrors).join('|')}`);
    await context.close();
  }
  // Reading time
  {
    const { context, page, log } = await newPage(width);
    await page.goto(SITE + 'tools/reading-time-calculator/');
    const text = Array.from({ length: 1500 }, (_, i) => 'word' + i).join(' ');
    await page.fill('#rt-input', text);
    check((await page.textContent('#rt-reading')) === '6 min 19 sec', `reading time ${W}: 1500 words at 238`);
    check((await page.textContent('#rt-speaking')) === T.formatDuration(T.timeForWords(1500, 140)), `reading time ${W}: speaking`);
    await page.fill('#rt-read-wpm', '10');
    check((await page.textContent('#rt-read-error')).includes('between 50 and 1000'), `reading time ${W}: low wpm error`);
    check((await page.getAttribute('#rt-read-wpm', 'aria-invalid')) === 'true', `reading time ${W}: aria-invalid`);
    check((await page.textContent('#rt-reading')) === '—', `reading time ${W}: no result when invalid`);
    await page.click('#rt-copy');
    check((await status(page, '#rt-status')).includes('Fix the speed'), `reading time ${W}: copy blocked when invalid`);
    await page.fill('#rt-read-wpm', '');
    check((await page.textContent('#rt-read-error')).includes('Enter a speed'), `reading time ${W}: empty wpm error`);
    await page.click('#rt-reset');
    check((await page.inputValue('#rt-read-wpm')) === '238' && (await page.inputValue('#rt-speak-wpm')) === '140' && (await page.textContent('#rt-read-error')) === '', `reading time ${W}: reset`);
    await page.click('#rt-copy');
    check((await clip(page)).startsWith('1500 words. Reading time: 6 min 19 sec at 238 wpm.'), `reading time ${W}: copied summary`);
    await page.click('#rt-clear');
    check((await page.textContent('#rt-reading')) === '0 sec', `reading time ${W}: clear`);
    await page.click('#rt-copy');
    check((await status(page, '#rt-status')).includes('no words'), `reading time ${W}: copy with no text`);
    check(log.pageErrors.length + log.console.length === 0, `reading time ${W}: console clean`);
    await context.close();
  }
  // Case converter
  {
    const { context, page, log } = await newPage(width);
    await page.goto(SITE + 'tools/case-converter/');
    await page.click('[data-case="upper"]');
    check((await status(page, '#cc-status')).includes('Type or paste'), `case ${W}: empty error`);
    const s = 'the causes of the FIRST world war: an overview. ÉCOLE ça va? پاکستان 👋🏽';
    for (const mode of ['upper', 'lower', 'title', 'sentence']) {
      await page.fill('#cc-input', s);
      await page.click(`[data-case="${mode}"]`);
      check((await page.inputValue('#cc-input')) === T.convertCase(s, mode, { smallWords: true, keepAcronyms: true }), `case ${W}: ${mode}`);
    }
    check(!(await page.isDisabled('#cc-undo')), `case ${W}: undo enabled`);
    await page.click('#cc-undo');
    check((await page.inputValue('#cc-input')) === s, `case ${W}: undo restores`);
    check(await page.isDisabled('#cc-undo'), `case ${W}: undo disabled after use`);
    await page.uncheck('#cc-acronyms');
    await page.click('[data-case="title"]');
    check((await page.inputValue('#cc-input')).includes('the First World War'), `case ${W}: acronym option off`);
    await page.click('[data-case="title"]');
    check((await status(page, '#cc-status')).includes('already'), `case ${W}: no-change message`);
    await page.click('#cc-copy');
    check((await clip(page)) === (await page.inputValue('#cc-input')), `case ${W}: copy`);
    await page.click('#cc-clear');
    check((await page.inputValue('#cc-input')) === '', `case ${W}: clear`);
    await page.click('#cc-undo');
    check((await page.inputValue('#cc-input')) !== '', `case ${W}: undo after clear`);
    // Keyboard activation
    await page.fill('#cc-input', 'keyboard test');
    await page.focus('[data-case="upper"]');
    await page.keyboard.press('Enter');
    check((await page.inputValue('#cc-input')) === 'KEYBOARD TEST', `case ${W}: Enter activates button`);
    await page.focus('[data-case="lower"]');
    await page.keyboard.press('Space');
    check((await page.inputValue('#cc-input')) === 'keyboard test', `case ${W}: Space activates button`);
    check(log.pageErrors.length + log.console.length === 0, `case ${W}: console clean`);
    await context.close();
  }
  // Duplicate lines
  {
    const { context, page, log } = await newPage(width);
    await page.goto(SITE + 'tools/remove-duplicate-lines/');
    await page.click('#dl-run');
    check((await status(page, '#dl-status')).includes('Paste some lines'), `dup ${W}: empty error`);
    const s = 'Biology\nChemistry\nbiology\nPhysics\nChemistry \nMaths\n\n\ncafé\ncafe\u0301';
    await page.fill('#dl-input', s);
    await page.click('#dl-run');
    const exp = T.removeDuplicateLines(s, { trim: true, ignoreEmpty: true });
    check((await page.inputValue('#dl-output')) === exp.text, `dup ${W}: default output`);
    check((await status(page, '#dl-status')).includes(`Removed ${exp.removed} duplicate line`), `dup ${W}: removed count message`);
    await page.check('#dl-case');
    await page.check('#dl-remove-empty');
    await page.click('#dl-run');
    const exp2 = T.removeDuplicateLines(s, { trim: true, ignoreEmpty: true, caseInsensitive: true, removeEmpty: true });
    check((await page.inputValue('#dl-output')) === exp2.text, `dup ${W}: options output`);
    check((await status(page, '#dl-status')).includes('empty line'), `dup ${W}: empty lines reported`);
    await page.click('#dl-copy');
    check((await clip(page)) === exp2.text, `dup ${W}: copy`);
    await page.click('#dl-reset');
    check(!(await page.isChecked('#dl-case')) && (await page.isChecked('#dl-trim')) && !(await page.isChecked('#dl-remove-empty')), `dup ${W}: reset options`);
    await page.fill('#dl-input', 'a\nb\nc');
    await page.click('#dl-run');
    check((await status(page, '#dl-status')).includes('No duplicate lines found'), `dup ${W}: none found message`);
    await page.click('#dl-clear');
    check((await page.inputValue('#dl-input')) === '' && (await page.inputValue('#dl-output')) === '', `dup ${W}: clear`);
    await page.click('#dl-copy');
    check((await status(page, '#dl-status')).includes('Nothing to copy'), `dup ${W}: copy empty`);
    check(log.pageErrors.length + log.console.length === 0, `dup ${W}: console clean`);
    await context.close();
  }
  // Whitespace cleaner
  {
    const { context, page, log } = await newPage(width);
    await page.goto(SITE + 'tools/whitespace-cleaner/');
    await page.click('#ws-run');
    check((await status(page, '#ws-status')).includes('Paste some text'), `ws ${W}: empty error`);
    const s = '  The   mitochondria\tis the\u00A0powerhouse\u200B   \n\n\n\nof the cell.  می\u200Cخواهم';
    await page.fill('#ws-input', s);
    await page.click('#ws-run');
    check((await page.inputValue('#ws-output')) === T.cleanWhitespace(s).text, `ws ${W}: default output`);
    const st = await status(page, '#ws-status');
    check(st.includes('1 unusual space replaced') && st.includes('1 invisible character removed'), `ws ${W}: report "${st}"`);
    check((await page.inputValue('#ws-output')).includes('\u200C'), `ws ${W}: ZWNJ kept by default`);
    await page.check('#ws-tabs');
    await page.selectOption('#ws-blank', 'remove');
    await page.check('#ws-joiners');
    await page.click('#ws-run');
    check((await page.inputValue('#ws-output')) === T.cleanWhitespace(s, { tabs: 'spaces', tabWidth: 4, blankLines: 'remove', joiners: true }).text, `ws ${W}: options output`);
    await page.click('#ws-copy');
    check((await clip(page)) === (await page.inputValue('#ws-output')), `ws ${W}: copy`);
    await page.click('#ws-reset');
    check(!(await page.isChecked('#ws-tabs')) && (await page.inputValue('#ws-blank')) === 'collapse' && !(await page.isChecked('#ws-joiners')), `ws ${W}: reset`);
    await page.fill('#ws-input', 'Already clean.');
    await page.click('#ws-run');
    check((await status(page, '#ws-status')).includes('Already clean'), `ws ${W}: already clean`);
    await page.click('#ws-clear');
    check((await page.inputValue('#ws-input')) === '' && (await page.inputValue('#ws-output')) === '', `ws ${W}: clear`);
    check(log.pageErrors.length + log.console.length === 0, `ws ${W}: console clean`);
    await context.close();
  }
  // Study notes
  {
    const { context, page, log } = await newPage(width);
    await page.goto(SITE + 'tools/study-notes-organizer/');
    check((await page.textContent('#nt-count')).includes('No notes yet'), `notes ${W}: empty state`);
    check(await page.isHidden('#nt-cancel'), `notes ${W}: Cancel editing hidden when not editing`);
    check(await page.isHidden('#nt-storage-warning'), `notes ${W}: storage warning hidden when storage works`);
    await page.click('#nt-save');
    check((await page.textContent('#nt-form-error')).includes('Add a title'), `notes ${W}: validation error`);
    check((await page.getAttribute('#nt-title', 'aria-invalid')) === 'true', `notes ${W}: aria-invalid on error`);
    const add = async (title, body, tags) => { await page.fill('#nt-title', title); await page.fill('#nt-body', body); await page.fill('#nt-tags', tags); await page.click('#nt-save'); await page.waitForTimeout(20); };
    await add('Cell structure', 'Nucleus, mitochondria', 'Biology, unit 1');
    await add('Enzymes', 'Active site', 'biology, unit 2');
    await add('<img src=x onerror="window.__xss=1">', '<script>window.__xss=2</script> café 你好 👋🏽 پاکستان', 'chemistry, unit 1');
    check((await page.locator('#nt-list > li').count()) === 3, `notes ${W}: 3 notes listed`);
    check((await page.evaluate(() => window.__xss)) === undefined && (await page.locator('#nt-list img').count()) === 0, `notes ${W}: HTML in notes is not executed`);
    check((await status(page, '#nt-status')).includes('saved'), `notes ${W}: saved status`);
    check((await page.locator('#nt-tag-filter option').count()) === 5, `notes ${W}: tag filter options`);
    await page.selectOption('#nt-tag-filter', 'unit 1');
    check((await page.locator('#nt-list > li').count()) === 2, `notes ${W}: tag filter`);
    await page.click('#nt-clear-search');
    await page.fill('#nt-search', 'cafe');
    check((await page.locator('#nt-list > li').count()) === 1, `notes ${W}: accent-insensitive search`);
    await page.fill('#nt-search', 'zzzz');
    check((await page.textContent('#nt-count')).includes('No notes match'), `notes ${W}: no match message`);
    await page.click('#nt-clear-search');
    await page.click('button[aria-label="Edit note: Enzymes"]');
    check((await page.inputValue('#nt-title')) === 'Enzymes' && !(await page.isHidden('#nt-cancel')), `notes ${W}: edit loads note`);
    check(await page.evaluate(() => document.activeElement.id === 'nt-title'), `notes ${W}: focus to title on edit`);
    await page.fill('#nt-title', 'Enzymes and catalysts');
    await page.click('#nt-save');
    check((await page.locator('#nt-list h3', { hasText: 'Enzymes and catalysts' }).count()) === 1 && (await page.locator('#nt-list > li').count()) === 3, `notes ${W}: edit saved`);
    check(await page.isHidden('#nt-cancel'), `notes ${W}: Cancel editing hidden again after save`);
    await page.click('button[aria-label="Edit note: Cell structure"]');
    await page.click('#nt-cancel');
    check((await page.inputValue('#nt-title')) === '' && (await page.isHidden('#nt-cancel')), `notes ${W}: cancel editing resets form`);
    await page.reload();
    check((await page.locator('#nt-list > li').count()) === 3, `notes ${W}: notes persist after reload`);
    const [dl] = await Promise.all([page.waitForEvent('download'), page.click('#nt-export-json')]);
    const jsonPath = path.join(os.tmpdir(), `sk-export-${width}.json`);
    await dl.saveAs(jsonPath);
    const exported = JSON.parse(fs.readFileSync(jsonPath, 'utf8'));
    check(exported.schema === 'studykit-notes' && exported.notes.length === 3, `notes ${W}: JSON export content`);
    check(/^studykit-notes-\d{4}-\d{2}-\d{2}\.json$/.test(dl.suggestedFilename()), `notes ${W}: export filename`);
    const [dlMd] = await Promise.all([page.waitForEvent('download'), page.click('#nt-export-md')]);
    const mdPath = path.join(os.tmpdir(), `sk-export-${width}.md`); await dlMd.saveAs(mdPath);
    check(fs.readFileSync(mdPath, 'utf8').includes('## Enzymes and catalysts'), `notes ${W}: Markdown export`);
    const [dlTxt] = await Promise.all([page.waitForEvent('download'), page.click('#nt-export-txt')]);
    const txtPath = path.join(os.tmpdir(), `sk-export-${width}.txt`); await dlTxt.saveAs(txtPath);
    check(fs.readFileSync(txtPath, 'utf8').startsWith('STUDY NOTES'), `notes ${W}: TXT export`);
    await page.click('button[aria-label="Delete note: Cell structure"]');
    check((await page.locator('#nt-list > li').count()) === 2, `notes ${W}: delete one`);
    await page.click('#nt-delete-all');
    check((await page.locator('#nt-list > li').count()) === 0, `notes ${W}: delete all`);
    await page.setInputFiles('#nt-import', jsonPath);
    await page.waitForTimeout(200);
    check((await page.locator('#nt-list > li').count()) === 3, `notes ${W}: import restores 3`);
    check((await status(page, '#nt-status')).includes('3 added'), `notes ${W}: import message`);
    await page.setInputFiles('#nt-import', jsonPath);
    await page.waitForTimeout(200);
    check((await status(page, '#nt-status')).includes('3 already up to date') && (await page.locator('#nt-list > li').count()) === 3, `notes ${W}: re-import is idempotent`);
    const badPath = path.join(os.tmpdir(), 'sk-bad.json');
    fs.writeFileSync(badPath, 'not json at all');
    await page.setInputFiles('#nt-import', badPath);
    await page.waitForTimeout(200);
    check((await status(page, '#nt-status')).includes('not valid JSON'), `notes ${W}: invalid import message`);
    await page.click('#nt-delete-all');
    await page.click('#nt-export-json');
    check((await status(page, '#nt-status')).includes('no notes to export'), `notes ${W}: export empty message`);
    check(log.pageErrors.length + log.console.length === 0, `notes ${W}: console clean ${log.console.join('|')}`);
    await context.close();
  }
  // Notes when storage is blocked
  {
    const { context, page, log } = await newPage(width);
    await context.addInitScript(() => { Object.defineProperty(window, 'localStorage', { get() { throw new DOMException('blocked', 'SecurityError'); } }); });
    await page.goto(SITE + 'tools/study-notes-organizer/');
    check(!(await page.isHidden('#nt-storage-warning')), `notes ${W}: storage-blocked warning shown`);
    await page.fill('#nt-title', 'Temp'); await page.click('#nt-save');
    check((await page.locator('#nt-list > li').count()) === 1, `notes ${W}: works in memory when storage blocked`);
    check(log.pageErrors.length === 0, `notes ${W}: no page errors when storage blocked`);
    await context.close();
  }
}

// No-JS rendering
{
  const context = await browser.newContext({ javaScriptEnabled: false, viewport: { width: 375, height: 800 } });
  const page = await context.newPage();
  await page.goto(SITE + 'tools/word-counter/');
  check(await page.isVisible('noscript .notice, .notice'), 'no-JS: notice visible');
  check((await page.textContent('h1')) === 'Word and character counter', 'no-JS: content renders');
  await context.close();
}

await browser.close();
server.kill();
fs.rmSync(serveDir, { recursive: true, force: true });

console.log('\n' + results.notes.join('\n'));
const axeTotal = axeSummary.reduce((a, s) => a + s.violations.length, 0);
console.log(`axe-core ${JSON.parse(fs.readFileSync(require.resolve('axe-core/package.json'), 'utf8')).version}: ${axeSummary.length} scans, ${axeTotal} violations.`);
console.log(`\nBrowser checks: ${results.pass} passed, ${results.fail} failed.`);
if (results.fail) { console.log(results.failures.join('\n')); process.exit(1); }
