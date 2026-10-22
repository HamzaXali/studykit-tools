(function () {
  'use strict';
  var S = window.StudyKitStudy;
  var K = window.StudyKit;
  var KEY = 'studykit.flashcards.v1';
  var $ = function (id) { return document.getElementById(id); };
  var status = $('fc-status');
  var pStatus = $('fc-practice-status');
  var deckSel = $('fc-deck');
  var decks = [];
  var storageOk = true;
  var session = null;

  function uid() { return Date.now().toString(36) + Math.random().toString(36).slice(2, 8); }
  function load() {
    try {
      var raw = window.localStorage.getItem(KEY);
      return raw ? S.normaliseDecks(JSON.parse(raw)) : [];
    } catch (e) { storageOk = false; return []; }
  }
  function save() {
    try { window.localStorage.setItem(KEY, JSON.stringify(decks)); storageOk = true; }
    catch (e) { storageOk = false; }
    $('fc-storage-warning').hidden = storageOk;
  }
  function current() {
    for (var i = 0; i < decks.length; i++) if (decks[i].id === deckSel.value) return decks[i];
    return decks[0] || null;
  }

  function renderDecks(selectId) {
    var keep = selectId || deckSel.value;
    deckSel.innerHTML = '';
    decks.forEach(function (d) {
      var o = document.createElement('option');
      o.value = d.id;
      o.textContent = d.name + ' (' + d.cards.length + ' card' + (d.cards.length === 1 ? '' : 's') + ')';
      deckSel.appendChild(o);
    });
    if (keep && decks.some(function (d) { return d.id === keep; })) deckSel.value = keep;
    renderCards();
  }
  function renderCards() {
    var d = current();
    var list = $('fc-list');
    list.innerHTML = '';
    $('fc-delete-deck').disabled = !d;
    if (!d) { $('fc-count').textContent = 'No decks yet. Create one above, or just add a card to start a deck called “My cards”.'; return; }
    $('fc-count').textContent = d.cards.length ? d.cards.length + ' card' + (d.cards.length === 1 ? '' : 's') + ' in “' + d.name + '”.' : 'This deck has no cards yet.';
    d.cards.forEach(function (c, i) {
      var li = document.createElement('li');
      li.className = 'card-item';
      var q = document.createElement('p'); q.className = 'card-front'; q.textContent = c.front;
      var a = document.createElement('p'); a.className = 'card-back'; a.textContent = c.back;
      var b = document.createElement('button');
      b.type = 'button'; b.className = 'secondary';
      b.textContent = 'Delete card ' + (i + 1);
      b.addEventListener('click', function () {
        d.cards = d.cards.filter(function (x) { return x.id !== c.id; });
        save(); renderDecks();
        var btns = $('fc-list').querySelectorAll('button');
        (btns[Math.min(i, btns.length - 1)] || $('fc-front')).focus();
        K.announce(status, 'Card deleted.', 'ok');
      });
      li.appendChild(q); li.appendChild(a); li.appendChild(b);
      list.appendChild(li);
    });
  }

  $('fc-create-deck').addEventListener('click', function () {
    var input = $('fc-new-deck');
    var name = input.value.replace(/\s+/g, ' ').trim();
    if (!name) { input.setAttribute('aria-invalid', 'true'); $('fc-deck-error').textContent = 'Type a name for the new deck.'; input.focus(); return; }
    if (decks.some(function (d) { return d.name.toLowerCase() === name.toLowerCase(); })) { input.setAttribute('aria-invalid', 'true'); $('fc-deck-error').textContent = 'You already have a deck with this name.'; input.focus(); return; }
    input.removeAttribute('aria-invalid'); $('fc-deck-error').textContent = '';
    var d = { id: uid(), name: name.slice(0, 100), cards: [] };
    decks.push(d); save(); renderDecks(d.id);
    input.value = '';
    K.announce(status, 'Deck “' + d.name + '” created and selected.', 'ok');
    $('fc-front').focus();
  });
  $('fc-delete-deck').addEventListener('click', function () {
    var d = current();
    if (!d) return;
    if (!window.confirm('Delete the deck “' + d.name + '” and its ' + d.cards.length + ' card(s)? This cannot be undone.')) return;
    decks = decks.filter(function (x) { return x.id !== d.id; });
    save(); renderDecks();
    endPractice();
    K.announce(status, 'Deck “' + d.name + '” deleted.', 'ok');
    deckSel.focus();
  });
  deckSel.addEventListener('change', function () { renderCards(); endPractice(); });

  $('fc-form').addEventListener('submit', function (e) {
    e.preventDefault();
    var f = $('fc-front'); var b = $('fc-back');
    var front = f.value.trim(); var back = b.value.trim();
    var err = $('fc-form-error');
    if (!front || !back) {
      err.textContent = 'Fill in both the front and the back of the card.';
      (front ? b : f).setAttribute('aria-invalid', 'true');
      (front ? b : f).focus();
      return;
    }
    f.removeAttribute('aria-invalid'); b.removeAttribute('aria-invalid'); err.textContent = '';
    var d = current();
    if (!d) { d = { id: uid(), name: 'My cards', cards: [] }; decks.push(d); }
    d.cards.push({ id: uid(), front: front.slice(0, 2000), back: back.slice(0, 2000) });
    save(); renderDecks(d.id);
    f.value = ''; b.value = '';
    f.focus();
    K.announce(status, 'Card added to “' + d.name + '”.', 'ok');
  });

  // ---- Practice ----
  function showCard() {
    var c = session.queue[0];
    session.flipped = false;
    $('fc-side').textContent = 'Front';
    $('fc-card-text').textContent = c.front;
    $('fc-card').classList.remove('is-flipped');
    $('fc-know').disabled = true; $('fc-again').disabled = true;
    $('fc-flip').textContent = 'Flip card';
    $('fc-progress').textContent = 'Known: ' + session.known + ' of ' + session.total + '. Cards left this round: ' + session.queue.length + '.';
  }
  function endPractice() { session = null; $('fc-practice').hidden = true; }
  $('fc-start').addEventListener('click', function () {
    var d = current();
    if (!d || !d.cards.length) { K.announce(pStatus, 'Add at least one card to this deck first.', 'error'); return; }
    var cards = $('fc-shuffle').checked ? S.shuffle(d.cards) : d.cards.slice();
    session = { queue: cards, known: 0, total: cards.length, flipped: false, reviews: 0 };
    $('fc-practice').hidden = false;
    showCard();
    $('fc-flip').focus();
    K.announce(pStatus, 'Practice started with ' + cards.length + ' card' + (cards.length === 1 ? '' : 's') + '.', 'info');
  });
  $('fc-flip').addEventListener('click', function () {
    if (!session) return;
    var c = session.queue[0];
    session.flipped = !session.flipped;
    $('fc-side').textContent = session.flipped ? 'Back' : 'Front';
    $('fc-card-text').textContent = session.flipped ? c.back : c.front;
    $('fc-card').classList.toggle('is-flipped', session.flipped);
    $('fc-flip').textContent = session.flipped ? 'Show front' : 'Flip card';
    $('fc-know').disabled = false; $('fc-again').disabled = false;
  });
  function answer(knew) {
    if (!session) return;
    var c = session.queue.shift();
    if (knew) session.known++; else { session.queue.push(c); session.reviews++; }
    if (!session.queue.length) {
      var msg = 'Well done! You knew all ' + session.total + ' card' + (session.total === 1 ? '' : 's') + (session.reviews ? ', after ' + session.reviews + ' review' + (session.reviews === 1 ? '' : 's') : ' first time') + '.';
      endPractice();
      K.announce(pStatus, msg, 'ok');
      $('fc-start').focus();
      return;
    }
    showCard();
    $('fc-flip').focus();
  }
  $('fc-know').addEventListener('click', function () { answer(true); });
  $('fc-again').addEventListener('click', function () { answer(false); });

  // ---- Backup ----
  $('fc-export').addEventListener('click', function () {
    if (!decks.length) { K.announce(status, 'There are no decks to export yet.', 'error'); return; }
    K.downloadText('studykit-flashcards-' + new Date().toISOString().slice(0, 10) + '.json', JSON.stringify(decks, null, 2), 'application/json');
    K.announce(status, 'Backup file created. Check your downloads.', 'ok');
  });
  $('fc-import').addEventListener('change', function () {
    var file = this.files && this.files[0];
    var input = this;
    if (!file) return;
    if (file.size > 5 * 1024 * 1024) { K.announce(status, 'That file is too large to be a flashcards backup.', 'error'); input.value = ''; return; }
    file.text().then(function (txt) {
      var incoming;
      try { incoming = S.normaliseDecks(JSON.parse(txt)); } catch (e) { incoming = []; }
      if (!incoming.length) { K.announce(status, 'No decks were found in that file. Choose a JSON backup made by this tool.', 'error'); return; }
      var cards = 0;
      incoming.forEach(function (d) {
        d.id = uid();
        d.cards.forEach(function (c) { c.id = uid(); });
        cards += d.cards.length;
        var name = d.name; var n = 2;
        while (decks.some(function (x) { return x.name === d.name; })) d.name = name + ' (' + (n++) + ')';
        decks.push(d);
      });
      save(); renderDecks(incoming[0].id);
      K.announce(status, 'Imported ' + incoming.length + ' deck' + (incoming.length === 1 ? '' : 's') + ' with ' + cards + ' card' + (cards === 1 ? '' : 's') + '.', 'ok');
    }).finally(function () { input.value = ''; });
  });

  window.addEventListener('storage', function (e) { if (e.key === KEY) { decks = load(); renderDecks(); } });
  decks = load();
  try { window.localStorage.setItem(KEY + '.test', '1'); window.localStorage.removeItem(KEY + '.test'); } catch (e) { storageOk = false; }
  $('fc-storage-warning').hidden = storageOk;
  renderDecks();
})();
