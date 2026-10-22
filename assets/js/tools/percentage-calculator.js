(function () {
  'use strict';
  var S = window.StudyKitStudy;
  var K = window.StudyKit;
  var $ = function (id) { return document.getElementById(id); };
  var status = $('pc-status');
  var rows = $('ps-rows');
  var counter = 0;

  function fmt(n) { return String(S.round(n, 2)); }
  function setErr(input, msg) {
    if (msg) input.setAttribute('aria-invalid', 'true'); else input.removeAttribute('aria-invalid');
    var e = $(input.id + '-error');
    if (e) e.textContent = msg || '';
  }
  /** Read a number field; returns null if empty, undefined (and shows an error) if invalid. */
  function read(input, opts) {
    var v = S.parseNum(input.value);
    var msg = '';
    if (v !== null) {
      if (isNaN(v)) msg = 'Enter a number.';
      else if (opts.min !== undefined && v < opts.min) msg = opts.minMsg;
      else if (opts.positive && v <= 0) msg = 'Enter a number greater than 0.';
      else if (opts.max !== undefined && v > opts.max) msg = opts.maxMsg;
    }
    setErr(input, msg);
    return msg ? undefined : v;
  }

  function single() {
    var o = read($('pc-obtained'), { min: 0, minMsg: 'Marks cannot be negative.' });
    var t = read($('pc-total'), { positive: true });
    if (typeof o === 'number' && typeof t === 'number' && o > t) setErr($('pc-obtained'), 'Marks obtained are more than the total. Check the numbers.');
    $('pc-percent').textContent = typeof o === 'number' && typeof t === 'number' ? fmt(S.percentOf(o, t)) + '%' : '—';
  }

  function addRow(focus) {
    counter++;
    var n = counter;
    var row = document.createElement('fieldset');
    row.className = 'course-row';
    row.innerHTML = '<legend>Subject ' + n + '</legend><div class="row">' +
      '<div class="field"><label for="ps-o-' + n + '">Marks obtained</label><input type="number" id="ps-o-' + n + '" class="ps-o" inputmode="decimal" min="0" step="any" aria-describedby="ps-o-' + n + '-error"><p class="field-error" id="ps-o-' + n + '-error"></p></div>' +
      '<div class="field"><label for="ps-t-' + n + '">Total marks</label><input type="number" id="ps-t-' + n + '" class="ps-t" inputmode="decimal" min="0" step="any" aria-describedby="ps-t-' + n + '-error"><p class="field-error" id="ps-t-' + n + '-error"></p></div>' +
      '</div>';
    rows.appendChild(row);
    if (focus) row.querySelector('.ps-o').focus();
  }

  function subjects() {
    var list = [];
    Array.prototype.forEach.call(rows.querySelectorAll('.course-row'), function (r) {
      var o = read(r.querySelector('.ps-o'), { min: 0, minMsg: 'Marks cannot be negative.' });
      var t = read(r.querySelector('.ps-t'), { positive: true });
      if (typeof o === 'number' && typeof t === 'number') {
        if (o > t) setErr(r.querySelector('.ps-o'), 'More than the total for this subject.');
        list.push({ obtained: o, total: t });
      }
    });
    var s = S.sumMarks(list);
    $('ps-obtained').textContent = fmt(s.obtained);
    $('ps-total').textContent = fmt(s.total);
    $('ps-percent').textContent = s.percent === null ? '—' : fmt(s.percent) + '%';
  }

  function needed() {
    var p = read($('pn-target'), { min: 0, minMsg: 'Enter 0 or more.', max: 100, maxMsg: 'Enter 100 or less.' });
    var t = read($('pn-total'), { positive: true });
    if (typeof p === 'number' && typeof t === 'number') {
      var m = S.marksForPercent(p, t);
      var up = Math.ceil(S.round(m, 6));
      $('pn-marks').textContent = fmt(m) + (up !== S.round(m, 6) ? ' (at least ' + up + ' whole marks)' : '');
    } else $('pn-marks').textContent = '—';
  }

  function compare() {
    var a = read($('pd-from'), {});
    var b = read($('pd-to'), {});
    if (typeof a === 'number' && typeof b === 'number') {
      var diff = S.round(b - a, 2);
      $('pd-points').textContent = (diff > 0 ? '+' : '') + diff + ' points';
      var ch = S.percentChange(a, b);
      $('pd-change').textContent = ch === null ? 'n/a' : (ch > 0 ? '+' : '') + fmt(ch) + '%';
    } else { $('pd-points').textContent = '—'; $('pd-change').textContent = '—'; }
  }

  $('pc-obtained').addEventListener('input', single);
  $('pc-total').addEventListener('input', single);
  rows.addEventListener('input', subjects);
  $('pn-target').addEventListener('input', needed);
  $('pn-total').addEventListener('input', needed);
  $('pd-from').addEventListener('input', compare);
  $('pd-to').addEventListener('input', compare);
  $('ps-add').addEventListener('click', function () { addRow(true); K.announce(status, 'Subject ' + counter + ' added.', 'ok'); });
  $('ps-clear').addEventListener('click', function () {
    rows.innerHTML = ''; counter = 0;
    for (var i = 0; i < 3; i++) addRow(false);
    subjects();
    rows.querySelector('.ps-o').focus();
    K.announce(status, 'Subjects cleared.', 'ok');
  });
  $('pc-copy').addEventListener('click', function () {
    var lines = [];
    if ($('pc-percent').textContent !== '—') lines.push($('pc-obtained').value + ' out of ' + $('pc-total').value + ' = ' + $('pc-percent').textContent);
    if ($('ps-percent').textContent !== '—') lines.push('Subjects total: ' + $('ps-obtained').textContent + ' out of ' + $('ps-total').textContent + ' = ' + $('ps-percent').textContent);
    if ($('pn-marks').textContent !== '—') lines.push('Marks needed for ' + $('pn-target').value + '% of ' + $('pn-total').value + ': ' + $('pn-marks').textContent);
    if ($('pd-points').textContent !== '—') lines.push('From ' + $('pd-from').value + '% to ' + $('pd-to').value + '%: ' + $('pd-points').textContent + ', relative change ' + $('pd-change').textContent);
    if (!lines.length) { K.announce(status, 'Nothing to copy yet. Enter some marks first.', 'error'); return; }
    var text = lines.join('\n');
    K.copyText(text).then(function (ok) {
      K.announce(status, ok ? 'Results copied.' : 'Your browser blocked copying. Please copy the results manually.', ok ? 'ok' : 'error');
    });
  });
  for (var i = 0; i < 3; i++) addRow(false);
  single(); subjects(); needed(); compare();
})();
