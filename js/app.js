(() => {
  const SVG_NS = 'http://www.w3.org/2000/svg';
  const STORE_KEY = 'jazz-guitar-lab';

  const state = Object.assign(
    { tab: 'chords', root: 0, mode: 'degree', group: 'all', scale: 'dorian', posAll: true, posStart: 7 },
    loadPrefs()
  );
  let stopPlayback = null;

  function loadPrefs() {
    try { return JSON.parse(localStorage.getItem(STORE_KEY)) || {}; } catch (e) { return {}; }
  }
  function savePrefs() {
    try { localStorage.setItem(STORE_KEY, JSON.stringify(state)); } catch (e) { /* 無視 */ }
  }

  // ---------- 共通 ----------
  function el(tag, attrs = {}, text) {
    const node = document.createElement(tag);
    Object.entries(attrs).forEach(([k, v]) => node.setAttribute(k, v));
    if (text !== undefined) node.textContent = text;
    return node;
  }
  function svg(tag, attrs = {}, text) {
    const node = document.createElementNS(SVG_NS, tag);
    Object.entries(attrs).forEach(([k, v]) => node.setAttribute(k, v));
    if (text !== undefined) node.textContent = text;
    return node;
  }

  function degreeClass(label) {
    if (label === 'R' || label === '1') return 'd-root';
    const step = degreeStep(label);
    const num = parseInt(label.replace(/\D/g, ''), 10);
    if (num > 7) return 'd-tension';
    if (step === 3 || step === 7) return 'd-guide';
    if (step === 5) return 'd-chord';
    return 'd-tension';
  }
  function labelFor(label) {
    return state.mode === 'note' ? spellNote(state.root, label) : prettyDegree(label === '1' ? 'R' : label);
  }

  // ---------- キー選択 ----------
  function renderKeys() {
    const box = document.getElementById('keys');
    box.innerHTML = '';
    ROOTS.forEach((name, pc) => {
      const b = el('button', { class: 'key' + (pc === state.root ? ' on' : ''), 'aria-pressed': pc === state.root }, name);
      b.addEventListener('click', () => { state.root = pc; savePrefs(); renderAll(); });
      box.appendChild(b);
    });
  }

  function renderModeToggle() {
    document.querySelectorAll('#label-mode button').forEach((b) => {
      b.classList.toggle('on', b.dataset.mode === state.mode);
      b.onclick = () => { state.mode = b.dataset.mode; savePrefs(); renderAll(); };
    });
  }

  function renderTabs() {
    document.querySelectorAll('.tab').forEach((t) => {
      const on = t.dataset.tab === state.tab;
      t.setAttribute('aria-selected', on);
      t.onclick = () => { state.tab = t.dataset.tab; savePrefs(); renderTabs(); };
    });
    document.getElementById('panel-chords').hidden = state.tab !== 'chords';
    document.getElementById('panel-scales').hidden = state.tab !== 'scales';
  }

  // ---------- コード・ダイアグラム ----------
  function chordDiagram(frets, degrees) {
    const fretted = frets.filter((f) => f !== null && f > 0);
    const maxF = Math.max(0, ...fretted);
    const minF = fretted.length ? Math.min(...fretted) : 1;
    const base = maxF <= 5 ? 1 : minF;
    const rows = Math.max(4, maxF - base + 1);
    const sx = 24, left = 34, top = 36, rowH = 30;
    const width = left + sx * 5 + 26;
    const height = top + rows * rowH + 12;
    const root = svg('svg', { viewBox: `0 0 ${width} ${height}`, class: 'diagram', role: 'img' });

    for (let r = 0; r <= rows; r++) {
      const y = top + r * rowH;
      root.appendChild(svg('line', { x1: left, x2: left + sx * 5, y1: y, y2: y, class: r === 0 && base === 1 ? 'nut' : 'fret' }));
    }
    for (let s = 0; s < 6; s++) {
      const x = left + s * sx;
      root.appendChild(svg('line', { x1: x, x2: x, y1: top, y2: top + rows * rowH, class: 'string' }));
    }
    if (base > 1) root.appendChild(svg('text', { x: left - 10, y: top + rowH / 2 + 4, class: 'base-fret', 'text-anchor': 'end' }, `${base}fr`));

    frets.forEach((f, s) => {
      const x = left + s * sx;
      if (f === null) {
        root.appendChild(svg('text', { x, y: top - 12, class: 'mute', 'text-anchor': 'middle' }, '×'));
        return;
      }
      const cls = degreeClass(degrees[s]);
      if (f === 0) {
        root.appendChild(svg('circle', { cx: x, cy: top - 16, r: 10, class: `open ${cls}` }));
        root.appendChild(svg('text', { x, y: top - 12, class: 'dot-label open-label', 'text-anchor': 'middle' }, labelFor(degrees[s])));
        return;
      }
      const y = top + (f - base + 0.5) * rowH;
      root.appendChild(svg('circle', { cx: x, cy: y, r: 11, class: `note ${cls}` }));
      root.appendChild(svg('text', { x, y: y + 4, class: 'dot-label', 'text-anchor': 'middle' }, labelFor(degrees[s])));
    });
    return root;
  }

  function voicingMidis(frets) {
    return frets.map((f, s) => (f === null ? null : TUNING[s] + f)).filter((m) => m !== null);
  }

  function renderChords() {
    const pills = document.getElementById('group-pills');
    pills.innerHTML = '';
    const groups = [{ id: 'all', title: 'すべて' }, ...VOICING_GROUPS];
    groups.forEach((g) => {
      const b = el('button', { class: 'pill' + (g.id === state.group ? ' on' : '') }, g.title);
      b.addEventListener('click', () => { state.group = g.id; savePrefs(); renderChords(); });
      pills.appendChild(b);
    });

    const desc = document.getElementById('group-desc');
    const grid = document.getElementById('chord-grid');
    grid.innerHTML = '';
    desc.innerHTML = '';
    const shown = state.group === 'all' ? VOICING_GROUPS : VOICING_GROUPS.filter((g) => g.id === state.group);
    if (shown.length === 1) desc.appendChild(el('p', {}, shown[0].desc));

    shown.forEach((g) => {
      if (shown.length > 1) {
        const h = el('div', { class: 'grid-heading' });
        h.appendChild(el('h3', {}, g.title));
        h.appendChild(el('p', { class: 'muted' }, g.desc));
        grid.appendChild(h);
      }
      g.voicings.forEach((v) => grid.appendChild(chordCard(v)));
    });
  }

  function chordCard(v) {
    const frets = transposeFrets(v.frets, state.root);
    const card = el('article', { class: 'chord-card' });
    const head = el('header');
    head.appendChild(el('h4', {}, ROOTS[state.root] + v.suffix));
    head.appendChild(el('span', { class: 'tag' }, v.note));
    card.appendChild(head);

    const diagram = chordDiagram(frets, v.degrees);
    diagram.setAttribute('aria-label', `${ROOTS[state.root]}${v.suffix} ${v.note}`);
    const btnWrap = el('button', { class: 'diagram-btn', title: 'クリックでストラム' });
    btnWrap.appendChild(diagram);
    btnWrap.addEventListener('click', () => strum(frets, card));
    card.appendChild(btnWrap);

    const notes = el('p', { class: 'note-list' });
    v.degrees.forEach((d) => {
      if (!d) return;
      const span = el('span', { class: degreeClass(d) });
      span.appendChild(el('b', {}, prettyDegree(d)));
      span.appendChild(document.createTextNode(spellNote(state.root, d)));
      notes.appendChild(span);
    });
    card.appendChild(notes);

    const actions = el('div', { class: 'card-actions' });
    const s = el('button', { class: 'btn small' }, 'ストラム');
    s.addEventListener('click', () => strum(frets, card));
    const a = el('button', { class: 'btn small' }, 'アルペジオ');
    a.addEventListener('click', () => {
      if (stopPlayback) stopPlayback();
      stopPlayback = GuitarAudio.sequence(voicingMidis(frets), 0.32, null, 0.9);
      flash(card);
    });
    actions.append(s, a);
    card.appendChild(actions);
    return card;
  }

  function strum(frets, card) {
    if (stopPlayback) stopPlayback();
    stopPlayback = GuitarAudio.sequence(voicingMidis(frets), 0.035, null, 0.75);
    flash(card);
  }
  function flash(node) {
    node.classList.remove('flash');
    void node.offsetWidth;
    node.classList.add('flash');
  }

  // ---------- スケール ----------
  const ALL_SCALES = SCALE_GROUPS.flatMap((g) => g.scales);
  const FRETS = 15;

  function currentScale() {
    return ALL_SCALES.find((s) => s.id === state.scale) || ALL_SCALES[0];
  }

  function renderScaleSelect() {
    const sel = document.getElementById('scale-select');
    if (!sel.options.length) {
      SCALE_GROUPS.forEach((g) => {
        const og = el('optgroup', { label: g.title });
        g.scales.forEach((s) => og.appendChild(el('option', { value: s.id }, s.name)));
        sel.appendChild(og);
      });
      sel.addEventListener('change', () => { state.scale = sel.value; savePrefs(); renderScale(); });
    }
    sel.value = currentScale().id;

    const all = document.getElementById('pos-all');
    const start = document.getElementById('pos-start');
    all.checked = state.posAll;
    start.value = state.posStart;
    start.disabled = state.posAll;
    all.onchange = () => { state.posAll = all.checked; savePrefs(); renderScale(); };
    start.oninput = () => { state.posStart = parseInt(start.value, 10); savePrefs(); renderScale(); };
  }

  function inWindow(fret) {
    return state.posAll || (fret >= state.posStart && fret <= state.posStart + 4);
  }

  // 指板上のスケール音（表示用）を列挙
  function scalePositions(scale) {
    const map = new Map(scale.degrees.map((d) => [(state.root + degreeSemis(d)) % 12, d]));
    const out = [];
    for (let s = 0; s < 6; s++) {
      for (let f = 0; f <= FRETS; f++) {
        const midi = TUNING[s] + f;
        const d = map.get(midi % 12);
        if (d) out.push({ s, f, midi, degree: d });
      }
    }
    return out;
  }

  function renderScale() {
    const scale = currentScale();
    document.getElementById('pos-start').disabled = state.posAll;
    document.getElementById('pos-text').textContent = state.posAll
      ? '0〜15フレット'
      : `${state.posStart}〜${state.posStart + 4}フレット`;

    // 情報カード
    const info = document.getElementById('scale-info');
    info.innerHTML = '';
    const title = el('div', { class: 'scale-title' });
    title.appendChild(el('h3', {}, `${ROOTS[state.root]} ${scale.name}`));
    title.appendChild(el('span', { class: 'tag' }, `${ROOTS[state.root]}${scale.chord.split(' / ').join(' / ' + ROOTS[state.root])}`));
    info.appendChild(title);
    const chips = el('div', { class: 'degree-chips' });
    scale.degrees.forEach((d) => {
      const c = el('span', { class: 'chip ' + degreeClass(d) });
      c.appendChild(el('b', {}, prettyDegree(d)));
      c.appendChild(el('span', {}, spellNote(state.root, d)));
      chips.appendChild(c);
    });
    info.appendChild(chips);
    info.appendChild(el('p', {}, scale.use));

    // 指板
    const fw = 54, left = 40, top = 26, sh = 30;
    const width = left + fw * FRETS + 20;
    const height = top + sh * 5 + 40;
    const board = svg('svg', { viewBox: `0 0 ${width} ${height}`, class: 'fretboard', width, height, role: 'img', 'aria-label': `${ROOTS[state.root]} ${scale.name} の指板図` });
    const xOf = (f) => (f === 0 ? left - 18 : left + (f - 0.5) * fw);
    const yOf = (s) => top + (5 - s) * sh; // 1弦を上に

    if (!state.posAll) {
      const x1 = state.posStart === 0 ? left - 34 : left + (state.posStart - 1) * fw;
      const x2 = left + Math.min(FRETS, state.posStart + 4) * fw;
      board.appendChild(svg('rect', { x: x1, y: top - 16, width: x2 - x1, height: sh * 5 + 32, rx: 8, class: 'window' }));
    }
    [3, 5, 7, 9, 15].forEach((f) => board.appendChild(svg('circle', { cx: left + (f - 0.5) * fw, cy: top + sh * 2.5, r: 6, class: 'inlay' })));
    board.appendChild(svg('circle', { cx: left + 11.5 * fw, cy: top + sh * 1.5, r: 6, class: 'inlay' }));
    board.appendChild(svg('circle', { cx: left + 11.5 * fw, cy: top + sh * 3.5, r: 6, class: 'inlay' }));
    for (let f = 0; f <= FRETS; f++) {
      const x = left + f * fw;
      board.appendChild(svg('line', { x1: x, x2: x, y1: top, y2: top + sh * 5, class: f === 0 ? 'nut' : 'fret' }));
      if (f > 0) board.appendChild(svg('text', { x: left + (f - 0.5) * fw, y: height - 6, class: 'fret-num', 'text-anchor': 'middle' }, f));
    }
    for (let s = 0; s < 6; s++) {
      board.appendChild(svg('line', { x1: left, x2: left + fw * FRETS, y1: yOf(s), y2: yOf(s), class: 'string', 'stroke-width': 0.8 + (5 - s) * 0.3 }));
    }

    scalePositions(scale).forEach((p) => {
      const g = svg('g', { class: 'fb-note' + (inWindow(p.f) ? '' : ' dim'), 'data-midi': p.midi, tabindex: inWindow(p.f) ? 0 : -1 });
      g.appendChild(svg('circle', { cx: xOf(p.f), cy: yOf(p.s), r: 12, class: `note ${degreeClass(p.degree)}` }));
      g.appendChild(svg('text', { x: xOf(p.f), y: yOf(p.s) + 4, class: 'dot-label', 'text-anchor': 'middle' }, labelFor(p.degree)));
      const play = () => { GuitarAudio.pluck(p.midi); pulse([g]); };
      g.addEventListener('click', play);
      g.addEventListener('keydown', (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); play(); } });
      board.appendChild(g);
    });

    const host = document.getElementById('fretboard');
    host.innerHTML = '';
    host.appendChild(board);
  }

  function pulse(nodes) {
    nodes.forEach((n) => {
      n.classList.remove('playing');
      void n.getBoundingClientRect();
      n.classList.add('playing');
    });
  }

  function playScale() {
    if (stopPlayback) stopPlayback();
    const scale = currentScale();
    let midis;
    if (state.posAll) {
      const rootMidi = 40 + ((state.root - 4 + 12) % 12);
      const pcs = new Set(scale.degrees.map((d) => (state.root + degreeSemis(d)) % 12));
      midis = [];
      for (let m = rootMidi; m <= rootMidi + 24; m++) if (pcs.has(m % 12)) midis.push(m);
    } else {
      midis = [...new Set(scalePositions(scale).filter((p) => inWindow(p.f)).map((p) => p.midi))].sort((a, b) => a - b);
    }
    const seq = midis.concat(midis.slice(0, -1).reverse());
    const board = document.getElementById('fretboard');
    stopPlayback = GuitarAudio.sequence(seq, 0.26, (i, m) => {
      const nodes = [...board.querySelectorAll(`.fb-note[data-midi="${m}"]`)].filter((n) => !n.classList.contains('dim'));
      pulse(nodes);
    }, 0.85);
  }

  document.getElementById('scale-play').addEventListener('click', playScale);
  document.getElementById('scale-stop').addEventListener('click', () => { if (stopPlayback) stopPlayback(); });

  function renderAll() {
    renderKeys();
    renderModeToggle();
    renderTabs();
    renderChords();
    renderScaleSelect();
    renderScale();
  }

  renderAll();
})();
