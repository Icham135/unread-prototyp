// Unread, Prototyp: Ablauf der ganzen Geschichte (Drehbuch). Bilder und Sprachmemos sind noch Platzhalter-Text.
(function () {
  'use strict';
  const $ = s => document.querySelector(s);
  const FAST = new URLSearchParams(location.search).has('fast') ? 0.03 : 1; // ?fast zum Testen
  const chat = $('#chat'), bar = $('#bar'), stat = $('#status'), nm = $('#nm'), app = $('#app');
  const sleep = ms => new Promise(r => setTimeout(r, ms * FAST));
  const KEY = 'unread.v1';
  let S = {}; try { S = JSON.parse(localStorage.getItem(KEY)) || {}; } catch (e) {}
  const save = () => { try { localStorage.setItem(KEY, JSON.stringify(S)); } catch (e) {} };

  // Spielzeit: beginnt 03:07 und läuft mit den Nachrichten
  let clk = 3 * 3600 + 7 * 60;
  const two = n => String(n).padStart(2, '0');
  const hhmm = () => two(Math.floor(clk / 3600) % 24) + ':' + two(Math.floor(clk % 3600 / 60));
  const adv = () => { clk += 15 + Math.floor(Math.random() * 25); };

  const el = (tag, cls, text) => { const e = document.createElement(tag); if (cls) e.className = cls; if (text != null) e.textContent = text; return e; };
  const fill = t => String(t).replace(/\{name\}/g, S.name || '').replace(/\{code\}/g, S.code || '');

  // Chat bleibt unten kleben, rollt weich nach
  let pinned = true;
  chat.addEventListener('scroll', () => { pinned = chat.scrollHeight - chat.scrollTop - chat.clientHeight < 90; }, { passive: true });
  const down = () => { pinned = true; chat.scrollTo({ top: chat.scrollHeight, behavior: FAST < 1 ? 'auto' : 'smooth' }); };
  if (window.ResizeObserver) new ResizeObserver(() => { if (pinned) chat.scrollTop = chat.scrollHeight; }).observe(chat);

  const setStat = k => { stat.className = k; stat.querySelector('em').textContent = { on: 'Online', typing: 'schreibt …', off: 'Offline' }[k]; };

  function bubble(text, who, extra) {
    const b = el('div', 'msg ' + who + (extra ? ' ' + extra : ''));
    b.append(el('span', 'txt', fill(text)));
    const tm = el('time', '', hhmm());
    if (who === 'me') { const t = el('span', 'tk', '✓✓'); tm.append(t); b.tk = t; }
    b.append(tm); chat.append(b); down(); return b;
  }
  function note(text) { chat.append(el('div', 'note', fill(text))); down(); }
  function placeholder(kind, text) {
    const b = el('div', 'msg mira ph'); b.append(el('b', '', '(' + kind + ')'), el('span', '', fill(text)), el('time', '', hhmm()));
    chat.append(b); down(); return b;
  }
  function typingBubble(who) { const t = el('div', 'msg ' + who + ' typing'); t.append(el('i'), el('i'), el('i')); chat.append(t); down(); return t; }

  // Miras Nachricht: Tipp-Blase wird an Ort und Stelle zur Nachricht
  async function say(...lines) {
    for (const l of lines) {
      const text = fill(l);
      setStat('typing'); const t = typingBubble('mira');
      await sleep(Math.min(2300, Math.max(750, text.length * 30)));
      adv(); t.className = 'msg mira'; t.replaceChildren(el('span', 'txt', text), el('time', '', hhmm())); down();
      setStat('on'); await sleep(420);
    }
  }

  // Antworten: Auswahl; misst das Zögern; mit stiller Frist (nur wenn der Tab sichtbar ist)
  function choose(opts, o) {
    o = o || {};
    return new Promise(res => {
      const box = el('div', 'choices'); bar.replaceChildren(box);
      const t0 = Date.now(); let visible = 0, done = false;
      const finish = r => { if (done) return; done = true; clearInterval(iv); bar.replaceChildren(); res(r); };
      opts.forEach((txt, i) => {
        const b = el('button', 'choice', fill(txt)); b.style.animationDelay = i * 80 + 'ms';
        b.onclick = () => {
          const z = Math.round((Date.now() - t0) / 1000);
          clk += 3; const me = bubble(txt, 'me');
          S.ans = S.ans || []; S.ans.push({ t: hhmm(), a: fill(txt), z: z }); save();
          finish({ i, text: fill(txt), z, bubble: me });
        };
        box.append(b);
      });
      const iv = setInterval(() => { if (document.visibilityState === 'visible') visible++; if (o.stille && visible >= o.stille / (FAST < 1 ? 20 : 1)) finish(null); }, 1000 * (FAST < 1 ? 0.05 : 1));
    });
  }
  function ask(label, ph) {
    return new Promise(res => {
      const row = el('div', 'row'), lab = el('label', '', label), inp = el('input'); inp.placeholder = ph || ''; inp.maxLength = 20; inp.autocomplete = 'off';
      const send = el('button', 'send', 'Senden'); send.disabled = true;
      inp.oninput = () => { send.disabled = !inp.value.trim(); };
      const go = () => { const v = inp.value.replace(/\s+/g, ' ').trim().slice(0, 20); if (!v) return; bar.replaceChildren(); res(v); };
      send.onclick = go; inp.onkeydown = e => { if (e.key === 'Enter') go(); };
      row.append(lab, inp, send); bar.replaceChildren(row); setTimeout(() => inp.focus(), 50);
    });
  }
  const zoom = src => {
    let z = $('#zoom'); if (!z) { z = el('div'); z.id = 'zoom'; z.onclick = () => z.classList.remove('on'); app.append(z); }
    z.replaceChildren(Object.assign(new Image(), { src })); z.classList.add('on');
  };
  function heftFoto(extraName) {
    const ans = (S.ans || []).slice(-9);
    const zeilen = ans.map(a => a.t + '  ' + a.a + (a.z ? '  (' + a.z + ' s)' : ''));
    const alt = ['Jonas', 'Noah', 'Lea', 'Timo', 'Keller', 'Sven', 'Tina'];
    const namen = alt.concat([S.name]); if (extraName) namen.push(extraName);
    try {
      const c = window.RaffiLib.heft.erzeuge({ zeilen: zeilen, vornamen: namen, durchgestrichen: alt.concat(extraName ? [S.name] : []), seed: S.name || 'x' });
      return window.RaffiLib.heft.alsUrl(c, 0.85);
    } catch (e) { return ''; }
  }
  function heftBubble(extraName) {
    const url = heftFoto(extraName), b = el('div', 'msg mira heft');
    if (url) { const im = new Image(); im.src = url; im.alt = 'Foto eines Notizhefts'; im.onclick = () => zoom(url); im.onload = down; b.append(im); }
    else b.append(el('span', 'gone', '(Bild: das Heft, mit deinen Antworten und deinem Namen)'));
    b.append(el('time', '', hhmm())); chat.append(b); down(); return url;
  }
  function over(html, buttons, imgUrl) {
    let o = $('#over'); if (!o) { o = el('div'); o.id = 'over'; app.append(o); }
    o.className = ''; const box = el('div', 'box');
    if (imgUrl) { const i = new Image(); i.src = imgUrl; box.append(i); }
    html.forEach(h => box.append(el('p', h[1] || '', h[0])));
    buttons.forEach(([t, f]) => { const b = el('button', 'big', t); b.onclick = f; box.append(b); });
    o.replaceChildren(box);
  }
  const reset = () => { S = {}; save(); location.reload(); };

  // ---------------- Die Geschichte ----------------
  async function main() {
    if (S.endedB) { await say('du bist zurückgekommen.', 'das zählt auch.'); return endeA(true); }
    await say('bist du wach?');
    let r = await choose(['ja, was ist los?', 'wer ist da?']);
    await say(r.i ? 'mira. du kennst mich nicht. aber du bist wach.' : 'gut. das ist gut.', 'wie heisst du?');
    S.name = await ask('Name:', 'dein Vorname'); save(); bubble(S.name, 'me');
    await say('{name}. schön.', 'jemand ist in meiner wohnung.', 'er steht am bettende. er tut nichts.');
    r = await choose(['ruf die polizei', 'bleib ruhig, ich bin da', 'schau nach, wer es ist']);
    await say(['nein nein nein. keine polizei.', 'danke. das hilft.', 'bitte nicht. nicht nachschauen.'][r.i], 'nein. ruf niemanden an.', 'es hört zu.');
    placeholder('Bild', 'Mira, müde, nur vom Handylicht beleuchtet');
    await say('sieht man\'s mir an? 41 nächte.');
    await choose(['seit 41 nächten?', 'du siehst müde aus']);
    await say('ich darf nicht schlafen.', 'wenn ich schlafe, ist niemand wach.', 'falls ich dir später schreib, frag ich nach unserem wort.');
    r = await choose(['Kirsche', 'Leuchtturm', 'Mittwoch']); S.code = r.text; save();
    await say('gut. {code}. nicht vergessen.', 'ich war im nachtdienst. eine patientin schrieb mir: bist du wach?', 'ich schrieb: ja, ich bin da.', 'sie starb in der nacht.', 'vorher hat sie gelacht und geweint gleichzeitig und danke gesagt.');
    await choose(['das war nett von dir', 'du konntest nichts tun']);
    await say('es sagt immer bitte.', 'das ist das schlimmste.');
    await say('jonas … {name}.', 'sorry. die gewohnheit.');
    r = await choose(['wer ist jonas?', 'schon gut']);
    await say('ein früherer.');
    { // gelöschte Nachricht
      const g = bubble('Noah, bist du', 'mira'); await sleep(1100);
      g.replaceChildren(el('span', 'gone', 'Diese Nachricht wurde gelöscht.'), el('time', '', hhmm()));
      await sleep(500); await say('nichts. vertippt.');
    }
    placeholder('Sprachmemo 0:05', 'Mira flüstert zu jemandem im Raum: «noch nicht. er antwortet ja noch.»');
    await sleep(900);
    note('Verpasster Anruf von Mira · 03:14');
    await say('ich hab dich angerufen. du hast nicht abgenommen.');
    await choose(['ich hab nichts gehört', 'sorry, war eingeschlafen']);
    await say('auch nein zählt.');
    placeholder('Bild', 'Mira, die Augen weit offen, rot gerändert, blinzelt nicht');
    await say('ich hab vergessen, wie man blinzelt.');
    placeholder('Bild', 'Mira, grau und eingefallen, ein ruhiges Lächeln; am Bildrand ein dunkler Fleck am Fussende des Betts');
    await say('sei nicht erschrocken. ich bin eigentlich ruhig.', 'schick mir ein foto von dir.', 'damit ich weiss, dass du wach bist.');
    await choose(['ich kann nicht']);
    await say('ok. dann sehe ich dich nicht.', 'aber es sieht dich.');
    await say('{code}. ich bins.', 'es kann nicht rein.', 'es kann nur fragen.', 'und es fragt nie selbst.', 'ich muss dir was zeigen.');
    clk = 3 * 3600 + 41 * 60; heftBubble(); await sleep(1500);
    await say('es liest nicht mit.', 'du hast alles selbst unterschrieben.', 'ich hab nur vorgelesen.');
    { const last = chat.querySelector('.msg.me:last-of-type .tk'); document.querySelectorAll('.msg.me .tk').forEach(t => t.classList.add('read')); note('gelesen ' + hhmm()); }
    await say('letzte frage.', 'schreib ja, dann darf ich schlafen.');
    r = await choose(['ja, ich bin wach'], { stille: 60 });
    if (!r) return endeB();
    return endeA(false);
  }

  async function endeB() {
    await say('okay.', 'das heft ist kaputt.', 'du hast nicht geantwortet. danke.', 'ich bleibe wach.', 'gute nacht, {name}.');
    S.endedB = true; save(); setStat('off');
    await sleep(2500);
    over([['Ende B: Schweigen', ''], ['Du hast nicht geantwortet.', ''], ['Öffnest du das Spiel später wieder, zählt auch das als Antwort.', 'small']],
      [['Später zurückkommen', () => location.reload()], ['Neu beginnen', reset]]);
  }

  async function endeA(back) {
    if (!back) { const dummy = null; }
    await say('haha', 'oh gott. haha. sorry ich wein grad', 'danke. danke danke danke {name}.', 'du weisst gar nicht, was du grad gemacht hast', 'ich darf schlafen. ich darf wirklich schlafen');
    placeholder('Sprachmemo 0:07', 'Lachen, das ins Schluchzen kippt und zurück. Leise ein Monitor-Piepen, das langsamer wird.');
    await sleep(900); await say('sorry. ich bin so müde, dass es lustig ist');
    await choose(['gern geschehen', 'was passiert mit mir?', '…']);
    await say('es ist komisch. die decke ist ganz weich', 'und gleichzeitig steh ich noch im gang auf station 4', 'wie spät ist es bei dir? hier ist es 03:14.', 'schon ganz lang 03:14', 'frau keller ist da. sie winkt.', 'sie sagt, sie hat mich damals gar nicht gemeint. nur irgendwen.', 'jonas auch. und lea. und timo mit der jacke.', 'die stehen alle am bettende und lächeln so höflich', 'die waren nie böse, {name}.', 'die wollten auch nur schlafen. so wie ich. so wie du dann.', 'du bist ganz hell. wusstest du das? du leuchtest richtig', 'ich hab dich vorher nie so gesehen. so von vorn', 'bist du wach', 'nein ich mein mich. bin ich wach. haha. ich glaub nicht mehr');
    const z = (S.ans || []).filter(a => a.z).slice(-1)[0];
    await say('du hast ' + (z ? Math.max(1, z.z) : 5) + ' sekunden gewartet vor dem ja.', 'ich hab damals keine einzige gewartet.', 'du warst besser als ich.', '{code}. siehst du, du musst gar nicht fragen. ich bins noch. fast.');
    placeholder('Bild', 'Mira im Bett, Augen zu, gelöstes Lächeln, Tränenspuren, zu weisses Licht. Am Fussende im Überbelichteten mehrere Fussspitzen.');
    await sleep(900);
    await say('das heft liegt jetzt bei dir.', 'ich hab dir die zeile ganz unten freigelassen.', 'es tut nicht weh.', 'es braucht einfach jemanden.', 'es fragt ja nie selbst.', 'schlaf gut sag ich nicht.', 'das wär gemein.', 'jetzt du.');
    setStat('off'); await sleep(1500);
    // Der Bruch: Name kippt, Blasen kippen, Tipp-Blase auf deiner Seite
    nm.classList.add('strike'); await sleep(1100); nm.textContent = S.name; nm.classList.remove('strike');
    chat.classList.add('flip'); document.querySelector('.av').textContent = (S.name || '?')[0].toUpperCase();
    await sleep(900); const tb = typingBubble('me'); await sleep(1800);
    // Letzter Bildschirm: einmalig frei einen Namen schreiben (nichts wird gesendet)
    let idle = setTimeout(() => { adv(); bubble('du musst nicht heute.', 'mira'); bubble('das heft wartet.', 'mira'); }, 60000 * FAST);
    const row = el('div', 'row'), lab = el('label', '', 'An:'), inp = el('input'), lock = el('input'), send = el('button', 'send', '➤');
    const col = el('div'); col.style.cssText = 'display:flex;flex-direction:column;gap:8px;width:100%';
    inp.placeholder = 'ein Name'; inp.maxLength = 20; lock.value = 'bist du wach?'; lock.disabled = true; send.disabled = true;
    inp.oninput = () => { send.disabled = !inp.value.trim(); };
    row.append(lab, inp); const row2 = el('div', 'row'); row2.append(lock, send); col.append(row, row2); bar.replaceChildren(col); setTimeout(() => inp.focus(), 50);
    const name = await new Promise(res => { const go = () => { const v = inp.value.replace(/\s+/g, ' ').trim().slice(0, 20); if (v) res(v); }; send.onclick = go; inp.onkeydown = e => { if (e.key === 'Enter') go(); }; });
    clearTimeout(idle); bar.replaceChildren(); tb.remove();
    nm.textContent = name; document.querySelector('.av').textContent = name[0].toUpperCase();
    clk = 3 * 3600 + 41 * 60; const mine = bubble('bist du wach?', 'me'); await sleep(900); mine.tk.classList.add('read'); note('gelesen ' + hhmm());
    await sleep(1200); setStat('typing'); await sleep(1400); setStat('on');
    const re = bubble('ja. was ist los?', 'mira'); re.className = 'msg mira'; // Antwort der fremden Person
    await sleep(2600);
    const url = heftFoto(name);
    over([['Ende. Nichts wurde gesendet.', ''], ['Der Name bleibt nur auf diesem Gerät.', 'small']],
      [['Name vergessen', () => { delete S.name; save(); location.reload(); }], ['Nochmal', reset]], url);
  }

  $('#go').onclick = () => { $('#intro').classList.add('hide'); setStat('on'); main(); };
  if (FAST < 1 && location.hash === '#auto') $('#go').click();
})();
