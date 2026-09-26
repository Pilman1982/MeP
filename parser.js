/* MeP Küchen-Parser
 * Zerlegt gesprochenen Text in Mise-en-place-Aufgaben oder erkennt Befehle.
 * Läuft im Browser (window.MepParser) und in Node (module.exports) für Tests.
 */
(function (root) {
  'use strict';

  // ---------- Posten ----------
  var POSTEN = [
    { id: 'warm', label: 'Warme Küche', short: 'Warm' },
    { id: 'kalt', label: 'Kalte Küche', short: 'Kalt' },
    { id: 'gemuese', label: 'Gemüse und Beilagen', short: 'Gemüse' },
    { id: 'patisserie', label: 'Pâtisserie', short: 'Pâtisserie' },
    { id: 'admin', label: 'Economat / Admin', short: 'Admin' },
    { id: 'allgemein', label: 'Allgemein', short: 'Allgemein' }
  ];

  // Stichwörter pro Posten (Teilwort-Suche, klein, ohne Akzente). Zahl = Gewicht.
  var KEYWORDS = {
    admin: {
      bestell: 3, lieferant: 3, lieferung: 3, liefer: 2, inventar: 3, economat: 3, anruf: 2, telefon: 2,
      mail: 2, einkauf: 2, kontroll: 2, temperatur: 2, haccp: 3, protokoll: 3, reinig: 2, putz: 2,
      abrechn: 3, rechnung: 3, menueplan: 3, menuplan: 3, dienstplan: 3, arbeitsplan: 3, einsatzplan: 3, wochenplan: 3, produktionsplan: 3, mitarbeiter: 2, sitzung: 2, meeting: 2, etikett: 2, beschrift: 2,
      offerte: 3, reservation: 2, allergen: 2, rezept: 1, kalkul: 3, ablauf: 1, abfall: 2, entsorg: 2,
      warenannahme: 3, rueckstell: 3, kuehlraum: 1, tiefkuehl: 1, lager: 1, drucken: 2, liste: 1
    },
    patisserie: {
      dessert: 3, torte: 3, kuchen: 3, creme: 2, mousse: 2, glace: 3, sorbet: 3, teig: 2, muerbteig: 3,
      blaetterteig: 2, biskuit: 3, schoko: 3, couverture: 3, kuvertuere: 3, vanille: 2, patisserie: 3,
      beeren: 2, erdbeer: 2, himbeer: 2, meringue: 3, backen: 2, brioche: 3, gipfeli: 3, zopf: 3, brot: 2,
      sabayon: 3, parfait: 3, coulis: 2, karamell: 2, caramel: 2, tarte: 3, macaron: 3, pralin: 3,
      rahm: 1, gelee: 1, kompott: 2, strudel: 3, crumble: 3, focaccia: 2, baguette: 2, grissini: 2,
      puderzucker: 3, zucker: 1, eiweiss: 1, eigelb: 1, panna: 2, tiramisu: 3
    },
    kalt: {
      salat: 3, dressing: 3, vinaigrette: 3, salatsauce: 4, terrine: 3, pastete: 3, carpaccio: 3,
      tatar: 3, tartar: 3, gravlax: 3, raeucher: 2, aufschnitt: 3, kaese: 2, kalt: 2, canape: 3, amuse: 2,
      vorspeise: 2, sandwich: 3, mayonnaise: 3, mayo: 2, aspik: 3, ceviche: 3, rohschinken: 3,
      bresaola: 3, buendnerfleisch: 3, antipasti: 3, dip: 2, hummus: 3, gazpacho: 3, cocktailsauce: 3,
      frischkaese: 3, mozzarella: 2, burrata: 3, crudites: 3, sushi: 3, tapenade: 3, pesto: 2,
      fruehstueck: 2, buffet: 1, platte: 1, garnitur: 1, kresse: 1
    },
    warm: {
      fleisch: 2, rind: 2, kalb: 2, schwein: 2, lamm: 2, gefluegel: 2, poulet: 2, huhn: 2, ente: 2,
      fisch: 2, lachs: 2, zander: 2, felchen: 2, egli: 2, forelle: 2, dorade: 2, crevett: 2, scampi: 2,
      sauce: 2, jus: 3, fond: 3, suppe: 3, bouillon: 3, consomme: 3, braten: 2, schmor: 2, sousvide: 3,
      grill: 2, wild: 1, reh: 2, hirsch: 2, gams: 2, heizen: 2, aufwaerm: 2, regenerier: 2, demiglace: 3,
      veloute: 3, ragout: 3, geschnetzelt: 3, wurst: 2, speck: 1, entrecote: 3, filet: 1, huft: 3,
      voressen: 3, gulasch: 3, siedfleisch: 3, kotelett: 2, schnitzel: 2, hackfleisch: 2, klopfen: 1, plattieren: 2, dressieren: 1, spicken: 2, bardieren: 2, tranchier: 2, burger: 2,
      pochier: 1, fritier: 1, fritteuse: 2, salamander: 2, anbrat: 2, glasier: 1, braise: 2,
      rahmsauce: 3, hollandaise: 3, bearnaise: 3, beurre: 2, eier: 1, omelett: 2, tagesmenue: 1,
      kochen: 1, reduzier: 2
    },
    gemuese: {
      zwiebel: 3, schalotte: 3, karotte: 3, rueebli: 3, sellerie: 3, lauch: 3, kartoffel: 3, haerdoepfel: 3,
      gemuese: 3, brunoise: 3, julienne: 3, mirepoix: 3, concasse: 3, tomate: 2, pilz: 3, champignon: 3,
      spinat: 3, kohl: 3, fenchel: 3, zucchetti: 3, zucchini: 3, peperoni: 3, aubergine: 3, reis: 3,
      risotto: 3, polenta: 3, teigwaren: 3, pasta: 3, nudel: 3, spaetzli: 3, knoepfli: 3, roesti: 3,
      gratin: 3, puree: 3, stock: 2, bohne: 3, erbse: 3, linse: 3, schael: 2, tournier: 3, blanchier: 3,
      kraeuter: 2, schnittlauch: 3, petersilie: 3, knoblauch: 2, spargel: 3, randen: 3, kuerbis: 3,
      broccoli: 3, blumenkohl: 3, rosenkohl: 3, wirz: 3, rotkraut: 3, sauerkraut: 3, mais: 2,
      couscous: 3, quinoa: 3, bulgur: 3, gnocchi: 3, ravioli: 2, pommes: 3, frites: 3, kroketten: 3,
      rueben: 3, pastinake: 3, topinambur: 3, radieschen: 2, gurke: 2, avocado: 2, ingwer: 2,
      chiffonade: 3, hacken: 1, hackeln: 1, schneiden: 1, ciseler: 3, parmentier: 3, macedoine: 3, paysanne: 3, wuerfel: 1, schneid: 1,
      rüst: 2, ruest: 2
    }
  };
  var TIE_ORDER = ['admin', 'patisserie', 'kalt', 'warm', 'gemuese'];

  // ---------- Zahlen und Einheiten ----------
  var NUM_WORDS = {
    ein: 1, eine: 1, einen: 1, einem: 1, einer: 1, eins: 1, zwei: 2, drei: 3, vier: 4, 'fünf': 5, fuenf: 5,
    sechs: 6, sieben: 7, acht: 8, neun: 9, zehn: 10, elf: 11, 'zwölf': 12, zwoelf: 12, 'fünfzehn': 15,
    zwanzig: 20, 'dreissig': 30, 'dreißig': 30, vierzig: 40, 'fünfzig': 50, sechzig: 60, achtzig: 80,
    hundert: 100, halb: 0.5, halbe: 0.5, halben: 0.5, halbes: 0.5, anderthalb: 1.5, eineinhalb: 1.5,
    zweieinhalb: 2.5
  };
  var MULT_WORDS = {
    einmal: 1, zweimal: 2, dreimal: 3, viermal: 4, 'fünfmal': 5, fuenfmal: 5, sechsmal: 6, siebenmal: 7,
    achtmal: 8, neunmal: 9, zehnmal: 10, doppelt: 2, dreifach: 3, vierfach: 4, zweifach: 2
  };
  // Einheit (klein) -> Anzeige
  var UNITS = {
    kg: 'kg', kilo: 'kg', kilos: 'kg', kilogramm: 'kg', g: 'g', gr: 'g', gramm: 'g',
    l: 'l', liter: 'l', dl: 'dl', deziliter: 'dl', cl: 'cl', zentiliter: 'cl', ml: 'ml', milliliter: 'ml',
    'stück': 'Stk.', stueck: 'Stk.', stk: 'Stk.', portionen: 'Port.', portion: 'Port.', port: 'Port.',
    pax: 'Pax', personen: 'Pax', bund: 'Bund', kiste: 'Kiste', kisten: 'Kisten', blech: 'Blech',
    bleche: 'Bleche', gn: 'GN', schale: 'Schale', schalen: 'Schalen', flasche: 'Fl.', flaschen: 'Fl.',
    dose: 'Dose', dosen: 'Dosen', packung: 'Pack.', packungen: 'Pack.', pack: 'Pack.', beutel: 'Beutel',
    eimer: 'Eimer', kessel: 'Kessel', topf: 'Topf', 'töpfe': 'Töpfe', toepfe: 'Töpfe', laib: 'Laib',
    scheiben: 'Scheiben', tranchen: 'Tranchen', stangen: 'Stangen', rollen: 'Rollen', tabletts: 'Tabletts'
  };

  // Diktierfehler und Fachbegriffe (Pauli-Schreibweise)
  var GLOSSARY = [
    [/\bbr[uü]n+ois(e)?\b/gi, 'Brunoise'],
    [/\bbr[uü]n+o[ai]s(e)?\b/gi, 'Brunoise'],
    [/(\w)br[uü]n+ois(e)?\b/gi, '$1brunoise'],
    [/\bjuli[ea]n+e?\b/gi, 'Julienne'],
    [/\b(k|c)on(k|c)ass[eé]e?\b/gi, 'Concassé'],
    [/\bmir+ep?o[ai]x?\b/gi, 'Mirepoix'],
    [/\bmirpoa\b/gi, 'Mirepoix'],
    [/\bdemi[\s-]?glace\b/gi, 'Demi-glace'],
    [/\bsous[\s-]?vide\b/gi, 'Sous-vide'],
    [/\bmise[\s-]en[\s-]place\b/gi, 'Mise en place'],
    [/\bvel[ou]+t[eé]e?\b/gi, 'Velouté'],
    [/\bchiff?onn?ade\b/gi, 'Chiffonnade'],
    [/\bconsom+[eé]e?\b/gi, 'Consommé'],
    [/\bp[aâ]tisserie\b/gi, 'Pâtisserie'],
    [/\bcr[eè]me br[uû]l[eé]e\b/gi, 'Crème brûlée'],
    [/\bentrec[oô]te\b/gi, 'Entrecôte'],
    [/\bpür[eé]e\b/gi, 'Püree'],
    [/ß/g, 'ss']
  ];

  var URGENT_RE = /\b(dringend|sofort|asap|prio(?:rit[aä]t)?|unbedingt|wichtig|als erstes|zuerst|nicht vergessen|vergiss nicht|vergesst nicht)\b[:!]?/gi;
  var LEAD_FILLER_RE = /^(?:(?:und|dann|danach|anschliessend|ausserdem|zudem|auch|noch|bitte|also|okay|ok|so|jetzt|ah|äh|ähm|ich muss|ich sollte|wir müssen|wir sollten|wir brauchen|es braucht|braucht|muss|müssen|mach|machen|vergiss nicht|nicht vergessen)[\s,:]+)+/i;
  var TRAIL_FILLER_RE = /(?:[\s,]+(?:bitte|noch|auch|danke|okay|ok))+$/i;

  function norm(s) {
    return String(s || '').toLowerCase()
      .replace(/ä/g, 'ae').replace(/ö/g, 'oe').replace(/ü/g, 'ue').replace(/ß/g, 'ss')
      .replace(/[éèê]/g, 'e').replace(/[àâ]/g, 'a').replace(/[ôò]/g, 'o').replace(/[ûù]/g, 'u')
      .replace(/[îï]/g, 'i').replace(/ç/g, 'c').replace(/-/g, '');
  }

  function parseNumber(tok) {
    if (tok == null) return null;
    var t = String(tok).toLowerCase().trim();
    if (/^\d+(?:[.,]\d+)?$/.test(t)) return parseFloat(t.replace(',', '.'));
    if (t === '½') return 0.5;
    if (t === '¼') return 0.25;
    if (Object.prototype.hasOwnProperty.call(NUM_WORDS, t)) return NUM_WORDS[t];
    return null;
  }

  function fmtNumber(n) {
    if (n == null) return '';
    if (n === 0.5) return '½';
    if (n === 1.5) return '1½';
    if (n === 2.5) return '2½';
    var s = (Math.round(n * 100) / 100).toString();
    return s.replace('.', ',');
  }

  // ---------- Segmentierung ----------
  var UNIT_KEYS = Object.keys(UNITS).sort(function (a, b) { return b.length - a.length; });
  var NUM_KEYS = Object.keys(NUM_WORDS).sort(function (a, b) { return b.length - a.length; });
  var MULT_KEYS = Object.keys(MULT_WORDS).sort(function (a, b) { return b.length - a.length; });
  function esc(s) { return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'); }
  var NUM_ALT = '\\d+(?:[.,]\\d+)?|½|¼|' + NUM_KEYS.map(esc).join('|');
  var UNIT_ALT = UNIT_KEYS.map(esc).join('|');
  var MULT_ALT = MULT_KEYS.map(esc).join('|') + '|\\d+\\s?(?:x|mal)\\b|x\\s?\\d+';

  var STARTS_QTY_RE = new RegExp('^(?:(?:' + NUM_ALT + ')\\s*(?:' + UNIT_ALT + ')\\b|\\d|(?:' + MULT_ALT + ')\\b)', 'i');

  function looksLikeVerb(word) {
    if (!word) return false;
    if (word !== word.toLowerCase()) return false; // gross geschrieben = Nomen
    var w = word.toLowerCase();
    if (UNITS[w]) return false;
    return /(en|ern|eln|ieren)$/.test(w) && w.length > 3;
  }

  function lastWord(s) { var m = s.trim().split(/\s+/); return m[m.length - 1] || ''; }
  function wordCount(s) { return s.trim() ? s.trim().split(/\s+/).length : 0; }

  function splitSegments(text) {
    var t = String(text || '').replace(/[\n\r\u2028\u2029]+/g, ' | ');
    // Gesprochene Trenner: "nächste Zeile", "neue Aufgabe", "Punkt", "Komma" ...
    t = t.replace(/(^|[\s,.|])(?:und\s+)?(?:(?:die\s+)?(?:n[aä]e?chste|neue|weitere)\s+(?:zeile|aufgabe|position|punkt)|(?:n[aä]e?chster|neuer|weiterer)\s+(?:punkt|absatz|posten)|neuer\s+absatz|als\s+n[aä]e?chstes|punkt|komma|strichpunkt|semikolon)(?=$|[\s,.:|])/gi, '$1 | ');
    t = t.replace(/\bund\s+so\s+weiter\b|\busw\.?/gi, ' ');
    t = ' ' + t.replace(/[ \t]+/g, ' ') + ' ';
    // Satzzeichen als Trenner (Dezimalkomma und Dezimalpunkt schützen)
    t = t.replace(/[;!?•]+/g, ',')
      .replace(/(?<!\d)\.|\.(?!\d)/g, ',')
      .replace(/(?<!\d),|,(?!\d)/g, '|');
    // Verbindungswörter
    t = t.replace(/\s(?:und dann|und danach|und ausserdem|und noch|dann noch|danach|anschliessend|ausserdem|außerdem|sowie|zudem|und zudem)\s/gi, ' | ');
    t = t.replace(/\s(?:dann)\s(?=\S+\s\S+)/gi, ' | ');
    var parts = t.split('|');
    var out = [];
    parts.forEach(function (p) {
      p = p.trim();
      if (!p) return;
      splitUnd(p).forEach(function (q) { if (q.trim()) out.push(q.trim()); });
    });
    return out;
  }

  function splitUnd(seg) {
    var idx = seg.search(/\sund\s/i);
    if (idx < 0) return [seg];
    var left = seg.slice(0, idx).trim();
    var right = seg.slice(idx).replace(/^\s*und\s+/i, '').trim();
    var split = false;
    if (STARTS_QTY_RE.test(right)) split = true;
    else if (looksLikeVerb(lastWord(left)) && wordCount(right) >= 2 && wordCount(left) >= 2) split = true;
    else if (/\bnicht vergessen$/i.test(left)) split = true;
    if (!split) {
      // weitere "und" rechts prüfen, links bleibt zusammen
      var rest = splitUnd(right);
      if (rest.length === 1) return [seg];
      return [left + ' und ' + rest[0]].concat(rest.slice(1));
    }
    var rightParts = splitUnd(right);
    // Verb-Übertrag: "5 kg Zwiebeln und 2 kg Karotten schälen"
    var lw = lastWord(left);
    var rv = lastWord(rightParts[0]);
    if (!looksLikeVerb(lw) && looksLikeVerb(rv) && STARTS_QTY_RE.test(left) && STARTS_QTY_RE.test(right)) {
      left = left + ' ' + rv;
    }
    return [left].concat(rightParts);
  }

  // ---------- Einzelaufgabe ----------
  function applyGlossary(s) {
    GLOSSARY.forEach(function (g) { s = s.replace(g[0], g[1]); });
    return s;
  }

  function capFirst(s) { return s ? s.charAt(0).toUpperCase() + s.slice(1) : s; }

  function classify(text, learned) {
    var n = norm(text);
    if (learned) {
      var words = tokens(text);
      // gelernte Zuordnungen haben Vorrang (ganzes Wort)
      var best = null, bestLen = 0;
      words.forEach(function (w) {
        if (learned[w] && w.length > bestLen) { best = learned[w]; bestLen = w.length; }
      });
      if (best) return best;
    }
    var scores = {};
    Object.keys(KEYWORDS).forEach(function (p) {
      var kw = KEYWORDS[p], sc = 0;
      Object.keys(kw).forEach(function (k) {
        var kn = norm(k);
        if (n.indexOf(kn) >= 0) sc += kw[k];
      });
      scores[p] = sc;
    });
    var winner = 'allgemein', top = 0;
    TIE_ORDER.forEach(function (p) {
      if (scores[p] > top) { top = scores[p]; winner = p; }
    });
    return winner;
  }

  function parseTask(seg, learned) {
    var s = ' ' + applyGlossary(seg) + ' ';
    var urgent = false;
    if (URGENT_RE.test(s)) { urgent = true; }
    URGENT_RE.lastIndex = 0;
    s = s.replace(URGENT_RE, ' ');

    // "5kg" -> "5 kg"
    s = s.replace(/(\d)([a-zA-Zä]+)/g, function (m, d, u) {
      return UNITS[u.toLowerCase()] ? d + ' ' + u : (/^(x|mal)$/i.test(u) ? d + ' ' + u : m);
    });

    // Multiplikator
    var mult = 1;
    var multRe = new RegExp('(?:^|\\s)(' + MULT_KEYS.map(esc).join('|') + ')(?=\\s|$)', 'i');
    var m = s.match(multRe);
    if (m) { mult = MULT_WORDS[m[1].toLowerCase()]; s = s.replace(m[0], ' '); }
    else {
      m = s.match(/(?:^|\s)(\d+)\s?(?:x|mal)(?=\s|$)/i) || s.match(/(?:^|\s)x\s?(\d+)(?=\s|$)/i);
      if (m) { mult = parseInt(m[1], 10); s = s.replace(m[0], ' '); }
    }

    // Menge + Einheit (irgendwo)
    var qty = null, unit = '';
    var qRe = new RegExp('(?:^|\\s)(' + NUM_ALT + ')\\s*(' + UNIT_ALT + ')(?=\\s|$)', 'i');
    m = s.match(qRe);
    if (m) {
      qty = parseNumber(m[1]);
      unit = UNITS[m[2].toLowerCase()] || m[2];
      s = s.replace(m[0], ' ');
    } else {
      // Zahl am Anfang ohne Einheit: "2 Hechte filetieren", "zwei Bleche"
      var lead = s.trim().match(new RegExp('^(' + NUM_ALT + ')\\s+(\\S+)', 'i'));
      if (lead) {
        var num = parseNumber(lead[1]);
        var isDigit = /^\d/.test(lead[1]);
        var nextIsNoun = lead[2].charAt(0) === lead[2].charAt(0).toUpperCase();
        if (num != null && (isDigit || (nextIsNoun && num > 1))) {
          qty = num;
          s = s.trim().replace(new RegExp('^' + esc(lead[1]) + '\\s+'), ' ');
        }
      }
    }

    // Aufräumen
    s = s.replace(/\s+/g, ' ').trim();
    s = s.replace(LEAD_FILLER_RE, '').replace(TRAIL_FILLER_RE, '').trim();
    s = s.replace(/^(?:von|vom|an|mit|à)\s+/i, '').replace(/[\s,:–-]+$/, '').trim();
    s = s.replace(/(?:\s+(?:auf|für|fuer|mit|von|zu|an|neu|um))+$/i, '').trim();
    if (!s) return null;
    s = capFirst(s);

    return {
      text: s,
      qty: qty,
      unit: unit,
      mult: mult > 1 ? mult : 1,
      urgent: urgent,
      posten: classify(s, learned)
    };
  }

  // ---------- Befehle ----------
  var STOP = { der: 1, die: 1, das: 1, den: 1, dem: 1, des: 1, ein: 1, eine: 1, einen: 1, und: 1, mit: 1, von: 1,
    vom: 1, fuer: 1, zu: 1, zum: 1, zur: 1, im: 1, in: 1, am: 1, auf: 1, ist: 1, sind: 1, noch: 1, bitte: 1,
    aufgabe: 1, alle: 1, alles: 1, mal: 1 };

  function tokens(s) {
    return norm(s).split(/[^a-z0-9]+/).filter(function (w) { return w && !STOP[w] && !/^\d+$/.test(w); })
      .map(function (w) { return w.length > 5 ? w.replace(/(en|er|es|e|n|s)$/, '') : w; });
  }

  function matchTask(query, tasks, opts) {
    opts = opts || {};
    var q = tokens(query);
    if (!q.length) return null;
    var best = null, bestScore = 0;
    tasks.forEach(function (t) {
      if (opts.openOnly && t.done) return;
      if (opts.doneOnly && !t.done) return;
      var tt = tokens(t.text);
      var hit = 0;
      q.forEach(function (w) {
        for (var i = 0; i < tt.length; i++) {
          var v = tt[i];
          if (v === w || (w.length >= 4 && v.indexOf(w) >= 0) || (v.length >= 4 && w.indexOf(v) >= 0)) { hit++; break; }
        }
      });
      var score = hit / q.length + (hit ? 0.01 * (1 / (tt.length || 1)) : 0);
      if (score > bestScore) { bestScore = score; best = t; }
    });
    return bestScore >= 0.5 ? best : null;
  }

  var CMD = [
    { type: 'clearAll', re: /^(?:neue liste|liste leeren|alles l[oö]schen|alle aufgaben l[oö]schen|von vorne)$/i },
    { type: 'clearDone', re: /^(?:(?:alle\s+)?erledigte(?:n)?(?:\s+aufgaben)?\s+(?:l[oö]schen|entfernen|weg)|aufr[aä]umen|erledigte weg)$/i },
    { type: 'undo', re: /^(.+?)\s+(?:ist\s+)?(?:doch\s+)?(?:nicht erledigt|wieder offen|noch offen)$/i, g: 1 },
    { type: 'done', re: /^(?:hake?|hak)\s+(.+?)(?:\s+ab)?$/i, g: 1 },
    { type: 'done', re: /^(?:erledigt|fertig|abgehakt)[:\s]+(.+)$/i, g: 1 },
    { type: 'done', re: /^(.+?)\s+(?:ist\s+|sind\s+)?(?:erledigt|fertig|gemacht|abgehakt|abhaken|erledigen|done|check)$/i, g: 1 },
    { type: 'delete', re: /^(?:l[oö]sche?|streiche?|entferne?)\s+(.+)$/i, g: 1 },
    { type: 'delete', re: /^(.+?)\s+(?:l[oö]schen|streichen|entfernen|weglassen|f[aä]llt weg|entf[aä]llt|braucht es nicht|nicht mehr n[oö]tig)$/i, g: 1 },
    { type: 'urgent', re: /^(.+?)\s+(?:ist\s+)?(?:dringend|wichtig|sofort|priorit[aä]t)$/i, g: 1, needMatch: true },
    { type: 'change', re: /^(?:[aä]ndere?\s+)?(.+?)\s+(?:auf|neu)\s+((?:\d+(?:[.,]\d+)?|\S+)\s*\S*)$/i, g: 1 }
  ];

  function parseCommand(seg, tasks) {
    var s = seg.trim().replace(/[.!]+$/, '');
    for (var i = 0; i < CMD.length; i++) {
      var c = CMD[i];
      var m = s.match(c.re);
      if (!m) continue;
      if (c.type === 'clearAll' || c.type === 'clearDone') return { type: c.type };
      var target = m[c.g];
      var opts = c.type === 'done' ? { openOnly: true } : c.type === 'undo' ? { doneOnly: true } : {};
      var task = matchTask(target, tasks, opts);
      if (c.type === 'change') {
        if (!task) continue;
        var p = parseTask('Menge ' + m[2]);
        if (!p || (p.qty == null && p.mult === 1)) continue;
        return { type: 'change', task: task, qty: p.qty, unit: p.unit, mult: p.mult, query: target };
      }
      if (c.needMatch && !task) continue;
      return { type: c.type, task: task, query: target };
    }
    return null;
  }

  // ---------- Hauptfunktion ----------
  function parse(text, tasks, learned) {
    tasks = tasks || [];
    var segs = splitSegments(text);
    var result = [];
    segs.forEach(function (seg) {
      var cmd = parseCommand(seg, tasks);
      if (cmd) { result.push(cmd); return; }
      var t = parseTask(seg, learned);
      if (t) result.push({ type: 'add', task: t });
    });
    return result;
  }

  function learnWords(text) {
    return tokens(text).filter(function (w) { return w.length >= 4; });
  }

  // ---------- Diktat-Puffer ----------
  // Safari auf dem iPhone hat drei Eigenheiten: Teilstücke kommen kumuliert doppelt,
  // nach einer Pause wird der bisherige Text verworfen, und Wörter werden nachträglich
  // korrigiert. Der Puffer gleicht das aus und liefert immer den ganzen Text.
  function joinText(a, b) {
    a = (a || '').trim(); b = (b || '').trim();
    if (!a) return b;
    if (!b) return a;
    var la = a.toLowerCase(), lb = b.toLowerCase();
    if (lb.indexOf(la) === 0) return b;
    if (la.indexOf(lb) >= 0) return a;
    return a + ' ' + b;
  }
  function commonPrefix(a, b) {
    a = a.toLowerCase(); b = b.toLowerCase();
    var i = 0; while (i < a.length && i < b.length && a[i] === b[i]) i++;
    return i;
  }
  function mergeEvent(results) {
    var acc = '';
    for (var i = 0; i < results.length; i++) {
      var r = results[i];
      var t = (r && r[0] && r[0].transcript || '').trim();
      if (t) acc = joinText(acc, t);
    }
    return acc;
  }
  function createTranscript() {
    var committed = '', last = '', lastLen = 0;
    return {
      push: function (ev) {
        var results = (ev && ev.results) || [];
        var cur = mergeEvent(results);
        if (last) {
          var refinement = commonPrefix(last, cur) >= Math.min(4, last.length);
          if (results.length < lastLen || !refinement) committed = joinText(committed, last);
        }
        last = cur; lastLen = results.length;
        return joinText(committed, cur);
      },
      text: function () { return joinText(committed, last); },
      reset: function () { committed = ''; last = ''; lastLen = 0; }
    };
  }

  var api = {
    POSTEN: POSTEN, parse: parse, splitSegments: splitSegments, parseTask: parseTask,
    parseCommand: parseCommand, classify: classify, matchTask: matchTask, fmtNumber: fmtNumber,
    norm: norm, learnWords: learnWords, UNITS: UNITS, createTranscript: createTranscript
  };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.MepParser = api;
})(typeof window !== 'undefined' ? window : this);
