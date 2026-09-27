// Procedural Web Audio. Unlocked from the first pointer gesture.
// No external recordings.

let ctx: AudioContext | null = null;
let master: GainNode | null = null;
let winBus: GainNode | null = null;
let gearSources: AudioScheduledSourceNode[] = [];

function context(): AudioContext | null {
  const Ctor = window.AudioContext;
  if (!Ctor) return null;
  if (!ctx) {
    ctx = new Ctor();
    master = ctx.createGain();
    master.gain.value = 0.75;
    master.connect(ctx.destination);
    winBus = ctx.createGain();
    winBus.connect(master);
  }
  return ctx;
}

export async function unlockAudio(): Promise<void> {
  const audio = context();
  if (audio && audio.state === 'suspended') {
    try {
      await audio.resume();
    } catch {
      // Autoplay can still reject. The next gesture tries again.
    }
  }
}

function bus(which: 'win' | 'gear'): GainNode | null {
  if (!context() || !master || !winBus) return null;
  return which === 'win' ? winBus : master;
}

export function duckWins(): void {
  const audio = context();
  if (!audio || !winBus) return;
  const now = audio.currentTime;
  winBus.gain.cancelScheduledValues(now);
  winBus.gain.setValueAtTime(0.0001, now);
  winBus.gain.linearRampToValueAtTime(1, now + 0.06);
}

function noiseBuffer(audio: AudioContext, seconds: number, decay = 0): AudioBuffer {
  const length = Math.floor(audio.sampleRate * seconds);
  const buffer = audio.createBuffer(1, length, audio.sampleRate);
  const data = buffer.getChannelData(0);
  for (let i = 0; i < length; i += 1) {
    const env = decay > 0 ? Math.exp(-i / (length * decay)) : 1;
    data[i] = (Math.random() * 2 - 1) * env;
  }
  return buffer;
}

function stopGears(): void {
  for (const source of gearSources) {
    try {
      source.stop();
    } catch {
      // Already ended.
    }
  }
  gearSources = [];
}

export async function playGears(): Promise<void> {
  await unlockAudio();
  const audio = context();
  const output = bus('gear');
  if (!audio || !output) return;
  stopGears();
  const now = audio.currentTime + 0.02;
  const dur = 2.15;

  const rumble = audio.createOscillator();
  rumble.type = 'sawtooth';
  rumble.frequency.setValueAtTime(56, now);
  rumble.frequency.linearRampToValueAtTime(74, now + 0.35);
  rumble.frequency.linearRampToValueAtTime(36, now + dur);
  const rumbleFilter = audio.createBiquadFilter();
  rumbleFilter.type = 'lowpass';
  rumbleFilter.frequency.value = 220;
  const rumbleGain = audio.createGain();
  rumbleGain.gain.setValueAtTime(0.0001, now);
  rumbleGain.gain.linearRampToValueAtTime(0.16, now + 0.1);
  rumbleGain.gain.exponentialRampToValueAtTime(0.0001, now + dur);
  rumble.connect(rumbleFilter).connect(rumbleGain).connect(output);
  rumble.start(now);
  rumble.stop(now + dur);
  gearSources.push(rumble);

  const click = noiseBuffer(audio, 0.045, 0.18);
  let t = 0;
  while (t < dur - 0.05) {
    const rate = 16 - (t / dur) * 11;
    const at = now + t;
    const src = audio.createBufferSource();
    src.buffer = click;
    src.playbackRate.value = 0.75 + Math.random() * 0.5;
    const bp = audio.createBiquadFilter();
    bp.type = 'bandpass';
    bp.frequency.value = 900 + Math.random() * 700;
    bp.Q.value = 5;
    const gain = audio.createGain();
    gain.gain.value = 0.35 * (1 - t / dur);
    src.connect(bp).connect(gain).connect(output);
    src.start(at);
    src.stop(at + 0.05);
    gearSources.push(src);
    t += 1 / rate;
  }
}

export async function playThunder(): Promise<void> {
  await unlockAudio();
  const audio = context();
  const output = bus('win');
  if (!audio || !output) return;
  const now = audio.currentTime + 0.02;
  const dur = 1.7;
  const buffer = noiseBuffer(audio, dur);
  const src = audio.createBufferSource();
  src.buffer = buffer;
  const low = audio.createBiquadFilter();
  low.type = 'lowpass';
  low.frequency.setValueAtTime(420, now);
  low.frequency.exponentialRampToValueAtTime(70, now + dur);
  const gain = audio.createGain();
  gain.gain.setValueAtTime(0.0001, now);
  gain.gain.linearRampToValueAtTime(0.55, now + 0.04);
  gain.gain.exponentialRampToValueAtTime(0.08, now + 0.45);
  gain.gain.exponentialRampToValueAtTime(0.0001, now + dur);
  src.connect(low).connect(gain).connect(output);
  src.start(now);
  src.stop(now + dur);

  const sub = audio.createOscillator();
  sub.type = 'sine';
  sub.frequency.setValueAtTime(48, now);
  sub.frequency.exponentialRampToValueAtTime(28, now + dur);
  const subGain = audio.createGain();
  subGain.gain.setValueAtTime(0.0001, now);
  subGain.gain.linearRampToValueAtTime(0.35, now + 0.03);
  subGain.gain.exponentialRampToValueAtTime(0.0001, now + dur);
  sub.connect(subGain).connect(output);
  sub.start(now);
  sub.stop(now + dur);
}

export async function playHowl(): Promise<void> {
  await unlockAudio();
  const audio = context();
  const output = bus('win');
  if (!audio || !output) return;
  const now = audio.currentTime + 0.03;
  const dur = 2.4;
  const voice = (base: number, peak: number, end: number, level: number) => {
    const osc = audio.createOscillator();
    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(base, now);
    osc.frequency.exponentialRampToValueAtTime(peak, now + 0.5);
    osc.frequency.exponentialRampToValueAtTime(end, now + dur - 0.1);
    const lfo = audio.createOscillator();
    lfo.frequency.value = 5.2;
    const lfoGain = audio.createGain();
    lfoGain.gain.value = peak * 0.016;
    lfo.connect(lfoGain).connect(osc.frequency);
    const filter = audio.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.setValueAtTime(880, now);
    filter.frequency.linearRampToValueAtTime(1500, now + 0.55);
    filter.frequency.linearRampToValueAtTime(640, now + dur);
    const gain = audio.createGain();
    gain.gain.setValueAtTime(0.0001, now);
    gain.gain.linearRampToValueAtTime(level, now + 0.32);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + dur);
    osc.connect(filter).connect(gain).connect(output);
    osc.start(now);
    osc.stop(now + dur);
    lfo.start(now);
    lfo.stop(now + dur);
  };
  voice(170, 410, 160, 0.2);
  voice(255, 600, 230, 0.08);
  voice(85, 200, 78, 0.12);
}

export async function playLaugh(): Promise<void> {
  await unlockAudio();
  const audio = context();
  const output = bus('win');
  if (!audio || !output) return;
  let t = audio.currentTime + 0.03;
  const syllables = 7;
  for (let i = 0; i < syllables; i += 1) {
    const ratio = i / (syllables - 1);
    const pitch = 180 + Math.sin(ratio * Math.PI) * 48 + Math.random() * 18;
    const len = 0.12 + Math.random() * 0.05;
    const osc = audio.createOscillator();
    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(pitch * 1.1, t);
    osc.frequency.exponentialRampToValueAtTime(pitch * 0.86, t + len);
    const filter = audio.createBiquadFilter();
    filter.type = 'bandpass';
    filter.frequency.value = 780 + Math.random() * 200;
    filter.Q.value = 4;
    const gain = audio.createGain();
    gain.gain.setValueAtTime(0.0001, t);
    gain.gain.linearRampToValueAtTime(0.2, t + 0.02);
    gain.gain.exponentialRampToValueAtTime(0.0001, t + len);
    osc.connect(filter).connect(gain).connect(output);
    osc.start(t);
    osc.stop(t + len + 0.02);
    t += 0.2 - ratio * 0.05;
  }
}

export async function playBuzz(): Promise<void> {
  await unlockAudio();
  const audio = context();
  const output = bus('win');
  if (!audio || !output) return;
  const now = audio.currentTime + 0.02;
  const dur = 1.35;
  const tone = (freq: number, level: number) => {
    const osc = audio.createOscillator();
    osc.type = 'sawtooth';
    osc.frequency.value = freq;
    const filter = audio.createBiquadFilter();
    filter.type = 'bandpass';
    filter.frequency.value = 240;
    filter.Q.value = 4;
    const gain = audio.createGain();
    gain.gain.setValueAtTime(0.0001, now);
    for (let i = 0; i < 28; i += 1) {
      const at = now + (i / 28) * dur;
      gain.gain.linearRampToValueAtTime(i % 2 === 0 ? level : level * 0.15, at);
    }
    gain.gain.exponentialRampToValueAtTime(0.0001, now + dur);
    osc.connect(filter).connect(gain).connect(output);
    osc.start(now);
    osc.stop(now + dur);
  };
  tone(55, 0.18);
  tone(110, 0.08);

  const buffer = noiseBuffer(audio, 0.03, 0.2);
  for (let i = 0; i < 10; i += 1) {
    const src = audio.createBufferSource();
    src.buffer = buffer;
    const bp = audio.createBiquadFilter();
    bp.type = 'highpass';
    bp.frequency.value = 1400;
    const gain = audio.createGain();
    gain.gain.value = 0.2;
    src.connect(bp).connect(gain).connect(output);
    const at = now + Math.random() * (dur - 0.05);
    src.start(at);
    src.stop(at + 0.04);
  }

  const zap = audio.createOscillator();
  zap.type = 'square';
  zap.frequency.setValueAtTime(720, now + 0.05);
  zap.frequency.exponentialRampToValueAtTime(90, now + 0.28);
  const zapGain = audio.createGain();
  zapGain.gain.setValueAtTime(0.0001, now + 0.05);
  zapGain.gain.linearRampToValueAtTime(0.08, now + 0.07);
  zapGain.gain.exponentialRampToValueAtTime(0.0001, now + 0.32);
  zap.connect(zapGain).connect(output);
  zap.start(now + 0.05);
  zap.stop(now + 0.34);
}

export async function playWin(kind: 'buzz' | 'laugh' | 'howl' | 'thunder' | 'none'): Promise<void> {
  if (kind === 'buzz') return playBuzz();
  if (kind === 'laugh') return playLaugh();
  if (kind === 'howl') return playHowl();
  if (kind === 'thunder') return playThunder();
}
