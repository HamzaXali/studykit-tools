(function () {
  'use strict';
  var S = window.StudyKitStudy;
  var K = window.StudyKit;
  var $ = function (id) { return document.getElementById(id); };
  var LABEL = { focus: 'Focus', short: 'Short break', long: 'Long break' };
  var status = $('pm-status');
  var clock = $('pm-clock');
  var startBtn = $('pm-start');
  var fields = { focus: $('pm-focus'), short: $('pm-short'), long: $('pm-long'), every: $('pm-every') };
  var LIMITS = { focus: [1, 180], short: [1, 60], long: [1, 90], every: [2, 10] };
  var phase = 'focus';
  var completed = 0;
  var remaining = 25 * 60 * 1000;
  var endAt = 0;
  var running = false;
  var tick = null;
  var audio = null;
  var fresh = true; // the current phase has not been started yet

  function val(key) {
    var input = fields[key];
    var v = S.parseNum(input.value);
    var lim = LIMITS[key];
    var ok = v !== null && !isNaN(v) && v === Math.floor(v) && v >= lim[0] && v <= lim[1];
    var err = $(input.id + '-error');
    if (ok) { input.removeAttribute('aria-invalid'); err.textContent = ''; }
    else { input.setAttribute('aria-invalid', 'true'); err.textContent = 'Enter a whole number from ' + lim[0] + ' to ' + lim[1] + '.'; }
    return ok ? v : null;
  }
  function phaseMs(p) { var v = val(p); return (v === null ? { focus: 25, short: 5, long: 15 }[p] : v) * 60000; }

  function render() {
    var text = S.formatClock(remaining / 1000);
    clock.textContent = text;
    $('pm-phase').textContent = LABEL[phase];
    $('pm-count').textContent = 'Focus sessions completed: ' + completed;
    document.title = (running ? text + ' ' + LABEL[phase] + ' – ' : '') + 'Pomodoro Study Timer: Focus and Break Timer | StudyKit Hub';
    startBtn.textContent = running ? 'Pause' : (fresh ? 'Start' : 'Resume');
    document.body.dataset.phase = phase;
  }

  function beep() {
    if (!$('pm-sound').checked) return;
    try {
      var Ctx = window.AudioContext || window.webkitAudioContext;
      if (!Ctx) return;
      audio = audio || new Ctx();
      [0, 0.35, 0.7].forEach(function (t) {
        var o = audio.createOscillator();
        var g = audio.createGain();
        o.frequency.value = 880;
        g.gain.setValueAtTime(0.0001, audio.currentTime + t);
        g.gain.exponentialRampToValueAtTime(0.3, audio.currentTime + t + 0.02);
        g.gain.exponentialRampToValueAtTime(0.0001, audio.currentTime + t + 0.25);
        o.connect(g); g.connect(audio.destination);
        o.start(audio.currentTime + t); o.stop(audio.currentTime + t + 0.3);
      });
    } catch (e) { /* sound is optional */ }
  }
  function notify(msg) {
    if (!$('pm-notify').checked || !('Notification' in window) || Notification.permission !== 'granted') return;
    try { new Notification('StudyKit Hub timer', { body: msg }); } catch (e) { /* some mobile browsers only allow notifications from an installed app */ }
  }

  function stopTicking() { if (tick) { window.clearInterval(tick); tick = null; } }
  function loop() {
    if (!running) return;
    remaining = Math.max(0, endAt - Date.now());
    if (remaining === 0) { finish(); return; }
    render();
  }
  function start() {
    if (running) return;
    var bad = Object.keys(fields).filter(function (k) { return val(k) === null; });
    if (bad.length) { K.announce(status, 'Fix the session lengths first.', 'error'); fields[bad[0]].focus(); return; }
    if (audio && audio.state === 'suspended') audio.resume();
    running = true;
    fresh = false;
    endAt = Date.now() + remaining;
    stopTicking();
    tick = window.setInterval(loop, 250);
    render();
    K.announce(status, LABEL[phase] + ' started.', 'info');
  }
  function pause() {
    if (!running) return;
    remaining = Math.max(0, endAt - Date.now());
    running = false;
    stopTicking();
    render();
    K.announce(status, 'Paused at ' + S.formatClock(remaining / 1000) + '.', 'info');
  }
  function goTo(next) {
    phase = next;
    fresh = true;
    remaining = phaseMs(phase);
  }
  function finish(skipped) {
    var was = phase;
    running = false;
    stopTicking();
    if (was === 'focus' && !skipped) completed++;
    var next = S.nextPhase(was, completed, val('every') || 4);
    if (was === 'focus' && skipped) next = 'short';
    goTo(next);
    var msg = (skipped ? 'Skipped. ' : LABEL[was] + ' finished. ') + 'Next: ' + LABEL[next] + ' (' + S.formatClock(remaining / 1000) + ').';
    if (!skipped) { beep(); notify(msg); }
    render();
    K.announce(status, msg, 'ok');
    if (!skipped && $('pm-auto').checked) start();
  }

  startBtn.addEventListener('click', function () { if (running) pause(); else start(); });
  $('pm-reset').addEventListener('click', function () {
    running = false; stopTicking();
    fresh = true;
    remaining = phaseMs(phase);
    render();
    K.announce(status, LABEL[phase] + ' reset to ' + S.formatClock(remaining / 1000) + '.', 'ok');
  });
  $('pm-skip').addEventListener('click', function () { finish(true); });
  Object.keys(fields).forEach(function (k) {
    fields[k].addEventListener('input', function () {
      // Changing the length of a phase that has not started yet updates the clock straight away.
      if (val(k) !== null && k === phase && fresh && !running) { remaining = phaseMs(phase); render(); }
    });
  });
  $('pm-notify').addEventListener('change', function () {
    var box = this;
    if (!box.checked) return;
    if (!('Notification' in window)) { box.checked = false; K.announce(status, 'This browser does not support notifications.', 'error'); return; }
    if (Notification.permission === 'granted') { K.announce(status, 'Notifications are on.', 'ok'); return; }
    if (Notification.permission === 'denied') { box.checked = false; K.announce(status, 'Notifications are blocked for this site. You can allow them in your browser’s site settings.', 'error'); return; }
    Notification.requestPermission().then(function (p) {
      if (p !== 'granted') { box.checked = false; K.announce(status, 'Notifications were not allowed.', 'info'); }
      else K.announce(status, 'Notifications are on.', 'ok');
    });
  });
  document.addEventListener('visibilitychange', loop);
  render();
})();
