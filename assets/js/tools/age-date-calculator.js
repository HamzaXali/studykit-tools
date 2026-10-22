(function () {
  'use strict';
  var S = window.StudyKitStudy;
  var K = window.StudyKit;
  var $ = function (id) { return document.getElementById(id); };
  var status = $('ad-status');
  var LONG = { year: 'numeric', month: 'long', day: 'numeric', weekday: 'long', timeZone: 'UTC' };

  function today() {
    var d = new Date();
    return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
  }
  function plural(n, w) { return n + ' ' + w + (n === 1 ? '' : 's'); }
  function setErr(input, msg) {
    if (msg) input.setAttribute('aria-invalid', 'true'); else input.removeAttribute('aria-invalid');
    var e = $(input.id + '-error');
    if (e) e.textContent = msg || '';
  }
  function fmtDate(d) { try { return d.toLocaleDateString(undefined, LONG); } catch (e) { return S.isoDate(d); } }

  function age() {
    var dob = S.parseDate($('ag-dob').value);
    var on = S.parseDate($('ag-on').value) || S.parseDate(today());
    var ids = ['ag-age', 'ag-months', 'ag-days', 'ag-next'];
    setErr($('ag-dob'), '');
    if (!dob) { ids.forEach(function (i) { $(i).textContent = '—'; }); return; }
    if (dob > on) {
      setErr($('ag-dob'), 'The date of birth is after the “age on” date.');
      ids.forEach(function (i) { $(i).textContent = '—'; });
      return;
    }
    var d = S.dateDiff(dob, on);
    $('ag-age').textContent = plural(d.years, 'year') + ', ' + plural(d.months, 'month') + ', ' + plural(d.days, 'day');
    $('ag-months').textContent = K.formatNumber(d.totalMonths);
    $('ag-days').textContent = K.formatNumber(d.totalDays);
    var nb = S.nextBirthday(dob, on);
    $('ag-next').textContent = nb.daysUntil === 0 ? 'Today! Turning ' + nb.turning : 'In ' + plural(nb.daysUntil, 'day') + ' (' + fmtDate(nb.date) + ')';
  }

  function diff() {
    var a = S.parseDate($('dd-start').value);
    var b = S.parseDate($('dd-end').value);
    var ids = ['dd-days', 'dd-weeks', 'dd-ymd'];
    if (!a || !b) { ids.forEach(function (i) { $(i).textContent = '—'; }); return; }
    var inc = $('dd-inclusive').checked;
    var lo = a <= b ? a : b;
    var hi = a <= b ? b : a;
    var d = S.dateDiff(lo, inc ? new Date(hi.getTime() + 86400000) : hi);
    var total = d.totalDays;
    d.negative = a > b;
    $('dd-days').textContent = K.formatNumber(total) + (d.negative ? ' (end is before start)' : '');
    $('dd-weeks').textContent = plural(Math.floor(total / 7), 'week') + ', ' + plural(total % 7, 'day');
    $('dd-ymd').textContent = plural(d.years, 'year') + ', ' + plural(d.months, 'month') + ', ' + plural(d.days, 'day');
  }

  ['ag-dob', 'ag-on'].forEach(function (id) { $(id).addEventListener('input', age); $(id).addEventListener('change', age); });
  ['dd-start', 'dd-end'].forEach(function (id) { $(id).addEventListener('input', diff); $(id).addEventListener('change', diff); });
  $('dd-inclusive').addEventListener('change', diff);
  $('ad-today').addEventListener('click', function () {
    var t = today();
    $('ag-on').value = t; $('dd-start').value = t;
    age(); diff();
    K.announce(status, '“Age on” date and start date set to today.', 'ok');
  });
  $('ad-copy').addEventListener('click', function () {
    var lines = [];
    if ($('ag-age').textContent !== '—') lines.push('Age on ' + $('ag-on').value + ': ' + $('ag-age').textContent + ' (' + $('ag-days').textContent + ' days)');
    if ($('dd-days').textContent !== '—') lines.push($('dd-start').value + ' to ' + $('dd-end').value + ($('dd-inclusive').checked ? ' (inclusive)' : '') + ': ' + $('dd-days').textContent + ' days, ' + $('dd-weeks').textContent + ', ' + $('dd-ymd').textContent);
    if (!lines.length) { K.announce(status, 'Nothing to copy yet. Enter a date first.', 'error'); return; }
    K.copyText(lines.join('\n')).then(function (ok) {
      K.announce(status, ok ? 'Results copied.' : 'Your browser blocked copying. Please copy the results manually.', ok ? 'ok' : 'error');
    });
  });
  $('ag-on').value = today();
  age(); diff();
})();
