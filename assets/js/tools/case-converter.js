(function () {
  'use strict';
  var T = window.StudyKitText;
  var K = window.StudyKit;
  var input = document.getElementById('cc-input');
  var status = document.getElementById('cc-status');
  var smallWords = document.getElementById('cc-small-words');
  var acronyms = document.getElementById('cc-acronyms');
  var undoBtn = document.getElementById('cc-undo');
  var names = { upper: 'UPPERCASE', lower: 'lowercase', title: 'Title Case', sentence: 'Sentence case' };
  var previous = null;

  function setUndo(value) {
    previous = value;
    undoBtn.disabled = previous === null;
  }

  Array.prototype.forEach.call(document.querySelectorAll('[data-case]'), function (btn) {
    btn.addEventListener('click', function () {
      var mode = btn.getAttribute('data-case');
      if (!input.value.trim()) {
        K.announce(status, 'Type or paste some text first, then choose a case.', 'error');
        input.focus();
        return;
      }
      var result = T.convertCase(input.value, mode, { smallWords: smallWords.checked, keepAcronyms: acronyms.checked });
      if (result === input.value) {
        K.announce(status, 'The text is already in ' + names[mode] + '. Nothing changed.', 'info');
        return;
      }
      setUndo(input.value);
      input.value = result;
      K.announce(status, 'Converted to ' + names[mode] + '. Use Undo to go back.', 'ok');
    });
  });
  undoBtn.addEventListener('click', function () {
    if (previous === null) return;
    input.value = previous;
    setUndo(null);
    input.focus();
    K.announce(status, 'Undone. Your previous text is back.', 'ok');
  });
  K.bindCopy(document.getElementById('cc-copy'), input, status, 'The text box');
  document.getElementById('cc-clear').addEventListener('click', function () {
    if (!input.value) { K.announce(status, 'The text box is already empty.', 'info'); input.focus(); return; }
    setUndo(input.value);
    input.value = '';
    input.focus();
    K.announce(status, 'Text cleared. Use Undo if that was a mistake.', 'ok');
  });
  setUndo(null);
})();
