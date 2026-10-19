(function () {
  'use strict';
  var T = window.StudyKitText;
  var K = window.StudyKit;
  var input = document.getElementById('wc-input');
  var status = document.getElementById('wc-status');
  var fields = ['characters', 'charactersNoSpaces', 'words', 'sentences', 'paragraphs', 'lines'];
  var out = {};
  fields.forEach(function (f) { out[f] = document.getElementById('wc-' + f); });

  function update() {
    var stats = T.getTextStats(input.value);
    fields.forEach(function (f) { out[f].textContent = K.formatNumber(stats[f]); });
  }
  // Short texts update on every keystroke; long texts wait until typing pauses.
  var slowUpdate = K.debounce(update, 250);
  var verySlowUpdate = K.debounce(update, 800);
  input.addEventListener('input', function () {
    var n = input.value.length;
    if (n > 300000) verySlowUpdate(); else if (n > 50000) slowUpdate(); else update();
  });
  K.bindCopy(document.getElementById('wc-copy'), input, status, 'The text box');
  document.getElementById('wc-clear').addEventListener('click', function () {
    if (!input.value) { K.announce(status, 'The text box is already empty.', 'info'); input.focus(); return; }
    input.value = '';
    update();
    input.focus();
    K.announce(status, 'Text cleared. All counts are back to zero.', 'ok');
  });
  update();
})();
