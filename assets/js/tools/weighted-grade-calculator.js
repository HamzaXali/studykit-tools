(function () {
  'use strict';
  var S = window.StudyKitStudy;
  var K = window.StudyKit;
  var $ = function (id) { return document.getElementById(id); };
  var rowsEl = $('wg-rows');
  var status = $('wg-status');
  var addBtn = $('wg-add');
  var capNote = $('wg-cap');
  var counter = 0;
  var MAX_ROWS = 12;
  var START_ROWS = 4;
  var EXAMPLE = [
    { name: 'Homework', score: 92, weight: 20 },
    { name: 'Quizzes', score: 84, weight: 20 },
    { name: 'Midterm', score: 79, weight: 30 },
    { name: 'Final', score: 88, weight: 30 }
  ];
  var EXTRA_NOTE = 'A score is above 100%. That is allowed when a category average includes extra credit. Check it against your gradebook.';

  function fmtGrade(n) { return S.round(n, 2).toFixed(2); }

  function fmtPlain(n) {
    var r = S.round(n, 2);
    if (Math.abs(r - Math.round(r)) < 1e-9) return String(Math.round(r));
    return r.toFixed(2);
  }

  function letterFor(grade) {
    if (grade >= 90) return 'A';
    if (grade >= 80) return 'B';
    if (grade >= 70) return 'C';
    if (grade >= 60) return 'D';
    return 'Below D';
  }

  function setErr(input, msg) {
    if (!input) return;
    if (msg) input.setAttribute('aria-invalid', 'true'); else input.removeAttribute('aria-invalid');
    var err = $(input.id + '-error');
    if (err) err.textContent = msg || '';
  }

  function syncAddButton() {
    var full = rowsEl.children.length >= MAX_ROWS;
    addBtn.disabled = full;
    capNote.hidden = !full;
  }

  function addRow(values, focus) {
    if (rowsEl.children.length >= MAX_ROWS) return false;
    counter += 1;
    var n = counter;
    var row = document.createElement('fieldset');
    row.className = 'course-row';
    row.innerHTML =
      '<legend>Category ' + n + '</legend>' +
      '<div class="row">' +
      '<div class="field"><label for="wg-name-' + n + '">Category name (optional)</label><input type="text" id="wg-name-' + n + '" class="wg-name" autocomplete="off"></div>' +
      '<div class="field"><label for="wg-score-' + n + '">Score (%)</label><input type="number" id="wg-score-' + n + '" class="wg-score" inputmode="decimal" step="any" aria-describedby="wg-score-' + n + '-error"><p class="field-error" id="wg-score-' + n + '-error"></p></div>' +
      '<div class="field"><label for="wg-weight-' + n + '">Weight</label><input type="number" id="wg-weight-' + n + '" class="wg-weight" inputmode="decimal" step="any" aria-describedby="wg-weight-hint wg-weight-' + n + '-error"><p class="field-error" id="wg-weight-' + n + '-error"></p></div>' +
      '<div class="field"><span class="label" id="wg-contrib-label-' + n + '">Contribution</span><p class="wg-contrib" id="wg-contrib-' + n + '" aria-labelledby="wg-contrib-label-' + n + '">—</p></div>' +
      '</div>' +
      '<button type="button" class="secondary wg-remove">Remove category ' + n + '</button>';
    rowsEl.appendChild(row);
    if (values) {
      row.querySelector('.wg-name').value = values.name || '';
      if (values.score !== undefined && values.score !== null && values.score !== '') row.querySelector('.wg-score').value = String(values.score);
      if (values.weight !== undefined && values.weight !== null && values.weight !== '') row.querySelector('.wg-weight').value = String(values.weight);
    }
    row.querySelector('.wg-remove').addEventListener('click', function () {
      if (rowsEl.children.length <= 1) {
        K.announce(status, 'At least one category row is needed.', 'info');
        return;
      }
      var next = row.nextElementSibling || row.previousElementSibling;
      row.remove();
      update();
      if (next) next.querySelector('input').focus();
      K.announce(status, 'Category ' + n + ' removed.', 'ok');
    });
    syncAddButton();
    if (focus) row.querySelector('.wg-name').focus();
    return true;
  }

  function readRows() {
    return Array.prototype.map.call(rowsEl.querySelectorAll('.course-row'), function (row) {
      return {
        row: row,
        name: row.querySelector('.wg-name').value,
        score: row.querySelector('.wg-score').value,
        weight: row.querySelector('.wg-weight').value
      };
    });
  }

  function clearResult() {
    $('wg-grade').textContent = '—';
    $('wg-letter').textContent = '—';
    $('wg-weight').textContent = '—';
    $('wg-weight-note').hidden = true;
    $('wg-weight-note').textContent = '';
  }

  function update() {
    syncAddButton();
    var list = readRows();
    list.forEach(function (item) {
      setErr(item.row.querySelector('.wg-score'), '');
      setErr(item.row.querySelector('.wg-weight'), '');
      item.row.querySelector('.wg-contrib').textContent = '—';
    });
    var result = S.calcWeightedGrade(list);
    result.rows.forEach(function (detail) {
      var item = list[detail.index];
      detail.issues.forEach(function (issue) {
        var input = item.row.querySelector(issue.field === 'score' ? '.wg-score' : '.wg-weight');
        setErr(input, issue.message);
      });
      if (detail.contribution !== null) item.row.querySelector('.wg-contrib').textContent = fmtGrade(detail.contribution);
    });
    $('wg-extra').hidden = !result.scoreAbove100;
    $('wg-extra').textContent = result.scoreAbove100 ? EXTRA_NOTE : '';
    if (!result.ok) {
      clearResult();
      return;
    }
    $('wg-grade').textContent = fmtGrade(result.grade) + '%';
    $('wg-letter').textContent = letterFor(result.grade);
    $('wg-weight').textContent = fmtPlain(result.weightTotal);
    if (result.weightsEqual100) {
      $('wg-weight-note').hidden = true;
      $('wg-weight-note').textContent = '';
    } else {
      $('wg-weight-note').hidden = false;
      $('wg-weight-note').textContent = 'Weights total ' + fmtPlain(result.weightTotal) + ', not 100. The grade above is averaged over the weights you entered (typical mid-semester view).';
    }
  }

  function resetRows(items) {
    rowsEl.innerHTML = '';
    counter = 0;
    items.forEach(function (item) { addRow(item, false); });
    update();
  }

  rowsEl.addEventListener('input', update);

  addBtn.addEventListener('click', function () {
    if (rowsEl.children.length >= MAX_ROWS) {
      K.announce(status, '12 categories is the limit on this page.', 'info');
      return;
    }
    addRow(null, true);
    update();
    K.announce(status, 'Category ' + counter + ' added.', 'ok');
  });

  $('wg-example').addEventListener('click', function () {
    resetRows(EXAMPLE);
    var first = rowsEl.querySelector('input');
    if (first) first.focus();
    K.announce(status, 'Example loaded. Your weighted grade is ' + $('wg-grade').textContent + '.', 'ok');
  });

  $('wg-clear').addEventListener('click', function () {
    var blanks = [];
    var i;
    for (i = 0; i < START_ROWS; i++) blanks.push(null);
    resetRows(blanks);
    var first = rowsEl.querySelector('input');
    if (first) first.focus();
    K.announce(status, 'Form cleared.', 'ok');
  });

  $('wg-copy').addEventListener('click', function () {
    if ($('wg-grade').textContent === '—') {
      K.announce(status, 'Nothing to copy yet. Enter a score and a weight.', 'error');
      return;
    }
    var lines = ['Your weighted grade: ' + $('wg-grade').textContent];
    lines.push('Letter on common US cutoffs (syllabus wins): ' + $('wg-letter').textContent);
    readRows().forEach(function (item, index) {
      var name = item.name.trim() || ('Category ' + (index + 1));
      var contrib = item.row.querySelector('.wg-contrib').textContent;
      if (item.score.trim() === '' && item.weight.trim() === '') return;
      lines.push(name + ': score ' + item.score + ', weight ' + item.weight + ', contribution ' + contrib);
    });
    if (!$('wg-weight-note').hidden && $('wg-weight-note').textContent) lines.push($('wg-weight-note').textContent);
    if (!$('wg-extra').hidden && $('wg-extra').textContent) lines.push($('wg-extra').textContent);
    K.copyText(lines.join('\n')).then(function (ok) {
      K.announce(status, ok ? 'Results copied.' : 'Your browser blocked copying. Please copy the results manually.', ok ? 'ok' : 'error');
    });
  });

  resetRows([null, null, null, null]);
})();
