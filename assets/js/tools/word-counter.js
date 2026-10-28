(function () {
  'use strict';
  var T = window.StudyKitText;
  var K = window.StudyKit;
  var DRAFT_KEY = 'studykit.wordCounter.draft.v1';
  var input = document.getElementById('wc-input');
  var status = document.getElementById('wc-status');
  var fields = ['characters', 'charactersNoSpaces', 'words', 'sentences', 'paragraphs', 'lines'];
  var out = {};
  fields.forEach(function (f) { out[f] = document.getElementById('wc-' + f); });

  var kdList = document.getElementById('wc-keyword-list');
  var kdEmpty = document.getElementById('wc-keyword-empty');
  var kdToggle = document.getElementById('wc-filter-stopwords');
  var freEl = document.getElementById('wc-flesch-ease');
  var fkgEl = document.getElementById('wc-flesch-grade');
  var rlNote = document.getElementById('wc-reading-note');
  var draftNote = document.getElementById('wc-draft-note');
  var clearDraftBtn = document.getElementById('wc-clear-draft');
  var storageOk = true;
  var suppressSave = false;

  function formatDensity(n) {
    return (Math.round(n * 10) / 10).toFixed(1) + '%';
  }

  function updateKeywords(text) {
    var result = T.keywordDensity(text, { filterStopwords: !!(kdToggle && kdToggle.checked), limit: 10 });
    while (kdList.firstChild) kdList.removeChild(kdList.firstChild);
    if (!result.items.length) {
      kdEmpty.hidden = false;
      kdList.hidden = true;
      return;
    }
    kdEmpty.hidden = true;
    kdList.hidden = false;
    result.items.forEach(function (item) {
      var li = document.createElement('li');
      var word = document.createElement('span');
      word.className = 'wc-kw-word';
      word.textContent = item.word;
      var meta = document.createElement('span');
      meta.className = 'wc-kw-meta';
      meta.textContent = item.count + ' × · ' + formatDensity(item.density);
      li.appendChild(word);
      li.appendChild(meta);
      kdList.appendChild(li);
    });
  }

  function updateReadingLevel(text) {
    var rl = T.readingLevel(text);
    if (!rl.available) {
      freEl.textContent = '—';
      fkgEl.textContent = '—';
      rlNote.textContent = rl.note;
      return;
    }
    freEl.textContent = String(rl.fleschReadingEase);
    fkgEl.textContent = String(rl.fleschKincaidGrade);
    rlNote.textContent = rl.note;
  }

  function updateDraftNote(saved) {
    if (!draftNote) return;
    if (!storageOk) {
      draftNote.textContent = 'Draft auto-save is unavailable in this browser (storage blocked).';
      return;
    }
    if (saved) {
      draftNote.textContent = 'Draft saved on this device only. It is not uploaded.';
    } else if (input.value) {
      draftNote.textContent = 'Draft will save on this device as you type.';
    } else {
      draftNote.textContent = 'No draft saved on this device.';
    }
  }

  function saveDraft() {
    if (suppressSave || !storageOk) return;
    try {
      if (!input.value) {
        window.localStorage.removeItem(DRAFT_KEY);
        updateDraftNote(false);
        return;
      }
      window.localStorage.setItem(DRAFT_KEY, JSON.stringify({ text: input.value, savedAt: Date.now() }));
      updateDraftNote(true);
    } catch (e) {
      storageOk = false;
      updateDraftNote(false);
    }
  }

  function loadDraft() {
    try {
      var raw = window.localStorage.getItem(DRAFT_KEY);
      if (!raw) { updateDraftNote(false); return; }
      var data = JSON.parse(raw);
      if (!data || typeof data.text !== 'string' || !data.text) { updateDraftNote(false); return; }
      suppressSave = true;
      input.value = data.text;
      suppressSave = false;
      updateDraftNote(true);
      K.announce(status, 'Restored a draft saved on this device.', 'info');
    } catch (e) {
      updateDraftNote(false);
    }
  }

  function clearDraft() {
    try { window.localStorage.removeItem(DRAFT_KEY); } catch (e) { /* ignore */ }
    suppressSave = true;
    input.value = '';
    suppressSave = false;
    update();
    updateDraftNote(false);
    input.focus();
    K.announce(status, 'Draft cleared from this device. Counts are back to zero.', 'ok');
  }

  function update() {
    var text = input.value;
    var stats = T.getTextStats(text);
    fields.forEach(function (f) { out[f].textContent = K.formatNumber(stats[f]); });
    updateKeywords(text);
    updateReadingLevel(text);
    saveDraft();
  }

  // Short texts update on every keystroke; long texts wait until typing pauses.
  var slowUpdate = K.debounce(update, 250);
  var verySlowUpdate = K.debounce(update, 800);
  input.addEventListener('input', function () {
    var n = input.value.length;
    if (n > 300000) verySlowUpdate(); else if (n > 50000) slowUpdate(); else update();
  });
  if (kdToggle) kdToggle.addEventListener('change', function () { updateKeywords(input.value); });
  K.bindCopy(document.getElementById('wc-copy'), input, status, 'The text box');
  document.getElementById('wc-clear').addEventListener('click', function () {
    if (!input.value) { K.announce(status, 'The text box is already empty.', 'info'); input.focus(); return; }
    suppressSave = true;
    input.value = '';
    suppressSave = false;
    try { window.localStorage.removeItem(DRAFT_KEY); } catch (e) { /* ignore */ }
    update();
    updateDraftNote(false);
    input.focus();
    K.announce(status, 'Text cleared. All counts are back to zero.', 'ok');
  });
  if (clearDraftBtn) clearDraftBtn.addEventListener('click', clearDraft);

  try {
    window.localStorage.setItem(DRAFT_KEY + '.test', '1');
    window.localStorage.removeItem(DRAFT_KEY + '.test');
  } catch (e) { storageOk = false; }

  loadDraft();
  update();
})();
