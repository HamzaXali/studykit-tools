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
const S = require(path.join(ROOT, 'assets/js/study-utils.js'));
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
  'tools/', 'tools/word-counter/', 'tools/reading-time-calculator/', 'tools/case-converter/',
  'tools/remove-duplicate-lines/', 'tools/whitespace-cleaner/', 'tools/study-notes-organizer/',
  'tools/gpa-cgpa-calculator/', 'tools/percentage-calculator/', 'tools/pomodoro-timer/', 'tools/flashcards/',
  'tools/citation-generator/', 'tools/age-date-calculator/', 'tools/text-to-speech/'];

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
    let rel = decodeURIComponent(new URL(route.request().url()).pathname).slice(new URL(BASE_URL).pathname.length).replace(/^\/+/, '');
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
        check((await page.textContent('h1')).includes('Learn smarter'), `${label}: home link works (base URL mapped to local server)`);
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
  check(!xmlOk.error && xmlOk.urls === 20, `sitemap.xml parses in browser with 20 urls: ${JSON.stringify(xmlOk)}`);
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
  // GPA and CGPA calculator
  {
    const { context, page, log } = await newPage(width);
    await page.goto(SITE + 'tools/gpa-cgpa-calculator/');
    await page.fill('#gp-cr-1', '3'); await page.fill('#gp-pt-1', '4');
    await page.fill('#gp-cr-2', '3'); await page.fill('#gp-pt-2', '3.33');
    await page.fill('#gp-cr-3', '2'); await page.fill('#gp-pt-3', '2.67');
    check((await page.textContent('#gp-gpa')) === '3.42' && (await page.textContent('#gp-credits')) === '8', `gpa ${W}: semester GPA 3.42 over 8 credits`);
    check((await page.inputValue('#cp-cgpa')) === '3.42' && (await page.textContent('#cp-percent')) === '85.50%', `gpa ${W}: proportional % ${await page.textContent('#cp-percent')}`);
    check((await page.textContent('#cp-formula')).includes('CGPA × 25'), `gpa ${W}: formula shown`);
    await page.fill('#cg-prev', '3.0'); await page.fill('#cg-prev-credits', '32');
    check((await page.textContent('#cg-new')) === S.round(S.combineCgpa(3, 32, 27.33 / 8, 8), 2).toFixed(2) && (await page.textContent('#cg-total')) === '40', `gpa ${W}: new CGPA ${await page.textContent('#cg-new')}`);
    await page.selectOption('#cp-method', 'multiplier');
    check(await page.isVisible('#cp-mult'), `gpa ${W}: custom formula fields shown`);
    await page.fill('#cp-cgpa', '3.5'); await page.fill('#cp-mult', '9.5'); await page.fill('#cp-add', '0');
    check((await page.textContent('#cp-percent')) === '33.25%', `gpa ${W}: custom multiplier`);
    await page.fill('#gp-pt-1', '5');
    check((await page.textContent('#gp-pt-1-error')).includes('0 to 4') && (await page.textContent('#gp-gpa')) === '—', `gpa ${W}: points over scale rejected`);
    await page.click('#gp-add');
    check(await page.isVisible('#gp-cr-5') && await page.evaluate(() => document.activeElement.id === 'gp-cr-5'), `gpa ${W}: add course focuses new row`);
    await page.fill('#gp-pt-1', '4');
    await page.click('#gp-copy');
    check((await clip(page)).startsWith('Semester GPA: 3.42'), `gpa ${W}: copy`);
    await page.click('#gp-clear');
    check((await page.textContent('#gp-gpa')) === '—', `gpa ${W}: clear`);
    check(log.pageErrors.length + log.console.length === 0, `gpa ${W}: console clean ${log.console.concat(log.pageErrors).join('|')}`);
    await context.close();
  }
  // Percentage calculator
  {
    const { context, page, log } = await newPage(width);
    await page.goto(SITE + 'tools/percentage-calculator/');
    await page.fill('#pc-obtained', '942'); await page.fill('#pc-total', '1100');
    check((await page.textContent('#pc-percent')) === '85.64%', `percent ${W}: 942/1100`);
    await page.fill('#pc-obtained', '1200');
    check((await page.textContent('#pc-obtained-error')).includes('more than the total'), `percent ${W}: over total warning`);
    await page.fill('#ps-o-1', '80'); await page.fill('#ps-t-1', '100'); await page.fill('#ps-o-2', '45'); await page.fill('#ps-t-2', '50');
    check((await page.textContent('#ps-percent')) === '83.33%' && (await page.textContent('#ps-obtained')) === '125', `percent ${W}: subjects total`);
    await page.fill('#pn-target', '33'); await page.fill('#pn-total', '75');
    check((await page.textContent('#pn-marks')).startsWith('24.75 (at least 25'), `percent ${W}: marks needed ${await page.textContent('#pn-marks')}`);
    await page.fill('#pd-from', '60'); await page.fill('#pd-to', '75');
    check((await page.textContent('#pd-points')) === '+15 points' && (await page.textContent('#pd-change')) === '+25%', `percent ${W}: compare`);
    await page.click('#pc-copy');
    check((await clip(page)).includes('Subjects total: 125 out of 150 = 83.33%'), `percent ${W}: copy`);
    check(log.pageErrors.length + log.console.length === 0, `percent ${W}: console clean ${log.console.concat(log.pageErrors).join('|')}`);
    await context.close();
  }
  // Pomodoro timer
  {
    const { context, page, log } = await newPage(width);
    await page.clock.install();
    await page.goto(SITE + 'tools/pomodoro-timer/');
    check((await page.textContent('#pm-clock')) === '25:00', `pomodoro ${W}: initial 25:00`);
    await page.fill('#pm-focus', '1'); await page.fill('#pm-short', '1');
    check((await page.textContent('#pm-clock')) === '01:00', `pomodoro ${W}: length change updates clock`);
    await page.click('#pm-start');
    check((await page.textContent('#pm-start')) === 'Pause', `pomodoro ${W}: start -> Pause label`);
    await page.clock.runFor(10500);
    check((await page.textContent('#pm-clock')) === '00:50', `pomodoro ${W}: counts down ${await page.textContent('#pm-clock')}`);
    await page.click('#pm-start');
    await page.clock.runFor(5000);
    check((await page.textContent('#pm-clock')) === '00:50' && (await page.textContent('#pm-start')) === 'Resume', `pomodoro ${W}: pause holds`);
    await page.click('#pm-start');
    await page.clock.runFor(51000);
    check((await page.textContent('#pm-phase')) === 'Short break' && (await page.textContent('#pm-count')).endsWith('1'), `pomodoro ${W}: switches to short break`);
    check((await status(page, '#pm-status')).includes('Focus finished'), `pomodoro ${W}: finish announced`);
    await page.click('#pm-reset');
    check((await page.textContent('#pm-clock')) === '01:00', `pomodoro ${W}: reset`);
    await page.click('#pm-skip');
    check((await page.textContent('#pm-phase')) === 'Focus', `pomodoro ${W}: skip`);
    await page.fill('#pm-focus', '0');
    await page.click('#pm-start');
    check((await page.textContent('#pm-focus-error')).includes('1 to 180') && (await status(page, '#pm-status')).includes('Fix'), `pomodoro ${W}: invalid length blocked`);
    check(log.pageErrors.length + log.console.length === 0, `pomodoro ${W}: console clean ${log.console.concat(log.pageErrors).join('|')}`);
    await context.close();
  }
  // Flashcards
  {
    const { context, page, log } = await newPage(width);
    await page.goto(SITE + 'tools/flashcards/');
    await page.click('#fc-add');
    check((await page.textContent('#fc-form-error')).includes('both'), `flashcards ${W}: empty card error`);
    await page.fill('#fc-new-deck', 'Biology'); await page.click('#fc-create-deck');
    for (const [f, b] of [['Mitochondria', 'Releases energy'], ['Ribosome', 'Makes proteins'], ['<img src=x onerror="window.__xss=1">', 'safe']]) { await page.fill('#fc-front', f); await page.fill('#fc-back', b); await page.click('#fc-add'); }
    check((await page.locator('#fc-list li').count()) === 3, `flashcards ${W}: 3 cards listed`);
    check(await page.evaluate(() => !window.__xss), `flashcards ${W}: card text not executed as HTML`);
    await page.reload();
    check((await page.locator('#fc-list li').count()) === 3 && (await page.textContent('#fc-deck')).includes('Biology (3 cards)'), `flashcards ${W}: saved after reload`);
    await page.uncheck('#fc-shuffle');
    await page.click('#fc-start');
    check((await page.textContent('#fc-card-text')) === 'Mitochondria' && await page.isDisabled('#fc-know'), `flashcards ${W}: practice shows front`);
    await page.click('#fc-flip');
    check((await page.textContent('#fc-card-text')) === 'Releases energy' && !(await page.isDisabled('#fc-know')), `flashcards ${W}: flip shows back`);
    await page.click('#fc-again');
    await page.click('#fc-flip'); await page.click('#fc-know');
    await page.click('#fc-flip'); await page.click('#fc-know');
    check((await page.textContent('#fc-card-text')) === 'Mitochondria', `flashcards ${W}: review-again card comes back`);
    await page.click('#fc-flip'); await page.click('#fc-know');
    check((await status(page, '#fc-practice-status')).includes('knew all 3') && await page.isHidden('#fc-practice'), `flashcards ${W}: round finished`);
    const [dl] = await Promise.all([page.waitForEvent('download'), page.click('#fc-export')]);
    const p = path.join(os.tmpdir(), `sk-fc-${width}.json`); await dl.saveAs(p);
    check(JSON.parse(fs.readFileSync(p, 'utf8'))[0].cards.length === 3, `flashcards ${W}: export`);
    await page.click('#fc-delete-deck');
    check((await page.locator('#fc-deck option').count()) === 0, `flashcards ${W}: delete deck`);
    await page.setInputFiles('#fc-import', p); await page.waitForTimeout(200);
    check((await page.locator('#fc-list li').count()) === 3, `flashcards ${W}: import`);
    check(log.pageErrors.length + log.console.length === 0, `flashcards ${W}: console clean ${log.console.concat(log.pageErrors).join('|')}`);
    await context.close();
  }
  // Citation generator
  {
    const { context, page, log } = await newPage(width);
    await page.goto(SITE + 'tools/citation-generator/');
    await page.click('#ct-copy');
    check((await status(page, '#ct-status')).includes('Nothing to copy'), `citation ${W}: empty copy`);
    await page.fill('#ct-authors', 'Smith, John Adam\nLee, Mary'); await page.fill('#ct-title', 'Learning how to learn'); await page.fill('#ct-year', '2020');
    await page.fill('#ct-edition', '2'); await page.fill('#ct-publisher', 'Oxford University Press');
    check((await page.textContent('#ct-output')) === 'Smith, J. A., & Lee, M. (2020). Learning how to learn (2nd ed.). Oxford University Press.', `citation ${W}: APA book "${await page.textContent('#ct-output')}"`);
    check((await page.innerHTML('#ct-output')).includes('<i>Learning how to learn</i>'), `citation ${W}: italic title`);
    await page.selectOption('#ct-style', 'mla');
    check((await page.textContent('#ct-output')) === 'Smith, John Adam, and Mary Lee. Learning how to learn. 2nd ed., Oxford University Press, 2020.', `citation ${W}: MLA book`);
    await page.selectOption('#ct-type', 'journal');
    check(await page.isVisible('#ct-journal') && await page.isHidden('#ct-publisher') && await page.isHidden('#ct-site'), `citation ${W}: fields switch by type`);
    await page.fill('#ct-journal', 'Journal of Memory and Language'); await page.fill('#ct-volume', '109'); await page.fill('#ct-pages', '1-20'); await page.fill('#ct-doi', '10.1016/j.jml.2019.104047');
    check((await page.textContent('#ct-output')).endsWith('Journal of Memory and Language, vol. 109, 2020, pp. 1–20. https://doi.org/10.1016/j.jml.2019.104047.'), `citation ${W}: MLA journal`);
    await page.click('#ct-copy');
    check((await status(page, '#ct-status')).includes('Citation copied'), `citation ${W}: copy status`);
    await page.waitForTimeout(200);
    check((await clip(page)).startsWith('Smith, John Adam, and Mary Lee.'), `citation ${W}: copy ${await clip(page)}`);
    await page.selectOption('#ct-type', 'website'); await page.selectOption('#ct-style', 'apa');
    check((await page.textContent('#ct-output')).includes('Add the URL'), `citation ${W}: website needs URL`);
    await page.click('#ct-clear');
    check((await page.inputValue('#ct-title')) === '', `citation ${W}: clear`);
    check(log.pageErrors.length + log.console.length === 0, `citation ${W}: console clean ${log.console.concat(log.pageErrors).join('|')}`);
    await context.close();
  }
  // Age and date calculator
  {
    const { context, page, log } = await newPage(width);
    await page.goto(SITE + 'tools/age-date-calculator/');
    await page.fill('#ag-dob', '2000-02-29'); await page.fill('#ag-on', '2026-10-22');
    check((await page.textContent('#ag-age')) === '26 years, 7 months, 23 days', `age ${W}: exact age ${await page.textContent('#ag-age')}`);
    check((await page.textContent('#ag-days')).replace(/\D/g, '') === '9732' && (await page.textContent('#ag-next')).startsWith('In 129 days'), `age ${W}: total days and next birthday`);
    await page.fill('#ag-dob', '2030-01-01');
    check((await page.textContent('#ag-dob-error')).includes('after'), `age ${W}: future dob error`);
    await page.fill('#dd-start', '2026-10-22'); await page.fill('#dd-end', '2027-03-01');
    check((await page.textContent('#dd-days')) === '130' && (await page.textContent('#dd-weeks')) === '18 weeks, 4 days', `age ${W}: days between`);
    await page.check('#dd-inclusive');
    check((await page.textContent('#dd-days')) === '131', `age ${W}: inclusive`);
    await page.click('#ad-copy');
    check((await clip(page)).includes('2026-10-22 to 2027-03-01 (inclusive): 131 days'), `age ${W}: copy`);
    check(log.pageErrors.length + log.console.length === 0, `age ${W}: console clean ${log.console.concat(log.pageErrors).join('|')}`);
    await context.close();
  }
  // Text to speech (fake speechSynthesis so the test does not depend on installed voices)
  {
    const { context, page, log } = await newPage(width);
    await context.addInitScript(() => {
      const spoken = []; window.__spoken = spoken;
      class U { constructor(t) { this.text = t; this.rate = 1; } }
      window.SpeechSynthesisUtterance = U;
      const synth = new EventTarget();
      synth.getVoices = () => [{ name: 'Test Local', lang: 'en-GB', localService: true, voiceURI: 'local' }, { name: 'Test Cloud', lang: 'en-US', localService: false, voiceURI: 'cloud' }];
      synth.onvoiceschanged = null;
      synth.speak = (u) => { spoken.push({ text: u.text, rate: u.rate, voice: u.voice && u.voice.name }); };
      synth.cancel = () => { window.__cancelled = (window.__cancelled || 0) + 1; };
      synth.pause = () => { window.__paused = true; };
      synth.resume = () => { window.__paused = false; };
      Object.defineProperty(window, 'speechSynthesis', { value: synth });
    });
    await page.goto(SITE + 'tools/text-to-speech/');
    check((await page.locator('#ts-voice option').count()) === 3 && (await page.textContent('#ts-voice')).includes('Test Cloud (en-US) – online'), `tts ${W}: voices listed, online labelled`);
    await page.click('#ts-play');
    check((await status(page, '#ts-status')).includes('Type or paste'), `tts ${W}: empty error`);
    await page.fill('#ts-input', 'First sentence. Second sentence!');
    await page.selectOption('#ts-voice', { label: 'Test Local (en-GB)' });
    await page.fill('#ts-rate', '1.5');
    await page.click('#ts-play');
    const spoken = await page.evaluate(() => window.__spoken);
    check(spoken.map((s) => s.text).join('').trim() === 'First sentence. Second sentence!' && spoken[0].rate === 1.5 && spoken[0].voice === 'Test Local', `tts ${W}: speaks with voice and rate ${JSON.stringify(spoken)}`);
    check(!(await page.isDisabled('#ts-pause')) && !(await page.isDisabled('#ts-stop')), `tts ${W}: pause/stop enabled while speaking`);
    await page.click('#ts-pause');
    check(await page.evaluate(() => window.__paused) && (await page.textContent('#ts-pause')) === 'Resume', `tts ${W}: pause`);
    await page.click('#ts-pause');
    check(await page.evaluate(() => window.__paused === false), `tts ${W}: resume`);
    await page.click('#ts-stop');
    check(await page.isDisabled('#ts-stop') && (await page.textContent('#ts-play')) === 'Play', `tts ${W}: stop`);
    check(log.pageErrors.length + log.console.length === 0, `tts ${W}: console clean ${log.console.concat(log.pageErrors).join('|')}`);
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
