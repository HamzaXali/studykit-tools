(function () {
  'use strict';
  var T = window.StudyKitText;
  var K = window.StudyKit;
  var $ = function (id) { return document.getElementById(id); };
  var input = $('ws-input');
  var output = $('ws-output');
  var status = $('ws-status');
  var checks = ['trim-lines', 'collapse', 'odd-spaces', 'zero-width', 'joiners', 'tabs', 'trim-text'];
  var defaults = { 'trim-lines': true, collapse: true, 'odd-spaces': true, 'zero-width': true, joiners: false, tabs: false, 'trim-text': true, blank: 'collapse', 'tab-width': '4' };

  function plural(n, word) { return K.formatNumber(n) + ' ' + word + (n === 1 ? '' : 's'); }

  $('ws-run').addEventListener('click', function () {
    if (!input.value) {
      output.value = '';
      K.announce(status, 'Paste some text into the input box first.', 'error');
      input.focus();
      return;
    }
    var r = T.cleanWhitespace(input.value, {
      trimLines: $('ws-trim-lines').checked,
      collapseSpaces: $('ws-collapse').checked,
      oddSpaces: $('ws-odd-spaces').checked,
      zeroWidth: $('ws-zero-width').checked,
      joiners: $('ws-joiners').checked,
      tabs: $('ws-tabs').checked ? 'spaces' : 'keep',
      tabWidth: $('ws-tab-width').value,
      blankLines: $('ws-blank').value,
      trimText: $('ws-trim-text').checked
    });
    output.value = r.text;
    if (!r.report.changed) { K.announce(status, 'Already clean. No whitespace changes were needed.', 'ok'); return; }
    var parts = [];
    if (r.report.oddSpaces) parts.push(plural(r.report.oddSpaces, 'unusual space') + ' replaced');
    if (r.report.zeroWidth) parts.push(plural(r.report.zeroWidth, 'invisible character') + ' removed');
    if (r.report.joiners) parts.push(plural(r.report.joiners, 'joiner') + ' removed');
    if (r.report.tabs) parts.push(plural(r.report.tabs, 'tab') + ' converted');
    if (r.report.blankLinesRemoved) parts.push(plural(r.report.blankLinesRemoved, 'blank line') + ' removed');
    K.announce(status, 'Cleaned. ' + (parts.length ? parts.join(', ') + '.' : 'Extra spaces removed.'), 'ok');
  });
  K.bindCopy($('ws-copy'), output, status, 'The result box');
  $('ws-clear').addEventListener('click', function () {
    input.value = '';
    output.value = '';
    input.focus();
    K.announce(status, 'Input and result cleared.', 'ok');
  });
  $('ws-reset').addEventListener('click', function () {
    checks.forEach(function (c) { $('ws-' + c).checked = defaults[c]; });
    $('ws-blank').value = defaults.blank;
    $('ws-tab-width').value = defaults['tab-width'];
    K.announce(status, 'Options reset to their defaults.', 'ok');
  });
})();
