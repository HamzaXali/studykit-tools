(function () {
  'use strict';
  var S = window.StudyKitStudy;
  var K = window.StudyKit;
  var $ = function (id) { return document.getElementById(id); };
  var status = $('uk-status');
  var YEAR_COUNT = 3;
  var PRESETS = {
    '0-50-50': [0, 50, 50],
    '0-40-60': [0, 40, 60],
    '0-33-67': [0, 33, 67],
    '0-1-2': [0, 1, 2],
    '0-25-75': [0, 25, 75]
  };
  var DEMO = {
    weights: [0, 40, 60],
    years: [
      [{ name: 'Year 1 (not counted)', mark: '55', credits: '120', remaining: false }],
      [
        { name: 'Research methods', mark: '58', credits: '20', remaining: false },
        { name: 'Group project', mark: '64', credits: '20', remaining: false },
        { name: 'Core module A', mark: '61', credits: '40', remaining: false },
        { name: 'Core module B', mark: '67', credits: '40', remaining: false }
      ],
      [
        { name: 'Option A', mark: '64', credits: '20', remaining: false },
        { name: 'Option B', mark: '68', credits: '20', remaining: false },
        { name: 'Advanced topics', mark: '70', credits: '40', remaining: false },
        { name: 'Dissertation', mark: '74', credits: '40', remaining: false }
      ]
    ]
  };
  var counters = [0, 0, 0];

  function fmt(n) { return String(S.round(n, 2)); }

  function weightInputs() {
    return [1, 2, 3].map(function (n) { return $('uk-w' + n); });
  }

  function readWeights() {
    return weightInputs().map(function (el) {
      var v = S.parseNum(el.value);
      return v === null ? 0 : v;
    });
  }

  function updateShareHint() {
    var nw = S.normaliseYearWeights(readWeights());
    var el = $('uk-share-hint');
    if (!nw.ok) {
      el.textContent = 'Enter at least one positive year weight.';
      return;
    }
    el.textContent = 'Effective shares: Year 1 ' + fmt(nw.shares[0] * 100) + '%, Year 2 ' +
      fmt(nw.shares[1] * 100) + '%, Year 3 ' + fmt(nw.shares[2] * 100) + '%.';
  }

  function setPreset(key) {
    var vals = PRESETS[key];
    if (!vals) return;
    weightInputs().forEach(function (el, i) { el.value = String(vals[i]); });
    document.querySelectorAll('[data-uk-preset]').forEach(function (btn) {
      var on = btn.getAttribute('data-uk-preset') === key;
      btn.setAttribute('aria-pressed', on ? 'true' : 'false');
    });
    updateShareHint();
    recompute();
  }

  function moduleRows(yearIndex) {
    return Array.prototype.slice.call($('uk-year-' + yearIndex).querySelectorAll('.uk-module-row'));
  }

  function readModules(yearIndex) {
    return moduleRows(yearIndex).map(function (row) {
      return {
        name: row.querySelector('.uk-name').value,
        mark: row.querySelector('.uk-mark').value,
        credits: row.querySelector('.uk-credits').value,
        remaining: row.querySelector('.uk-remaining').checked
      };
    });
  }

  function setErr(input, msg) {
    if (!input) return;
    if (msg) input.setAttribute('aria-invalid', 'true'); else input.removeAttribute('aria-invalid');
    var e = document.getElementById(input.id + '-error');
    if (e) e.textContent = msg || '';
  }

  function addModuleRow(yearIndex, data, focus) {
    counters[yearIndex]++;
    var n = counters[yearIndex];
    var idBase = 'uk-y' + yearIndex + '-m' + n;
    var wrap = document.createElement('fieldset');
    wrap.className = 'course-row uk-module-row';
    wrap.innerHTML =
      '<legend>Module ' + n + '</legend><div class="row">' +
      '<div class="field"><label for="' + idBase + '-name">Name (optional)</label>' +
      '<input type="text" id="' + idBase + '-name" class="uk-name" maxlength="80" autocomplete="off"></div>' +
      '<div class="field"><label for="' + idBase + '-mark">Mark (%)</label>' +
      '<input type="number" id="' + idBase + '-mark" class="uk-mark" inputmode="decimal" min="0" max="100" step="any" aria-describedby="' + idBase + '-mark-error">' +
      '<p class="field-error" id="' + idBase + '-mark-error"></p></div>' +
      '<div class="field"><label for="' + idBase + '-credits">Credits</label>' +
      '<input type="number" id="' + idBase + '-credits" class="uk-credits" inputmode="decimal" min="0" step="any" aria-describedby="' + idBase + '-credits-error">' +
      '<p class="field-error" id="' + idBase + '-credits-error"></p></div>' +
      '</div><div class="row"><div class="check"><input type="checkbox" class="uk-remaining" id="' + idBase + '-rem"><label for="' + idBase + '-rem">Remaining / not yet marked</label></div>' +
      '<div class="actions"><button type="button" class="secondary uk-remove">Remove</button></div></div>';
    $('uk-year-' + yearIndex).appendChild(wrap);
    if (data) {
      wrap.querySelector('.uk-name').value = data.name || '';
      wrap.querySelector('.uk-mark').value = data.mark || '';
      wrap.querySelector('.uk-credits').value = data.credits || '';
      wrap.querySelector('.uk-remaining').checked = !!data.remaining;
    }
    wrap.querySelector('.uk-remove').addEventListener('click', function () {
      wrap.remove();
      recompute();
    });
    if (focus) wrap.querySelector('.uk-mark').focus();
  }

  function clearYear(yearIndex) {
    $('uk-year-' + yearIndex).innerHTML = '';
    counters[yearIndex] = 0;
  }

  function loadDemo() {
    weightInputs().forEach(function (el, i) { el.value = String(DEMO.weights[i]); });
    document.querySelectorAll('[data-uk-preset]').forEach(function (btn) {
      btn.setAttribute('aria-pressed', btn.getAttribute('data-uk-preset') === '0-40-60' ? 'true' : 'false');
    });
    for (var y = 0; y < YEAR_COUNT; y++) {
      clearYear(y);
      DEMO.years[y].forEach(function (m) { addModuleRow(y, m, false); });
    }
    updateShareHint();
    recompute();
    K.announce(status, 'Loaded the worked example (0 / 40 / 60).', 'ok');
  }

  function clearAll() {
    weightInputs().forEach(function (el) { el.value = ''; });
    document.querySelectorAll('[data-uk-preset]').forEach(function (btn) { btn.setAttribute('aria-pressed', 'false'); });
    for (var y = 0; y < YEAR_COUNT; y++) {
      clearYear(y);
      addModuleRow(y, null, false);
    }
    updateShareHint();
    recompute();
    K.announce(status, 'Form cleared.', 'ok');
  }

  function yearsPayload() {
    return [0, 1, 2].map(function (i) {
      return { weight: readWeights()[i], modules: readModules(i) };
    });
  }

  function validateInline() {
    [0, 1, 2].forEach(function (yi) {
      moduleRows(yi).forEach(function (row) {
        var markEl = row.querySelector('.uk-mark');
        var credEl = row.querySelector('.uk-credits');
        var rem = row.querySelector('.uk-remaining').checked;
        setErr(markEl, '');
        setErr(credEl, '');
        var cr = S.parseNum(credEl.value);
        var mk = S.parseNum(markEl.value);
        var markEmpty = markEl.value.trim() === '';
        var credEmpty = credEl.value.trim() === '';
        if (credEmpty && markEmpty && !rem) return;
        if (cr === null || isNaN(cr) || !(cr > 0)) setErr(credEl, 'Enter credits greater than 0.');
        if (!rem && !markEmpty && (isNaN(mk) || mk < 0 || mk > 100)) setErr(markEl, 'Enter a mark from 0 to 100.');
      });
    });
  }

  function renderClassification(r) {
    var avgEl = $('uk-degree-avg');
    var classEl = $('uk-class');
    var borderEl = $('uk-borderline');
    var yearsEl = $('uk-year-results');
    if (!r || !r.ok || r.degreeAverage === null) {
      avgEl.textContent = '—';
      classEl.textContent = '—';
      borderEl.hidden = true;
      borderEl.textContent = '';
      yearsEl.innerHTML = '';
      return;
    }
    avgEl.textContent = fmt(r.degreeAverage) + '%';
    classEl.textContent = r.classification ? r.classification.label : '—';
    if (r.borderline) {
      borderEl.hidden = false;
      borderEl.innerHTML = '<strong>Borderline zone.</strong> Your average is ' + fmt(r.borderline.gap) +
        ' percentage points below the usual ' + r.borderline.nextLabel + ' boundary (' + r.borderline.nextBoundary +
        '%). This tool only flags the zone — it does not apply university uplift, discount or viva rules. Check your handbook.';
    } else {
      borderEl.hidden = true;
      borderEl.textContent = '';
    }
    yearsEl.innerHTML = r.years.map(function (yr, i) {
      var avg = yr.average === null ? '—' : fmt(yr.average) + '%';
      var share = fmt(yr.share * 100) + '%';
      var note = yr.weight === 0 ? ' (weight 0 — shown for information only)' : '';
      var rem = yr.remainingCredits ? '; ' + fmt(yr.remainingCredits) + ' credits remaining' : '';
      return '<li><strong>Year ' + (i + 1) + ':</strong> ' + avg + ' from ' + fmt(yr.lockedCredits) +
        ' locked credits' + rem + '; weight share ' + share + note + '</li>';
    }).join('');
  }

  function renderTarget(t) {
    var el = $('uk-needed');
    var detail = $('uk-needed-detail');
    if (!t || !t.ok) {
      el.textContent = '—';
      detail.hidden = true;
      detail.textContent = t && t.message ? t.message : '';
      if (t && t.message) { detail.hidden = false; }
      return;
    }
    if (t.status === 'safe') {
      el.textContent = 'Already safe';
      detail.hidden = false;
      detail.textContent = t.message;
      return;
    }
    if (t.status === 'unreachable') {
      el.textContent = fmt(t.required) + '% (over 100%)';
      detail.hidden = false;
      detail.textContent = t.message;
      return;
    }
    el.textContent = fmt(t.required) + '%';
    detail.hidden = false;
    detail.textContent = 'You need about ' + fmt(t.required) + '% across the remaining credits for this target (before handbook borderline, discount or rounding rules).';
  }

  function recompute() {
    validateInline();
    updateShareHint();
    var years = yearsPayload();
    var r = S.calcUkDegree(years);
    renderClassification(r.empty ? null : r);
    if (r && !r.ok && r.errors && r.errors.length && !r.empty) {
      // surface first weight-level message if any
      var top = r.errors.filter(function (e) { return e.message && e.year === undefined; })[0];
      if (top) $('uk-weight-error').textContent = top.message;
      else $('uk-weight-error').textContent = '';
    } else {
      $('uk-weight-error').textContent = '';
    }

    var targetSelect = $('uk-target-class').value;
    var targetAvg = S.ukTargetAverageForClass(targetSelect);
    if ($('uk-target-custom').value.trim() !== '') {
      var custom = S.parseNum($('uk-target-custom').value);
      if (custom !== null && !isNaN(custom)) targetAvg = custom;
    }
    var t = S.requiredRemainingForUkTarget(years, targetAvg);
    renderTarget(t);
  }

  // Events
  weightInputs().forEach(function (el) {
    el.addEventListener('input', function () {
      document.querySelectorAll('[data-uk-preset]').forEach(function (btn) { btn.setAttribute('aria-pressed', 'false'); });
      recompute();
    });
  });
  document.querySelectorAll('[data-uk-preset]').forEach(function (btn) {
    btn.addEventListener('click', function () { setPreset(btn.getAttribute('data-uk-preset')); });
  });
  [0, 1, 2].forEach(function (yi) {
    $('uk-add-' + yi).addEventListener('click', function () {
      addModuleRow(yi, null, true);
      recompute();
    });
  });
  $('uk-years').addEventListener('input', recompute);
  $('uk-years').addEventListener('change', recompute);
  $('uk-target-class').addEventListener('change', recompute);
  $('uk-target-custom').addEventListener('input', recompute);
  $('uk-load-demo').addEventListener('click', loadDemo);
  $('uk-clear').addEventListener('click', clearAll);
  $('uk-copy').addEventListener('click', function () {
    var lines = [];
    if ($('uk-degree-avg').textContent !== '—') {
      lines.push('Degree average: ' + $('uk-degree-avg').textContent);
      lines.push('Classification: ' + $('uk-class').textContent);
    }
    if ($('uk-needed').textContent !== '—') {
      lines.push('Needed on remaining for target: ' + $('uk-needed').textContent);
      if (!$('uk-needed-detail').hidden) lines.push($('uk-needed-detail').textContent);
    }
    if (!lines.length) { K.announce(status, 'Nothing to copy yet. Add marks first.', 'error'); return; }
    K.copyText(lines.join('\n')).then(function (ok) {
      K.announce(status, ok ? 'Results copied.' : 'Your browser blocked copying. Please copy the results manually.', ok ? 'ok' : 'error');
    });
  });

  // Initial: one empty row per year; default preset 0/40/60 weights without modules
  weightInputs().forEach(function (el, i) { el.value = String(PRESETS['0-40-60'][i]); });
  document.querySelectorAll('[data-uk-preset]').forEach(function (btn) {
    btn.setAttribute('aria-pressed', btn.getAttribute('data-uk-preset') === '0-40-60' ? 'true' : 'false');
  });
  for (var y = 0; y < YEAR_COUNT; y++) addModuleRow(y, null, false);
  updateShareHint();
  recompute();
})();
