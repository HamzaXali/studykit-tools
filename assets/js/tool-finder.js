/* Filter tool cards already on the page. No network requests. */
(function () {
  'use strict';
  var root = document.querySelector('[data-tool-finder]');
  if (!root) return;
  var input = root.querySelector('[data-finder-input]');
  var form = root.querySelector('[data-finder-form]');
  var status = root.querySelector('[data-finder-status]');
  var empty = root.querySelector('[data-finder-empty]');
  var clearBtn = root.querySelector('[data-finder-clear]');
  var items = Array.prototype.slice.call(root.querySelectorAll('[data-finder-item]'));
  var pills = Array.prototype.slice.call(root.querySelectorAll('[data-filter]'));
  var active = 'all';
  var labels = { all: 'All Tools', study: 'Study', write: 'Write', grade: 'Grade', plan: 'Plan', fix: 'Fix' };

  function apply() {
    var q = input ? input.value.trim().toLowerCase() : '';
    var shown = 0;
    items.forEach(function (item) {
      var cats = (item.getAttribute('data-cats') || '').split(/\s+/);
      var hay = (item.getAttribute('data-search') || '').toLowerCase();
      var ok = (active === 'all' || cats.indexOf(active) !== -1) && (!q || hay.indexOf(q) !== -1);
      item.hidden = !ok;
      if (ok) shown += 1;
    });
    if (empty) empty.hidden = shown !== 0;
    if (!status) return;
    var noun = shown === 1 ? 'tool' : 'tools';
    var queryText = input ? input.value.trim() : '';
    if (q && active !== 'all') status.textContent = 'Showing ' + shown + ' ' + noun + ' in ' + labels[active] + ' for "' + queryText + '".';
    else if (q) status.textContent = 'Showing ' + shown + ' ' + noun + ' for "' + queryText + '".';
    else if (active !== 'all') status.textContent = 'Showing ' + shown + ' ' + noun + ' in ' + labels[active] + '.';
    else status.textContent = 'Showing ' + shown + ' ' + noun + '.';
  }

  if (input) input.addEventListener('input', apply);
  if (form) form.addEventListener('submit', function (event) { event.preventDefault(); apply(); });
  pills.forEach(function (btn) {
    btn.addEventListener('click', function () {
      active = btn.getAttribute('data-filter') || 'all';
      pills.forEach(function (pill) {
        pill.setAttribute('aria-pressed', pill === btn ? 'true' : 'false');
      });
      apply();
    });
  });
  if (clearBtn) {
    clearBtn.addEventListener('click', function () {
      if (input) input.value = '';
      active = 'all';
      pills.forEach(function (pill) {
        pill.setAttribute('aria-pressed', pill.getAttribute('data-filter') === 'all' ? 'true' : 'false');
      });
      apply();
      if (input) input.focus();
    });
  }
  apply();
})();
