/*
 * StudyKit Hub — pure helpers for the calculators, citation generator and flashcards.
 * Works in the browser (window.StudyKitStudy) and in Node (require) for the unit tests.
 * No network requests, no storage, no DOM access in this file.
 */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) {
    module.exports = factory();
  } else {
    root.StudyKitStudy = factory();
  }
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  /** Round to `dp` decimal places without floating-point surprises such as 1.005 -> 1. */
  function round(n, dp) {
    var f = Math.pow(10, dp);
    return Math.round((n + Number.EPSILON) * f) / f;
  }

  /** Parse a number field. Empty -> null. Returns NaN for anything that is not a plain number. */
  function parseNum(v) {
    if (v === null || v === undefined) return null;
    var s = String(v).trim().replace(',', '.');
    if (s === '') return null;
    if (!/^[-+]?(\d+\.?\d*|\.\d+)$/.test(s)) return NaN;
    return Number(s);
  }

  // ---------------- GPA / CGPA ----------------
  /**
   * courses: [{ credits, points }]. Rows with both values empty are ignored.
   * Returns { ok, gpa, credits, qualityPoints, counted, errors: [{ index, field, message }] }.
   */
  function calcGpa(courses, scale) {
    scale = scale || 4;
    var errors = [];
    var credits = 0;
    var qp = 0;
    var counted = 0;
    (courses || []).forEach(function (c, i) {
      var cr = parseNum(c.credits);
      var gp = parseNum(c.points);
      if (cr === null && gp === null) return;
      if (cr === null || isNaN(cr) || cr <= 0 || cr > 30) errors.push({ index: i, field: 'credits', message: 'Enter credit hours greater than 0 (up to 30).' });
      if (gp === null || isNaN(gp) || gp < 0 || gp > scale) errors.push({ index: i, field: 'points', message: 'Enter grade points from 0 to ' + scale + '.' });
      if (cr > 0 && cr <= 30 && gp !== null && gp >= 0 && gp <= scale) {
        credits += cr;
        qp += cr * gp;
        counted++;
      }
    });
    if (errors.length) return { ok: false, errors: errors, counted: counted };
    if (!counted) return { ok: false, errors: [], counted: 0, empty: true };
    return { ok: true, errors: [], gpa: qp / credits, credits: credits, qualityPoints: qp, counted: counted };
  }

  /** Combine a previous CGPA (over prevCredits) with a new term GPA (over termCredits). */
  function combineCgpa(prevCgpa, prevCredits, termGpa, termCredits) {
    var total = prevCredits + termCredits;
    if (!(total > 0)) return null;
    return (prevCgpa * prevCredits + termGpa * termCredits) / total;
  }

  /**
   * Convert a CGPA to a percentage.
   * method 'proportional': cgpa / scale * 100 (on a 4.0 scale this is the same as cgpa * 25).
   * method 'multiplier':   cgpa * multiplier + add (a formula you enter yourself).
   */
  function cgpaToPercent(cgpa, opts) {
    opts = opts || {};
    if (opts.method === 'multiplier') return cgpa * opts.multiplier + (opts.add || 0);
    return (cgpa / (opts.scale || 4)) * 100;
  }

  // ---------------- Percentage and marks ----------------
  function percentOf(obtained, total) {
    if (!(total > 0)) return null;
    return (obtained / total) * 100;
  }
  function marksForPercent(percent, total) {
    return (percent / 100) * total;
  }
  function percentChange(from, to) {
    if (from === 0) return null;
    return ((to - from) / Math.abs(from)) * 100;
  }
  /** subjects: [{ obtained, total }] -> { obtained, total, percent } */
  function sumMarks(subjects) {
    var o = 0;
    var t = 0;
    subjects.forEach(function (s) { o += s.obtained; t += s.total; });
    return { obtained: o, total: t, percent: percentOf(o, t) };
  }

  // ---------------- Dates ----------------
  /** Parse 'YYYY-MM-DD' to a UTC-midnight Date, or null. */
  function parseDate(s) {
    var m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(s || ''));
    if (!m) return null;
    var y = +m[1], mo = +m[2] - 1, d = +m[3];
    var dt = new Date(Date.UTC(y, mo, d));
    if (dt.getUTCFullYear() !== y || dt.getUTCMonth() !== mo || dt.getUTCDate() !== d) return null;
    return dt;
  }
  function daysInMonth(y, m) { return new Date(Date.UTC(y, m + 1, 0)).getUTCDate(); }
  function addMonths(date, n) {
    var y = date.getUTCFullYear() + Math.floor((date.getUTCMonth() + n) / 12);
    var m = ((date.getUTCMonth() + n) % 12 + 12) % 12;
    return new Date(Date.UTC(y, m, Math.min(date.getUTCDate(), daysInMonth(y, m))));
  }
  function isoDate(d) { return d.toISOString().slice(0, 10); }

  /**
   * Calendar difference from a to b (a <= b expected; swapped otherwise and `negative` set).
   * Returns { years, months, days, totalDays, weeks, weekDays, totalMonths, negative }.
   */
  function dateDiff(a, b) {
    var negative = false;
    if (a > b) { var t = a; a = b; b = t; negative = true; }
    // Whole months first (clamped to the end of shorter months, so 31 January + 1 month = 28/29 February), then days.
    var months = (b.getUTCFullYear() - a.getUTCFullYear()) * 12 + (b.getUTCMonth() - a.getUTCMonth());
    var anchor = addMonths(a, months);
    if (anchor > b) { months -= 1; anchor = addMonths(a, months); }
    var y = Math.floor(months / 12);
    var m = months % 12;
    var d = Math.round((b - anchor) / 86400000);
    var totalDays = Math.round((b - a) / 86400000);
    return { years: y, months: m, days: d, totalMonths: y * 12 + m, totalDays: totalDays, weeks: Math.floor(totalDays / 7), weekDays: totalDays % 7, negative: negative };
  }

  /** Next birthday on or after `on`. 29 February birthdays fall on 28 February in common years. */
  function nextBirthday(dob, on) {
    function bday(year) {
      var day = dob.getUTCDate();
      if (dob.getUTCMonth() === 1 && day === 29 && daysInMonth(year, 1) === 28) day = 28;
      return new Date(Date.UTC(year, dob.getUTCMonth(), day));
    }
    var next = bday(on.getUTCFullYear());
    if (next < on) next = bday(on.getUTCFullYear() + 1);
    return { date: next, daysUntil: Math.round((next - on) / 86400000), turning: next.getUTCFullYear() - dob.getUTCFullYear() };
  }

  // ---------------- Citations (APA 7 and MLA 9) ----------------
  var MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
  var MLA_MONTHS = ['Jan.', 'Feb.', 'Mar.', 'Apr.', 'May', 'June', 'July', 'Aug.', 'Sept.', 'Oct.', 'Nov.', 'Dec.'];

  function esc(s) {
    return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  }
  function clean(s) { return String(s || '').replace(/\s+/g, ' ').trim(); }
  function stripEndPunct(s) { return clean(s).replace(/[.\s]+$/, ''); }
  /** Add a full stop unless the text already ends with . ? or ! */
  function endDot(s) { return /[.?!]$/.test(s) ? s : s + '.'; }

  /** "Last, First Middle" or "First Middle Last" -> { last, given: [..] }. Organisation names: wrap in braces {World Health Organization}. */
  function parseAuthor(raw) {
    var s = clean(raw);
    if (!s) return null;
    var org = /^\{(.+)\}$/.exec(s);
    if (org) return { org: clean(org[1]) };
    var last, given;
    if (s.indexOf(',') !== -1) {
      last = clean(s.slice(0, s.indexOf(',')));
      given = clean(s.slice(s.indexOf(',') + 1)).split(' ').filter(Boolean);
    } else {
      var parts = s.split(' ');
      last = parts.pop();
      given = parts;
    }
    return { last: last, given: given };
  }
  function parseAuthors(text) {
    return String(text || '').split(/\n|;/).map(parseAuthor).filter(Boolean);
  }
  function initials(given) {
    return given.map(function (g) {
      return g.split('-').map(function (p) { return p.replace(/\.$/, '').charAt(0).toUpperCase() + '.'; }).join('-');
    }).join(' ');
  }
  function apaName(a) { return a.org ? a.org : a.last + (a.given.length ? ', ' + initials(a.given) : ''); }
  function apaAuthors(list) {
    var n = list.map(apaName);
    if (n.length === 0) return '';
    if (n.length === 1) return n[0];
    if (n.length === 2) return n[0] + ', & ' + n[1];
    if (n.length <= 20) return n.slice(0, -1).join(', ') + ', & ' + n[n.length - 1];
    return n.slice(0, 19).join(', ') + ', . . . ' + n[n.length - 1];
  }
  function mlaFirst(a) { return a.org ? a.org : a.last + (a.given.length ? ', ' + a.given.join(' ') : ''); }
  function mlaNormal(a) { return a.org ? a.org : (a.given.length ? a.given.join(' ') + ' ' : '') + a.last; }
  function mlaAuthors(list) {
    if (list.length === 0) return '';
    if (list.length === 1) return mlaFirst(list[0]);
    if (list.length === 2) return mlaFirst(list[0]) + ', and ' + mlaNormal(list[1]);
    return mlaFirst(list[0]) + ', et al';
  }

  function ordinalEdition(ed) {
    var s = clean(ed).replace(/\s*(ed\.?|edition)$/i, '');
    if (!s) return '';
    if (/^\d+$/.test(s)) {
      var n = +s;
      var suf = (n % 100 >= 11 && n % 100 <= 13) ? 'th' : ({ 1: 'st', 2: 'nd', 3: 'rd' }[n % 10] || 'th');
      return n + suf;
    }
    return s;
  }
  function doiUrl(doi) {
    var d = clean(doi);
    if (!d) return '';
    if (/^https?:\/\//i.test(d)) return d;
    return 'https://doi.org/' + d.replace(/^doi:\s*/i, '');
  }
  function mlaUrl(u) { return clean(u).replace(/^https?:\/\//i, '').replace(/\/$/, ''); }
  function pagesApa(p) { return clean(p).replace(/\s*[-–—]\s*/g, '–'); }

  /** Build output from parts: [text, italic?] pairs. Returns { html, text }. */
  function build(parts) {
    var html = '';
    var text = '';
    parts.forEach(function (p) {
      if (!p || !p[0]) return;
      html += p[1] ? '<i>' + esc(p[0]) + '</i>' : esc(p[0]);
      text += p[0];
    });
    return { html: html.trim(), text: text.trim() };
  }

  /**
   * style: 'apa' | 'mla'; type: 'book' | 'website' | 'journal'.
   * data: { authors, year, month (1-12), day, title, edition, publisher, site, url, accessed (YYYY-MM-DD),
   *         journal, volume, issue, pages, doi }
   * Returns { ok, html, text, missing: [field names] }.
   */
  function formatCitation(style, type, data) {
    var d = {};
    Object.keys(data || {}).forEach(function (k) { d[k] = typeof data[k] === 'string' ? clean(data[k]) : data[k]; });
    var authors = parseAuthors(data.authors);
    var title = stripEndPunct(d.title || '');
    var missing = [];
    if (!title) missing.push('title');
    if (type === 'book' && !d.publisher) missing.push('publisher');
    if (type === 'website' && !d.url) missing.push('url');
    if (type === 'journal' && !d.journal) missing.push('journal');
    if (missing.length) return { ok: false, missing: missing, html: '', text: '' };
    var month = d.month ? +d.month : 0;
    var day = d.day ? +d.day : 0;
    var parts = [];

    if (style === 'apa') {
      var dateStr = d.year ? String(d.year) : 'n.d.';
      if (type === 'website' && d.year && month) dateStr += ', ' + MONTHS[month - 1] + (day ? ' ' + day : '');
      var auth = apaAuthors(authors);
      var lead = auth ? [endDot(auth) + ' ', false] : null;
      var dateP = ['(' + dateStr + '). ', false];
      if (type === 'book') {
        var ed = ordinalEdition(d.edition || '');
        if (lead) parts.push(lead, dateP);
        parts.push([title, true]);
        if (ed) parts.push([' (' + ed + ' ed.)', false]);
        parts.push([/[.?!]$/.test(title) && !ed ? ' ' : '. ', false]);
        if (!lead) parts.push(dateP);
        parts.push([endDot(d.publisher) + ' ', false]);
        if (d.doi) parts.push([doiUrl(d.doi), false]);
        else if (d.url) parts.push([d.url, false]);
      } else if (type === 'website') {
        if (lead) { parts.push(lead, dateP, [endDot(title), true], [' ', false]); } else { parts.push([endDot(title), true], [' ', false], dateP); }
        if (d.site && !(authors.length === 1 && authors[0].org && authors[0].org === d.site)) parts.push([endDot(d.site) + ' ', false]);
        if (d.accessed) {
          var ac = parseDate(d.accessed);
          if (ac) parts.push(['Retrieved ' + MONTHS[ac.getUTCMonth()] + ' ' + ac.getUTCDate() + ', ' + ac.getUTCFullYear() + ', from ', false]);
        }
        parts.push([d.url, false]);
      } else {
        if (lead) { parts.push(lead, dateP, [endDot(title) + ' ', false]); } else { parts.push([endDot(title) + ' ', false], dateP); }
        parts.push([d.journal, true]);
        if (d.volume) { parts.push([', ', false], [d.volume, true]); }
        if (d.issue) parts.push(['(' + d.issue + ')', false]);
        if (d.pages) parts.push([', ' + pagesApa(d.pages), false]);
        parts.push(['. ', false]);
        if (d.doi) parts.push([doiUrl(d.doi), false]);
        else if (d.url) parts.push([d.url, false]);
      }
    } else {
      var a = mlaAuthors(authors);
      if (a) parts.push([endDot(a) + ' ', false]);
      if (type === 'book') {
        parts.push([endDot(title), true], [' ', false]);
        var e = ordinalEdition(d.edition || '');
        if (e) parts.push([(/^\d/.test(e) ? e + ' ed.' : e) + ', ', false]);
        parts.push([d.publisher + (d.year ? ', ' + d.year : '') + '.', false]);
        if (d.doi) parts.push([' ' + doiUrl(d.doi) + '.', false]);
      } else if (type === 'website') {
        parts.push(['\u201C' + endDot(title) + '\u201D ', false]);
        var bits = [];
        if (d.site) parts.push([d.site, true]);
        if (d.year) bits.push((day && month ? day + ' ' : '') + (month ? MLA_MONTHS[month - 1] + ' ' : '') + d.year);
        bits.push(mlaUrl(d.url));
        parts.push([(d.site ? ', ' : '') + bits.join(', ') + '.', false]);
        if (d.accessed) {
          var ad = parseDate(d.accessed);
          if (ad) parts.push([' Accessed ' + ad.getUTCDate() + ' ' + MLA_MONTHS[ad.getUTCMonth()] + ' ' + ad.getUTCFullYear() + '.', false]);
        }
      } else {
        parts.push(['\u201C' + endDot(title) + '\u201D ', false], [d.journal, true]);
        var jb = [];
        if (d.volume) jb.push('vol. ' + d.volume);
        if (d.issue) jb.push('no. ' + d.issue);
        if (d.year) jb.push(d.year);
        if (d.pages) jb.push((/[-–—,]/.test(d.pages) ? 'pp. ' : 'p. ') + pagesApa(d.pages));
        parts.push([(jb.length ? ', ' + jb.join(', ') : '') + '.', false]);
        if (d.doi) parts.push([' ' + doiUrl(d.doi) + '.', false]);
        else if (d.url) parts.push([' ' + mlaUrl(d.url) + '.', false]);
      }
    }
    var out = build(parts);
    out.ok = true;
    out.missing = [];
    return out;
  }

  // ---------------- Flashcards ----------------
  /** Validate and normalise decks loaded from storage or an import. Returns [] for anything unusable. */
  function normaliseDecks(value) {
    if (!Array.isArray(value)) return [];
    return value.filter(function (d) { return d && typeof d.name === 'string' && Array.isArray(d.cards); }).map(function (d) {
      return {
        id: String(d.id || ''),
        name: d.name.slice(0, 100),
        cards: d.cards.filter(function (c) { return c && typeof c.front === 'string' && typeof c.back === 'string'; }).map(function (c) {
          return { id: String(c.id || ''), front: c.front.slice(0, 2000), back: c.back.slice(0, 2000) };
        })
      };
    });
  }
  /** Fisher–Yates shuffle (returns a new array). rnd defaults to Math.random. */
  function shuffle(arr, rnd) {
    rnd = rnd || Math.random;
    var a = arr.slice();
    for (var i = a.length - 1; i > 0; i--) {
      var j = Math.floor(rnd() * (i + 1));
      var t = a[i]; a[i] = a[j]; a[j] = t;
    }
    return a;
  }


  // ---------------- Final grade ----------------
  /**
   * required final score = (target - current * (1 - w)) / w, where w is weight/100.
   * Rounds the required score UP to 2 decimal places so the result is always enough.
   * Returns { ok, status, required, bestPossible, message }.
   * status: 'ok' | 'safe' | 'unreachable' | 'invalid'
   */
  function requiredFinalScore(current, weightPercent, target) {
    if (current === null || weightPercent === null || target === null) {
      return { ok: false, status: 'invalid', required: null, bestPossible: null, message: '' };
    }
    if (isNaN(current) || isNaN(weightPercent) || isNaN(target)) {
      return { ok: false, status: 'invalid', required: null, bestPossible: null, message: 'Enter a number.' };
    }
    if (weightPercent <= 0 || weightPercent > 100) {
      return { ok: false, status: 'invalid', required: null, bestPossible: null, message: 'Final weight must be greater than 0 and at most 100.' };
    }
    var w = weightPercent / 100;
    var required = weightPercent === 100 ? target : (target - current * (1 - w)) / w;
    var bestPossible = current * (1 - w) + 100 * w;
    if (required <= 0) {
      return { ok: true, status: 'safe', required: 0, bestPossible: round(bestPossible, 2), message: 'You are already at or above the target, even with 0% on the final.' };
    }
    // Round UP to 2 dp so the shown score is always enough.
    var ceil2 = Math.ceil(required * 100 - 1e-9) / 100;
    if (ceil2 > 100) {
      return {
        ok: true,
        status: 'unreachable',
        required: ceil2,
        bestPossible: round(bestPossible, 2),
        message: 'The target is not reachable with a 100% final. Best possible course grade with a perfect final: ' + round(bestPossible, 2) + '%.'
      };
    }
    return { ok: true, status: 'ok', required: ceil2, bestPossible: round(bestPossible, 2), message: '' };
  }

  /** Predicted course grade after a final: current * (1 - w) + finalScore * w. */
  function courseGradeAfterFinal(current, weightPercent, finalScore) {
    if (current === null || weightPercent === null || finalScore === null) return null;
    if (isNaN(current) || isNaN(weightPercent) || isNaN(finalScore)) return null;
    if (!(weightPercent > 0) || weightPercent > 100) return null;
    var w = weightPercent / 100;
    return current * (1 - w) + finalScore * w;
  }

  // ---------------- Timer ----------------
  /** Seconds -> "MM:SS" (or "H:MM:SS" for an hour or more). */
  function formatClock(totalSeconds) {
    var s = Math.max(0, Math.ceil(totalSeconds));
    var h = Math.floor(s / 3600);
    var m = Math.floor((s % 3600) / 60);
    var sec = s % 60;
    var mm = (m < 10 ? '0' : '') + m;
    var ss = (sec < 10 ? '0' : '') + sec;
    return h ? h + ':' + mm + ':' + ss : mm + ':' + ss;
  }
  /** Which phase follows: after every `longEvery` focus sessions take a long break. */
  function nextPhase(phase, completedFocus, longEvery) {
    if (phase !== 'focus') return 'focus';
    return completedFocus > 0 && completedFocus % longEvery === 0 ? 'long' : 'short';
  }

  return {
    round: round,
    parseNum: parseNum,
    calcGpa: calcGpa,
    combineCgpa: combineCgpa,
    cgpaToPercent: cgpaToPercent,
    percentOf: percentOf,
    marksForPercent: marksForPercent,
    percentChange: percentChange,
    sumMarks: sumMarks,
    parseDate: parseDate,
    isoDate: isoDate,
    dateDiff: dateDiff,
    nextBirthday: nextBirthday,
    parseAuthors: parseAuthors,
    formatCitation: formatCitation,
    normaliseDecks: normaliseDecks,
    shuffle: shuffle,
    formatClock: formatClock,
    nextPhase: nextPhase,
    requiredFinalScore: requiredFinalScore,
    courseGradeAfterFinal: courseGradeAfterFinal
  };
});
