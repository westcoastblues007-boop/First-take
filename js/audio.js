// Karplus-Strong 方式の撥弦シンセ（外部音源ファイル不要）
const GuitarAudio = (() => {
  let ctx = null;
  let master = null;
  const cache = new Map();

  function ensure() {
    if (!ctx) {
      const AC = window.AudioContext || window.webkitAudioContext;
      ctx = new AC();
      const tone = ctx.createBiquadFilter();
      tone.type = 'lowpass';
      tone.frequency.value = 3200; // フルアコ風に高域を丸める
      const comp = ctx.createDynamicsCompressor();
      master = ctx.createGain();
      master.gain.value = 0.55;
      master.connect(tone).connect(comp).connect(ctx.destination);
    }
    if (ctx.state === 'suspended') ctx.resume();
    return ctx;
  }

  function makeBuffer(midi) {
    if (cache.has(midi)) return cache.get(midi);
    const sr = ctx.sampleRate;
    const freq = 440 * Math.pow(2, (midi - 69) / 12);
    const period = Math.max(2, Math.floor(sr / freq - 0.5));
    const len = Math.floor(sr * 2.4);
    const buffer = ctx.createBuffer(1, len, sr);
    const out = buffer.getChannelData(0);
    const ring = new Float32Array(period);
    let prev = 0;
    for (let i = 0; i < period; i++) {
      const n = Math.random() * 2 - 1;
      prev = prev * 0.55 + n * 0.45; // 指弾き風に励振ノイズを柔らかく
      ring[i] = prev;
    }
    const decay = midi > 64 ? 0.9935 : 0.9965;
    for (let i = 0; i < len; i++) {
      const idx = i % period;
      const nxt = (idx + 1) % period;
      const v = ring[idx];
      out[i] = v;
      ring[idx] = decay * 0.5 * (v + ring[nxt]);
    }
    // 末尾フェードでクリックノイズ防止
    const fade = Math.floor(sr * 0.25);
    for (let i = 0; i < fade; i++) out[len - fade + i] *= 1 - i / fade;
    const entry = { buffer, rate: freq / (sr / (period + 0.5)) };
    cache.set(midi, entry);
    return entry;
  }

  function pluck(midi, delay = 0, velocity = 0.9) {
    ensure();
    const { buffer, rate } = makeBuffer(midi);
    const src = ctx.createBufferSource();
    src.buffer = buffer;
    src.playbackRate.value = rate;
    const g = ctx.createGain();
    g.gain.value = velocity;
    src.connect(g).connect(master);
    src.start(ctx.currentTime + delay);
    return src;
  }

  // midis を順に鳴らす。onNote(i, midi) は鳴った瞬間に呼ばれる（表示ハイライト用）
  function sequence(midis, gapSec, onNote, velocity) {
    ensure();
    const sources = [];
    const timers = midis.map((m, i) => {
      sources.push(pluck(m, i * gapSec, velocity));
      return onNote ? setTimeout(() => onNote(i, m), i * gapSec * 1000) : null;
    });
    return () => {
      timers.forEach((t) => t && clearTimeout(t));
      sources.forEach((src) => { try { src.stop(); } catch (e) { /* 既に停止 */ } });
    };
  }

  return { pluck, sequence, ensure };
})();
