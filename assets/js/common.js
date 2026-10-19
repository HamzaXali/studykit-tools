/* StudyKit Tools — small shared helpers for the tool pages. No tracking, no network requests. */
(function () {
  'use strict';

  var timers = new WeakMap();

  /** Show a message in an aria-live status region. kind: 'ok' | 'error' | 'info'. */
  function announce(el, message, kind) {
    if (!el) return;
    el.dataset.kind = kind || 'info';
    // Clearing first makes screen readers re-announce identical messages.
    el.textContent = '';
    window.setTimeout(function () { el.textContent = message; }, 30);
    if (timers.has(el)) window.clearTimeout(timers.get(el));
    if (kind !== 'error') {
      timers.set(el, window.setTimeout(function () { el.textContent = ''; }, 8000));
    }
  }

  function legacyCopy(text) {
    var ta = document.createElement('textarea');
    ta.value = text;
    ta.setAttribute('readonly', '');
    ta.style.position = 'fixed';
    ta.style.top = '-1000px';
    document.body.appendChild(ta);
    ta.select();
    var ok = false;
    try { ok = document.execCommand('copy'); } catch (e) { ok = false; }
    document.body.removeChild(ta);
    return ok;
  }

  /** Copy text to the clipboard. Resolves true/false; never throws. */
  function copyText(text) {
    if (navigator.clipboard && window.isSecureContext) {
      return navigator.clipboard.writeText(text).then(function () { return true; }, function () { return legacyCopy(text); });
    }
    return Promise.resolve(legacyCopy(text));
  }

  /** Wire a copy button to a field. */
  function bindCopy(button, field, statusEl, label) {
    button.addEventListener('click', function () {
      var value = field.value;
      if (!value) { announce(statusEl, 'Nothing to copy yet. ' + (label ? label + ' is empty.' : ''), 'error'); field.focus(); return; }
      copyText(value).then(function (ok) {
        if (ok) announce(statusEl, 'Copied to clipboard.', 'ok');
        else {
          field.focus();
          field.select();
          announce(statusEl, 'Your browser blocked copying. The text is selected: press Ctrl+C (or Cmd+C) to copy it.', 'error');
        }
      });
    });
  }

  /** Save text as a file download (generated locally, never uploaded). */
  function downloadText(filename, text, mime) {
    var blob = new Blob([text], { type: (mime || 'text/plain') + ';charset=utf-8' });
    var url = URL.createObjectURL(blob);
    var a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    window.setTimeout(function () { URL.revokeObjectURL(url); }, 1000);
  }

  function debounce(fn, wait) {
    var t;
    return function () {
      var args = arguments;
      var ctx = this;
      window.clearTimeout(t);
      t = window.setTimeout(function () { fn.apply(ctx, args); }, wait);
    };
  }

  function formatNumber(n) {
    try { return Number(n).toLocaleString(); } catch (e) { return String(n); }
  }

  window.StudyKit = {
    announce: announce,
    copyText: copyText,
    bindCopy: bindCopy,
    downloadText: downloadText,
    debounce: debounce,
    formatNumber: formatNumber
  };
})();
