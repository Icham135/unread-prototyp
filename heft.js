/* RaffiLib.heft – Foto eines handgeschriebenen Notizhefts, rein per Canvas.
 * Schnittstelle:
 *   RaffiLib.heft.erzeuge(opt) -> HTMLCanvasElement (sofort, synchron)
 *     opt.zeilen: ['Text', '', ...]   ('' = Leerzeile)
 *     opt.vornamen: ['Lena', ...]     (werden als Liste unter den Zeilen notiert)
 *     opt.durchgestrichen: ['Lena']   (überall im Text durchgestrichen)
 *     opt.seed: 'beliebig'            (gleicher Seed = gleiche Optik)
 *     opt.breite/hoehe (1080x1440), opt.schrift, opt.tinte ('blau'|'schwarz'|'rot'), opt.datum
 *   RaffiLib.heft.alsUrl(canvas, qualitaet) -> 'data:image/jpeg...' (JPEG wie ein Handyfoto)
 *   RaffiLib.heft.alsBlobUrl(canvas) -> Promise<'blob:...'> ; RaffiLib.heft.schriften() -> vorhandene Schreibschriften
 * Keine Netzwerkzugriffe, nur Systemschriften. */
(function () {
  'use strict';
  var R = window.RaffiLib = window.RaffiLib || {};

  // ---------- Zufall mit Seed ----------
  function hash(str) {
    str = String(str == null ? '' : str);
    var h = 2166136261 >>> 0;
    for (var i = 0; i < str.length; i++) { h ^= str.charCodeAt(i); h = Math.imul(h, 16777619); }
    return h >>> 0;
  }
  function zufall(seed) {
    var s = hash(seed) || 1;
    var f = function () {
      s = (s + 0x6D2B79F5) | 0;
      var t = Math.imul(s ^ (s >>> 15), 1 | s);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
    f.zw = function (a, b) { return a + f() * (b - a); };
    f.gauss = function () { return (f() + f() + f() - 1.5) / 1.5; };
    return f;
  }
  // Weiches 1D-Rauschen (für wandernde Grundlinie)
  function rauschen1d(r, n) {
    var p = []; for (var i = 0; i < (n || 64); i++) p.push(r() * 2 - 1);
    return function (x) {
      var i0 = Math.floor(x), t = x - i0, a = p[((i0 % p.length) + p.length) % p.length], b = p[(((i0 + 1) % p.length) + p.length) % p.length];
      var u = (1 - Math.cos(t * Math.PI)) / 2; return a * (1 - u) + b * u;
    };
  }
  function leinwand(w, h) { var c = document.createElement('canvas'); c.width = Math.max(1, Math.round(w)); c.height = Math.max(1, Math.round(h)); return c; }

  // ---------- Schriften erkennen ----------
  var KANDIDATEN = ['Bradley Hand', 'Noteworthy', 'Segoe Print', 'Ink Free', 'Segoe Script', 'Chalkboard SE', 'Comic Sans MS', 'Snell Roundhand', 'Marker Felt'];
  var cacheSchriften = null;
  function vorhanden(name) {
    var c = leinwand(10, 10).getContext('2d'), t = 'Heft mmwwlli Raffi 0123 ÄÖÜ';
    var basen = ['monospace', 'serif', 'sans-serif'];
    for (var i = 0; i < basen.length; i++) {
      c.font = '40px ' + basen[i]; var w0 = c.measureText(t).width;
      c.font = '40px "' + name + '", ' + basen[i]; var w1 = c.measureText(t).width;
      if (Math.abs(w0 - w1) > 0.5) return true;
    }
    return false;
  }
  function schriften() {
    if (!cacheSchriften) {
      cacheSchriften = KANDIDATEN.filter(vorhanden);
      cacheSchriften.push('cursive'); // Android: Dancing Script / Coming Soon
    }
    return cacheSchriften.slice();
  }
  function fontString(name, px) {
    var fam = name === 'cursive' ? 'cursive' : '"' + name + '", cursive';
    var gewicht = name === 'Bradley Hand' ? 'bold ' : '';
    return gewicht + Math.round(px * 10) / 10 + 'px ' + fam;
  }

  var TINTEN = { blau: [24, 46, 132], schwarz: [28, 28, 34], rot: [150, 24, 30] };

  // ---------- Papier ----------
  function zeichnePapier(ctx, W, H, r, pad) {
    var x0 = pad;
    ctx.fillStyle = 'rgb(' + Math.round(r.zw(240, 246)) + ',' + Math.round(r.zw(236, 241)) + ',' + Math.round(r.zw(224, 232)) + ')';
    ctx.fillRect(x0, 0, W - x0, H);
    // Flecken / Vergilbung
    for (var i = 0; i < 18; i++) {
      var gx = r.zw(x0, W), gy = r.zw(0, H), gr = r.zw(80, 400);
      var g = ctx.createRadialGradient(gx, gy, 0, gx, gy, gr);
      var dunkel = r() < 0.5;
      g.addColorStop(0, dunkel ? 'rgba(150,120,70,0.035)' : 'rgba(255,255,250,0.05)');
      g.addColorStop(1, 'rgba(0,0,0,0)');
      ctx.fillStyle = g; ctx.fillRect(x0, 0, W - x0, H);
    }
    // Fasern
    ctx.lineCap = 'round';
    for (i = 0; i < 1600; i++) {
      var fx = r.zw(x0, W), fy = r.zw(0, H), l = r.zw(2, 9), a = r() * Math.PI;
      ctx.strokeStyle = r() < 0.5 ? 'rgba(120,100,70,' + r.zw(0.02, 0.06) + ')' : 'rgba(255,255,255,' + r.zw(0.05, 0.12) + ')';
      ctx.lineWidth = r.zw(0.4, 1.1);
      ctx.beginPath(); ctx.moveTo(fx, fy); ctx.lineTo(fx + Math.cos(a) * l, fy + Math.sin(a) * l); ctx.stroke();
    }
    // Feinkörnung des Papiers
    var img = ctx.getImageData(x0, 0, W - x0, H), d = img.data;
    for (var p = 0; p < d.length; p += 4) {
      var n = (r() - 0.5) * 9; d[p] += n; d[p + 1] += n; d[p + 2] += n;
    }
    ctx.putImageData(img, x0, 0);
  }

  function zeichneLiniatur(ctx, W, H, r, pad, L, oben, rand) {
    // Linien (gedruckt, leicht unregelmässig im Farbauftrag)
    for (var y = oben; y < H - L * 0.6; y += L) {
      ctx.strokeStyle = 'rgba(80,125,200,' + r.zw(0.42, 0.55) + ')';
      ctx.lineWidth = r.zw(1.4, 1.9);
      ctx.beginPath(); ctx.moveTo(pad, y + 0.5); ctx.lineTo(W, y + 0.5); ctx.stroke();
    }
    // Kopflinie dicker
    ctx.strokeStyle = 'rgba(80,125,200,0.55)'; ctx.lineWidth = 2.2;
    ctx.beginPath(); ctx.moveTo(pad, oben - L + 0.5); ctx.lineTo(W, oben - L + 0.5); ctx.stroke();
    // Randlinie rot
    ctx.strokeStyle = 'rgba(214,70,70,0.55)'; ctx.lineWidth = 2;
    ctx.beginPath(); ctx.moveTo(rand, 0); ctx.lineTo(rand, H); ctx.stroke();
  }

  // Durchscheinende Schrift von der Rückseite
  function zeichneRueckseite(ctx, W, H, r, pad, L, oben) {
    ctx.save();
    ctx.strokeStyle = 'rgba(40,50,110,0.045)'; ctx.lineWidth = 2.2; ctx.lineCap = 'round';
    for (var y = oben - L * 0.25; y < H * 0.8; y += L) {
      if (r() < 0.3) continue;
      var x = W - r.zw(60, 120), ende = r.zw(pad + 150, W * 0.6);
      ctx.beginPath(); ctx.moveTo(x, y);
      while (x > ende) {
        var s = r.zw(6, 16);
        ctx.quadraticCurveTo(x - s / 2, y - r.zw(4, 14), x - s, y + r.zw(-2, 2));
        x -= s; if (r() < 0.12) { x -= r.zw(10, 22); ctx.moveTo(x, y); }
      }
      ctx.stroke();
    }
    ctx.restore();
  }

  function zeichneSpirale(ctx, H, r, pad, L) {
    for (var y = L * 0.8; y < H - L * 0.4; y += L * 0.92) {
      // Loch
      ctx.fillStyle = 'rgba(20,14,10,0.92)';
      ctx.beginPath(); ctx.ellipse(pad + 26, y, 9, 11, 0, 0, Math.PI * 2); ctx.fill();
      // Ring (Metall)
      var g = ctx.createLinearGradient(0, y - 8, 0, y + 8);
      g.addColorStop(0, '#5b5f66'); g.addColorStop(0.35, '#e6e9ee'); g.addColorStop(0.6, '#9aa0a8'); g.addColorStop(1, '#3a3d42');
      ctx.strokeStyle = 'rgba(0,0,0,0.35)'; ctx.lineWidth = 8;
      ctx.beginPath(); ctx.moveTo(pad + 28, y + 3); ctx.bezierCurveTo(pad + 10, y + 6, 4, y + 2, 6, y - 4); ctx.stroke();
      ctx.strokeStyle = g; ctx.lineWidth = 5.5; ctx.lineCap = 'round';
      ctx.beginPath(); ctx.moveTo(pad + 27, y); ctx.bezierCurveTo(pad + 8, y + 3, 4, y - 1, 7, y - 7); ctx.stroke();
    }
  }

  // ---------- Handschrift ----------
  function normName(s) { return String(s).toLowerCase().replace(/[^a-zäöüéèàçâêîôû-]/gi, ''); }

  function schreibe(ink, opt, r, geo) {
    var ctx = ink.getContext('2d');
    var farbe = TINTEN[opt.tinte] || TINTEN.blau;
    var schrift = geo.schrift, L = geo.L;
    var px = L * 0.82;
    // x-Höhe normalisieren, damit jede Schrift gleich gross wirkt
    ctx.font = fontString(schrift, px);
    var mx = ctx.measureText('x');
    if (mx.actualBoundingBoxAscent) {
      // x-Höhe ~0.34 Linien, Oberlängen höchstens ~0.72 Linien – das Kleinere gewinnt
      var xh = mx.actualBoundingBoxAscent, oberl = ctx.measureText('Hdlk').actualBoundingBoxAscent || xh * 2;
      var px1 = px * (L * 0.34) / xh, px2 = px * (L * 0.72) / oberl;
      px = Math.max(L * 0.5, Math.min(L * 1.25, px1, px2));
    }
    var streich = {}; (opt.durchgestrichen || []).forEach(function (n) { streich[normName(n)] = true; });
    var schraeg = r.zw(-0.17, -0.08);       // Grundneigung nach rechts
    // fette Schriften dünner machen
    var duenner = opt.duenner != null ? opt.duenner : ({ 'Bradley Hand': 0.045, 'Marker Felt': 0.05, 'Chalkboard SE': 0.03, 'Comic Sans MS': 0.03, 'Noteworthy': 0.02 }[schrift] || 0);
    var wander = rauschen1d(r, 97);
    var druck = rauschen1d(r, 53);
    var zeilen = (opt.zeilen || []).slice();
    if (opt.vornamen && opt.vornamen.length) {
      if (zeilen.length) zeilen.push('');
      var strich = r() < 0.5 ? '– ' : '';   // einheitlich pro Heft
      opt.vornamen.forEach(function (n) { zeilen.push(strich + n); });
    }
    // Zeilenumbruch nach Breite
    var maxW = geo.rechts - geo.links;
    var umbrochen = [];
    zeilen.forEach(function (z) {
      if (!z) { umbrochen.push(''); return; }
      ctx.font = fontString(schrift, px);
      var woerter = String(z).split(/\s+/), akt = '';
      woerter.forEach(function (w) {
        var t = akt ? akt + ' ' + w : w;
        if (ctx.measureText(t).width * 1.06 > maxW && akt) { umbrochen.push(akt); akt = w; } else akt = t;
      });
      if (akt) umbrochen.push(akt);
    });

    var zeile = 0, schlag = 0;
    if (opt.datum) {
      ctx.save(); ctx.font = fontString(schrift, px * 0.85);
      ctx.fillStyle = 'rgba(' + farbe.join(',') + ',0.85)';
      ctx.setTransform(1, 0, schraeg, 1, geo.rechts - ctx.measureText(opt.datum).width - 10, geo.oben - L - L * 0.2);
      ctx.fillText(opt.datum, 0, 0); ctx.restore();
    }
    var randEinzug = r.zw(6, 16);
    for (var zi = 0; zi < umbrochen.length; zi++) {
      var text = umbrochen[zi];
      var basis = geo.oben + zeile * L - L * r.zw(0.12, 0.2);
      zeile++;
      if (basis > geo.unten) break;
      if (!text) continue;
      var x = geo.links + randEinzug + r.zw(-5, 7);
      var steigung = r.zw(-0.012, 0.006);  // Zeile läuft leicht schief
      var woerter = text.split(' ');
      var startX = x;
      for (var wi = 0; wi < woerter.length; wi++) {
        var wort = woerter[wi];
        var groesse = px * r.zw(0.94, 1.06);
        ctx.font = fontString(schrift, groesse);
        var breite = ctx.measureText(wort).width;
        var y = basis + (x - startX) * steigung + wander(schlag * 0.35) * L * 0.07 + r.gauss() * L * 0.02;
        var winkel = r.gauss() * 0.025 + steigung;
        var neig = schraeg + r.gauss() * 0.03;
        var p = 0.62 + 0.3 * (druck(schlag * 0.21) * 0.5 + 0.5);   // Druck 0.62..0.92
        // Druckverlauf innerhalb des Wortes
        var a0 = Math.min(1, p + 0.06), am = p - r.zw(0.05, 0.18), a1 = Math.min(1, p + r.zw(-0.05, 0.08)), tm = r.zw(0.3, 0.7);
        ctx.save();
        ctx.translate(x, y); ctx.rotate(winkel); ctx.transform(1, 0, neig, 1, 0, 0);
        // Buchstabe für Buchstabe: Position aus dem Wortanfang gemessen (Kerning bleibt),
        // jeder Buchstabe leicht anders gedreht, skaliert, versetzt – damit gleiche Buchstaben nie identisch sind
        var dy = 0;
        for (var ci = 0; ci < wort.length; ci++) {
          var bx = ci ? ctx.measureText(wort.slice(0, ci)).width : 0, tt = breite ? bx / breite : 0;
          var alpha = tt < tm ? a0 + (am - a0) * tt / tm : am + (a1 - am) * (tt - tm) / (1 - tm);
          ctx.fillStyle = 'rgba(' + farbe.join(',') + ',' + alpha.toFixed(3) + ')';
          dy += r.gauss() * 0.35; dy *= 0.8;
          ctx.save();
          ctx.translate(bx + r.gauss() * 0.5, dy);
          ctx.rotate(r.gauss() * 0.035);
          var sk = 1 + r.gauss() * 0.035; ctx.scale(sk, 1 + r.gauss() * 0.04);
          ctx.fillText(wort[ci], 0, 0);
          // Zittern: zweiter, leicht versetzter Strich für ungleichmässige Strichstärke
          ctx.globalAlpha = r.zw(0.15, 0.45);
          ctx.fillText(wort[ci], r.zw(-0.7, 0.7), r.zw(-0.5, 0.5));
          // Kanten abtragen: Kugelschreiberstrich ist dünner als die Schrift
          if (duenner > 0) {
            ctx.globalAlpha = 1; ctx.globalCompositeOperation = 'destination-out';
            ctx.lineWidth = groesse * duenner * r.zw(0.7, 1.2); ctx.lineJoin = 'round';
            ctx.strokeStyle = 'rgba(0,0,0,0.85)'; ctx.strokeText(wort[ci], 0, 0);
          }
          ctx.restore();
        }
        // Kugelschreiber-Klecks am Wortanfang (selten)
        if (r() < 0.12) {
          ctx.fillStyle = 'rgba(' + farbe.join(',') + ',0.8)';
          ctx.beginPath(); ctx.arc(r.zw(0, 3), -groesse * r.zw(0.1, 0.3), r.zw(1, 1.8), 0, Math.PI * 2); ctx.fill();
        }
        ctx.restore();
        if (streich[normName(wort)]) streicheDurch(ctx, x, y, breite, groesse, winkel, neig, farbe, r);
        x += breite + ctx.measureText(' ').width * r.zw(0.85, 1.35);
        schlag++;
      }
    }
    return umbrochen.length;
  }

  function streicheDurch(ctx, x, y, breite, groesse, winkel, neig, farbe, r) {
    ctx.save();
    ctx.translate(x, y); ctx.rotate(winkel + r.zw(-0.05, 0.03));
    ctx.lineCap = 'round'; ctx.lineJoin = 'round';
    var anzahl = r() < 0.55 ? 2 : (r() < 0.6 ? 1 : 3);
    var mitte = -groesse * 0.27;
    for (var k = 0; k < anzahl; k++) {
      var y0 = mitte + r.zw(-groesse * 0.1, groesse * 0.1) + k * groesse * 0.05;
      var x0 = r.zw(-10, -3), x1 = breite + r.zw(2, 12);
      ctx.strokeStyle = 'rgba(' + farbe.join(',') + ',' + r.zw(0.78, 0.95) + ')';
      ctx.lineWidth = r.zw(2.4, 3.6);
      ctx.beginPath(); ctx.moveTo(x0, y0 + r.zw(-2, 2));
      var schritte = 6;
      for (var s = 1; s <= schritte; s++) {
        var t = s / schritte;
        ctx.lineTo(x0 + (x1 - x0) * t, y0 + r.zw(-1.6, 1.6) - t * r.zw(0, 5));
      }
      ctx.stroke();
      // Rückstrich (Hin und zurück, typisch beim schnellen Durchstreichen)
      if (r() < 0.45) {
        ctx.lineWidth *= 0.8;
        ctx.beginPath(); ctx.moveTo(x1, y0 - 3);
        ctx.quadraticCurveTo((x0 + x1) / 2, y0 + r.zw(2, 6), x0 + r.zw(0, 10), y0 + r.zw(-1, 4));
        ctx.stroke();
      }
    }
    ctx.restore();
  }

  // Aussetzer der Kugelschreibermine
  function aussetzer(ink, r) {
    var ctx = ink.getContext('2d');
    ctx.save(); ctx.globalCompositeOperation = 'destination-out';
    var n = Math.round(ink.width * ink.height / 260);
    for (var i = 0; i < n; i++) {
      ctx.fillStyle = 'rgba(0,0,0,' + r.zw(0.15, 0.55) + ')';
      ctx.fillRect(r() * ink.width, r() * ink.height, r.zw(0.6, 1.8), r.zw(0.6, 1.4));
    }
    ctx.restore();
  }

  // ---------- Perspektive: Trapez durch Zeilenstreifen ----------
  function verzerre(quelle, obenFaktor, r) {
    var w = quelle.width, h = quelle.height;
    var ziel = leinwand(w, h * 0.97);
    var ctx = ziel.getContext('2d');
    var streifen = 2, zh = ziel.height;
    for (var y = 0; y < h; y += streifen) {
      var t = y / h;
      var f = obenFaktor + (1 - obenFaktor) * t;      // Breite je Zeile
      // obere Zeilen etwas gestaucht (Verkürzung)
      var ty = (t * (0.9 + 0.1 * t)) / 1.0;
      var ty2 = ((t + streifen / h) * (0.9 + 0.1 * (t + streifen / h)));
      var dw = w * f, dx = (w - dw) / 2 + Math.sin(t * 3.1) * 1.5;
      ctx.drawImage(quelle, 0, y, w, streifen, dx, ty * zh, dw, Math.max(1, (ty2 - ty) * zh + 0.6));
    }
    // Seite hebt sich zur Spirale hin leicht an: Linien biegen sich dort
    var gebogen = leinwand(w, ziel.height + 14), gc = gebogen.getContext('2d');
    for (var x = 0; x < w; x += 2) {
      var dyb = 12 * Math.exp(-x / (w * 0.07)) + 2 * Math.sin(x / w * Math.PI);
      gc.drawImage(ziel, x, 0, 2, ziel.height, x, 12 - dyb + 2, 2, ziel.height);
    }
    return gebogen;
  }

  // ---------- Tisch ----------
  function zeichneTisch(ctx, W, H, r) {
    var kw = Math.ceil(W / 4), kh = Math.ceil(H / 4);
    var k = leinwand(kw, kh), kc = k.getContext('2d');
    var img = kc.createImageData(kw, kh), d = img.data;
    var n1 = rauschen1d(r, 61), n2 = rauschen1d(r, 89);
    var grundR = r.zw(78, 96), grundG = r.zw(50, 60), grundB = r.zw(32, 40);
    var winkel = r.zw(-0.25, 0.25);
    for (var y = 0; y < kh; y++) for (var x = 0; x < kw; x++) {
      var u = x * Math.cos(winkel) + y * Math.sin(winkel), v = -x * Math.sin(winkel) + y * Math.cos(winkel);
      // Maserung: entlang u gestreckt, quer dazu feine Streifen
      var mase = Math.sin(v * 0.55 + n1(u * 0.012) * 7 + n2(v * 0.03) * 3);
      var streifen = n2(v * 1.9 + n1(u * 0.02) * 3) * 0.5 + n1(v * 4.3 + 17) * 0.25;
      var f = 0.62 + 0.13 * mase + 0.12 * streifen;
      var i = (y * kw + x) * 4;
      d[i] = grundR * f; d[i + 1] = grundG * f; d[i + 2] = grundB * f; d[i + 3] = 255;
    }
    kc.putImageData(img, 0, 0);
    ctx.imageSmoothingEnabled = true;
    ctx.drawImage(k, 0, 0, W, H);
  }

  // ---------- Kugelschreiber ----------
  function zeichneStift(ctx, W, H, r, lichtX, lichtY) {
    var laenge = W * r.zw(0.6, 0.7), dm = W * 0.04;
    var cx = W * r.zw(0.62, 0.72), cy = H * r.zw(0.74, 0.8);
    var winkel = r.zw(-0.75, -0.5);
    var koerper = r() < 0.5 ? ['#0d1b4a', '#1f3b9c', '#5f7fe0'] : ['#111114', '#2b2b30', '#6b6b74'];
    ctx.save();
    ctx.translate(cx, cy); ctx.rotate(winkel);
    // Schatten
    ctx.save();
    ctx.translate(dm * 0.5, dm * 0.9);
    ctx.shadowColor = 'rgba(0,0,0,0.55)'; ctx.shadowBlur = dm * 0.9;
    ctx.fillStyle = 'rgba(0,0,0,0.35)';
    rundRechteck(ctx, -laenge / 2, -dm / 2, laenge, dm, dm / 2); ctx.fill();
    ctx.restore();
    // Spitze (Metallkegel)
    var spitzeL = dm * 1.5, x0 = -laenge / 2;
    var gm = ctx.createLinearGradient(0, -dm / 2, 0, dm / 2);
    gm.addColorStop(0, '#4a4d52'); gm.addColorStop(0.3, '#f2f4f7'); gm.addColorStop(0.55, '#9ca1a8'); gm.addColorStop(1, '#2c2e32');
    ctx.fillStyle = gm;
    ctx.beginPath(); ctx.moveTo(x0, 0); ctx.lineTo(x0 + spitzeL, -dm * 0.36); ctx.lineTo(x0 + spitzeL, dm * 0.36); ctx.closePath(); ctx.fill();
    ctx.fillStyle = '#1a1a1a'; ctx.beginPath(); ctx.arc(x0 + 1, 0, 1.6, 0, Math.PI * 2); ctx.fill();
    // Griffzone (Gummi mit Rillen)
    var gx = x0 + spitzeL, gl = laenge * 0.22;
    var gg = ctx.createLinearGradient(0, -dm / 2, 0, dm / 2);
    gg.addColorStop(0, '#060606'); gg.addColorStop(0.32, '#3a3a3e'); gg.addColorStop(0.5, '#1a1a1c'); gg.addColorStop(1, '#030303');
    ctx.fillStyle = gg; rundRechteck(ctx, gx, -dm * 0.46, gl, dm * 0.92, dm * 0.2); ctx.fill();
    ctx.strokeStyle = 'rgba(255,255,255,0.07)'; ctx.lineWidth = 1;
    for (var rx = gx + 6; rx < gx + gl - 4; rx += 5) { ctx.beginPath(); ctx.moveTo(rx, -dm * 0.42); ctx.lineTo(rx, dm * 0.42); ctx.stroke(); }
    // Körper
    var bx = gx + gl, bl = laenge / 2 - bx;
    var gb = ctx.createLinearGradient(0, -dm / 2, 0, dm / 2);
    gb.addColorStop(0, koerper[0]); gb.addColorStop(0.22, koerper[2]); gb.addColorStop(0.3, '#ffffff'); gb.addColorStop(0.38, koerper[2]);
    gb.addColorStop(0.7, koerper[1]); gb.addColorStop(1, koerper[0]);
    ctx.fillStyle = gb; rundRechteck(ctx, bx, -dm / 2, bl, dm, dm * 0.45); ctx.fill();
    // Clip (Metall)
    var cl = laenge * 0.3, cxp = laenge / 2 - cl - dm * 0.2;
    var gc = ctx.createLinearGradient(0, -dm * 0.62, 0, -dm * 0.2);
    gc.addColorStop(0, '#6d7178'); gc.addColorStop(0.5, '#f5f7fa'); gc.addColorStop(1, '#80858c');
    ctx.save(); ctx.shadowColor = 'rgba(0,0,0,0.45)'; ctx.shadowBlur = 4; ctx.shadowOffsetY = 2;
    ctx.fillStyle = gc; rundRechteck(ctx, cxp, -dm * 0.6, cl, dm * 0.34, dm * 0.12); ctx.fill(); ctx.restore();
    // Druckknopf
    ctx.fillStyle = gm; rundRechteck(ctx, laenge / 2 - 2, -dm * 0.32, dm * 0.5, dm * 0.64, dm * 0.15); ctx.fill();
    ctx.restore();
  }
  function rundRechteck(ctx, x, y, w, h, rr) {
    rr = Math.min(rr, h / 2, w / 2);
    ctx.beginPath(); ctx.moveTo(x + rr, y); ctx.lineTo(x + w - rr, y); ctx.arcTo(x + w, y, x + w, y + rr, rr);
    ctx.lineTo(x + w, y + h - rr); ctx.arcTo(x + w, y + h, x + w - rr, y + h, rr); ctx.lineTo(x + rr, y + h);
    ctx.arcTo(x, y + h, x, y + h - rr, rr); ctx.lineTo(x, y + rr); ctx.arcTo(x, y, x + rr, y, rr); ctx.closePath();
  }

  // ---------- Kamera-Effekte ----------
  function weichzeichnen(quelle, faktor) {
    var k = leinwand(quelle.width * faktor, quelle.height * faktor);
    var kc = k.getContext('2d'); kc.imageSmoothingEnabled = true; kc.imageSmoothingQuality = 'high';
    kc.drawImage(quelle, 0, 0, k.width, k.height);
    return k;
  }
  function kamera(scene, r, lx, ly) {
    var W = scene.width, H = scene.height, ctx = scene.getContext('2d');
    // leichte Unschärfe gesamt
    var weich = weichzeichnen(scene, 0.55);
    ctx.globalAlpha = 0.55; ctx.drawImage(weich, 0, 0, W, H); ctx.globalAlpha = 1;
    // Rand-Unschärfe (geringe Schärfentiefe)
    var stark = weichzeichnen(scene, 0.18);
    var maske = leinwand(W, H), mc = maske.getContext('2d');
    mc.drawImage(stark, 0, 0, W, H);
    mc.globalCompositeOperation = 'destination-in';
    var g = mc.createRadialGradient(lx, ly, Math.min(W, H) * 0.32, lx, ly, Math.max(W, H) * 0.75);
    g.addColorStop(0, 'rgba(0,0,0,0)'); g.addColorStop(1, 'rgba(0,0,0,0.9)');
    mc.fillStyle = g; mc.fillRect(0, 0, W, H);
    ctx.drawImage(maske, 0, 0);
    // Körnung (stärker in dunklen Bereichen), leichte Farbsäume am Rand, Farbrauschen
    var img = ctx.getImageData(0, 0, W, H), d = img.data, quelleD = new Uint8ClampedArray(d);
    var cxm = W / 2, cym = H / 2, maxR = Math.sqrt(cxm * cxm + cym * cym);
    for (var y = 0; y < H; y++) {
      for (var x = 0; x < W; x++) {
        var i = (y * W + x) * 4;
        var dx = x - cxm, dy = y - cym, dist = Math.sqrt(dx * dx + dy * dy) / maxR;
        var ver = Math.round(dist * dist * 2.2); // Rot nach aussen verschoben
        var xs = Math.min(W - 1, Math.max(0, x + (dx > 0 ? ver : -ver)));
        var rr = quelleD[(y * W + xs) * 4];
        var lum = (rr + d[i + 1] + d[i + 2]) / 765;
        var amp = 7 + 24 * (1 - lum) * (1 - lum);
        var n = (r() + r() - 1) * amp;
        d[i] = rr + n + (r() - 0.5) * 4;
        d[i + 1] = d[i + 1] + n;
        d[i + 2] = d[i + 2] + n + (r() - 0.5) * 5;
      }
    }
    ctx.putImageData(img, 0, 0);
  }

  // ---------- Hauptfunktion ----------
  function erzeuge(opt) {
    opt = opt || {};
    var W = opt.breite || 1080, H = opt.hoehe || 1440;
    var r = zufall('heft:' + (opt.seed == null ? 'raffi' : opt.seed));
    var verf = schriften();
    var schrift = opt.schrift && verf.indexOf(opt.schrift) >= 0 ? opt.schrift : verf[0];

    // Seite (eigene Leinwand, danach perspektivisch verzerrt)
    var pad = 40;
    var nah = opt.nah == null ? 1.06 : opt.nah;
    var PW = Math.round(W * 0.86 * nah) + pad, PH = Math.round(H * 0.9 * nah);
    var seite = leinwand(PW, PH), sc = seite.getContext('2d', { willReadFrequently: true });
    var L = PH / (opt.linien || 24), oben = L * 2.6, rand = pad + PW * 0.12;
    zeichnePapier(sc, PW, PH, r, pad);
    zeichneRueckseite(sc, PW, PH, r, pad, L, oben);
    zeichneLiniatur(sc, PW, PH, r, pad, L, oben, rand);

    var ink = leinwand(PW, PH);
    schreibe(ink, opt, r, { schrift: schrift, L: L, oben: oben, unten: PH - L, links: rand + 10, rechts: PW - 30 });
    aussetzer(ink, r);
    sc.save(); sc.globalCompositeOperation = 'multiply'; sc.drawImage(ink, 0, 0); sc.restore();

    // Wölbung: Schatten zur Spirale hin, Licht in der Mitte
    var gw = sc.createLinearGradient(pad, 0, PW, 0);
    gw.addColorStop(0, 'rgba(60,40,20,0.28)'); gw.addColorStop(0.07, 'rgba(60,40,20,0.06)');
    gw.addColorStop(0.45, 'rgba(255,255,255,0)'); gw.addColorStop(0.92, 'rgba(60,40,20,0.05)'); gw.addColorStop(1, 'rgba(60,40,20,0.16)');
    sc.fillStyle = gw; sc.fillRect(pad, 0, PW - pad, PH);
    zeichneSpirale(sc, PH, r, pad, L);

    var verzerrt = verzerre(seite, r.zw(0.9, 0.95), r);

    // Szene
    var scene = leinwand(W, H), ctx = scene.getContext('2d', { willReadFrequently: true });
    zeichneTisch(ctx, W, H, r);
    ctx.save();
    ctx.translate(W / 2 + r.zw(-10, 30) + (nah - 1) * W * 0.25, H / 2 + r.zw(0, 20) + (nah - 1) * H * 0.3);
    ctx.rotate(r.zw(-0.09, 0.09) + (r() < 0.5 ? 0.03 : -0.03));
    ctx.shadowColor = 'rgba(0,0,0,0.6)'; ctx.shadowBlur = 40; ctx.shadowOffsetX = 10; ctx.shadowOffsetY = 18;
    // darunterliegende Seiten (Heftdicke)
    for (var lage = 4; lage >= 1; lage--) {
      ctx.fillStyle = lage % 2 ? '#cfc8b8' : '#ddd6c6';
      ctx.fillRect(-verzerrt.width / 2 + pad + lage * 1.6, -verzerrt.height / 2 + lage * 2.2, verzerrt.width - pad - 4, verzerrt.height - 6);
      if (lage === 4) ctx.shadowColor = 'transparent';
    }
    ctx.drawImage(verzerrt, -verzerrt.width / 2, -verzerrt.height / 2);
    ctx.restore();

    var lx = W * r.zw(0.38, 0.55), ly = H * r.zw(0.3, 0.42);
    if (opt.stift !== false) zeichneStift(ctx, W, H, r, lx, ly);

    // Blitzlicht: Abfall zum Rand, Schein in der Mitte, Farbstich
    ctx.save();
    ctx.globalCompositeOperation = 'multiply';
    var abfall = ctx.createRadialGradient(lx, ly, 0, lx, ly, Math.max(W, H) * 0.85);
    abfall.addColorStop(0, 'rgb(255,250,242)'); abfall.addColorStop(0.45, 'rgb(205,196,186)');
    abfall.addColorStop(0.8, 'rgb(95,86,80)'); abfall.addColorStop(1, 'rgb(40,36,34)');
    ctx.fillStyle = abfall; ctx.fillRect(0, 0, W, H);
    ctx.globalCompositeOperation = 'screen';
    var schein = ctx.createRadialGradient(lx, ly, 0, lx, ly, W * 0.38);
    schein.addColorStop(0, 'rgba(255,255,255,0.32)'); schein.addColorStop(0.5, 'rgba(255,252,245,0.1)'); schein.addColorStop(1, 'rgba(255,255,255,0)');
    ctx.fillStyle = schein; ctx.fillRect(0, 0, W, H);
    var hot = ctx.createRadialGradient(lx + 10, ly - 6, 0, lx, ly, W * 0.1);
    hot.addColorStop(0, 'rgba(255,255,255,0.22)'); hot.addColorStop(1, 'rgba(255,255,255,0)');
    ctx.fillStyle = hot; ctx.fillRect(0, 0, W, H);
    ctx.restore();

    kamera(scene, r, lx, ly);
    scene.dataset.schrift = schrift;
    return scene;
  }

  function alsUrl(canvas, qualitaet) { return canvas.toDataURL('image/jpeg', qualitaet == null ? 0.84 : qualitaet); }
  function alsBlobUrl(canvas, qualitaet) {
    return new Promise(function (ok) {
      if (!canvas.toBlob) { ok(alsUrl(canvas, qualitaet)); return; }
      canvas.toBlob(function (b) { ok(b ? URL.createObjectURL(b) : alsUrl(canvas, qualitaet)); }, 'image/jpeg', qualitaet == null ? 0.84 : qualitaet);
    });
  }

  R.heft = { erzeuge: erzeuge, alsUrl: alsUrl, alsBlobUrl: alsBlobUrl, schriften: schriften, _zufall: zufall, _hash: hash };
})();
