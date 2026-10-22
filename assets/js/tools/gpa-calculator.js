(function () {
  'use strict';
  var S = window.StudyKitStudy;
  var K = window.StudyKit;
  var rowsEl = document.getElementById('gp-rows');
  var scaleEl = document.getElementById('gp-scale');
  var status = document.getElementById('gp-status');
  var outGpa = document.getElementById('gp-gpa');
  var outCredits = document.getElementById('gp-credits');
  var outQp = document.getElementById('gp-qp');
  var prev = document.getElementById('cg-prev');
  var prevCr = document.getElementById('cg-prev-credits');
  var outNew = document.getElementById('cg-new');
  var outTotal = document.getElementById('cg-total');
  var cpCgpa = document.getElementById('cp-cgpa');
  var method = document.getElementById('cp-method');
  var custom = document.getElementById('cp-custom');
  var mult = document.getElementById('cp-mult');
  var add = document.getElementById('cp-add');
  var formula = document.getElementById('cp-formula');
  var outPct = document.getElementById('cp-percent');
  var counter = 0;
  var cpTouched = false;
  var last = { gpa: null, cgpa: null, pct: null };

  function fmt(n, dp) { return S.round(n, dp).toFixed(dp); }
  function setErr(input, msg) {
    var err = document.getElementById(input.id + '-error');
    if (msg) input.setAttribute('aria-invalid', 'true'); else input.removeAttribute('aria-invalid');
    if (err) err.textContent = msg || '';
  }

  function addRow(focus) {
    counter++;
    var n = counter;
    var row = document.createElement('fieldset');
    row.className = 'course-row';
    row.innerHTML =
      '<legend>Course ' + n + '</legend>' +
      '<div class="row">' +
      '<div class="field"><label for="gp-name-' + n + '">Course name (optional)</label><input type="text" id="gp-name-' + n + '" autocomplete="off"></div>' +
      '<div class="field"><label for="gp-cr-' + n + '">Credit hours</label><input type="number" id="gp-cr-' + n + '" class="gp-cr" inputmode="decimal" min="0" step="0.5" aria-describedby="gp-cr-' + n + '-error"><p class="field-error" id="gp-cr-' + n + '-error"></p></div>' +
      '<div class="field"><label for="gp-pt-' + n + '">Grade points</label><input type="number" id="gp-pt-' + n + '" class="gp-pt" inputmode="decimal" min="0" step="0.01" aria-describedby="gp-pt-' + n + '-error"><p class="field-error" id="gp-pt-' + n + '-error"></p></div>' +
      '</div>' +
      '<button type="button" class="secondary gp-remove">Remove course ' + n + '</button>';
    rowsEl.appendChild(row);
    row.querySelector('.gp-remove').addEventListener('click', function () {
      if (rowsEl.children.length <= 1) { K.announce(status, 'At least one course row is needed.', 'info'); return; }
      var next = row.nextElementSibling || row.previousElementSibling;
      row.remove();
      update();
      if (next) next.querySelector('input').focus();
      K.announce(status, 'Course ' + n + ' removed.', 'ok');
    });
    if (focus) row.querySelector('.gp-cr').focus();
  }

  function courses() {
    return Array.prototype.map.call(rowsEl.querySelectorAll('.course-row'), function (r) {
      return { credits: r.querySelector('.gp-cr').value, points: r.querySelector('.gp-pt').value, row: r };
    });
  }

  function update() {
    var scale = Number(scaleEl.value);
    var list = courses();
    list.forEach(function (c) { setErr(c.row.querySelector('.gp-cr'), ''); setErr(c.row.querySelector('.gp-pt'), ''); });
    var r = S.calcGpa(list, scale);
    r.errors.forEach(function (e) { setErr(list[e.index].row.querySelector(e.field === 'credits' ? '.gp-cr' : '.gp-pt'), e.message); });
    last.gpa = r.ok ? r.gpa : null;
    outGpa.textContent = r.ok ? fmt(r.gpa, 2) : '—';
    outCredits.textContent = r.ok ? String(S.round(r.credits, 2)) : '0';
    outQp.textContent = r.ok ? String(S.round(r.qualityPoints, 2)) : '0';

    // CGPA
    var pv = S.parseNum(prev.value);
    var pc = S.parseNum(prevCr.value);
    setErr(prev, pv !== null && (isNaN(pv) || pv < 0 || pv > scale) ? 'Enter a CGPA from 0 to ' + scale + '.' : '');
    setErr(prevCr, pc !== null && (isNaN(pc) || pc < 0) ? 'Enter 0 or more credit hours.' : '');
    var okPrev = pv !== null && pc !== null && pv >= 0 && pv <= scale && pc >= 0;
    last.cgpa = null;
    if (r.ok && okPrev) last.cgpa = S.combineCgpa(pv, pc, r.gpa, r.credits);
    else if (r.ok && pv === null && pc === null) last.cgpa = r.gpa;
    outNew.textContent = last.cgpa !== null ? fmt(last.cgpa, 2) : '—';
    outTotal.textContent = r.ok ? String(S.round(r.credits + (okPrev ? pc : 0), 2)) : '0';
    if (!cpTouched) cpCgpa.value = last.cgpa !== null ? fmt(last.cgpa, 2) : '';
    convert();
  }

  function convert() {
    var scale = Number(scaleEl.value);
    var isCustom = method.value === 'multiplier';
    custom.hidden = !isCustom;
    var c = S.parseNum(cpCgpa.value);
    setErr(cpCgpa, c !== null && (isNaN(c) || c < 0 || c > scale) ? 'Enter a CGPA from 0 to ' + scale + '.' : '');
    var m = S.parseNum(mult.value);
    var a = S.parseNum(add.value);
    setErr(mult, isCustom && (m === null || isNaN(m) || m <= 0) ? 'Enter a multiplier greater than 0.' : '');
    setErr(add, isCustom && a !== null && isNaN(a) ? 'Enter a number, or 0.' : '');
    var cOk = c !== null && !isNaN(c) && c >= 0 && c <= scale;
    if (isCustom) {
      var okM = m !== null && !isNaN(m) && m > 0;
      var addN = a === null || isNaN(a) ? 0 : a;
      formula.textContent = 'Formula: percentage = CGPA × ' + (okM ? m : '?') + (addN ? (addN > 0 ? ' + ' : ' − ') + Math.abs(addN) : '') +
        (cOk && okM ? ' = ' + c + ' × ' + m + (addN ? (addN > 0 ? ' + ' : ' − ') + Math.abs(addN) : '') : '') + '. This is the formula you entered.';
      last.pct = cOk && okM ? S.cgpaToPercent(c, { method: 'multiplier', multiplier: m, add: addN }) : null;
    } else {
      formula.textContent = 'Formula: percentage = CGPA ÷ ' + scale + ' × 100' + (scale === 4 ? ' (the same as CGPA × 25)' : '') +
        (cOk ? ' = ' + c + ' ÷ ' + scale + ' × 100' : '') + '. This is a simple proportional conversion, not an official formula.';
      last.pct = cOk ? S.cgpaToPercent(c, { method: 'proportional', scale: scale }) : null;
    }
    outPct.textContent = last.pct !== null ? fmt(last.pct, 2) + '%' : '—';
  }

  rowsEl.addEventListener('input', update);
  scaleEl.addEventListener('change', update);
  prev.addEventListener('input', update);
  prevCr.addEventListener('input', update);
  cpCgpa.addEventListener('input', function () { cpTouched = cpCgpa.value !== ''; convert(); });
  method.addEventListener('change', convert);
  mult.addEventListener('input', convert);
  add.addEventListener('input', convert);

  document.getElementById('gp-add').addEventListener('click', function () {
    addRow(true);
    K.announce(status, 'Course ' + counter + ' added.', 'ok');
  });
  document.getElementById('gp-clear').addEventListener('click', function () {
    rowsEl.innerHTML = '';
    counter = 0;
    for (var i = 0; i < 4; i++) addRow(false);
    prev.value = '';
    prevCr.value = '';
    cpCgpa.value = '';
    cpTouched = false;
    update();
    rowsEl.querySelector('.gp-cr').focus();
    K.announce(status, 'All courses cleared.', 'ok');
  });
  document.getElementById('gp-copy').addEventListener('click', function () {
    var parts = [];
    if (last.gpa !== null) parts.push('Semester GPA: ' + fmt(last.gpa, 2));
    if (last.cgpa !== null) parts.push('CGPA: ' + fmt(last.cgpa, 2));
    if (last.pct !== null) parts.push('Percentage: ' + fmt(last.pct, 2) + '% (' + formula.textContent.replace(/^Formula: /, '').split('. ')[0] + ')');
    if (!parts.length) { K.announce(status, 'Nothing to copy yet. Enter at least one course or a CGPA.', 'error'); return; }
    var text = parts.join('. ') + '.';
    K.copyText(text).then(function (ok) {
      K.announce(status, ok ? 'Copied: ' + text : 'Your browser blocked copying. Please copy the results manually.', ok ? 'ok' : 'error');
    });
  });

  for (var i = 0; i < 4; i++) addRow(false);
  update();
})();
