(function () {
  'use strict';
  var T = window.StudyKitText;
  var K = window.StudyKit;
  var DEFAULT_READ = 238;
  var DEFAULT_SPEAK = 140;
  var input = document.getElementById('rt-input');
  var readWpm = document.getElementById('rt-read-wpm');
  var speakWpm = document.getElementById('rt-speak-wpm');
  var readErr = document.getElementById('rt-read-error');
  var speakErr = document.getElementById('rt-speak-error');
  var status = document.getElementById('rt-status');
  var outWords = document.getElementById('rt-words');
  var outRead = document.getElementById('rt-reading');
  var outSpeak = document.getElementById('rt-speaking');

  function check(inputEl, errEl) {
    var v = T.validateWpm(inputEl.value);
    if (v.ok) {
      inputEl.removeAttribute('aria-invalid');
      errEl.textContent = '';
    } else {
      inputEl.setAttribute('aria-invalid', 'true');
      errEl.textContent = v.error;
    }
    return v;
  }

  function update() {
    var r = check(readWpm, readErr);
    var s = check(speakWpm, speakErr);
    var words = T.countWords(input.value);
    outWords.textContent = K.formatNumber(words);
    outRead.textContent = r.ok ? T.formatDuration(T.timeForWords(words, r.value)) : '—';
    outSpeak.textContent = s.ok ? T.formatDuration(T.timeForWords(words, s.value)) : '—';
  }
  // Short texts update on every keystroke; long texts wait until typing pauses.
  var slowUpdate = K.debounce(update, 250);
  var verySlowUpdate = K.debounce(update, 800);
  input.addEventListener('input', function () {
    var n = input.value.length;
    if (n > 300000) verySlowUpdate(); else if (n > 50000) slowUpdate(); else update();
  });
  readWpm.addEventListener('input', update);
  speakWpm.addEventListener('input', update);

  document.getElementById('rt-clear').addEventListener('click', function () {
    if (!input.value) { K.announce(status, 'The text box is already empty.', 'info'); input.focus(); return; }
    input.value = '';
    update();
    input.focus();
    K.announce(status, 'Text cleared.', 'ok');
  });
  document.getElementById('rt-reset').addEventListener('click', function () {
    readWpm.value = DEFAULT_READ;
    speakWpm.value = DEFAULT_SPEAK;
    update();
    K.announce(status, 'Speeds reset to ' + DEFAULT_READ + ' words per minute for reading and ' + DEFAULT_SPEAK + ' for speaking.', 'ok');
  });
  document.getElementById('rt-copy').addEventListener('click', function () {
    var r = T.validateWpm(readWpm.value);
    var s = T.validateWpm(speakWpm.value);
    if (!r.ok || !s.ok) { K.announce(status, 'Fix the speed values first, then copy.', 'error'); (r.ok ? speakWpm : readWpm).focus(); return; }
    var words = T.countWords(input.value);
    if (!words) { K.announce(status, 'Add some text first. There are no words to time yet.', 'error'); input.focus(); return; }
    var summary = words + ' words. Reading time: ' + T.formatDuration(T.timeForWords(words, r.value)) +
      ' at ' + r.value + ' wpm. Speaking time: ' + T.formatDuration(T.timeForWords(words, s.value)) + ' at ' + s.value + ' wpm.';
    K.copyText(summary).then(function (ok) {
      K.announce(status, ok ? 'Copied: ' + summary : 'Your browser blocked copying. Please copy the results manually.', ok ? 'ok' : 'error');
    });
  });
  update();
})();
