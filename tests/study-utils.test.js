'use strict';
// Run with: node --test tests/
const test = require('node:test');
const assert = require('node:assert/strict');
const S = require('../assets/js/study-utils.js');
const D = S.parseDate;

// ---------------- GPA / CGPA ----------------
test('gpa: weighted by credit hours, empty rows ignored', () => {
  const r = S.calcGpa([{ credits: 3, points: 4 }, { credits: 3, points: 3.33 }, { credits: '', points: '' }, { credits: 2, points: 2.67 }], 4);
  assert.equal(r.ok, true);
  assert.equal(S.round(r.gpa, 2), 3.42);
  assert.equal(r.credits, 8);
  assert.equal(S.round(r.qualityPoints, 2), 27.33);
});
test('gpa: invalid rows reported, nothing counted', () => {
  const r = S.calcGpa([{ credits: 3, points: 4.5 }, { credits: 0, points: 3 }], 4);
  assert.equal(r.ok, false);
  assert.deepEqual(r.errors.map((e) => [e.index, e.field]), [[0, 'points'], [1, 'credits']]);
  assert.equal(S.calcGpa([], 4).empty, true);
  assert.equal(S.calcGpa([{ credits: 'abc', points: 3 }], 4).ok, false);
});
test('gpa: 5 and 10 point scales', () => {
  assert.equal(S.calcGpa([{ credits: 4, points: 5 }], 5).gpa, 5);
  assert.equal(S.calcGpa([{ credits: 4, points: 9 }, { credits: 2, points: 6 }], 10).gpa, 8);
});
test('cgpa: combine previous and new term', () => {
  assert.equal(S.round(S.combineCgpa(3.0, 32, 3.5, 16), 4), 3.1667);
  assert.equal(S.combineCgpa(0, 0, 0, 0), null);
});
test('cgpa to percentage: proportional and custom formula', () => {
  assert.equal(S.cgpaToPercent(3.2, { scale: 4 }), 80);
  assert.equal(S.cgpaToPercent(4, { scale: 5 }), 80);
  assert.equal(S.round(S.cgpaToPercent(8.2, { method: 'multiplier', multiplier: 9.5 }), 2), 77.9);
  assert.equal(S.round(S.cgpaToPercent(8, { method: 'multiplier', multiplier: 10, add: -7.5 }), 2), 72.5);
});
test('parseNum', () => {
  assert.equal(S.parseNum(''), null);
  assert.equal(S.parseNum(' 3,5 '), 3.5);
  assert.ok(Number.isNaN(S.parseNum('3a')));
  assert.equal(S.parseNum('.5'), 0.5);
});

// ---------------- Percentage ----------------
test('percentages', () => {
  assert.equal(S.round(S.percentOf(942, 1100), 2), 85.64);
  assert.equal(S.percentOf(5, 0), null);
  assert.equal(S.marksForPercent(33, 75), 24.75);
  assert.equal(S.percentChange(60, 75), 25);
  assert.equal(S.percentChange(0, 10), null);
  assert.deepEqual(S.sumMarks([{ obtained: 80, total: 100 }, { obtained: 45, total: 50 }]).obtained, 125);
  assert.equal(S.round(S.sumMarks([{ obtained: 80, total: 100 }, { obtained: 45, total: 50 }]).percent, 2), 83.33);
  assert.equal(S.round(1.005, 2), 1.01);
});


// ---------------- Final grade ----------------
test('requiredFinalScore: 82/30/85 → 92', () => {
  const r = S.requiredFinalScore(82, 30, 85);
  assert.equal(r.ok, true);
  assert.equal(r.status, 'ok');
  assert.equal(r.required, 92);
});
test('requiredFinalScore: unreachable 85/25/90 → 105, best 88.75', () => {
  const r = S.requiredFinalScore(85, 25, 90);
  assert.equal(r.ok, true);
  assert.equal(r.status, 'unreachable');
  assert.equal(r.required, 105);
  assert.equal(r.bestPossible, 88.75);
});
test('requiredFinalScore: already safe', () => {
  // (60 − 90×0.7) ÷ 0.3 = −10 → already safe even with 0% on the final
  const r = S.requiredFinalScore(90, 30, 60);
  assert.equal(r.ok, true);
  assert.equal(r.status, 'safe');
  assert.equal(r.required, 0);
});
test('requiredFinalScore: weight 100 equals target; weight 0 invalid', () => {
  const full = S.requiredFinalScore(50, 100, 88);
  assert.equal(full.ok, true);
  assert.equal(full.status, 'ok');
  assert.equal(full.required, 88);
  const zero = S.requiredFinalScore(80, 0, 90);
  assert.equal(zero.ok, false);
  assert.equal(zero.status, 'invalid');
});
test('requiredFinalScore: rounds up to 2 dp', () => {
  // (90 - 80*0.8)/0.2 = (90-64)/0.2 = 130 → unreachable
  // slight non-integer: current 81, weight 30, target 85
  // (85 - 81*0.7)/0.3 = (85 - 56.7)/0.3 = 28.3/0.3 = 94.333... → 94.34
  const r = S.requiredFinalScore(81, 30, 85);
  assert.equal(r.ok, true);
  assert.equal(r.status, 'ok');
  assert.equal(r.required, 94.34);
});
test('courseGradeAfterFinal: reverse of worked example', () => {
  assert.equal(S.round(S.courseGradeAfterFinal(82, 30, 92), 2), 85);
  assert.equal(S.round(S.courseGradeAfterFinal(85, 25, 100), 2), 88.75);
  assert.equal(S.courseGradeAfterFinal(80, 0, 90), null);
});
// ---------------- Dates ----------------
test('dates: parse rejects impossible dates', () => {
  assert.equal(D('2026-02-30'), null);
  assert.equal(D('2026-13-01'), null);
  assert.equal(D('26-1-1'), null);
  assert.equal(S.isoDate(D('2024-02-29')), '2024-02-29');
});
test('dates: calendar difference', () => {
  assert.deepEqual(pick(S.dateDiff(D('2000-02-29'), D('2026-10-22'))), [26, 7, 23, 9732]);
  assert.deepEqual(pick(S.dateDiff(D('2026-01-15'), D('2026-03-10'))), [0, 1, 23, 54]);
  assert.deepEqual(pick(S.dateDiff(D('2026-01-31'), D('2026-03-01'))), [0, 1, 1, 29]);
  assert.deepEqual(pick(S.dateDiff(D('2026-10-22'), D('2027-03-01'))), [0, 4, 7, 130]);
  const neg = S.dateDiff(D('2027-03-01'), D('2026-10-22'));
  assert.equal(neg.negative, true);
  assert.equal(neg.totalDays, 130);
  assert.deepEqual(pick(S.dateDiff(D('2026-05-05'), D('2026-05-05'))), [0, 0, 0, 0]);
  function pick(d) { return [d.years, d.months, d.days, d.totalDays]; }
});
test('dates: next birthday incl. 29 February', () => {
  const nb = S.nextBirthday(D('2000-02-29'), D('2026-10-22'));
  assert.equal(S.isoDate(nb.date), '2027-02-28');
  assert.equal(nb.turning, 27);
  assert.equal(S.nextBirthday(D('2000-10-22'), D('2026-10-22')).daysUntil, 0);
  assert.equal(S.isoDate(S.nextBirthday(D('2000-02-29'), D('2027-10-01')).date), '2028-02-29');
});

// ---------------- Citations ----------------
const book = { authors: 'Smith, John Adam\nLee, Mary', year: '2020', title: 'Learning how to learn', publisher: 'Oxford University Press', edition: '2' };
test('citation: APA 7 book', () => {
  const r = S.formatCitation('apa', 'book', book);
  assert.equal(r.text, 'Smith, J. A., & Lee, M. (2020). Learning how to learn (2nd ed.). Oxford University Press.');
  assert.equal(r.html, 'Smith, J. A., &amp; Lee, M. (2020). <i>Learning how to learn</i> (2nd ed.). Oxford University Press.');
});
test('citation: MLA 9 book', () => {
  assert.equal(S.formatCitation('mla', 'book', book).text, 'Smith, John Adam, and Mary Lee. Learning how to learn. 2nd ed., Oxford University Press, 2020.');
  assert.equal(S.formatCitation('mla', 'book', Object.assign({}, book, { authors: 'A, B\nC, D\nE, F' })).text.startsWith('A, B, et al.'), true);
});
test('citation: journal article APA and MLA', () => {
  const j = { authors: 'Brysbaert, Marc', year: '2019', title: 'How many words do we read per minute? A review and meta-analysis of reading rate', journal: 'Journal of Memory and Language', volume: '109', pages: '104047', doi: '10.1016/j.jml.2019.104047' };
  assert.equal(S.formatCitation('apa', 'journal', j).text, 'Brysbaert, M. (2019). How many words do we read per minute? A review and meta-analysis of reading rate. Journal of Memory and Language, 109, 104047. https://doi.org/10.1016/j.jml.2019.104047');
  assert.equal(S.formatCitation('mla', 'journal', j).text, 'Brysbaert, Marc. \u201CHow many words do we read per minute? A review and meta-analysis of reading rate.\u201D Journal of Memory and Language, vol. 109, 2019, p. 104047. https://doi.org/10.1016/j.jml.2019.104047.');
  const withIssue = S.formatCitation('apa', 'journal', Object.assign({}, j, { issue: '3', pages: '10-20' }));
  assert.ok(withIssue.html.includes('<i>109</i>(3), 10–20.'));
});
test('citation: website, organisation author, no date', () => {
  const w = { authors: '{World Health Organization}', year: '2023', month: '5', day: '4', title: 'Malaria', site: 'WHO', url: 'https://www.who.int/news-room/fact-sheets/detail/malaria', accessed: '2026-10-22' };
  assert.equal(S.formatCitation('apa', 'website', w).text, 'World Health Organization. (2023, May 4). Malaria. WHO. Retrieved October 22, 2026, from https://www.who.int/news-room/fact-sheets/detail/malaria');
  assert.equal(S.formatCitation('mla', 'website', w).text, 'World Health Organization. \u201CMalaria.\u201D WHO, 4 May 2023, www.who.int/news-room/fact-sheets/detail/malaria. Accessed 22 Oct. 2026.');
  assert.equal(S.formatCitation('apa', 'website', { title: 'Study tips', url: 'https://example.org/tips' }).text, 'Study tips. (n.d.). https://example.org/tips');
  assert.equal(S.formatCitation('apa', 'book', { title: 'Atlas of the world', edition: '3', year: '2021', publisher: 'Collins' }).text, 'Atlas of the world (3rd ed.). (2021). Collins.');
  assert.equal(S.formatCitation('apa', 'book', { title: 'Atlas of the world', publisher: 'Collins' }).html, '<i>Atlas of the world</i>. (n.d.). Collins.');
});
test('citation: missing fields and HTML escaping', () => {
  assert.deepEqual(S.formatCitation('apa', 'book', { title: '' }).missing, ['title', 'publisher']);
  assert.deepEqual(S.formatCitation('mla', 'website', { title: 'x' }).missing, ['url']);
  const r = S.formatCitation('apa', 'book', { title: '<script>alert(1)</script>', publisher: 'A & B' });
  assert.ok(!r.html.includes('<script>'));
  assert.ok(r.html.includes('&lt;script&gt;') && r.html.includes('A &amp; B'));
});
test('citation: APA lists 20 authors, truncates 21+', () => {
  const many = Array.from({ length: 22 }, (_, i) => 'Author' + i + ', A').join('\n');
  const t = S.formatCitation('apa', 'book', { authors: many, title: 'T', publisher: 'P', year: '2020' }).text;
  assert.ok(t.includes('Author18, A., . . . Author21, A.'));
  assert.ok(!t.includes('Author19,'));
});

// ---------------- Flashcards & timer ----------------
test('flashcards: normaliseDecks drops bad data', () => {
  assert.deepEqual(S.normaliseDecks(null), []);
  assert.deepEqual(S.normaliseDecks({}), []);
  const d = S.normaliseDecks([{ id: 1, name: 'Bio', cards: [{ front: 'a', back: 'b' }, { front: 1 }, null] }, { name: 5 }]);
  assert.equal(d.length, 1);
  assert.deepEqual(d[0].cards, [{ id: '', front: 'a', back: 'b' }]);
});
test('flashcards: shuffle keeps all cards', () => {
  const a = [1, 2, 3, 4, 5];
  const s = S.shuffle(a, () => 0);
  assert.deepEqual(s.slice().sort(), a);
  assert.deepEqual(a, [1, 2, 3, 4, 5]);
});
test('timer helpers', () => {
  assert.equal(S.formatClock(1500), '25:00');
  assert.equal(S.formatClock(59.2), '01:00');
  assert.equal(S.formatClock(3725), '1:02:05');
  assert.equal(S.formatClock(-3), '00:00');
  assert.equal(S.nextPhase('focus', 1, 4), 'short');
  assert.equal(S.nextPhase('focus', 4, 4), 'long');
  assert.equal(S.nextPhase('short', 1, 4), 'focus');
  assert.equal(S.nextPhase('long', 4, 4), 'focus');
});
