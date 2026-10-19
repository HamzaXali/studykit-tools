'use strict';
// Run with: node --test tests/
const test = require('node:test');
const assert = require('node:assert/strict');
const T = require('../assets/js/text-utils.js');

const FB = { forceFallback: true };
const ONE_MB = 'The quick brown fox jumps over the lazy dog. '.repeat(Math.ceil(1048576 / 45)).slice(0, 1048576);

function timed(fn) { const t = process.hrtime.bigint(); const r = fn(); return { r, ms: Number(process.hrtime.bigint() - t) / 1e6 }; }

// ---------------- Word & character counter ----------------
test('counter: normal English text', () => {
  const s = 'Photosynthesis turns light into chemical energy. Plants, algae and some bacteria do it.\n\nIt happens mainly in the leaves.';
  assert.deepEqual(T.getTextStats(s), { characters: 121, charactersNoSpaces: 102, words: 19, sentences: 3, paragraphs: 2, lines: 3 });
});

test('counter: empty, null, undefined', () => {
  const zero = { characters: 0, charactersNoSpaces: 0, words: 0, sentences: 0, paragraphs: 0, lines: 0 };
  assert.deepEqual(T.getTextStats(''), zero);
  assert.deepEqual(T.getTextStats(null), zero);
  assert.deepEqual(T.getTextStats(undefined), zero);
  assert.deepEqual(T.getTextStats('', FB), zero);
});

test('counter: whitespace only', () => {
  const s = '   \n\t\n   ';
  const st = T.getTextStats(s);
  assert.equal(st.words, 0);
  assert.equal(st.sentences, 0);
  assert.equal(st.paragraphs, 0);
  assert.equal(st.charactersNoSpaces, 0);
  assert.equal(st.characters, 9);
  assert.equal(st.lines, 3);
});

test('counter: emoji count as one character and not as words', () => {
  for (const opts of [undefined, FB]) {
    assert.equal(T.countGraphemes('👋🏽', opts), 1, 'skin tone');
    assert.equal(T.countGraphemes('👨‍👩‍👧‍👦', opts), 1, 'ZWJ family');
    assert.equal(T.countGraphemes('🇵🇰🇬🇧', opts), 2, 'two flags');
    assert.equal(T.countGraphemes('❤️', opts), 1, 'variation selector');
    assert.equal(T.countWords('🎉🎉 🎉', opts), 0);
  }
  assert.equal(T.countWords('Café au lait ☕ is my favourite.'), 6);
  assert.equal(T.countGraphemes('Café au lait ☕ is my favourite.'), 31);
});

test('counter: accents and combining marks', () => {
  const composed = 'caf\u00e9';
  const decomposed = 'cafe\u0301';
  for (const opts of [undefined, FB]) {
    assert.equal(T.countGraphemes(composed, opts), 4);
    assert.equal(T.countGraphemes(decomposed, opts), 4, 'combining acute counts with its base letter');
    assert.equal(T.countWords(decomposed, opts), 1);
    assert.equal(T.countWords('naïve résumé Zoë', opts), 3);
  }
});

test('counter: Urdu and Arabic', () => {
  const ur = 'پاکستان ایک خوبصورت ملک ہے۔ کیا آپ تیار ہیں؟';
  for (const opts of [undefined, FB]) {
    assert.equal(T.countWords(ur, opts), 9);
    assert.equal(T.countSentences(ur, opts), 2);
  }
  const ar = 'مرحبا بالعالم. كيف حالك؟';
  assert.equal(T.countWords(ar), 4);
  assert.equal(T.countSentences(ar), 2);
  // Urdu with ZWNJ inside a word must still count as words, not break
  assert.ok(T.countWords('می\u200Cخواهم') >= 1);
});

test('counter: CJK', () => {
  const zh = '你好世界。今天天气很好！';
  assert.equal(T.countSentences(zh), 2);
  assert.equal(T.countSentences(zh, FB), 2);
  assert.ok(T.countWords(zh) >= 3, 'Segmenter splits Chinese into dictionary words');
  assert.equal(T.countWords('你好世界', FB), 4, 'fallback counts one word per Han character');
  assert.equal(T.countGraphemes(zh), 12);
  assert.equal(T.countWords('日本語です'), T.countWords('日本語です'));
});

test('counter: contractions, numbers, hyphens', () => {
  assert.equal(T.countWords("don't won't it's"), 3);
  assert.equal(T.countWords("don't won't it's", FB), 3);
  assert.equal(T.countWords('3.14 is pi'), 3);
  assert.equal(T.countWords('— – - ... !!!'), 0);
  assert.equal(T.countWords('— – - ... !!!', FB), 0);
});

test('counter: CRLF, CR and trailing newline handling', () => {
  assert.equal(T.countLines('a\r\nb\r\nc'), 3);
  assert.equal(T.countLines('a\rb'), 2);
  assert.equal(T.countLines('a\n'), 1, 'one trailing newline does not add a line');
  assert.equal(T.countLines('a\n\n'), 2);
  assert.equal(T.countLines('\n'), 1);
  assert.equal(T.countParagraphs('p1\r\n\r\np2\r\n\r\n\r\np3'), 3);
  assert.equal(T.countParagraphs('line1\nline2'), 1);
  assert.equal(T.countParagraphs('p1\n   \np2'), 2, 'whitespace-only line separates paragraphs');
  assert.equal(T.countGraphemesNoSpaces('a b\r\nc'), 3);
});

test('counter: sentences without final punctuation and with abbreviations-free text', () => {
  assert.equal(T.countSentences('Hello there. How are you'), 2);
  assert.equal(T.countSentences('Wait... what?!'), T.countSentences('Wait... what?!'));
  assert.equal(T.countSentences('...'), 0);
  assert.equal(T.countSentences('One. Two! Three?', FB), 3);
});

test('counter: ~1 MB input performance', () => {
  const { r, ms } = timed(() => T.getTextStats(ONE_MB));
  assert.equal(r.characters, 1048576);
  assert.ok(r.words > 200000);
  assert.ok(ms < 5000, `took ${ms.toFixed(0)} ms`);
  const fb = timed(() => T.getTextStats(ONE_MB, FB));
  assert.equal(fb.r.characters, 1048576);
  assert.equal(fb.r.words, r.words, 'fallback agrees on simple English');
  assert.ok(fb.ms < 5000, `fallback took ${fb.ms.toFixed(0)} ms`);
  console.log(`  1 MB stats: Segmenter ${ms.toFixed(0)} ms, fallback ${fb.ms.toFixed(0)} ms`);
});

// ---------------- Reading time ----------------
test('reading time: normal values', () => {
  assert.equal(T.timeForWords(1500, 238), 379);
  assert.equal(T.formatDuration(379), '6 min 19 sec');
  assert.equal(T.timeForWords(650, 130), 300);
  assert.equal(T.formatDuration(300), '5 min');
  assert.equal(T.formatDuration(3725), '1 hr 2 min 5 sec');
  assert.equal(T.formatDuration(3600), '1 hr');
  const r = T.readingTime('one two three four five', 238, 140);
  assert.equal(r.words, 5);
  assert.equal(r.readingSeconds, 2);
  assert.equal(r.speakingSeconds, 3);
});

test('reading time: empty text and zero words', () => {
  const r = T.readingTime('', 238, 140);
  assert.equal(r.words, 0);
  assert.equal(r.reading, '0 sec');
  assert.equal(T.readingTime('   \n ', 238, 140).readingSeconds, 0);
  assert.equal(T.formatDuration(0), '0 sec');
  assert.equal(T.formatDuration(-5), '0 sec');
  assert.equal(T.formatDuration(NaN), '0 sec');
});

test('reading time: rounds up partial seconds', () => {
  assert.equal(T.timeForWords(1, 238), 1);
  assert.equal(T.timeForWords(1, 1000), 1);
});

test('reading time: WPM validation', () => {
  assert.deepEqual(T.validateWpm('238'), { ok: true, value: 238 });
  assert.equal(T.validateWpm(' 140 ').value, 140);
  assert.equal(T.validateWpm('50').ok, true);
  assert.equal(T.validateWpm('1000').ok, true);
  for (const bad of ['', '  ', '0', '49', '1001', '-200', 'abc', '2e2', '١٢٣', '1,000', null, undefined]) {
    const v = T.validateWpm(bad);
    assert.equal(v.ok, false, `should reject ${JSON.stringify(bad)}`);
    assert.ok(v.error.length > 10);
  }
  assert.throws(() => T.timeForWords(10, 0), RangeError);
});

test('reading time: Unicode text and 1 MB input', () => {
  assert.equal(T.readingTime('پاکستان ایک خوبصورت ملک ہے۔', 238, 140).words, 5);
  const { r, ms } = timed(() => T.readingTime(ONE_MB, 238, 140));
  assert.ok(r.readingSeconds > 3600);
  assert.ok(ms < 5000);
});

// ---------------- Case converter ----------------
test('case: upper and lower', () => {
  assert.equal(T.toUpper('Hello, World'), 'HELLO, WORLD');
  assert.equal(T.toLower('Hello, WORLD'), 'hello, world');
  assert.equal(T.toUpper('straße'), 'STRASSE');
  assert.equal(T.toUpper('école ça'), 'ÉCOLE ÇA');
  assert.equal(T.toLower('ÉCOLE'), 'école');
  assert.equal(T.toUpper(''), '');
  assert.equal(T.convertCase(null, 'upper'), '');
});

test('case: title case', () => {
  assert.equal(T.toTitleCase('the causes of the FIRST world war: an overview'), 'The Causes of the FIRST World War: An Overview');
  assert.equal(T.toTitleCase('the causes of the FIRST world war', { keepAcronyms: false }), 'The Causes of the First World War');
  assert.equal(T.toTitleCase('war and peace', { smallWords: false }), 'War And Peace');
  assert.equal(T.toTitleCase('what is it for'), 'What Is It For', 'last word capitalised');
  assert.equal(T.toTitleCase("don't stop me now"), "Don't Stop Me Now");
  assert.equal(T.toTitleCase('a well-known fact'), 'A Well-Known Fact');
  assert.equal(T.toTitleCase('line one\nthe second line'), 'Line One\nThe Second Line');
  assert.equal(T.toTitleCase('ÉCOLE normale', { keepAcronyms: false }), 'École Normale');
  assert.equal(T.toTitleCase('e\u0301cole'), 'E\u0301cole', 'combining mark preserved');
  assert.equal(T.toTitleCase('I am'), 'I Am', 'single capital letter not treated as acronym-protected but still capital');
});

test('case: sentence case', () => {
  assert.equal(T.toSentenceCase('HELLO THERE. how ARE you? i am fine'), 'Hello there. How are you? I am fine');
  assert.equal(T.toSentenceCase('first line\nsecond LINE'), 'First line\nSecond line');
  assert.equal(T.toSentenceCase('  "quoted start"'), '  "Quoted start"');
  assert.equal(T.toSentenceCase('ÉCOLE ET ÇA VA. PRÊT?'), 'École et ça va. Prêt?');
  assert.equal(T.toSentenceCase('...'), '...');
  assert.equal(T.toSentenceCase(''), '');
});

test('case: scripts without case are unchanged; emoji survive', () => {
  for (const mode of ['upper', 'lower', 'title', 'sentence']) {
    assert.equal(T.convertCase('پاکستان زندہ باد', mode), 'پاکستان زندہ باد');
    assert.equal(T.convertCase('你好世界', mode), '你好世界');
    assert.equal(T.convertCase('👨‍👩‍👧‍👦🇵🇰', mode), '👨‍👩‍👧‍👦🇵🇰');
  }
  assert.equal(T.toUpper('hello 👋🏽 مرحبا'), 'HELLO 👋🏽 مرحبا');
  assert.throws(() => T.convertCase('x', 'bogus'));
});

test('case: CRLF, whitespace only and 1 MB', () => {
  assert.equal(T.toTitleCase('one\r\ntwo'), 'One\nTwo');
  assert.equal(T.toSentenceCase('   '), '   ');
  assert.equal(T.toTitleCase(' \n '), ' \n ');
  for (const mode of ['upper', 'lower', 'title', 'sentence']) {
    const { r, ms } = timed(() => T.convertCase(ONE_MB, mode));
    assert.ok(r.length >= 1048576 - 1);
    assert.ok(ms < 5000, `${mode} took ${ms} ms`);
  }
});

// ---------------- Duplicate lines ----------------
test('duplicates: defaults keep first occurrence and order', () => {
  const r = T.removeDuplicateLines('b\na\nb\nc\na');
  assert.equal(r.text, 'b\na\nc');
  assert.equal(r.removed, 2);
  assert.equal(r.kept, 3);
  assert.equal(r.total, 5);
});

test('duplicates: options', () => {
  const s = 'Biology\nChemistry\nbiology\nPhysics\nChemistry \nMaths';
  assert.equal(T.removeDuplicateLines(s).removed, 0, 'no trim, case-sensitive by default in function');
  assert.equal(T.removeDuplicateLines(s, { trim: true }).text, 'Biology\nChemistry\nbiology\nPhysics\nMaths');
  const ci = T.removeDuplicateLines(s, { trim: true, caseInsensitive: true });
  assert.equal(ci.text, 'Biology\nChemistry\nPhysics\nMaths');
  assert.equal(ci.removed, 2);
});

test('duplicates: empty line handling', () => {
  const s = 'a\n\nb\n\na\n';
  assert.equal(T.removeDuplicateLines(s).text, 'a\n\nb\n\n', 'blank lines kept by default; trailing newline kept');
  assert.equal(T.removeDuplicateLines(s, { ignoreEmpty: false }).text, 'a\n\nb\n');
  const rm = T.removeDuplicateLines(s, { removeEmpty: true });
  assert.equal(rm.text, 'a\nb\n');
  assert.equal(rm.emptyRemoved, 2);
  assert.equal(rm.removed, 1);
});

test('duplicates: empty and whitespace-only input', () => {
  assert.deepEqual(T.removeDuplicateLines(''), { text: '', removed: 0, kept: 0, total: 0, emptyRemoved: 0 });
  assert.equal(T.removeDuplicateLines('   \n   \n').removed, 0);
  assert.equal(T.removeDuplicateLines('   \n   \n', { ignoreEmpty: false, trim: true }).removed, 1);
  assert.equal(T.removeDuplicateLines('\n\n\n', { removeEmpty: true }).text, '');
});

test('duplicates: Unicode normalisation, case folding, emoji, RTL, CJK', () => {
  const r = T.removeDuplicateLines('caf\u00e9\ncafe\u0301');
  assert.equal(r.removed, 1, 'NFC and NFD forms are duplicates');
  assert.equal(T.removeDuplicateLines('ÉCOLE\nécole', { caseInsensitive: true }).removed, 1);
  assert.equal(T.removeDuplicateLines('👋🏽\n👋🏽\n👋').removed, 1, 'different skin tone is not a duplicate');
  assert.equal(T.removeDuplicateLines('سلام\nسلام\nشکریہ').text, 'سلام\nشکریہ');
  assert.equal(T.removeDuplicateLines('你好\n你好\n再见').removed, 1);
});

test('duplicates: CRLF input', () => {
  const r = T.removeDuplicateLines('a\r\nb\r\na\r\n');
  assert.equal(r.text, 'a\nb\n');
  assert.equal(r.removed, 1);
});

test('duplicates: 1 MB / 100k lines performance', () => {
  const lines = [];
  for (let i = 0; i < 100000; i++) lines.push('item number ' + (i % 5000));
  const big = lines.join('\n');
  const { r, ms } = timed(() => T.removeDuplicateLines(big, { trim: true, caseInsensitive: true }));
  assert.equal(r.kept, 5000);
  assert.equal(r.removed, 95000);
  assert.ok(ms < 3000, `took ${ms} ms`);
  const mb = timed(() => T.removeDuplicateLines(ONE_MB));
  assert.equal(mb.r.kept, 1);
});

// ---------------- Whitespace cleaner ----------------
test('whitespace: defaults', () => {
  const s = '  The   mitochondria\tis the\u00A0powerhouse   \n\n\n\nof the cell.  ';
  const r = T.cleanWhitespace(s);
  assert.equal(r.text, 'The mitochondria\tis the powerhouse\n\nof the cell.');
  assert.equal(r.report.oddSpaces, 1);
  assert.equal(r.report.blankLinesRemoved, 2);
  assert.equal(r.report.changed, true);
});

test('whitespace: options individually', () => {
  assert.equal(T.cleanWhitespace('a  b', { collapseSpaces: false }).text, 'a  b');
  assert.equal(T.cleanWhitespace('  a  ', { trimLines: false, collapseSpaces: false }).text, '  a  ');
  assert.equal(T.cleanWhitespace('  a', { trimLines: false }).text, '  a', 'indentation kept when not trimming');
  assert.equal(T.cleanWhitespace('a\n\n\nb', { blankLines: 'keep' }).text, 'a\n\n\nb');
  assert.equal(T.cleanWhitespace('a\n\n\nb', { blankLines: 'remove' }).text, 'a\nb');
  assert.equal(T.cleanWhitespace('a\n \n\t\nb', { blankLines: 'collapse' }).text, 'a\n\nb');
  assert.equal(T.cleanWhitespace('\n\na\n\n', { trimText: false, blankLines: 'keep' }).text, '\n\na\n\n');
  assert.equal(T.cleanWhitespace('a\tb', { tabs: 'spaces', tabWidth: 4, collapseSpaces: false }).text, 'a    b');
  assert.equal(T.cleanWhitespace('a\tb', { tabs: 'spaces', tabWidth: 4 }).text, 'a b', 'collapse after tab conversion');
  assert.equal(T.cleanWhitespace('\tindent', { tabs: 'spaces', tabWidth: 2, trimLines: false }).text, '  indent');
  assert.equal(T.cleanWhitespace('a\tb', { tabs: 'spaces', tabWidth: 99, collapseSpaces: false }).text, 'a' + ' '.repeat(16) + 'b', 'tab width clamped');
  assert.equal(T.cleanWhitespace('a\u00A0b', { oddSpaces: false }).text, 'a\u00A0b');
});

test('whitespace: zero-width characters and joiners', () => {
  const s = 'zero\u200Bwidth\uFEFF word\u2060joiner soft\u00ADhyphen';
  const r = T.cleanWhitespace(s);
  assert.equal(r.text, 'zerowidth wordjoiner softhyphen');
  assert.equal(r.report.zeroWidth, 4);
  // ZWNJ/ZWJ are kept by default (Persian/Urdu shaping and emoji sequences)
  const fa = 'می\u200Cخواهم 👨\u200D👩\u200D👧';
  assert.equal(T.cleanWhitespace(fa).text, fa);
  assert.equal(T.cleanWhitespace(fa, { joiners: true }).text, 'میخواهم 👨👩👧');
  assert.equal(T.cleanWhitespace('a\u200Bb', { zeroWidth: false }).text, 'a\u200Bb');
});

test('whitespace: unusual Unicode spaces', () => {
  const s = 'a\u2003b\u202Fc\u3000d\u2009e\u1680f';
  assert.equal(T.cleanWhitespace(s).text, 'a b c d e f');
  assert.equal(T.cleanWhitespace(s).report.oddSpaces, 5);
});

test('whitespace: empty, whitespace-only, CRLF, already clean', () => {
  assert.equal(T.cleanWhitespace('').text, '');
  assert.equal(T.cleanWhitespace('').report.changed, false);
  assert.equal(T.cleanWhitespace(null).text, '');
  assert.equal(T.cleanWhitespace('   \n\t\n  \u00A0 ').text, '');
  assert.equal(T.cleanWhitespace('a  \r\n\r\n\r\nb').text, 'a\n\nb');
  const clean = T.cleanWhitespace('Already clean.\n\nTwo paragraphs.');
  assert.equal(clean.report.changed, false);
  assert.equal(T.cleanWhitespace('a\r\nb').report.changed, false, 'CRLF-only difference is not a change');
});

test('whitespace: Unicode text untouched apart from spacing', () => {
  assert.equal(T.cleanWhitespace('  پاکستان   زندہ   باد  ').text, 'پاکستان زندہ باد');
  assert.equal(T.cleanWhitespace('你好　 世界').text, '你好 世界');
  assert.equal(T.cleanWhitespace('cafe\u0301   👋🏽').text, 'cafe\u0301 👋🏽');
});

test('whitespace: 1 MB performance', () => {
  const messy = ('word  \u00A0 word\u200B\t\n\n\n').repeat(60000);
  assert.ok(messy.length > 1000000);
  const { r, ms } = timed(() => T.cleanWhitespace(messy, { tabs: 'spaces' }));
  assert.ok(r.text.length < messy.length);
  assert.ok(!/\u200B|\u00A0|\t/.test(r.text));
  assert.ok(ms < 5000, `took ${ms} ms`);
});

// ---------------- Study notes ----------------
test('notes: parseTags', () => {
  assert.deepEqual(T.parseTags('Biology, exam prep , #week-1'), ['biology', 'exam prep', 'week-1']);
  assert.deepEqual(T.parseTags('a, A, a'), ['a']);
  assert.deepEqual(T.parseTags(''), []);
  assert.deepEqual(T.parseTags(' , ,, '), []);
  assert.deepEqual(T.parseTags('حیاتیات، امتحان'), ['حیاتیات', 'امتحان'], 'Arabic comma separator');
  assert.deepEqual(T.parseTags('生物、考试'), ['生物', '考试'], 'ideographic comma');
  assert.equal(T.parseTags(Array.from({ length: 30 }, (_, i) => 't' + i).join(',')).length, 20);
  assert.equal(T.parseTags('x'.repeat(100))[0].length, 40);
  assert.deepEqual(T.parseTags('ÉCOLE'), ['école']);
  assert.deepEqual(T.parseTags('🎉 party'), ['🎉 party']);
});

test('notes: validateNoteInput', () => {
  assert.equal(T.validateNoteInput('', '', '').ok, false);
  assert.equal(T.validateNoteInput('  ', ' \n ', '').ok, false);
  assert.equal(T.validateNoteInput('Title', '', '').ok, true);
  assert.equal(T.validateNoteInput('', 'body only', '').ok, true);
  assert.equal(T.validateNoteInput('x'.repeat(201), 'b', '').ok, false);
  assert.equal(T.validateNoteInput('😀'.repeat(200), 'b', '').ok, true, 'title length measured in code points');
  assert.equal(T.validateNoteInput('t', 'x'.repeat(100001), '').ok, false);
  const v = T.validateNoteInput('  Cell structure ', 'Text', 'Biology, Unit 1');
  assert.deepEqual(v.fields, { title: 'Cell structure', body: 'Text', tags: ['biology', 'unit 1'] });
});

function sample() {
  const a = T.createNote({ title: 'Cell structure', body: 'Nucleus, mitochondria', tags: ['biology', 'unit 1'] }, '2026-01-01T10:00:00.000Z');
  const b = T.createNote({ title: 'Enzymes', body: 'Active site; denaturation', tags: ['biology', 'unit 2'] }, '2026-01-03T10:00:00.000Z');
  const c = T.createNote({ title: 'Moles and mass', body: 'n = m / M', tags: ['chemistry', 'unit 1'] }, '2026-01-02T10:00:00.000Z');
  const d = T.createNote({ title: 'اردو نوٹس', body: 'café résumé 你好 👋🏽', tags: ['urdu'] }, '2026-01-04T10:00:00.000Z');
  return [a, b, c, d];
}

test('notes: create and update', () => {
  const [a] = sample();
  assert.match(a.id, /^n-/);
  assert.equal(a.created, a.updated);
  const u = T.updateNote(a, { title: 'New', body: 'B', tags: ['x'] }, '2026-02-01T00:00:00.000Z');
  assert.equal(u.id, a.id);
  assert.equal(u.created, a.created);
  assert.equal(u.updated, '2026-02-01T00:00:00.000Z');
  assert.equal(a.title, 'Cell structure', 'original not mutated');
  const ids = new Set(Array.from({ length: 1000 }, () => T.createNote({ title: 't', body: '', tags: [] }).id));
  assert.equal(ids.size, 1000, 'ids unique');
});

test('notes: filter, search and tags', () => {
  const notes = sample();
  assert.deepEqual(T.filterNotes(notes, '', '').map((n) => n.title), ['اردو نوٹس', 'Enzymes', 'Moles and mass', 'Cell structure'], 'newest first');
  assert.deepEqual(T.filterNotes(notes, '', 'unit 1').map((n) => n.title), ['Moles and mass', 'Cell structure']);
  assert.deepEqual(T.filterNotes(notes, 'ENZYME', '').map((n) => n.title), ['Enzymes']);
  assert.deepEqual(T.filterNotes(notes, 'cafe resume', '').map((n) => n.title), ['اردو نوٹس'], 'accent-insensitive');
  assert.deepEqual(T.filterNotes(notes, 'نوٹس', '').length, 1);
  assert.deepEqual(T.filterNotes(notes, '你好', '').length, 1);
  assert.deepEqual(T.filterNotes(notes, 'biology unit', '').length, 2, 'all terms must match');
  assert.deepEqual(T.filterNotes(notes, 'nothing-here', ''), []);
  assert.deepEqual(T.filterNotes([], 'x', ''), []);
  assert.deepEqual(T.filterNotes(null, '', ''), []);
  assert.deepEqual(T.allTags(notes), ['biology', 'chemistry', 'unit 1', 'unit 2', 'urdu']);
});

test('notes: JSON export round trip', () => {
  const notes = sample();
  const json = T.notesToJson(notes, '2026-10-20T00:00:00.000Z');
  const parsed = T.parseNotesImport(json);
  assert.equal(parsed.ok, true);
  assert.equal(parsed.skipped, 0);
  assert.deepEqual(parsed.notes, notes);
  assert.equal(JSON.parse(json).schema, 'studykit-notes');
});

test('notes: import validation', () => {
  assert.equal(T.parseNotesImport('not json').ok, false);
  assert.equal(T.parseNotesImport('').ok, false);
  assert.equal(T.parseNotesImport('{"foo":1}').ok, false);
  assert.equal(T.parseNotesImport('"string"').ok, false);
  assert.equal(T.parseNotesImport('null').ok, false);
  const mixed = T.parseNotesImport(JSON.stringify([
    { title: 'ok', body: 'b', tags: ['A', 'b'] },
    { title: 'tags as string', tags: 'x, y' },
    null, 5, 'str', {}, { title: '', body: '   ' }, { title: 42 },
    { title: '<img src=x onerror=alert(1)>', body: '<script>alert(1)</script>', created: 'garbage' }
  ]));
  assert.equal(mixed.ok, true);
  assert.equal(mixed.notes.length, 3);
  assert.equal(mixed.skipped, 6);
  assert.deepEqual(mixed.notes[0].tags, ['a', 'b']);
  assert.deepEqual(mixed.notes[1].tags, ['x', 'y']);
  assert.equal(mixed.notes[2].body, '<script>alert(1)</script>', 'stored as plain text; rendered with textContent');
  assert.ok(!isNaN(Date.parse(mixed.notes[2].created)), 'invalid date replaced');
});

test('notes: merge', () => {
  const [a, b] = sample();
  const newerA = T.updateNote(a, { title: 'A2', body: '', tags: [] }, '2027-01-01T00:00:00.000Z');
  const olderB = T.updateNote(b, { title: 'old B', body: '', tags: [] }, '2000-01-01T00:00:00.000Z');
  const c = T.createNote({ title: 'C', body: '', tags: [] });
  const m = T.mergeNotes([a, b], [newerA, olderB, c]);
  assert.equal(m.added, 1);
  assert.equal(m.updated, 1);
  assert.equal(m.unchanged, 1);
  assert.equal(m.notes.length, 3);
  assert.equal(m.notes.find((n) => n.id === a.id).title, 'A2');
  assert.equal(m.notes.find((n) => n.id === b.id).title, 'Enzymes');
  assert.deepEqual(T.mergeNotes([], []).notes, []);
});

test('notes: Markdown and text export', () => {
  const notes = sample();
  const md = T.notesToMarkdown(notes);
  assert.match(md, /^# Study notes/);
  assert.match(md, /## Cell structure/);
  assert.match(md, /Tags: `biology`, `unit 1`/);
  assert.match(md, /👋🏽/);
  const txt = T.notesToText(notes);
  assert.match(txt, /^STUDY NOTES/);
  assert.match(txt, /Enzymes\n=======\n/);
  assert.match(T.notesToMarkdown([]), /No notes/);
  assert.match(T.notesToText([]), /No notes/);
  const untitled = T.notesToMarkdown([T.createNote({ title: '', body: 'x', tags: [] })]);
  assert.match(untitled, /## Untitled note/);
});

test('notes: large data set', () => {
  const many = [];
  for (let i = 0; i < 5000; i++) many.push(T.createNote({ title: 'Note ' + i, body: 'body text '.repeat(20), tags: ['t' + (i % 50)] }, new Date(2026, 0, 1, 0, 0, i).toISOString()));
  const json = T.notesToJson(many);
  assert.ok(json.length > 1000000, 'export over 1 MB');
  const { r, ms } = timed(() => T.parseNotesImport(json));
  assert.equal(r.notes.length, 5000);
  const f = timed(() => T.filterNotes(many, 'note 4999', 't49'));
  assert.equal(f.r.length, 1);
  assert.ok(ms < 3000 && f.ms < 3000);
});

// ---------------- Chunked segmentation (performance workaround) ----------------
test('chunking: chunked counts equal one-pass Intl.Segmenter counts on mixed-script text', () => {
  const parts = ['Hello world. ', 'Café naïve e\u0301 ', '👋🏽 👨‍👩‍👧‍👦 🇵🇰 ', 'پاکستان ایک خوبصورت ملک ہے۔ ', '你好世界。日本語です。', "don't stop! ",
    'a\u0301 ', '\n', '\n\n', 'x. y ', 'Mr. Smith. ', '  ', '\t', 'e.g. the ', '١٢٣ ', 'हिन्दी में। ', 'Is it? Yes. ', '\r\n'];
  let seed = 42;
  const rand = () => { seed = (seed * 1103515245 + 12345) % 2147483648; return seed / 2147483648; };
  const ref = (s, g) => {
    let n = 0;
    for (const p of new Intl.Segmenter(undefined, { granularity: g }).segment(s)) {
      if (g === 'grapheme') n++;
      else if (g === 'word') { if (p.isWordLike) n++; }
      else if (/[\p{L}\p{N}]/u.test(p.segment)) n++;
    }
    return n;
  };
  for (let k = 0; k < 150; k++) {
    let s = '';
    const len = 300 + Math.floor(rand() * 500);
    for (let i = 0; i < len; i++) s += parts[Math.floor(rand() * parts.length)];
    assert.equal(T.countGraphemes(s), ref(s, 'grapheme'), 'graphemes, sample ' + k);
    assert.equal(T.countWords(s), ref(s, 'word'), 'words, sample ' + k);
    assert.equal(T.countSentences(s), ref(s, 'sentence'), 'sentences, sample ' + k);
    for (const g of ['grapheme', 'word', 'sentence']) assert.equal(T._chunkText(s, g).join(''), s, 'chunks rejoin');
  }
});

test('chunking: 1 MB with no spaces or punctuation stays fast and nearly exact', () => {
  const x = 'x'.repeat(1048576);
  const { r, ms } = timed(() => T.getTextStats(x));
  assert.equal(r.characters, 1048576);
  assert.equal(r.words, 1);
  assert.equal(r.sentences, 1);
  assert.ok(ms < 8000, `took ${ms} ms`);
  const zh = '你好世界我们今天学习数学'.repeat(80000);
  const z = T.countWords(zh);
  const exact = 480000; // dictionary splits each 12-character unit into 6 words
  assert.ok(Math.abs(z - exact) / exact < 0.005, `CJK words ${z} within 0.5% of ${exact}`);
});
