let ctx = null;
let master = null;
let noiseBuf = null;
let ambience = null;
let muted = false;

function makeNoise() {
  const len = ctx.sampleRate * 2;
  const buf = ctx.createBuffer(1, len, ctx.sampleRate);
  const data = buf.getChannelData(0);
  let last = 0;
  for (let i = 0; i < len; i++) {
    const white = Math.random() * 2 - 1;
    last = (last + 0.02 * white) / 1.02;
    data[i] = last * 3.2;
  }
  return buf;
}

export function initAudio() {
  if (ctx) { ctx.resume?.(); return; }
  const AC = window.AudioContext || window.webkitAudioContext;
  if (!AC) return;
  ctx = new AC();
  master = ctx.createGain();
  master.gain.value = 0.55;
  master.connect(ctx.destination);
  noiseBuf = makeNoise();
  startAmbience();
  ctx.resume?.();
}

function startAmbience() {
  if (!ctx) return;
  const src = ctx.createBufferSource();
  src.buffer = noiseBuf;
  src.loop = true;
  const lp = ctx.createBiquadFilter();
  lp.type = 'lowpass';
  lp.frequency.value = 480;
  const g = ctx.createGain();
  g.gain.value = 0.05;
  src.connect(lp).connect(g).connect(master);
  src.start();
  ambience = { src, lp, g };
}

export function setMuted(m) {
  muted = m;
  if (master) master.gain.value = m ? 0 : 0.55;
}

export function isMuted() { return muted; }

function tone(freq, dur, type = 'sine', vol = 0.12, slideTo = null, delay = 0) {
  if (!ctx || muted) return;
  const t0 = ctx.currentTime + delay;
  const osc = ctx.createOscillator();
  const g = ctx.createGain();
  osc.type = type;
  osc.frequency.setValueAtTime(freq, t0);
  if (slideTo) osc.frequency.exponentialRampToValueAtTime(slideTo, t0 + dur);
  g.gain.setValueAtTime(0.0001, t0);
  g.gain.exponentialRampToValueAtTime(vol, t0 + 0.012);
  g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
  osc.connect(g).connect(master);
  osc.start(t0);
  osc.stop(t0 + dur + 0.05);
}

function noise(dur, vol = 0.15, freq = 800, type = 'lowpass', delay = 0) {
  if (!ctx || muted) return;
  const t0 = ctx.currentTime + delay;
  const src = ctx.createBufferSource();
  src.buffer = noiseBuf;
  const f = ctx.createBiquadFilter();
  f.type = type;
  f.frequency.setValueAtTime(freq, t0);
  f.frequency.exponentialRampToValueAtTime(Math.max(80, freq * 0.5), t0 + dur);
  const g = ctx.createGain();
  g.gain.setValueAtTime(vol, t0);
  g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
  src.connect(f).connect(g).connect(master);
  src.start(t0);
  src.stop(t0 + dur + 0.02);
}

export function sfx(name) {
  if (!ctx) return;
  switch (name) {
    case 'chop':
      noise(0.16, 0.22, 620);
      tone(120, 0.12, 'triangle', 0.1, 80);
      break;
    case 'pick':
      tone(940, 0.08, 'square', 0.05, 520);
      noise(0.1, 0.12, 1800, 'bandpass');
      break;
    case 'hit':
      noise(0.18, 0.22, 1200, 'bandpass');
      tone(180, 0.14, 'triangle', 0.12, 90);
      break;
    case 'hurt':
      tone(260, 0.25, 'sawtooth', 0.1, 90);
      break;
    case 'pickup':
      tone(620, 0.09, 'sine', 0.1, 880);
      tone(880, 0.12, 'sine', 0.09, 1180, 0.08);
      break;
    case 'craft':
      tone(440, 0.12, 'triangle', 0.1, 620);
      tone(660, 0.16, 'triangle', 0.1, 880, 0.12);
      break;
    case 'eat':
      noise(0.12, 0.12, 900);
      tone(300, 0.1, 'sine', 0.06, 420);
      break;
    case 'splash':
      noise(0.4, 0.16, 1400);
      break;
    case 'sail':
      noise(0.7, 0.13, 500);
      break;
    case 'win':
      [523, 659, 784, 1047].forEach((f, i) => tone(f, 0.5, 'triangle', 0.13, null, i * 0.14));
      break;
    case 'death':
      [440, 330, 220, 150].forEach((f, i) => tone(f, 0.4, 'sine', 0.1, null, i * 0.18));
      break;
    case 'click':
      tone(720, 0.05, 'square', 0.045, 880);
      break;
    case 'repair':
      tone(300, 0.1, 'triangle', 0.1, 420);
      noise(0.15, 0.1, 1600, 'bandpass', 0.1);
      break;
    case 'gull':
      tone(1200, 0.2, 'triangle', 0.04, 900);
      break;
    default:
      break;
  }
}
