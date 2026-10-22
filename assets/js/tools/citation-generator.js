(function () {
  'use strict';
  var S = window.StudyKitStudy;
  var K = window.StudyKit;
  var $ = function (id) { return document.getElementById(id); };
  var status = $('ct-status');
  var out = $('ct-output');
  var FIELDS = ['authors', 'title', 'year', 'month', 'day', 'edition', 'publisher', 'journal', 'volume', 'issue', 'pages', 'site', 'url', 'doi', 'accessed'];
  var NAMES = { title: 'the title', publisher: 'the publisher', url: 'the URL', journal: 'the journal name' };
  var current = null;

  function showFields() {
    var type = $('ct-type').value;
    Array.prototype.forEach.call(document.querySelectorAll('[data-for]'), function (el) {
      el.hidden = el.getAttribute('data-for').split(' ').indexOf(type) === -1;
    });
  }
  function data() {
    var d = {};
    FIELDS.forEach(function (f) {
      var el = $('ct-' + f);
      d[f] = el.closest('[data-for]') && el.closest('[data-for]').hidden ? '' : el.value;
    });
    return d;
  }
  function update() {
    showFields();
    var y = $('ct-year');
    var yv = S.parseNum(y.value);
    var yBad = yv !== null && (isNaN(yv) || yv < 1000 || yv > 2100 || yv !== Math.floor(yv));
    if (yBad) { y.setAttribute('aria-invalid', 'true'); $('ct-year-error').textContent = 'Enter a four-digit year, or leave it empty.'; }
    else { y.removeAttribute('aria-invalid'); $('ct-year-error').textContent = ''; }
    var d = data();
    if (yBad) d.year = '';
    var r = S.formatCitation($('ct-style').value, $('ct-type').value, d);
    current = r.ok ? r : null;
    if (r.ok) {
      out.innerHTML = r.html; // built from escaped text by StudyKitStudy.formatCitation
      out.classList.remove('is-empty');
    } else {
      out.textContent = 'Add ' + r.missing.map(function (m) { return NAMES[m] || m; }).join(' and ') + ' to see the citation.';
      out.classList.add('is-empty');
    }
  }

  document.querySelector('.tool').addEventListener('input', update);
  document.querySelector('.tool').addEventListener('change', update);

  $('ct-copy').addEventListener('click', function () {
    if (!current) { K.announce(status, 'Nothing to copy yet. ' + out.textContent, 'error'); $('ct-title').focus(); return; }
    var text = current.text;
    var html = current.html;
    var done = function (ok) { K.announce(status, ok ? 'Citation copied.' : 'Your browser blocked copying. Select the citation and copy it manually.', ok ? 'ok' : 'error'); };
    if (navigator.clipboard && window.ClipboardItem && window.isSecureContext) {
      try {
        var item = new window.ClipboardItem({ 'text/plain': new Blob([text], { type: 'text/plain' }), 'text/html': new Blob([html], { type: 'text/html' }) });
        navigator.clipboard.write([item]).then(function () { done(true); }, function () { K.copyText(text).then(done); });
        return;
      } catch (e) { /* fall back to plain text */ }
    }
    K.copyText(text).then(done);
  });
  $('ct-clear').addEventListener('click', function () {
    FIELDS.forEach(function (f) { $('ct-' + f).value = ''; });
    update();
    $('ct-authors').focus();
    K.announce(status, 'Form cleared.', 'ok');
  });
  update();
})();
