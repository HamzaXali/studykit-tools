(function () {
  'use strict';
  var T = window.StudyKitText;
  var K = window.StudyKit;
  var input = document.getElementById('dl-input');
  var output = document.getElementById('dl-output');
  var status = document.getElementById('dl-status');
  var opts = {
    caseInsensitive: document.getElementById('dl-case'),
    trim: document.getElementById('dl-trim'),
    ignoreEmpty: document.getElementById('dl-ignore-empty'),
    removeEmpty: document.getElementById('dl-remove-empty')
  };
  var defaults = { caseInsensitive: false, trim: true, ignoreEmpty: true, removeEmpty: false };

  function plural(n, word) { return K.formatNumber(n) + ' ' + word + (n === 1 ? '' : 's'); }

  document.getElementById('dl-run').addEventListener('click', function () {
    if (!input.value.trim()) {
      output.value = '';
      K.announce(status, 'Paste some lines into the input box first.', 'error');
      input.focus();
      return;
    }
    var r = T.removeDuplicateLines(input.value, {
      caseInsensitive: opts.caseInsensitive.checked,
      trim: opts.trim.checked,
      ignoreEmpty: opts.ignoreEmpty.checked,
      removeEmpty: opts.removeEmpty.checked
    });
    output.value = r.text;
    var msg = r.removed === 0
      ? 'No duplicate lines found. ' + plural(r.kept, 'line') + ' kept.'
      : 'Removed ' + plural(r.removed, 'duplicate line') + '. ' + plural(r.kept, 'line') + ' kept out of ' + K.formatNumber(r.total) + '.';
    if (r.emptyRemoved) msg += ' Also removed ' + plural(r.emptyRemoved, 'empty line') + '.';
    K.announce(status, msg, 'ok');
  });
  K.bindCopy(document.getElementById('dl-copy'), output, status, 'The result box');
  document.getElementById('dl-clear').addEventListener('click', function () {
    input.value = '';
    output.value = '';
    input.focus();
    K.announce(status, 'Input and result cleared.', 'ok');
  });
  document.getElementById('dl-reset').addEventListener('click', function () {
    Object.keys(defaults).forEach(function (k) { opts[k].checked = defaults[k]; });
    K.announce(status, 'Options reset to their defaults.', 'ok');
  });
})();
