/* MeP App-Logik */
(function () {
  'use strict';
  var P = window.MepParser;
  var KEY = 'mep.v1';
  var ORDER = ['warm', 'kalt', 'gemuese', 'patisserie', 'admin', 'allgemein'];
  var POSTEN = {};
  P.POSTEN.forEach(function (p) { POSTEN[p.id] = p; });
  var UNIT_OPTIONS = ['', 'kg', 'g', 'l', 'dl', 'cl', 'ml', 'Stk.', 'Port.', 'Pax', 'Bund', 'Kiste', 'Kisten', 'Blech', 'Bleche', 'GN', 'Schale', 'Schalen', 'Fl.', 'Dose', 'Dosen', 'Pack.', 'Beutel', 'Eimer'];

  var $ = function (id) { return document.getElementById(id); };
  var isArtifact = (function () { try { return window.self !== window.top; } catch (e) { return true; } })();

  // ---------- Zustand ----------
  function uid() { return Date.now().toString(36) + Math.random().toString(36).slice(2, 7); }
  function example(text, posten, o) {
    o = o || {};
    return { id: uid(), text: text, qty: o.qty == null ? null : o.qty, unit: o.unit || '', mult: o.mult || 1, posten: posten,
      urgent: !!o.urgent, done: !!o.done, created: Date.now(), doneAt: o.done ? Date.now() : null, example: true };
  }
  function seed() {
    return {
      tasks: [
        example('Zwiebelbrunoise', 'gemuese', { qty: 5, unit: 'kg' }),
        example('Rindfleisch hochholen', 'warm'),
        example('Suppe heizen', 'warm', { mult: 2 }),
        example('Kalbsjus reduzieren', 'warm', { done: true }),
        example('Vinaigrette ansetzen', 'kalt', { qty: 3, unit: 'l' }),
        example('Schokoladenmousse', 'patisserie', { qty: 20, unit: 'Port.' }),
        example('Gemüsebestellung aufgeben', 'admin', { urgent: true }),
        example('Temperaturkontrolle Kühlräume', 'admin', { done: true })
      ],
      learned: {},
      settings: { big: false, theme: 'auto' },
      filter: 'alle'
    };
  }
  function load() {
    try {
      var raw = localStorage.getItem(KEY);
      if (raw) {
        var s = JSON.parse(raw);
        if (s && Array.isArray(s.tasks)) {
          s.learned = s.learned || {}; s.settings = s.settings || { big: false, theme: 'auto' }; s.filter = s.filter || 'alle';
          return s;
        }
      }
    } catch (e) { /* Speicher nicht verfügbar */ }
    return seed();
  }
  var state = load();
  function save() { try { localStorage.setItem(KEY, JSON.stringify(state)); } catch (e) { /* ignorieren */ } }
  function clone(o) { return JSON.parse(JSON.stringify(o)); }

  // ---------- Darstellung ----------
  function esc(s) { return String(s).replace(/[&<>"]/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]; }); }
  function qtyLabel(t) { return t.qty == null ? '' : (P.fmtNumber(t.qty) + (t.unit ? ' ' + t.unit : '')); }
  var CHECK_SVG = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3.4" stroke-linecap="round" stroke-linejoin="round"><path d="M5 12.5l4.5 4.5L19 7.5"/></svg>';
  var FLAG_SVG = '<svg viewBox="0 0 24 24" fill="currentColor"><path d="M5 3h2v18H5zM8 4h11l-2.5 4.5L19 13H8z"/></svg>';

  var freshIds = {};

  function sortTasks(list) {
    return list.slice().sort(function (a, b) {
      if (a.done !== b.done) return a.done ? 1 : -1;
      if (!a.done && a.urgent !== b.urgent) return a.urgent ? -1 : 1;
      if (a.done) return (a.doneAt || 0) - (b.doneAt || 0);
      return a.created - b.created;
    });
  }

  function render() {
    var tasks = state.tasks;
    var total = tasks.length, done = tasks.filter(function (t) { return t.done; }).length;
    $('date').textContent = new Intl.DateTimeFormat('de-CH', { weekday: 'long', day: 'numeric', month: 'long' }).format(new Date());
    $('count').textContent = total ? (done + ' von ' + total + ' erledigt') : 'Keine Aufgaben';
    $('barfill').style.width = total ? (done / total * 100) + '%' : '0';
    $('banner').hidden = !tasks.some(function (t) { return t.example; });
    $('mDoneCount').textContent = done ? done + ' erledigt' : 'keine';

    // Filter
    var byP = {};
    ORDER.forEach(function (p) { byP[p] = []; });
    tasks.forEach(function (t) { (byP[t.posten] || byP.allgemein).push(t); });
    if (state.filter !== 'alle' && !byP[state.filter].length) state.filter = 'alle';
    var openAll = tasks.filter(function (t) { return !t.done; }).length;
    var chips = '<button class="chip" data-f="alle" aria-pressed="' + (state.filter === 'alle') + '">Alle <b>' + openAll + '</b></button>';
    ORDER.forEach(function (p) {
      if (!byP[p].length) return;
      var open = byP[p].filter(function (t) { return !t.done; }).length;
      chips += '<button class="chip" data-f="' + p + '" style="--pc:var(--p-' + p + ')" aria-pressed="' + (state.filter === p) + '"><span class="dot"></span>' +
        esc(POSTEN[p].short) + ' <b>' + open + '</b></button>';
    });
    $('chips').innerHTML = chips;

    // Gruppen
    var html = '';
    ORDER.forEach(function (p) {
      if (state.filter !== 'alle' && state.filter !== p) return;
      var list = byP[p];
      if (!list.length) return;
      var open = list.filter(function (t) { return !t.done; }).length;
      html += '<section class="group" style="--pc:var(--p-' + p + ')"><div class="group-head"><h2 class="tape"><span class="dot"></span>' + esc(POSTEN[p].label) +
        '</h2><span class="open">' + (open ? open + ' offen' : 'alles erledigt') + '</span></div><ul class="tasks">';
      sortTasks(list).forEach(function (t) {
        var q = qtyLabel(t);
        html += '<li class="task' + (t.done ? ' done' : '') + (freshIds[t.id] ? ' fresh' : '') + '" data-id="' + t.id + '">' +
          '<button class="check" aria-label="' + (t.done ? 'Wieder öffnen: ' : 'Erledigt: ') + esc(t.text) + '"><span>' + CHECK_SVG + '</span></button>' +
          '<button class="tbody" aria-label="Bearbeiten: ' + esc(t.text) + '">' +
          (t.qty != null ? '<span class="qty">' + esc(P.fmtNumber(t.qty)) + (t.unit ? '<small>' + esc(t.unit) + '</small>' : '') + '</span>' : '') +
          '<span class="txt">' + esc(t.text) + '</span>' +
          (t.mult > 1 ? '<span class="mult">×' + t.mult + '</span>' : '') +
          (t.urgent && !t.done ? '<span class="flag">' + FLAG_SVG + 'Wichtig</span>' : '') +
          '</button></li>';
      });
      html += '</ul></section>';
    });
    if (!html) {
      html = '<div class="empty"><strong>Mise en place leer</strong>Tippe aufs Mikrofon oder schreib zum Beispiel:<br>«5 kg Zwiebelbrunoise, zweimal Suppe heizen, Bestellung nicht vergessen»</div>';
    }
    $('groups').innerHTML = html;
    freshIds = {};
  }

  // ---------- Toast ----------
  var toastTimer = null, undoSnapshot = null;
  function toast(msg, snapshot) {
    $('toastMsg').textContent = msg;
    undoSnapshot = snapshot || null;
    $('toastUndo').hidden = !snapshot;
    $('toast').classList.add('show');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(function () { $('toast').classList.remove('show'); undoSnapshot = null; }, snapshot ? 6000 : 3200);
  }
  $('toastUndo').addEventListener('click', function () {
    if (!undoSnapshot) return;
    state.tasks = undoSnapshot; undoSnapshot = null;
    save(); render();
    $('toast').classList.remove('show');
  });

  // ---------- Eingabe verarbeiten ----------
  function removeExamples() {
    if (state.tasks.some(function (t) { return t.example; })) {
      state.tasks = state.tasks.filter(function (t) { return !t.example; });
    }
  }

  function handleInput(text) {
    text = String(text || '').trim();
    if (!text) return;
    var snapshot = clone(state.tasks);
    var results = P.parse(text, state.tasks.filter(function (t) { return !t.example; }).length ? state.tasks : state.tasks, state.learned);
    var added = 0, msgs = [];
    var addedExampleClear = false;
    results.forEach(function (r) {
      if (r.type === 'add') {
        if (!addedExampleClear) { removeExamples(); addedExampleClear = true; }
        var t = r.task;
        var nt = { id: uid(), text: t.text, qty: t.qty, unit: t.unit, mult: t.mult, posten: t.posten, urgent: t.urgent, done: false, created: Date.now() + added, doneAt: null };
        state.tasks.push(nt); freshIds[nt.id] = 1; added++;
      } else if (r.type === 'done') {
        if (r.task) { r.task.done = true; r.task.doneAt = Date.now(); msgs.push('«' + r.task.text + '» erledigt'); }
        else msgs.push('Keine offene Aufgabe zu «' + r.query + '»');
      } else if (r.type === 'undo') {
        if (r.task) { r.task.done = false; r.task.doneAt = null; msgs.push('«' + r.task.text + '» wieder offen'); }
        else msgs.push('Nichts gefunden zu «' + r.query + '»');
      } else if (r.type === 'delete') {
        if (r.task) { state.tasks = state.tasks.filter(function (x) { return x !== r.task; }); msgs.push('«' + r.task.text + '» gelöscht'); }
        else msgs.push('Nichts gefunden zu «' + r.query + '»');
      } else if (r.type === 'urgent') {
        r.task.urgent = true; msgs.push('«' + r.task.text + '» als wichtig markiert');
      } else if (r.type === 'change') {
        if (r.qty != null) { r.task.qty = r.qty; r.task.unit = r.unit || r.task.unit; }
        if (r.mult > 1) r.task.mult = r.mult;
        freshIds[r.task.id] = 1;
        msgs.push('«' + r.task.text + '» auf ' + (r.qty != null ? qtyLabel(r.task) : '×' + r.mult) + ' geändert');
      } else if (r.type === 'clearDone') {
        var n = state.tasks.filter(function (x) { return x.done; }).length;
        state.tasks = state.tasks.filter(function (x) { return !x.done; });
        msgs.push(n + ' erledigte entfernt');
      } else if (r.type === 'clearAll') {
        openSheet('confirmSheet');
      }
    });
    if (added) msgs.unshift(added === 1 ? '1 Aufgabe erfasst' : added + ' Aufgaben erfasst');
    save(); render();
    if (msgs.length) toast(msgs.join(' · '), snapshot);
    if (added && state.filter !== 'alle') {
      var lastAdded = state.tasks[state.tasks.length - 1];
      if (lastAdded.posten !== state.filter) { state.filter = 'alle'; save(); render(); }
    }
  }

  // ---------- Eingabefeld ----------
  var input = $('input');
  function autosize() {
    input.style.height = 'auto';
    input.style.height = Math.min(input.scrollHeight + 2, 140) + 'px';
    $('send').hidden = !input.value.trim();
  }
  input.addEventListener('input', autosize);
  input.addEventListener('keydown', function (e) {
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); submit(); }
  });
  $('form').addEventListener('submit', function (e) { e.preventDefault(); submit(); });
  function submit() {
    var v = input.value;
    input.value = ''; autosize();
    handleInput(v);
  }

  // ---------- Diktat ----------
  var SR = window.SpeechRecognition || window.webkitSpeechRecognition;
  var rec = null, listening = false;
  $('mic').addEventListener('click', function () {
    if (!SR) {
      input.focus();
      toast('Tippe auf das Mikrofon der Tastatur, um zu diktieren');
      return;
    }
    if (listening) { try { rec.stop(); } catch (e) { /* */ } return; }
    try {
      rec = new SR();
      rec.lang = 'de-CH';
      rec.interimResults = true;
      rec.continuous = false;
      var base = input.value ? input.value.trim() + ', ' : '';
      rec.onresult = function (ev) {
        var txt = '';
        for (var i = 0; i < ev.results.length; i++) txt += ev.results[i][0].transcript;
        input.value = base + txt; autosize();
      };
      rec.onerror = function (ev) {
        if (ev.error === 'not-allowed' || ev.error === 'service-not-allowed') toast('Mikrofon ist blockiert. Tippe aufs Mikrofon der Tastatur.');
        else if (ev.error === 'no-speech') toast('Nichts gehört. Nochmals versuchen.');
      };
      rec.onend = function () {
        listening = false; $('mic').classList.remove('live'); $('mic').setAttribute('aria-label', 'Diktieren');
        if (input.value.trim()) submit();
      };
      rec.start();
      listening = true; $('mic').classList.add('live'); $('mic').setAttribute('aria-label', 'Diktat beenden');
    } catch (e) {
      input.focus();
      toast('Diktat hier nicht verfügbar. Tippe aufs Mikrofon der Tastatur.');
    }
  });

  // ---------- Liste: Klicks ----------
  $('groups').addEventListener('click', function (e) {
    var li = e.target.closest('.task'); if (!li) return;
    var t = state.tasks.find(function (x) { return x.id === li.dataset.id; }); if (!t) return;
    if (e.target.closest('.check')) {
      t.done = !t.done; t.doneAt = t.done ? Date.now() : null;
      if (navigator.vibrate) { try { navigator.vibrate(12); } catch (er) { /* */ } }
      save(); render();
    } else if (e.target.closest('.tbody')) {
      openEdit(t);
    }
  });
  $('chips').addEventListener('click', function (e) {
    var b = e.target.closest('.chip'); if (!b) return;
    state.filter = b.dataset.f; save(); render();
  });
  $('clearExamples').addEventListener('click', function () { removeExamples(); save(); render(); });

  // ---------- Sheets ----------
  var lastFocus = null;
  function openSheet(id) {
    lastFocus = document.activeElement;
    var s = $(id); s.classList.add('open'); s.setAttribute('aria-hidden', 'false');
  }
  function closeSheet(id) {
    var s = $(id); s.classList.remove('open'); s.setAttribute('aria-hidden', 'true');
    if (lastFocus && lastFocus.focus) { try { lastFocus.focus({ preventScroll: true }); } catch (e) { /* */ } }
  }
  Array.prototype.forEach.call(document.querySelectorAll('.sheet'), function (s) {
    s.addEventListener('click', function (e) { if (e.target === s) closeSheet(s.id); });
  });
  document.addEventListener('keydown', function (e) {
    if (e.key !== 'Escape') return;
    var open = document.querySelector('.sheet.open'); if (open) closeSheet(open.id);
  });

  // Bearbeiten
  var editing = null, editMult = 1, editPosten = 'allgemein', editUrgent = false;
  $('fUnit').innerHTML = UNIT_OPTIONS.map(function (u) { return '<option value="' + esc(u) + '">' + (u ? esc(u) : '–') + '</option>'; }).join('');
  $('fPosten').innerHTML = ORDER.map(function (p) {
    return '<button type="button" data-p="' + p + '" style="--pc:var(--p-' + p + ')"><span class="dot"></span>' + esc(POSTEN[p].short) + '</button>';
  }).join('');
  function paintEdit() {
    $('fMult').textContent = editMult;
    Array.prototype.forEach.call($('fPosten').children, function (b) { b.setAttribute('aria-pressed', String(b.dataset.p === editPosten)); });
    $('fUrgent').setAttribute('aria-pressed', String(editUrgent));
  }
  function openEdit(t) {
    editing = t;
    $('fText').value = t.text;
    $('fQty').value = t.qty == null ? '' : String(t.qty).replace('.', ',');
    var u = t.unit || '';
    if (UNIT_OPTIONS.indexOf(u) < 0) { var o = document.createElement('option'); o.value = u; o.textContent = u; $('fUnit').appendChild(o); }
    $('fUnit').value = u;
    editMult = t.mult || 1; editPosten = t.posten; editUrgent = !!t.urgent;
    $('editDelete').classList.remove('armed'); $('editDelete').textContent = 'Löschen';
    paintEdit(); openSheet('editSheet');
  }
  $('multMinus').addEventListener('click', function () { editMult = Math.max(1, editMult - 1); paintEdit(); });
  $('multPlus').addEventListener('click', function () { editMult = Math.min(20, editMult + 1); paintEdit(); });
  $('fPosten').addEventListener('click', function (e) { var b = e.target.closest('button'); if (b) { editPosten = b.dataset.p; paintEdit(); } });
  $('fUrgent').addEventListener('click', function () { editUrgent = !editUrgent; paintEdit(); });
  $('editSave').addEventListener('click', function () {
    if (!editing) return;
    var t = editing;
    var txt = $('fText').value.trim(); if (txt) t.text = txt;
    var q = $('fQty').value.trim().replace(',', '.');
    t.qty = q && !isNaN(parseFloat(q)) ? parseFloat(q) : null;
    t.unit = t.qty == null ? '' : $('fUnit').value;
    t.mult = editMult; t.urgent = editUrgent;
    if (t.posten !== editPosten) {
      t.posten = editPosten;
      P.learnWords(t.text).forEach(function (w) { state.learned[w] = editPosten; });
    }
    delete t.example;
    save(); render(); closeSheet('editSheet');
  });
  $('editDelete').addEventListener('click', function () {
    var b = $('editDelete');
    if (!b.classList.contains('armed')) { b.classList.add('armed'); b.textContent = 'Wirklich löschen'; return; }
    var snapshot = clone(state.tasks);
    var name = editing.text;
    state.tasks = state.tasks.filter(function (x) { return x.id !== editing.id; });
    save(); render(); closeSheet('editSheet');
    toast('«' + name + '» gelöscht', snapshot);
  });

  // Menü
  $('menuBtn').addEventListener('click', function () { paintMenu(); openSheet('menuSheet'); });
  function paintMenu() {
    $('bigToggle').setAttribute('aria-pressed', String(!!state.settings.big));
    Array.prototype.forEach.call($('themeSeg').children, function (b) { b.setAttribute('aria-pressed', String(b.dataset.v === state.settings.theme)); });
    $('mClearAll').classList.remove('armed'); $('mClearAllLbl').textContent = 'Neue Liste starten';
  }
  var wakeLock = null;
  function applySettings() {
    document.body.classList.toggle('big', !!state.settings.big);
    var th = state.settings.theme;
    if (th === 'light' || th === 'dark') document.documentElement.setAttribute('data-theme', th);
    else if (themeTouched) document.documentElement.removeAttribute('data-theme');
    if (state.settings.big && 'wakeLock' in navigator && !wakeLock) {
      navigator.wakeLock.request('screen').then(function (l) { wakeLock = l; l.addEventListener('release', function () { wakeLock = null; }); }).catch(function () { /* */ });
    } else if (!state.settings.big && wakeLock) { try { wakeLock.release(); } catch (e) { /* */ } wakeLock = null; }
  }
  var themeTouched = false;
  document.addEventListener('visibilitychange', function () { if (document.visibilityState === 'visible') applySettings(); });
  $('bigToggle').addEventListener('click', function () { state.settings.big = !state.settings.big; save(); applySettings(); paintMenu(); });
  $('themeSeg').addEventListener('click', function (e) {
    var b = e.target.closest('button'); if (!b) return;
    themeTouched = true; state.settings.theme = b.dataset.v; save(); applySettings(); paintMenu();
  });
  $('mClearDone').addEventListener('click', function () {
    var snapshot = clone(state.tasks);
    var n = state.tasks.filter(function (t) { return t.done; }).length;
    state.tasks = state.tasks.filter(function (t) { return !t.done; });
    save(); render(); closeSheet('menuSheet');
    toast(n + ' erledigte entfernt', n ? snapshot : null);
  });
  $('mClearAll').addEventListener('click', function () {
    var b = $('mClearAll');
    if (!b.classList.contains('armed')) { b.classList.add('armed'); $('mClearAllLbl').textContent = 'Nochmals tippen: alles löschen'; return; }
    clearAll(); closeSheet('menuSheet');
  });
  function clearAll() {
    var snapshot = clone(state.tasks);
    state.tasks = []; state.filter = 'alle';
    save(); render();
    toast('Neue Liste gestartet', snapshot);
  }
  $('confirmOk').addEventListener('click', function () { closeSheet('confirmSheet'); clearAll(); });
  $('confirmCancel').addEventListener('click', function () { closeSheet('confirmSheet'); });

  // Teilen
  function appUrl() { return location.origin + location.pathname; }
  function b64enc(str) { return btoa(unescape(encodeURIComponent(str))).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, ''); }
  function b64dec(str) { str = str.replace(/-/g, '+').replace(/_/g, '/'); while (str.length % 4) str += '='; return decodeURIComponent(escape(atob(str))); }
  $('mShare').addEventListener('click', function () {
    var open = state.tasks.filter(function (t) { return !t.done; });
    if (!open.length) { toast('Keine offenen Aufgaben zum Teilen'); return; }
    var lines = ['MeP · ' + new Intl.DateTimeFormat('de-CH', { weekday: 'short', day: '2-digit', month: '2-digit' }).format(new Date())];
    ORDER.forEach(function (p) {
      var l = open.filter(function (t) { return t.posten === p; }); if (!l.length) return;
      lines.push(''); lines.push(POSTEN[p].label.toUpperCase());
      sortTasks(l).forEach(function (t) {
        var q = qtyLabel(t);
        lines.push('☐ ' + (q ? q + ' ' : '') + t.text + (t.mult > 1 ? ' ×' + t.mult : '') + (t.urgent ? ' (wichtig)' : ''));
      });
    });
    if (!isArtifact) {
      var data = open.map(function (t) { return [t.text, t.qty, t.unit, t.mult, t.posten, t.urgent ? 1 : 0]; });
      lines.push(''); lines.push('In MeP übernehmen: ' + appUrl() + '?import=' + b64enc(JSON.stringify(data)));
    }
    var text = lines.join('\n');
    closeSheet('menuSheet');
    if (navigator.share) {
      navigator.share({ title: 'MeP', text: text }).catch(function () { /* abgebrochen */ });
    } else if (navigator.clipboard) {
      navigator.clipboard.writeText(text).then(function () { toast('Liste kopiert, jetzt einfügen'); }, function () { toast('Kopieren nicht möglich'); });
    }
  });

  // Sicherung
  $('mBackup').addEventListener('click', function () {
    var blob = new Blob([JSON.stringify(state, null, 1)], { type: 'application/json' });
    var a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = 'MeP-Sicherung-' + new Date().toISOString().slice(0, 10) + '.json';
    document.body.appendChild(a); a.click(); a.remove();
    setTimeout(function () { URL.revokeObjectURL(a.href); }, 2000);
  });
  $('mRestore').addEventListener('click', function () { $('restoreFile').click(); });
  $('restoreFile').addEventListener('change', function () {
    var f = this.files && this.files[0]; if (!f) return;
    var r = new FileReader();
    r.onload = function () {
      try {
        var s = JSON.parse(r.result);
        if (!s || !Array.isArray(s.tasks)) throw new Error('x');
        var snapshot = clone(state.tasks);
        state.tasks = s.tasks; state.learned = s.learned || state.learned;
        save(); render(); closeSheet('menuSheet');
        toast(s.tasks.length + ' Aufgaben geladen', snapshot);
      } catch (e) { toast('Diese Datei ist keine MeP-Sicherung'); }
    };
    r.readAsText(f);
    this.value = '';
  });

  // Einrichtung
  $('mHelp').addEventListener('click', function () {
    closeSheet('menuSheet');
    var url = isArtifact ? 'https://DEIN-NAME.github.io/mep/?add=' : appUrl() + '?add=';
    $('shortcutUrl').textContent = url;
    openSheet('helpSheet');
  });
  $('copyUrl').addEventListener('click', function () {
    var txt = $('shortcutUrl').textContent;
    if (navigator.clipboard) {
      navigator.clipboard.writeText(txt).then(function () { $('copyUrl').textContent = 'Kopiert'; setTimeout(function () { $('copyUrl').textContent = 'Kopieren'; }, 1800); },
        function () { selectText($('shortcutUrl')); });
    } else selectText($('shortcutUrl'));
  });
  function selectText(el) { var r = document.createRange(); r.selectNodeContents(el); var s = getSelection(); s.removeAllRanges(); s.addRange(r); }
  $('helpClose').addEventListener('click', function () { closeSheet('helpSheet'); });

  // ---------- Eingang über Adresse (Kurzbefehl, Teilen, Import) ----------
  var pendingImport = null;
  function handleUrl() {
    var params;
    try { params = new URLSearchParams(location.search); } catch (e) { return; }
    var add = params.get('add') || params.get('text') || '';
    var title = params.get('title') || '';
    var imp = params.get('import');
    var cleaned = false;
    if (add || title) {
      handleInput([title, add].filter(Boolean).join(', '));
      cleaned = true;
    }
    if (imp) {
      try {
        var data = JSON.parse(b64dec(imp));
        pendingImport = data.filter(Array.isArray).map(function (d) {
          return { id: uid(), text: String(d[0] || '').slice(0, 200), qty: typeof d[1] === 'number' ? d[1] : null, unit: String(d[2] || ''),
            mult: Math.max(1, Math.min(20, parseInt(d[3], 10) || 1)), posten: POSTEN[d[4]] ? d[4] : 'allgemein', urgent: !!d[5], done: false, created: Date.now(), doneAt: null };
        }).filter(function (t) { return t.text; });
        if (pendingImport.length) {
          $('importText').textContent = pendingImport.length + (pendingImport.length === 1 ? ' Aufgabe wird' : ' Aufgaben werden') + ' zu deiner Liste hinzugefügt: ' +
            pendingImport.slice(0, 4).map(function (t) { return t.text; }).join(', ') + (pendingImport.length > 4 ? ' …' : '');
          openSheet('importSheet');
        }
      } catch (e) { toast('Der geteilte Link ist beschädigt'); }
      cleaned = true;
    }
    if (cleaned) { try { history.replaceState(null, '', location.pathname); } catch (e) { /* */ } }
  }
  $('importOk').addEventListener('click', function () {
    if (!pendingImport) return;
    var snapshot = clone(state.tasks);
    removeExamples();
    pendingImport.forEach(function (t, i) { t.created += i; state.tasks.push(t); freshIds[t.id] = 1; });
    var n = pendingImport.length; pendingImport = null;
    save(); render(); closeSheet('importSheet');
    toast(n + ' Aufgaben übernommen', snapshot);
  });
  $('importCancel').addEventListener('click', function () { pendingImport = null; closeSheet('importSheet'); });

  // ---------- Layout ----------
  function measureComposer() {
    document.documentElement.style.setProperty('--composer-h', $('composer').offsetHeight + 'px');
  }
  if (window.ResizeObserver) new ResizeObserver(measureComposer).observe($('composer'));
  window.addEventListener('resize', measureComposer);

  // ---------- Start ----------
  if (isArtifact) $('mBackup').hidden = true;
  applySettings();
  render();
  measureComposer();
  handleUrl();

  if ('serviceWorker' in navigator && !isArtifact && location.protocol === 'https:') {
    window.addEventListener('load', function () { navigator.serviceWorker.register('sw.js').catch(function () { /* */ }); });
  }
})();
