/*!
 * StudyKit Tools — shared text utilities.
 * Pure functions with no DOM access, so they run in the browser
 * (window.StudyKitText) and in Node (require) for the unit tests.
 * Nothing here sends data anywhere.
 */
(function (root, factory) {
  'use strict';
  if (typeof module === 'object' && module.exports) {
    module.exports = factory();
  } else {
    root.StudyKitText = factory();
  }
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  var HAS_SEGMENTER = typeof Intl !== 'undefined' && typeof Intl.Segmenter === 'function';
  var segCache = {};

  function getSegmenter(granularity, forceFallback) {
    if (forceFallback || !HAS_SEGMENTER) return null;
    if (!segCache[granularity]) {
      try {
        segCache[granularity] = new Intl.Segmenter(undefined, { granularity: granularity });
      } catch (e) {
        return null;
      }
    }
    return segCache[granularity];
  }

  function toStr(text) {
    if (text === null || text === undefined) return '';
    return String(text);
  }

  /** Normalise CRLF / CR line endings to LF. */
  function normalizeNewlines(text) {
    return toStr(text).replace(/\r\n?/g, '\n');
  }

  function splitLines(text) {
    return normalizeNewlines(text).split('\n');
  }

  var WHITESPACE_RE = /^\s+$/u;
  var LETTER_OR_NUMBER_RE = /[\p{L}\p{N}]/u;
  // Fallback word pattern: letters/numbers/marks, allowing internal apostrophes and hyphens.
  var FALLBACK_WORD_RE = /[\p{L}\p{N}][\p{L}\p{N}\p{M}]*(?:['\u2019\-\u2010.][\p{L}\p{N}][\p{L}\p{N}\p{M}]*)*/gu;
  var CJK_CHAR_RE = /[\p{Script=Han}\p{Script=Hiragana}\p{Script=Katakana}]/gu;
  // Sentence terminators: Latin, CJK full stops, Arabic question mark, Urdu full stop, Devanagari danda.
  var FALLBACK_SENTENCE_RE = /[^.!?\u3002\uFF01\uFF1F\u061F\u06D4\u0964]+(?:[.!?\u3002\uFF01\uFF1F\u061F\u06D4\u0964]+|$)/gu;

  // V8's Intl.Segmenter iterator gets quadratically slower on long strings (100 KB can take
  // seconds), so long text is segmented in pieces that are cut only where a boundary is
  // guaranteed: after a line break, or (for graphemes and words) after a space that is not
  // followed by a combining mark, or (for sentences) after sentence punctuation + space
  // followed by a capital letter, digit or uncased letter.
  var CHUNK = 1000;
  var EXTEND_RE = /[\p{M}\u200C\u200D\uFE00-\uFE0F]/u;
  var SENT_END_RE = /[.!?\u3002\uFF01\uFF1F\u061F\u06D4\u0964]/u;
  var SENT_START_RE = /[\p{Lu}\p{Lt}\p{Lo}\p{N}]/u;

  var CJK_PUNCT_RE = /[\u3001\u3002\uFF0C\uFF01\uFF1F\uFF1B\uFF1A]/u;
  var CJK_SENT_END_RE = /[\u3002\uFF01\uFF1F]/u;

  function cpAt(s, p) { return String.fromCodePoint(s.codePointAt(p)); }

  function isSafeCut(s, p, granularity) {
    var prev = s.charAt(p - 1);
    if (prev === '\n') return true;
    if (prev === '\r') return s.charAt(p) !== '\n';
    var next = cpAt(s, p);
    if (granularity === 'sentence') {
      if (CJK_SENT_END_RE.test(prev)) return SENT_START_RE.test(next);
      if (prev !== ' ' || !SENT_END_RE.test(s.charAt(p - 2))) return false;
      // After a full stop, Unicode rule SB8 keeps going if a lowercase letter follows later
      // (e.g. ". 3 apples"), so only cut before an uppercase or uncased letter there.
      return s.charAt(p - 2) === '.' ? /[\p{Lu}\p{Lt}\p{Lo}]/u.test(next) : SENT_START_RE.test(next);
    }
    return (prev === ' ' || CJK_PUNCT_RE.test(prev)) && !EXTEND_RE.test(next);
  }

  // Last resort for very long runs with no safe boundary (e.g. one huge word): cut between two
  // ordinary code points. Can shift a count by one at that cut, which is acceptable for such input.
  function isForcedCut(s, p) {
    var c = s.charCodeAt(p);
    if (c >= 0xDC00 && c <= 0xDFFF) return false;
    var next = s.codePointAt(p);
    if (next >= 0x1F1E6 && next <= 0x1F1FF) return false;
    if (next >= 0x1F3FB && next <= 0x1F3FF) return false;
    return !EXTEND_RE.test(cpAt(s, p)) && s.charAt(p - 1) !== '\u200D';
  }

  function chunkText(s, granularity) {
    if (s.length <= CHUNK) return [s];
    var out = [];
    var forcedAfter = [];
    var forced = false;
    var start = 0;
    var len = s.length;
    while (start < len) {
      if (len - start <= CHUNK) { out.push(s.slice(start)); break; }
      var cut = -1;
      var p;
      forced = false;
      for (p = start + CHUNK; p > start + (CHUNK >> 1); p--) {
        if (isSafeCut(s, p, granularity)) { cut = p; break; }
      }
      if (cut === -1) {
        var limit = Math.min(len, start + CHUNK * 2);
        for (p = start + CHUNK + 1; p < limit; p++) {
          if (isSafeCut(s, p, granularity)) { cut = p; break; }
        }
        for (p = limit; cut === -1 && p < len && p < limit + 64; p++) {
          if (isForcedCut(s, p)) cut = p;
        }
        forced = cut !== -1;
      }
      if (cut === -1) { out.push(s.slice(start)); break; }
      out.push(s.slice(start, cut));
      forcedAfter[out.length] = forced;
      start = cut;
    }
    out.forced = forcedAfter;
    return out;
  }

  /**
   * Iterate segments of s for a granularity, chunking long input. fn(part, continues) gets
   * continues = true for the first segment after a forced cut, which may be the second half
   * of the previous chunk's last segment.
   */
  function eachSegment(seg, s, granularity, fn) {
    var chunks = s.length <= CHUNK ? [s] : chunkText(s, granularity);
    var forced = chunks.forced || [];
    for (var c = 0; c < chunks.length; c++) {
      var first = true;
      for (var part of seg.segment(chunks[c])) {
        fn(part, first && !!forced[c]);
        first = false;
      }
    }
  }

  /** Count user-perceived characters (grapheme clusters). Emoji and accented letters count once. */
  function countGraphemes(text, opts) {
    var s = toStr(text);
    if (!s) return 0;
    var seg = getSegmenter('grapheme', opts && opts.forceFallback);
    if (seg) {
      var n = 0;
      eachSegment(seg, s, 'grapheme', function () { n++; });
      return n;
    }
    // Fallback approximation: count code points, but attach combining marks, variation selectors,
    // emoji skin-tone modifiers, ZWJ sequences and regional-indicator (flag) pairs to the previous character.
    var count = 0;
    var joinNext = false;
    var pendingFlag = false;
    var s2 = s.replace(/\r\n/g, '\n');
    for (var ch of s2) {
      var cp = ch.codePointAt(0);
      var attaches = /\p{M}/u.test(ch) || (cp >= 0xFE00 && cp <= 0xFE0F) || (cp >= 0x1F3FB && cp <= 0x1F3FF) || (cp >= 0xE0020 && cp <= 0xE007F);
      if (cp === 0x200D) { joinNext = true; continue; }
      if (cp >= 0x1F1E6 && cp <= 0x1F1FF) {
        if (pendingFlag) { pendingFlag = false; continue; }
        pendingFlag = true;
      } else {
        pendingFlag = false;
      }
      if ((attaches || joinNext) && count > 0) { joinNext = false; continue; }
      joinNext = false;
      count++;
    }
    return count;
  }

  /** Count graphemes that are not whitespace. */
  function countGraphemesNoSpaces(text, opts) {
    var s = toStr(text);
    if (!s) return 0;
    var seg = getSegmenter('grapheme', opts && opts.forceFallback);
    if (seg) {
      var n = 0;
      eachSegment(seg, s, 'grapheme', function (part) { if (!WHITESPACE_RE.test(part.segment)) n++; });
      return n;
    }
    return countGraphemes(s.replace(/\s+/gu, ''), opts);
  }

  /** Count words. Uses Intl.Segmenter (handles CJK, Thai, etc.) with a regex fallback. */
  function countWords(text, opts) {
    var s = toStr(text);
    if (!s.trim()) return 0;
    var seg = getSegmenter('word', opts && opts.forceFallback);
    if (seg) {
      var n = 0;
      var lastWord = false;
      eachSegment(seg, s, 'word', function (part, continues) {
        if (part.isWordLike && !(continues && lastWord)) n++;
        lastWord = part.isWordLike;
      });
      return n;
    }
    // Fallback: scripts written without spaces (Chinese, Japanese) count one word per character,
    // which is the usual convention for those languages; other scripts use the word pattern.
    var cjk = s.match(CJK_CHAR_RE);
    var rest = s.replace(CJK_CHAR_RE, ' ').match(FALLBACK_WORD_RE);
    return (cjk ? cjk.length : 0) + (rest ? rest.length : 0);
  }

  /** Count sentences: segments that contain at least one letter or number. */
  function countSentences(text, opts) {
    var s = toStr(text);
    if (!s.trim()) return 0;
    var seg = getSegmenter('sentence', opts && opts.forceFallback);
    var n = 0;
    if (seg) {
      var lastCounted = false;
      eachSegment(seg, s, 'sentence', function (part, continues) {
        var has = LETTER_OR_NUMBER_RE.test(part.segment);
        if (has && !(continues && lastCounted)) n++;
        lastCounted = has || (continues && lastCounted);
      });
      return n;
    }
    var m = s.match(FALLBACK_SENTENCE_RE) || [];
    for (var i = 0; i < m.length; i++) if (LETTER_OR_NUMBER_RE.test(m[i])) n++;
    return n;
  }

  /** Paragraphs are blocks of non-blank text separated by one or more blank lines. */
  function countParagraphs(text) {
    var s = normalizeNewlines(text);
    if (!s.trim()) return 0;
    return s.split(/\n[ \t\u00A0\u3000]*\n/u).filter(function (p) { return p.trim() !== ''; }).length;
  }

  /**
   * Count lines. Empty text has 0 lines. A single trailing line break does not
   * start a new line (matches how most editors number lines of saved files).
   */
  function countLines(text) {
    var s = normalizeNewlines(text);
    if (s === '') return 0;
    var n = s.split('\n').length;
    if (s.charAt(s.length - 1) === '\n') n--;
    return Math.max(n, 1);
  }

  function getTextStats(text, opts) {
    var s = toStr(text);
    return {
      characters: countGraphemes(s, opts),
      charactersNoSpaces: countGraphemesNoSpaces(s, opts),
      words: countWords(s, opts),
      sentences: countSentences(s, opts),
      paragraphs: countParagraphs(s),
      lines: countLines(s)
    };
  }

  // ---------- Reading time ----------

  var WPM_MIN = 50;
  var WPM_MAX = 1000;

  /** Validate a words-per-minute value. Returns { ok, value, error }. */
  function validateWpm(value) {
    var str = toStr(value).trim();
    if (str === '') return { ok: false, error: 'Enter a speed in words per minute.' };
    if (!/^\d+(\.\d+)?$/.test(str)) return { ok: false, error: 'Speed must be a positive number, for example 238.' };
    var n = Number(str);
    if (n < WPM_MIN || n > WPM_MAX) {
      return { ok: false, error: 'Speed must be between ' + WPM_MIN + ' and ' + WPM_MAX + ' words per minute.' };
    }
    return { ok: true, value: n };
  }

  /** Seconds needed for a word count at a speed; rounds up to whole seconds. */
  function timeForWords(words, wpm) {
    if (!(wpm > 0)) throw new RangeError('wpm must be greater than 0');
    var w = Math.max(0, Math.floor(Number(words) || 0));
    if (w === 0) return 0;
    return Math.ceil((w / wpm) * 60);
  }

  /** Format seconds as "1 hr 2 min 3 sec", omitting zero parts. */
  function formatDuration(totalSeconds) {
    var s = Math.max(0, Math.round(Number(totalSeconds) || 0));
    if (s === 0) return '0 sec';
    var h = Math.floor(s / 3600);
    var m = Math.floor((s % 3600) / 60);
    var sec = s % 60;
    var parts = [];
    if (h) parts.push(h + ' hr');
    if (m) parts.push(m + ' min');
    if (sec) parts.push(sec + ' sec');
    return parts.join(' ');
  }

  function readingTime(text, readWpm, speakWpm, opts) {
    var words = countWords(text, opts);
    var read = timeForWords(words, readWpm);
    var speak = timeForWords(words, speakWpm);
    return {
      words: words,
      readingSeconds: read,
      speakingSeconds: speak,
      reading: formatDuration(read),
      speaking: formatDuration(speak)
    };
  }

  // ---------- Case conversion ----------

  var SMALL_WORDS = ['a', 'an', 'and', 'as', 'at', 'but', 'by', 'for', 'in', 'nor', 'of', 'on', 'or', 'per', 'the', 'to', 'vs', 'via'];
  var WORD_RE = /[\p{L}\p{N}][\p{L}\p{N}\p{M}]*(?:['\u2019][\p{L}][\p{L}\p{M}]*)*/gu;

  function capitalizeFirst(word) {
    var chars = Array.from(word);
    if (!chars.length) return word;
    return chars[0].toUpperCase() + chars.slice(1).join('');
  }

  function toUpper(text) { return toStr(text).toUpperCase(); }
  function toLower(text) { return toStr(text).toLowerCase(); }

  function isAllCaps(word) {
    return /\p{Lu}/u.test(word) && !/\p{Ll}/u.test(word) && Array.from(word).length > 1;
  }

  /**
   * Title Case. Options:
   *  smallWords (default true): keep short English words like "of", "the" lowercase unless first/last in a line.
   *  keepAcronyms (default true): leave words already in ALL CAPS (NASA, UK) unchanged.
   */
  function toTitleCase(text, options) {
    var o = Object.assign({ smallWords: true, keepAcronyms: true }, options || {});
    return splitLines(text).map(function (line) {
      var matches = [];
      var m;
      WORD_RE.lastIndex = 0;
      while ((m = WORD_RE.exec(line)) !== null) matches.push({ word: m[0], index: m.index });
      if (!matches.length) return line;
      var out = '';
      var last = 0;
      matches.forEach(function (item, i) {
        var w = item.word;
        var lower = w.toLowerCase();
        var replacement;
        // Only look at the separator since the previous word (keeps this linear on huge lines).
        var gap = line.slice(last, item.index);
        var afterColon = i > 0 && /[:\u2014\u2013]|\s-\s/.test(gap);
        if (o.keepAcronyms && isAllCaps(w)) {
          replacement = w;
        } else if (o.smallWords && i > 0 && i < matches.length - 1 && !afterColon && SMALL_WORDS.indexOf(lower) !== -1) {
          replacement = lower;
        } else {
          replacement = capitalizeFirst(lower);
        }
        out += line.slice(last, item.index) + replacement;
        last = item.index + w.length;
      });
      return out + line.slice(last);
    }).join('\n');
  }

  /** Sentence case: lowercase everything, then capitalise the first letter of each sentence and line. */
  function toSentenceCase(text) {
    var s = toStr(text).toLowerCase();
    var capNext = true;
    var out = '';
    for (var ch of s) {
      if (capNext && /[\p{L}\p{N}]/u.test(ch)) {
        out += ch.toUpperCase();
        capNext = false;
      } else {
        out += ch;
        if (/[.!?\u3002\uFF01\uFF1F\u061F\u06D4\n]/u.test(ch)) capNext = true;
      }
    }
    return out;
  }

  function convertCase(text, mode, options) {
    switch (mode) {
      case 'upper': return toUpper(text);
      case 'lower': return toLower(text);
      case 'title': return toTitleCase(text, options);
      case 'sentence': return toSentenceCase(text);
      default: throw new Error('Unknown case mode: ' + mode);
    }
  }

  // ---------- Duplicate lines ----------

  /**
   * Remove duplicate lines, keeping the first occurrence and original order.
   * Options: caseInsensitive, trim (compare trimmed lines; output is trimmed too),
   * ignoreEmpty (never treat blank lines as duplicates), removeEmpty (drop blank lines).
   * Lines are compared after Unicode NFC normalisation, so "é" typed two ways matches.
   */
  function removeDuplicateLines(text, options) {
    var o = Object.assign({ caseInsensitive: false, trim: false, ignoreEmpty: true, removeEmpty: false }, options || {});
    var s = toStr(text);
    if (s === '') return { text: '', removed: 0, kept: 0, total: 0, emptyRemoved: 0 };
    var lines = splitLines(s);
    var trailingNewline = lines.length > 1 && lines[lines.length - 1] === '';
    if (trailingNewline) lines.pop();
    var seen = new Set();
    var out = [];
    var removed = 0;
    var emptyRemoved = 0;
    for (var i = 0; i < lines.length; i++) {
      var line = o.trim ? lines[i].trim() : lines[i];
      var blank = line.trim() === '';
      if (blank && o.removeEmpty) { emptyRemoved++; continue; }
      if (blank && o.ignoreEmpty) { out.push(line); continue; }
      var key = line.normalize('NFC');
      if (o.caseInsensitive) key = key.toLowerCase();
      if (seen.has(key)) { removed++; continue; }
      seen.add(key);
      out.push(line);
    }
    return {
      text: out.join('\n') + (trailingNewline && out.length ? '\n' : ''),
      removed: removed,
      emptyRemoved: emptyRemoved,
      kept: out.length,
      total: lines.length
    };
  }

  // ---------- Whitespace cleaning ----------

  // Unusual spaces converted to a normal space: NBSP, Ogham space, en/em spaces etc., narrow NBSP,
  // medium math space, ideographic space.
  var ODD_SPACES_RE = /[\u00A0\u1680\u2000-\u200A\u202F\u205F\u3000]/gu;
  // Invisible characters that are almost always junk: zero-width space, word joiner, BOM, soft hyphen.
  var ZERO_WIDTH_RE = /[\u200B\u2060\uFEFF\u00AD]/gu;
  // Joiners are meaningful in Urdu/Persian/Indic scripts and emoji sequences: only removed when asked.
  var JOINERS_RE = /[\u200C\u200D]/gu;

  function countMatches(s, re) {
    var m = s.match(re);
    return m ? m.length : 0;
  }

  /**
   * Clean whitespace. Options (defaults in brackets):
   *  oddSpaces [true]       convert non-breaking and other unusual spaces to normal spaces
   *  zeroWidth [true]       remove zero-width spaces, word joiners, BOMs and soft hyphens
   *  joiners [false]        also remove ZWJ/ZWNJ (can break Urdu, Persian, Hindi and emoji)
   *  tabs ['keep']          'keep' | 'spaces' (replace each tab with tabWidth spaces)
   *  tabWidth [4]
   *  collapseSpaces [true]  turn runs of spaces into one space (leading indentation kept unless trimmed)
   *  trimLines [true]       remove spaces at the start and end of each line
   *  blankLines ['collapse']'keep' | 'collapse' (max one blank line in a row) | 'remove'
   *  trimText [true]        remove blank lines at the very start and end
   */
  function cleanWhitespace(text, options) {
    var o = Object.assign({
      oddSpaces: true, zeroWidth: true, joiners: false, tabs: 'keep', tabWidth: 4,
      collapseSpaces: true, trimLines: true, blankLines: 'collapse', trimText: true
    }, options || {});
    var s = normalizeNewlines(text);
    var report = { oddSpaces: 0, zeroWidth: 0, joiners: 0, tabs: 0, blankLinesRemoved: 0 };
    if (o.zeroWidth) { report.zeroWidth = countMatches(s, ZERO_WIDTH_RE); s = s.replace(ZERO_WIDTH_RE, ''); }
    if (o.joiners) { report.joiners = countMatches(s, JOINERS_RE); s = s.replace(JOINERS_RE, ''); }
    if (o.oddSpaces) { report.oddSpaces = countMatches(s, ODD_SPACES_RE); s = s.replace(ODD_SPACES_RE, ' '); }
    if (o.tabs === 'spaces') {
      var width = Math.min(Math.max(parseInt(o.tabWidth, 10) || 4, 1), 16);
      report.tabs = countMatches(s, /\t/g);
      s = s.replace(/\t/g, ' '.repeat(width));
    }
    var lines = s.split('\n').map(function (line) {
      var l = line;
      if (o.trimLines) l = l.replace(/^[ \t]+|[ \t]+$/g, '');
      if (o.collapseSpaces) {
        var lead = (l.match(/^[ \t]*/) || [''])[0];
        var rest = l.slice(lead.length).replace(/ {2,}/g, ' ').replace(/[ \t]*\t[ \t]*/g, '\t');
        if (o.tabs === 'spaces') rest = rest.replace(/ {2,}/g, ' ');
        l = lead + rest;
      }
      return l;
    });
    var before = lines.length;
    if (o.blankLines === 'remove') {
      lines = lines.filter(function (l) { return l.trim() !== ''; });
    } else if (o.blankLines === 'collapse') {
      lines = lines.filter(function (l, i, arr) {
        return !(l.trim() === '' && i > 0 && arr[i - 1].trim() === '');
      });
    }
    if (o.trimText) {
      while (lines.length && lines[0].trim() === '') lines.shift();
      while (lines.length && lines[lines.length - 1].trim() === '') lines.pop();
    }
    report.blankLinesRemoved = before - lines.length;
    var result = lines.join('\n');
    report.changed = result !== normalizeNewlines(text);
    return { text: result, report: report };
  }

  // ---------- Study notes ----------

  var NOTES_SCHEMA = 'studykit-notes';
  var MAX_TITLE = 200;
  var MAX_BODY = 100000;
  var MAX_TAGS = 20;
  var MAX_TAG_LEN = 40;

  /** Parse "Biology, exam prep , #week-1" into ["biology", "exam prep", "week-1"] (deduplicated). */
  function parseTags(input) {
    var seen = new Set();
    var tags = [];
    toStr(input).split(/[,\n\u060C\u3001]/u).forEach(function (raw) {
      var t = raw.trim().replace(/^#+/, '').replace(/\s+/g, ' ').toLowerCase().slice(0, MAX_TAG_LEN).trim();
      if (t && !seen.has(t) && tags.length < MAX_TAGS) { seen.add(t); tags.push(t); }
    });
    return tags;
  }

  function makeId() {
    return 'n-' + Date.now().toString(36) + '-' + Math.random().toString(36).slice(2, 10);
  }

  /** Validate note fields from the form. Returns { ok, errors[], note }. */
  function validateNoteInput(title, body, tagsInput) {
    var t = toStr(title).trim();
    var b = toStr(body);
    var errors = [];
    if (!t && !b.trim()) errors.push('Add a title or some note text before saving.');
    if (Array.from(t).length > MAX_TITLE) errors.push('Title is too long (maximum ' + MAX_TITLE + ' characters).');
    if (b.length > MAX_BODY) errors.push('Note text is too long (maximum ' + MAX_BODY.toLocaleString('en') + ' characters).');
    return { ok: errors.length === 0, errors: errors, fields: { title: t, body: b, tags: parseTags(tagsInput) } };
  }

  function createNote(fields, now) {
    var ts = now || new Date().toISOString();
    return { id: makeId(), title: fields.title, body: fields.body, tags: fields.tags.slice(), created: ts, updated: ts };
  }

  function updateNote(note, fields, now) {
    return Object.assign({}, note, { title: fields.title, body: fields.body, tags: fields.tags.slice(), updated: now || new Date().toISOString() });
  }

  function foldForSearch(s) {
    return toStr(s).normalize('NFKD').replace(/\p{M}/gu, '').toLowerCase();
  }

  /** Filter notes by free-text query (title, body, tags; accent-insensitive) and an optional tag. Newest first. */
  function filterNotes(notes, query, tag) {
    var q = foldForSearch(query).trim();
    var terms = q ? q.split(/\s+/) : [];
    return (notes || []).filter(function (n) {
      if (tag && (n.tags || []).indexOf(tag) === -1) return false;
      if (!terms.length) return true;
      var hay = foldForSearch(n.title + '\n' + n.body + '\n' + (n.tags || []).join(' '));
      return terms.every(function (t) { return hay.indexOf(t) !== -1; });
    }).sort(function (a, b) { return a.updated < b.updated ? 1 : a.updated > b.updated ? -1 : 0; });
  }

  function allTags(notes) {
    var set = new Set();
    (notes || []).forEach(function (n) { (n.tags || []).forEach(function (t) { set.add(t); }); });
    return Array.from(set).sort(function (a, b) { return a.localeCompare(b); });
  }

  function isIsoDate(s) {
    return typeof s === 'string' && !isNaN(Date.parse(s));
  }

  /**
   * Validate imported JSON text. Accepts this site's export format or a bare array of notes.
   * Returns { ok, notes, skipped, error }.
   */
  function parseNotesImport(jsonText) {
    var data;
    try {
      data = JSON.parse(toStr(jsonText));
    } catch (e) {
      return { ok: false, error: 'This file is not valid JSON, so nothing was imported.' };
    }
    var list = Array.isArray(data) ? data : (data && data.schema === NOTES_SCHEMA && Array.isArray(data.notes) ? data.notes : null);
    if (!list) return { ok: false, error: 'This file is not a StudyKit notes export, so nothing was imported.' };
    var notes = [];
    var skipped = 0;
    list.forEach(function (n) {
      if (!n || typeof n !== 'object' || (typeof n.title !== 'string' && typeof n.body !== 'string')) { skipped++; return; }
      var title = toStr(n.title).trim().slice(0, MAX_TITLE * 2);
      var body = toStr(n.body).slice(0, MAX_BODY);
      if (!title && !body.trim()) { skipped++; return; }
      var now = new Date().toISOString();
      notes.push({
        id: typeof n.id === 'string' && n.id.length <= 100 ? n.id : makeId(),
        title: title,
        body: body,
        tags: parseTags(Array.isArray(n.tags) ? n.tags.join(',') : toStr(n.tags)),
        created: isIsoDate(n.created) ? n.created : now,
        updated: isIsoDate(n.updated) ? n.updated : now
      });
    });
    return { ok: true, notes: notes, skipped: skipped };
  }

  /** Merge imported notes into existing ones. Same id: the more recently updated copy wins. */
  function mergeNotes(existing, incoming) {
    var map = new Map();
    var added = 0;
    var updated = 0;
    var unchanged = 0;
    (existing || []).forEach(function (n) { map.set(n.id, n); });
    (incoming || []).forEach(function (n) {
      var cur = map.get(n.id);
      if (!cur) { map.set(n.id, n); added++; }
      else if (n.updated > cur.updated) { map.set(n.id, n); updated++; }
      else unchanged++;
    });
    return { notes: Array.from(map.values()), added: added, updated: updated, unchanged: unchanged };
  }

  function notesToJson(notes, now) {
    return JSON.stringify({ schema: NOTES_SCHEMA, version: 1, exported: now || new Date().toISOString(), notes: notes || [] }, null, 2);
  }

  function notesToMarkdown(notes) {
    if (!notes || !notes.length) return '# Study notes\n\n_No notes._\n';
    return '# Study notes\n\n' + notes.map(function (n) {
      var head = '## ' + (n.title || 'Untitled note').replace(/\n/g, ' ');
      var meta = (n.tags && n.tags.length ? 'Tags: ' + n.tags.map(function (t) { return '`' + t + '`'; }).join(', ') + '  \n' : '') +
        'Updated: ' + n.updated;
      return head + '\n\n' + meta + '\n\n' + (n.body || '').trim() + '\n';
    }).join('\n---\n\n');
  }

  function notesToText(notes) {
    if (!notes || !notes.length) return 'STUDY NOTES\n\n(No notes.)\n';
    return 'STUDY NOTES\n\n' + notes.map(function (n) {
      var title = n.title || 'Untitled note';
      return title + '\n' + '='.repeat(Math.min(Array.from(title).length, 60)) + '\n' +
        (n.tags && n.tags.length ? 'Tags: ' + n.tags.join(', ') + '\n' : '') +
        'Updated: ' + n.updated + '\n\n' + (n.body || '').trim() + '\n';
    }).join('\n\n');
  }

  return {
    HAS_SEGMENTER: HAS_SEGMENTER,
    _chunkText: chunkText,
    normalizeNewlines: normalizeNewlines,
    countGraphemes: countGraphemes,
    countGraphemesNoSpaces: countGraphemesNoSpaces,
    countWords: countWords,
    countSentences: countSentences,
    countParagraphs: countParagraphs,
    countLines: countLines,
    getTextStats: getTextStats,
    WPM_MIN: WPM_MIN,
    WPM_MAX: WPM_MAX,
    validateWpm: validateWpm,
    timeForWords: timeForWords,
    formatDuration: formatDuration,
    readingTime: readingTime,
    toUpper: toUpper,
    toLower: toLower,
    toTitleCase: toTitleCase,
    toSentenceCase: toSentenceCase,
    convertCase: convertCase,
    removeDuplicateLines: removeDuplicateLines,
    cleanWhitespace: cleanWhitespace,
    parseTags: parseTags,
    validateNoteInput: validateNoteInput,
    createNote: createNote,
    updateNote: updateNote,
    filterNotes: filterNotes,
    allTags: allTags,
    parseNotesImport: parseNotesImport,
    mergeNotes: mergeNotes,
    notesToJson: notesToJson,
    notesToMarkdown: notesToMarkdown,
    notesToText: notesToText,
    NOTES_SCHEMA: NOTES_SCHEMA
  };
});
