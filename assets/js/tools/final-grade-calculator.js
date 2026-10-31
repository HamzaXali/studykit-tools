(function () {
  'use strict';
  var S = window.StudyKitStudy;
  var K = window.StudyKit;
  var $ = function (id) { return document.getElementById(id); };
  var status = $('fg-status');
  var LETTERS = { A: 90, B: 80, C: 70, D: 60 };

  function fmt(n) { return String(S.round(n, 2)); }

  function setErr(input, msg) {
    if (!input) return;
    if (msg) input.setAttribute('aria-invalid', 'true'); else input.removeAttribute('aria-invalid');
    var e = $(input.id + '-error');
    if (e) e.textContent = msg || '';
  }

  /** Read a number field; returns null if empty, undefined if invalid (and shows an error). */
  function read(input, opts) {
    opts = opts || {};
    var v = S.parseNum(input.value);
    var msg = '';
    if (v !== null) {
      if (isNaN(v)) msg = 'Enter a number.';
      else if (opts.min !== undefined && v < opts.min) msg = opts.minMsg || ('Enter ' + opts.min + ' or more.');
      else if (opts.max !== undefined && v > opts.max) msg = opts.maxMsg || ('Enter ' + opts.max + ' or less.');
      else if (opts.positive && !(v > 0)) msg = opts.positiveMsg || 'Enter a number greater than 0.';
    }
    setErr(input, msg);
    return msg ? undefined : v;
  }

  function clearResult() {
    $('fg-needed').textContent = '—';
    $('fg-detail').textContent = '';
    $('fg-detail').hidden = true;
  }

  function computeNeeded() {
    var current = read($('fg-current'), { min: 0, minMsg: 'Current grade cannot be negative.', max: 200, maxMsg: 'Enter a realistic percentage.' });
    var weight = read($('fg-weight'), {
      positive: true,
      positiveMsg: 'Final weight must be greater than 0.',
      max: 100,
      maxMsg: 'Final weight cannot be more than 100%.'
    });
    var target = read($('fg-target'), { min: 0, minMsg: 'Target cannot be negative.', max: 200, maxMsg: 'Enter a realistic percentage.' });

    if (current === null || weight === null || target === null || current === undefined || weight === undefined || target === undefined) {
      clearResult();
      return;
    }

    var r = S.requiredFinalScore(current, weight, target);
    if (!r.ok) {
      clearResult();
      if (r.message) setErr($('fg-weight'), r.message);
      return;
    }

    if (r.status === 'safe') {
      $('fg-needed').textContent = 'Already safe';
      $('fg-detail').textContent = r.message + ' Best possible course grade with a perfect final: ' + fmt(r.bestPossible) + '%.';
      $('fg-detail').hidden = false;
      return;
    }

    if (r.status === 'unreachable') {
      $('fg-needed').textContent = fmt(r.required) + '% (over 100%)';
      $('fg-detail').textContent = r.message;
      $('fg-detail').hidden = false;
      return;
    }

    $('fg-needed').textContent = fmt(r.required) + '%';
    $('fg-detail').textContent = 'You need ' + fmt(r.required) + '% on your final to reach a ' + fmt(target) + '% course grade.';
    $('fg-detail').hidden = false;
  }

  function computePredict() {
    var current = read($('fg-p-current'), { min: 0, minMsg: 'Current grade cannot be negative.', max: 200, maxMsg: 'Enter a realistic percentage.' });
    var weight = read($('fg-p-weight'), {
      positive: true,
      positiveMsg: 'Final weight must be greater than 0.',
      max: 100,
      maxMsg: 'Final weight cannot be more than 100%.'
    });
    var finalScore = read($('fg-p-final'), { min: 0, minMsg: 'Final score cannot be negative.', max: 200, maxMsg: 'Enter a realistic percentage.' });

    if (current === null || weight === null || finalScore === null ||
        current === undefined || weight === undefined || finalScore === undefined) {
      $('fg-predicted').textContent = '—';
      return;
    }
    var g = S.courseGradeAfterFinal(current, weight, finalScore);
    $('fg-predicted').textContent = g === null ? '—' : fmt(g) + '%';
  }

  function setTargetLetter(letter) {
    var v = LETTERS[letter];
    if (v === undefined) return;
    $('fg-target').value = String(v);
    computeNeeded();
    K.announce(status, 'Target set to ' + letter + ' (' + v + '%). Check your syllabus — cutoffs vary.', 'ok');
  }

  $('fg-current').addEventListener('input', computeNeeded);
  $('fg-weight').addEventListener('input', computeNeeded);
  $('fg-target').addEventListener('input', computeNeeded);
  $('fg-p-current').addEventListener('input', computePredict);
  $('fg-p-weight').addEventListener('input', computePredict);
  $('fg-p-final').addEventListener('input', computePredict);

  Array.prototype.forEach.call(document.querySelectorAll('[data-fg-letter]'), function (btn) {
    btn.addEventListener('click', function () { setTargetLetter(btn.getAttribute('data-fg-letter')); });
  });

  $('fg-copy').addEventListener('click', function () {
    var lines = [];
    if ($('fg-needed').textContent !== '—') {
      lines.push('Current ' + $('fg-current').value + '%, final weight ' + $('fg-weight').value + '%, target ' + $('fg-target').value + '% → ' + $('fg-needed').textContent);
      if (!$('fg-detail').hidden && $('fg-detail').textContent) lines.push($('fg-detail').textContent);
    }
    if ($('fg-predicted').textContent !== '—') {
      lines.push('If final is ' + $('fg-p-final').value + '% (current ' + $('fg-p-current').value + '%, weight ' + $('fg-p-weight').value + '%) → course grade ' + $('fg-predicted').textContent);
    }
    if (!lines.length) { K.announce(status, 'Nothing to copy yet. Enter your grades first.', 'error'); return; }
    K.copyText(lines.join('\n')).then(function (ok) {
      K.announce(status, ok ? 'Results copied.' : 'Your browser blocked copying. Please copy the results manually.', ok ? 'ok' : 'error');
    });
  });

  $('fg-clear').addEventListener('click', function () {
    ['fg-current', 'fg-weight', 'fg-target', 'fg-p-current', 'fg-p-weight', 'fg-p-final'].forEach(function (id) {
      $(id).value = '';
      setErr($(id), '');
    });
    clearResult();
    $('fg-predicted').textContent = '—';
    $('fg-current').focus();
    K.announce(status, 'Form cleared.', 'ok');
  });

  computeNeeded();
  computePredict();
})();
