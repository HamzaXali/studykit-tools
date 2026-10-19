(function () {
  'use strict';
  var T = window.StudyKitText;
  var K = window.StudyKit;
  var KEY = 'studykit.notes.v1';
  var $ = function (id) { return document.getElementById(id); };
  var form = $('nt-form');
  var titleEl = $('nt-title');
  var bodyEl = $('nt-body');
  var tagsEl = $('nt-tags');
  var formError = $('nt-form-error');
  var formHeading = $('nt-form-heading');
  var saveBtn = $('nt-save');
  var cancelBtn = $('nt-cancel');
  var searchEl = $('nt-search');
  var tagFilter = $('nt-tag-filter');
  var list = $('nt-list');
  var countEl = $('nt-count');
  var status = $('nt-status');
  var storageWarning = $('nt-storage-warning');

  var notes = [];
  var editingId = null;
  var storageOk = true;

  function load() {
    try {
      var raw = window.localStorage.getItem(KEY);
      if (!raw) return [];
      var parsed = T.parseNotesImport(raw);
      return parsed.ok ? parsed.notes : [];
    } catch (e) {
      storageOk = false;
      return [];
    }
  }

  function save() {
    if (!storageOk) return false;
    try {
      window.localStorage.setItem(KEY, T.notesToJson(notes));
      return true;
    } catch (e) {
      var full = e && (e.name === 'QuotaExceededError' || e.code === 22);
      K.announce(status, full
        ? 'Your browser storage is full, so the last change was not saved. Export your notes, then delete some.'
        : 'Your browser would not let this page save notes. Changes will be lost when you close the tab. Export them to keep a copy.', 'error');
      return false;
    }
  }

  function el(tag, attrs, text) {
    var node = document.createElement(tag);
    if (attrs) Object.keys(attrs).forEach(function (k) { node.setAttribute(k, attrs[k]); });
    if (text !== undefined) node.textContent = text;
    return node;
  }

  function formatDate(iso) {
    try { return new Date(iso).toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' }); } catch (e) { return iso; }
  }

  function renderTagFilter() {
    var current = tagFilter.value;
    var tags = T.allTags(notes);
    tagFilter.textContent = '';
    tagFilter.appendChild(el('option', { value: '' }, 'All tags'));
    tags.forEach(function (t) { tagFilter.appendChild(el('option', { value: t }, t)); });
    tagFilter.value = tags.indexOf(current) !== -1 ? current : '';
  }

  function render() {
    renderTagFilter();
    var shown = T.filterNotes(notes, searchEl.value, tagFilter.value);
    list.textContent = '';
    if (!notes.length) {
      countEl.textContent = 'No notes yet. Your first note will appear here.';
    } else if (!shown.length) {
      countEl.textContent = 'No notes match your search. ' + notes.length + ' note' + (notes.length === 1 ? '' : 's') + ' in total.';
    } else {
      countEl.textContent = 'Showing ' + shown.length + ' of ' + notes.length + ' note' + (notes.length === 1 ? '' : 's') + '.';
    }
    shown.forEach(function (n) {
      var li = el('li', { 'class': 'note' });
      var art = el('article', { 'aria-labelledby': 'h-' + n.id });
      var title = n.title || 'Untitled note';
      art.appendChild(el('h3', { id: 'h-' + n.id }, title));
      art.appendChild(el('p', { 'class': 'note-meta' }, 'Updated ' + formatDate(n.updated)));
      if (n.tags.length) {
        var ul = el('ul', { 'class': 'tags', 'aria-label': 'Tags' });
        n.tags.forEach(function (t) { ul.appendChild(el('li', null, '#' + t)); });
        art.appendChild(ul);
      }
      if (n.body) art.appendChild(el('div', { 'class': 'note-body', tabindex: '0', role: 'region', 'aria-label': 'Text of ' + title }, n.body));
      var actions = el('div', { 'class': 'actions' });
      var edit = el('button', { type: 'button', 'class': 'secondary', 'aria-label': 'Edit note: ' + title }, 'Edit');
      edit.addEventListener('click', function () { startEdit(n.id); });
      var del = el('button', { type: 'button', 'class': 'danger', 'aria-label': 'Delete note: ' + title }, 'Delete');
      del.addEventListener('click', function () { removeNote(n.id); });
      actions.appendChild(edit);
      actions.appendChild(del);
      art.appendChild(actions);
      li.appendChild(art);
      list.appendChild(li);
    });
  }

  function resetForm() {
    editingId = null;
    form.reset();
    formError.textContent = '';
    titleEl.removeAttribute('aria-invalid');
    formHeading.textContent = 'Add a note';
    saveBtn.textContent = 'Save note';
    cancelBtn.hidden = true;
  }

  function startEdit(id) {
    var n = notes.filter(function (x) { return x.id === id; })[0];
    if (!n) return;
    editingId = id;
    titleEl.value = n.title;
    bodyEl.value = n.body;
    tagsEl.value = n.tags.join(', ');
    formHeading.textContent = 'Edit note';
    saveBtn.textContent = 'Save changes';
    cancelBtn.hidden = false;
    titleEl.focus();
    K.announce(status, 'Editing "' + (n.title || 'Untitled note') + '". Change it, then choose Save changes.', 'info');
  }

  function removeNote(id) {
    var n = notes.filter(function (x) { return x.id === id; })[0];
    if (!n) return;
    if (!window.confirm('Delete the note "' + (n.title || 'Untitled note') + '"? This cannot be undone.')) return;
    notes = notes.filter(function (x) { return x.id !== id; });
    if (editingId === id) resetForm();
    var saved = save();
    render();
    searchEl.focus();
    if (saved || !storageOk) K.announce(status, 'Note deleted.', 'ok');
  }

  form.addEventListener('submit', function (e) {
    e.preventDefault();
    var v = T.validateNoteInput(titleEl.value, bodyEl.value, tagsEl.value);
    if (!v.ok) {
      formError.textContent = v.errors.join(' ');
      titleEl.setAttribute('aria-invalid', 'true');
      titleEl.focus();
      return;
    }
    var wasEditing = !!editingId;
    if (editingId) {
      notes = notes.map(function (n) { return n.id === editingId ? T.updateNote(n, v.fields) : n; });
    } else {
      notes.push(T.createNote(v.fields));
    }
    var saved = save();
    resetForm();
    render();
    titleEl.focus();
    if (saved) K.announce(status, wasEditing ? 'Changes saved in this browser.' : 'Note saved in this browser.', 'ok');
    else if (!storageOk) K.announce(status, 'Note kept for this visit only. Storage is unavailable, so export it before closing the tab.', 'error');
  });
  cancelBtn.addEventListener('click', function () {
    resetForm();
    titleEl.focus();
    K.announce(status, 'Editing cancelled. No changes saved.', 'info');
  });
  searchEl.addEventListener('input', render);
  tagFilter.addEventListener('change', render);
  $('nt-clear-search').addEventListener('click', function () {
    searchEl.value = '';
    tagFilter.value = '';
    render();
    searchEl.focus();
    K.announce(status, 'Search cleared. Showing all notes.', 'ok');
  });

  function stamp() { return new Date().toISOString().slice(0, 10); }
  function exportAs(kind) {
    if (!notes.length) { K.announce(status, 'There are no notes to export yet.', 'error'); return; }
    var sorted = T.filterNotes(notes, '', '');
    if (kind === 'json') K.downloadText('studykit-notes-' + stamp() + '.json', T.notesToJson(sorted), 'application/json');
    if (kind === 'md') K.downloadText('studykit-notes-' + stamp() + '.md', T.notesToMarkdown(sorted), 'text/markdown');
    if (kind === 'txt') K.downloadText('studykit-notes-' + stamp() + '.txt', T.notesToText(sorted), 'text/plain');
    K.announce(status, 'Exported ' + notes.length + ' note' + (notes.length === 1 ? '' : 's') + ' as ' + kind.toUpperCase() + '. Check your downloads folder.', 'ok');
  }
  $('nt-export-json').addEventListener('click', function () { exportAs('json'); });
  $('nt-export-md').addEventListener('click', function () { exportAs('md'); });
  $('nt-export-txt').addEventListener('click', function () { exportAs('txt'); });

  $('nt-import').addEventListener('change', function (e) {
    var file = e.target.files && e.target.files[0];
    e.target.value = '';
    if (!file) return;
    if (file.size > 5 * 1024 * 1024) { K.announce(status, 'That file is larger than 5 MB, so it was not imported.', 'error'); return; }
    var reader = new FileReader();
    reader.onload = function () {
      var parsed = T.parseNotesImport(String(reader.result));
      if (!parsed.ok) { K.announce(status, parsed.error, 'error'); return; }
      var merged = T.mergeNotes(notes, parsed.notes);
      notes = merged.notes;
      save();
      render();
      var msg = 'Import finished: ' + merged.added + ' added, ' + merged.updated + ' updated, ' + merged.unchanged + ' already up to date.';
      if (parsed.skipped) msg += ' ' + parsed.skipped + ' invalid item' + (parsed.skipped === 1 ? ' was' : 's were') + ' skipped.';
      K.announce(status, msg, 'ok');
    };
    reader.onerror = function () { K.announce(status, 'The file could not be read. Nothing was imported.', 'error'); };
    reader.readAsText(file);
  });

  $('nt-delete-all').addEventListener('click', function () {
    if (!notes.length) { K.announce(status, 'There are no notes to delete.', 'info'); return; }
    if (!window.confirm('Delete all ' + notes.length + ' notes from this browser? Export them first if you want a backup. This cannot be undone.')) return;
    notes = [];
    resetForm();
    save();
    render();
    K.announce(status, 'All notes deleted from this browser.', 'ok');
  });

  // Keep several open tabs in sync.
  window.addEventListener('storage', function (e) {
    if (e.key === KEY) { notes = load(); render(); }
  });

  notes = load();
  if (!storageOk) storageWarning.hidden = false;
  resetForm();
  render();
})();
