(function () {
  'use strict';
  var K = window.StudyKit;
  var $ = function (id) { return document.getElementById(id); };
  var MAX = 20000;
  var status = $('ts-status');
  var input = $('ts-input');
  var voiceSel = $('ts-voice');
  var rate = $('ts-rate');
  var playBtn = $('ts-play');
  var pauseBtn = $('ts-pause');
  var stopBtn = $('ts-stop');
  var synth = window.speechSynthesis;
  var voices = [];
  var state = 'idle'; // idle | speaking | paused

  if (!synth || typeof window.SpeechSynthesisUtterance !== 'function') {
    $('ts-unsupported').hidden = false;
    playBtn.disabled = true;
    return;
  }

  function setState(s) {
    state = s;
    pauseBtn.disabled = s === 'idle';
    stopBtn.disabled = s === 'idle';
    pauseBtn.textContent = s === 'paused' ? 'Resume' : 'Pause';
    playBtn.textContent = s === 'idle' ? 'Play' : 'Play from start';
  }

  function loadVoices() {
    var list = synth.getVoices() || [];
    if (!list.length) return;
    var sel = voiceSel.options[voiceSel.selectedIndex];
    var keep = sel && sel.dataset.uri;
    voices = list.slice().sort(function (a, b) { return (a.lang + a.name).localeCompare(b.lang + b.name); });
    voiceSel.innerHTML = '';
    var def = document.createElement('option');
    def.value = ''; def.textContent = 'Default voice';
    voiceSel.appendChild(def);
    voices.forEach(function (v, i) {
      var o = document.createElement('option');
      o.value = String(i);
      o.textContent = v.name + ' (' + v.lang + ')' + (v.localService ? '' : ' – online');
      o.dataset.uri = v.voiceURI;
      voiceSel.appendChild(o);
    });
    if (keep) {
      for (var j = 0; j < voiceSel.options.length; j++) if (voiceSel.options[j].dataset.uri === keep) voiceSel.selectedIndex = j;
    }
  }
  loadVoices();
  if ('onvoiceschanged' in synth) synth.addEventListener('voiceschanged', loadVoices);

  function chunks(text) {
    // Long utterances stop early in some browsers, so speak sentence-sized pieces.
    var parts = text.match(/[^.!?。؟۔\n]+[.!?。؟۔]*\s*|\n+/g) || [text];
    var out = [];
    var buf = '';
    parts.forEach(function (p) {
      if ((buf + p).length > 220 && buf) { out.push(buf); buf = ''; }
      buf += p;
    });
    if (buf.trim()) out.push(buf);
    return out.filter(function (c) { return c.trim(); });
  }

  var queueId = 0;
  function play() {
    var text = input.value.trim();
    if (!text) { K.announce(status, 'Type or paste some text to read aloud first.', 'error'); input.focus(); return; }
    if (text.length > MAX) { K.announce(status, 'That is more than ' + K.formatNumber(MAX) + ' characters. Read it in smaller parts.', 'error'); input.focus(); return; }
    synth.cancel();
    var id = ++queueId;
    var pieces = chunks(text);
    var voice = voiceSel.value === '' ? null : voices[Number(voiceSel.value)];
    var r = Number(rate.value) || 1;
    pieces.forEach(function (piece, i) {
      var u = new window.SpeechSynthesisUtterance(piece);
      if (voice) { u.voice = voice; u.lang = voice.lang; }
      u.rate = r;
      if (i === pieces.length - 1) {
        u.onend = function () { if (id === queueId) { setState('idle'); K.announce(status, 'Finished reading.', 'ok'); } };
      }
      u.onerror = function (e) {
        if (id !== queueId || e.error === 'interrupted' || e.error === 'canceled') return;
        setState('idle');
        K.announce(status, 'Your browser could not read the text aloud (' + e.error + '). Try another voice.', 'error');
      };
      synth.speak(u);
    });
    setState('speaking');
    K.announce(status, 'Reading aloud' + (voice ? ' with ' + voice.name : '') + '.', 'info');
  }

  playBtn.addEventListener('click', play);
  pauseBtn.addEventListener('click', function () {
    if (state === 'speaking') { synth.pause(); setState('paused'); K.announce(status, 'Paused.', 'info'); }
    else if (state === 'paused') { synth.resume(); setState('speaking'); K.announce(status, 'Resumed.', 'info'); }
  });
  stopBtn.addEventListener('click', function () {
    queueId++;
    synth.cancel();
    setState('idle');
    K.announce(status, 'Stopped.', 'ok');
    playBtn.focus();
  });
  $('ts-clear').addEventListener('click', function () {
    if (!input.value) { K.announce(status, 'The text box is already empty.', 'info'); input.focus(); return; }
    queueId++;
    synth.cancel();
    setState('idle');
    input.value = '';
    input.focus();
    K.announce(status, 'Text cleared.', 'ok');
  });
  rate.addEventListener('input', function () { $('ts-rate-value').textContent = Number(rate.value).toFixed(1); });
  window.addEventListener('pagehide', function () { synth.cancel(); });
  setState('idle');
})();
