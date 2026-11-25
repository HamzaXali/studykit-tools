(function () {
  'use strict';
  var S = window.StudyKitStudy;
  var K = window.StudyKit;
  var $ = function (id) { return document.getElementById(id); };
  var status = $('ct-status');
  var out = $('ct-output');
  var FIELDS = ['authors', 'title', 'year', 'month', 'day', 'edition', 'place', 'publisher', 'journal', 'volume', 'issue', 'pages', 'site', 'url', 'doi', 'accessed', 'locator'];
  var NAMES = { title: 'the title', publisher: 'the publisher', url: 'the URL', journal: 'the journal name' };
  var current = null;

  var accessedEdited = false;

  function showFields() {
    var type = $('ct-type').value;
    var style = $('ct-style').value;
    Array.prototype.forEach.call(document.querySelectorAll('[data-for], [data-style], [data-when]'), function (el) {
      var when = el.getAttribute('data-when');
      if (when === 'accessed') {
        el.hidden = !(type === 'website' || (style === 'harvard' && (type === 'book' || type === 'journal')));
        return;
      }
      var types = el.getAttribute('data-for');
      var styles = el.getAttribute('data-style');
      var typeOk = !types || types.split(' ').indexOf(type) !== -1;
      var styleOk = !styles || styles.split(' ').indexOf(style) !== -1;
      el.hidden = !(typeOk && styleOk);
    });
  }
  function wrapperHidden(el) {
    var node = el.parentElement;
    while (node && !node.classList.contains('tool')) {
      if (node.hidden && (node.hasAttribute('data-for') || node.hasAttribute('data-style') || node.hasAttribute('data-when'))) return true;
      node = node.parentElement;
    }
    return false;
  }
  function todayLocalIso() {
    var n = new Date();
    function pad(x) { return (x < 10 ? '0' : '') + x; }
    return n.getFullYear() + '-' + pad(n.getMonth() + 1) + '-' + pad(n.getDate());
  }
  /** Harvard only: when a URL is present and the reader has not chosen a date, use the local calendar day. */
  function syncAccessed() {
    var acc = $('ct-accessed');
    var style = $('ct-style').value;
    if (style !== 'harvard' && acc.getAttribute('data-autofilled') === '1') {
      acc.value = '';
      acc.removeAttribute('data-autofilled');
    }
    var url = $('ct-url').value.trim();
    if (style === 'harvard' && url && !acc.value && !accessedEdited && !wrapperHidden(acc)) {
      acc.value = todayLocalIso();
      acc.setAttribute('data-autofilled', '1');
    }
  }
  function data() {
    var d = {};
    FIELDS.forEach(function (f) {
      var el = $('ct-' + f);
      d[f] = wrapperHidden(el) ? '' : el.value;
    });
    return d;
  }
  function update() {
    showFields();
    syncAccessed();
    var harvard = $('ct-style').value === 'harvard';
    $('ct-harvard-etal').hidden = !harvard;
    $('ct-harvard-more').hidden = !harvard;
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
      out.classList.toggle('has-lines', harvard);
    } else {
      out.textContent = 'Add ' + r.missing.map(function (m) { return NAMES[m] || m; }).join(' and ') + ' to see the citation.';
      out.classList.add('is-empty');
      out.classList.remove('has-lines');
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
  $('ct-accessed').addEventListener('input', function () {
    accessedEdited = true;
    $('ct-accessed').removeAttribute('data-autofilled');
  });
  $('ct-clear').addEventListener('click', function () {
    FIELDS.forEach(function (f) { $('ct-' + f).value = ''; });
    accessedEdited = false;
    $('ct-accessed').removeAttribute('data-autofilled');
    update();
    $('ct-authors').focus();
    K.announce(status, 'Form cleared.', 'ok');
  });
  update();
})();
