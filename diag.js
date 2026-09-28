/* MeP Diagnose-Panel (nur Entwicklungsmodus)
 * Einschalten: Adresse mit ?debug=1 öffnen. Ausschalten: ?debug=0 oder Knopf «Aus».
 * Zeigt Umgebung, Status der Spracherkennung, Mikrofon-Berechtigung, AudioContext,
 * MIME-Type und einen Live-Pegel. Der Mikrofon-Test hält das Mikrofon nur solange
 * offen, bis er gestoppt wird oder die Spracherkennung startet (nie beides zugleich).
 */
(function () {
  'use strict';
  var KEY = 'mep.debug';
  var on = false;
  try {
    var q = new URLSearchParams(location.search).get('debug');
    if (q === '1') localStorage.setItem(KEY, '1');
    if (q === '0') localStorage.removeItem(KEY);
    on = localStorage.getItem(KEY) === '1';
  } catch (e) { on = /[?&]debug=1\b/.test(location.search); }

  var t0 = Date.now();
  var events = [];
  var st = {};
  var testing = false, pending = false, stream = null, ctx = null, analyser = null, raf = 0, autoStop = 0;
  var el = null;

  function now() { return ((Date.now() - t0) / 1000).toFixed(1); }
  function log(type, detail) {
    if (!on) return;
    events.push(now() + 's ' + type + (detail ? ' · ' + detail : ''));
    if (events.length > 80) events.shift();
    renderLog();
  }
  function set(key, val) {
    if (!on) return;
    st[key] = val;
    renderRows();
  }

  // ---------- Mikrofon-Test (getUserMedia + AnalyserNode) ----------
  function stopTest(reason) {
    if (!testing && !pending && !stream && !ctx) return;
    cancelAnimationFrame(raf); clearTimeout(autoStop);
    if (stream) { stream.getTracks().forEach(function (t) { try { t.stop(); } catch (e) { /* */ } }); }
    stream = null; analyser = null;
    if (ctx) { var c = ctx; ctx = null; try { c.close(); } catch (e) { /* */ } set('ctx', 'closed'); }
    testing = false; pending = false;
    set('level', 0);
    if (st.peakDb != null) log('Spitzenpegel', (st.peakDb > -120 ? st.peakDb.toFixed(0) : '–∞') + ' dB');
    st.peakDb = null;
    log('Mikrofon-Test gestoppt', reason || '');
    paintTestBtn();
  }

  function startTest() {
    if (testing || pending) { stopTest('von Hand'); return; }
    // Spracherkennung und Test dürfen das Mikrofon nie gleichzeitig halten
    if (window.MepMic && window.MepMic.busy()) window.MepMic.stop();

    // 1. AudioContext direkt im Tipp erzeugen und entsperren (iOS verlangt die Geste)
    var AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) { set('ctx', 'nicht vorhanden'); log('AudioContext fehlt'); }
    else {
      try {
        ctx = new AC();
        set('ctx', ctx.state + ' · ' + ctx.sampleRate + ' Hz');
        ctx.onstatechange = function () { if (ctx) { set('ctx', ctx.state + ' · ' + ctx.sampleRate + ' Hz'); log('AudioContext', ctx.state); } };
        if (ctx.state === 'suspended') {
          ctx.resume().then(function () { log('AudioContext resume()', ctx && ctx.state); }, function (e) { log('resume() Fehler', e.name + ': ' + e.message); });
        }
      } catch (e) { set('ctx', 'Fehler ' + e.name + ': ' + e.message); log('AudioContext Fehler', e.name); }
    }

    // 2. getUserMedia
    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
      set('gum', 'navigator.mediaDevices fehlt (nur HTTPS)');
      log('getUserMedia fehlt');
      stopTest('kein getUserMedia');
      return;
    }
    pending = true; paintTestBtn();
    set('gum', 'fragt an …');
    log('getUserMedia angefragt');
    navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true } })
      .then(function (s) {
        if (!pending) { s.getTracks().forEach(function (t) { t.stop(); }); return; } // inzwischen abgebrochen
        pending = false; testing = true; stream = s;
        var track = s.getAudioTracks()[0];
        var info = track ? (track.label || 'Mikrofon') : 'keine Spur';
        try { var ts = track.getSettings(); if (ts.sampleRate) info += ' · ' + ts.sampleRate + ' Hz'; } catch (e) { /* */ }
        set('gum', 'ok · ' + info);
        set('perm', 'granted');
        log('getUserMedia ok', info);
        if (track) track.onended = function () { log('Mikrofon-Spur beendet'); };
        // MIME-Type, den MediaRecorder für diesen Stream wählen würde (Safari: audio/mp4)
        // Format explizit wählen: Safari auf iOS nimmt nur audio/mp4 (AAC)
        if (window.MediaRecorder) {
          var pick = ['audio/mp4', 'audio/webm;codecs=opus', 'audio/webm'].filter(function (t) {
            return !MediaRecorder.isTypeSupported || MediaRecorder.isTypeSupported(t);
          })[0];
          try {
            var mr = pick ? new MediaRecorder(s, { mimeType: pick }) : new MediaRecorder(s);
            set('mime', (mr.mimeType || pick || 'Standard') + supportList());
          } catch (e) { set('mime', 'MediaRecorder Fehler ' + e.name + ': ' + e.message + supportList()); }
        } else set('mime', 'MediaRecorder fehlt');
        if (ctx) {
          try {
            var src = ctx.createMediaStreamSource(s);
            analyser = ctx.createAnalyser();
            analyser.fftSize = 1024;
            src.connect(analyser);
            meter();
          } catch (e) { log('Analyser Fehler', e.name + ': ' + e.message); }
        }
        autoStop = setTimeout(function () { stopTest('nach 20 s automatisch'); }, 20000);
        paintTestBtn();
      }, function (err) {
        pending = false;
        set('gum', 'Fehler ' + err.name + ': ' + err.message);
        if (err.name === 'NotAllowedError') set('perm', 'denied');
        set('err', err.name + ': ' + err.message);
        log('getUserMedia Fehler', err.name + ': ' + err.message);
        stopTest('Fehler');
      });
  }

  function supportList() {
    if (!window.MediaRecorder || !MediaRecorder.isTypeSupported) return '';
    var types = ['audio/mp4', 'audio/aac', 'audio/webm', 'audio/ogg'];
    return ' · unterstützt: ' + types.filter(function (t) { return MediaRecorder.isTypeSupported(t); }).join(', ');
  }

  function meter() {
    if (!analyser) return;
    var buf = new Uint8Array(analyser.fftSize);
    analyser.getByteTimeDomainData(buf);
    var sum = 0;
    for (var i = 0; i < buf.length; i++) { var v = (buf[i] - 128) / 128; sum += v * v; }
    var rms = Math.sqrt(sum / buf.length);
    // Spitzenwert halten und langsam abfallen lassen: auf dem Handy gut ablesbar
    st.level = Math.max(Math.min(1, rms * 4), (st.level || 0) * 0.97);
    st.peakDb = Math.max(st.peakDb == null ? -120 : st.peakDb, rms > 0 ? 20 * Math.log10(rms) : -120);
    st.levelDb = (rms > 0 ? (20 * Math.log10(rms)).toFixed(0) : '–∞') + ' dB · Spitze ' + (st.peakDb > -120 ? st.peakDb.toFixed(0) : '–∞') + ' dB';
    paintLevel();
    raf = requestAnimationFrame(meter);
  }

  // ---------- Berechtigung ----------
  function watchPermission() {
    if (!navigator.permissions || !navigator.permissions.query) { set('perm', 'nicht abfragbar (Permissions API fehlt)'); return; }
    navigator.permissions.query({ name: 'microphone' }).then(function (p) {
      set('perm', p.state);
      p.onchange = function () { set('perm', p.state); log('Berechtigung', p.state); };
    }, function (e) { set('perm', 'nicht abfragbar (' + e.name + ')'); });
  }

  // ---------- Oberfläche ----------
  var ROWS = [
    ['env', 'Umgebung'], ['secure', 'Sicherer Kontext'], ['sr', 'Spracherkennung'], ['srState', 'SR-Status'],
    ['mode', 'Mikrofon-Knopf'], ['md', 'mediaDevices'], ['perm', 'Berechtigung'], ['gum', 'getUserMedia'],
    ['ctx', 'AudioContext'], ['mime', 'MIME-Type'], ['err', 'Letzter Fehler']
  ];

  function css() {
    var s = document.createElement('style');
    s.textContent =
      '#mepDiag{position:fixed;left:0;right:0;top:0;z-index:50;padding:calc(env(safe-area-inset-top,0px) + 6px) 10px 8px;' +
      'background:rgba(8,14,16,.94);color:#D8E6E4;font:12px/1.35 ui-monospace,SFMono-Regular,Menlo,Consolas,monospace;box-shadow:0 6px 18px rgba(0,0,0,.35)}' +
      '#mepDiag .dh{display:flex;align-items:center;gap:8px}' +
      '#mepDiag .dh b{font-weight:700;color:#F0AA45;letter-spacing:.06em}' +
      '#mepDiag .sum{flex:1;min-width:0;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;color:#9FB3B6}' +
      '#mepDiag button{font:600 12px ui-monospace,Menlo,monospace;color:#10171A;background:#D8E6E4;border:0;border-radius:6px;padding:6px 8px;cursor:pointer}' +
      '#mepDiag button.hot{background:#F0AA45}' +
      '#mepDiag .db{margin-top:6px;max-height:52vh;overflow:auto}' +
      '#mepDiag.min .db{display:none}' +
      '#mepDiag dl{display:grid;grid-template-columns:118px 1fr;gap:2px 8px;margin:0}' +
      '#mepDiag dt{color:#8FA3A7}#mepDiag dd{margin:0;overflow-wrap:anywhere}' +
      '#mepDiag .ok{color:#79C06A}#mepDiag .bad{color:#FF6B73}#mepDiag .warn{color:#F0AA45}' +
      '#mepDiag .lv{display:flex;align-items:center;gap:8px;margin:6px 0}' +
      '#mepDiag .lv i{flex:1;height:10px;border-radius:5px;background:#26343A;overflow:hidden}' +
      '#mepDiag .lv i s{display:block;height:100%;width:0;background:linear-gradient(90deg,#79C06A,#F0AA45 70%,#FF6B73);transition:width .06s linear}' +
      '#mepDiag .row{display:flex;gap:6px;flex-wrap:wrap;margin:6px 0}' +
      '.top{top:var(--diag-h,0px)!important}' +
      '#mepDiag pre{margin:4px 0 0;white-space:pre-wrap;color:#B8CACC;max-height:22vh;overflow:auto}';
    document.head.appendChild(s);
  }

  function build() {
    css();
    el = document.createElement('div');
    el.id = 'mepDiag';
    el.setAttribute('role', 'region');
    el.setAttribute('aria-label', 'Diagnose');
    el.innerHTML =
      '<div class="dh"><b>DIAGNOSE</b><span class="sum" id="dSum"></span>' +
      '<button type="button" id="dMin">Einklappen</button></div>' +
      '<div class="db"><dl id="dRows"></dl>' +
      '<div class="lv"><span>Pegel</span><i><s id="dLvl"></s></i><span id="dDb">–</span></div>' +
      '<div class="row"><button type="button" id="dTest">Mikrofon-Test starten</button>' +
      '<button type="button" id="dCopy">Protokoll kopieren</button>' +
      '<button type="button" id="dClear">Leeren</button>' +
      '<button type="button" id="dOff">Aus</button></div>' +
      '<pre id="dLog"></pre></div>';
    document.body.appendChild(el);
    try { if (localStorage.getItem(KEY + '.min') === '1') el.classList.add('min'); } catch (e) { /* */ }
    paintMinBtn();
    el.querySelector('#dMin').addEventListener('click', function () {
      el.classList.toggle('min');
      try { localStorage.setItem(KEY + '.min', el.classList.contains('min') ? '1' : '0'); } catch (e) { /* */ }
      paintMinBtn();
    });
    el.querySelector('#dTest').addEventListener('click', startTest);
    el.querySelector('#dClear').addEventListener('click', function () { events = []; st.err = ''; renderRows(); renderLog(); });
    el.querySelector('#dOff').addEventListener('click', function () {
      stopTest('Diagnose aus');
      try { localStorage.removeItem(KEY); } catch (e) { /* */ }
      on = false; el.remove(); document.body.style.paddingTop = '';
      document.documentElement.style.removeProperty('--diag-h');
    });
    el.querySelector('#dCopy').addEventListener('click', function () {
      var txt = report();
      var btn = el.querySelector('#dCopy');
      if (navigator.clipboard && navigator.clipboard.writeText) {
        navigator.clipboard.writeText(txt).then(function () { btn.textContent = 'Kopiert'; setTimeout(function () { btn.textContent = 'Protokoll kopieren'; }, 1600); },
          function () { fallbackCopy(txt); });
      } else fallbackCopy(txt);
    });
    renderRows(); renderLog();
  }
  function paintMinBtn() { if (el) el.querySelector('#dMin').textContent = el.classList.contains('min') ? 'Aufklappen' : 'Einklappen'; }
  function paintTestBtn() {
    if (!el) return;
    var b = el.querySelector('#dTest');
    b.textContent = pending ? 'wartet auf Erlaubnis …' : testing ? 'Mikrofon-Test stoppen' : 'Mikrofon-Test starten';
    b.classList.toggle('hot', testing || pending);
  }
  function fallbackCopy(txt) {
    var ta = document.createElement('textarea'); ta.value = txt; ta.style.cssText = 'position:fixed;top:0;left:0;opacity:0';
    document.body.appendChild(ta); ta.select();
    try { document.execCommand('copy'); } catch (e) { /* */ }
    ta.remove();
  }
  function cls(key, v) {
    v = String(v || '');
    if (/^(ok|granted|running|hört zu|ja)/.test(v)) return 'ok';
    if (/Fehler|denied|fehlt|hängt|nein|closed|not-allowed|Error/i.test(v)) return key === 'ctx' && v.indexOf('closed') === 0 ? '' : 'bad';
    if (/suspended|prompt|startet|fragt/.test(v)) return 'warn';
    return '';
  }
  function renderRows() {
    if (!el) return;
    var h = '';
    ROWS.forEach(function (r) {
      var v = st[r[0]] == null || st[r[0]] === '' ? '–' : st[r[0]];
      h += '<dt>' + r[1] + '</dt><dd class="' + cls(r[0], v) + '">' + esc(v) + '</dd>';
    });
    el.querySelector('#dRows').innerHTML = h;
    el.querySelector('#dSum').textContent = 'SR: ' + (st.srState || '–') + ' · Perm: ' + (st.perm || '–') + ' · Ctx: ' + String(st.ctx || '–').split(' ')[0];
    document.body.style.paddingTop = el.offsetHeight + 'px';
    document.documentElement.style.setProperty('--diag-h', el.offsetHeight + 'px');
  }
  function paintLevel() {
    if (!el) return;
    el.querySelector('#dLvl').style.width = Math.round((st.level || 0) * 100) + '%';
    el.querySelector('#dDb').textContent = st.levelDb || '–';
  }
  function renderLog() {
    if (!el) return;
    el.querySelector('#dLog').textContent = events.slice(-14).reverse().join('\n');
  }
  function esc(s) { return String(s).replace(/[&<>"]/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]; }); }
  function report() {
    var lines = ['MeP Diagnose ' + new Date().toLocaleString('de-CH'), navigator.userAgent, ''];
    ROWS.forEach(function (r) { lines.push(r[1] + ': ' + (st[r[0]] || '–')); });
    lines.push('Pegel: ' + (st.levelDb || '–'), '', 'Ereignisse:');
    return lines.concat(events).join('\n');
  }

  function envInfo() {
    var ua = navigator.userAgent;
    var ios = (ua.match(/OS (\d+)_(\d+)/) || [])[0];
    var standalone = navigator.standalone === true || (window.matchMedia && matchMedia('(display-mode: standalone)').matches);
    set('env', (ios ? 'iOS ' + ios.slice(3).replace('_', '.') : navigator.platform) + ' · ' + (standalone ? 'Home-Bildschirm-App (standalone)' : 'Browser-Tab'));
    set('secure', (window.isSecureContext ? 'ja' : 'nein') + ' · ' + location.protocol.replace(':', ''));
    set('sr', window.SpeechRecognition ? 'SpeechRecognition' : window.webkitSpeechRecognition ? 'webkitSpeechRecognition' : 'fehlt');
    set('md', navigator.mediaDevices && navigator.mediaDevices.getUserMedia ? 'vorhanden' : 'fehlt');
    set('gum', 'nicht getestet');
    set('ctx', 'nicht erstellt');
    set('srState', 'bereit');
  }

  window.MepDiag = {
    enabled: function () { return on; },
    log: log,
    set: set,
    releaseMic: function () { if (testing || pending) stopTest('Spracherkennung startet'); }
  };

  if (!on) return;
  var init = function () {
    build(); envInfo(); watchPermission(); log('Diagnose aktiv');
    document.addEventListener('visibilitychange', function () {
      log('Sichtbarkeit', document.hidden ? 'Hintergrund' : 'Vordergrund');
      if (document.hidden) stopTest('App im Hintergrund');
      else if (ctx && ctx.state === 'suspended') ctx.resume();
    });
    window.addEventListener('pageshow', function (e) { if (e.persisted) log('aus Cache wiederhergestellt (bfcache)'); });
  };
  if (document.body) init(); else document.addEventListener('DOMContentLoaded', init);
})();
