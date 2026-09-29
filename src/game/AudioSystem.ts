/**
 * Procedural WebAudio sound system. Every sound is addressed by name so it can
 * later be replaced by a sample: call `audio.registerSample(name, url)`.
 */
export type SfxName =
  | 'click'
  | 'hover'
  | 'toggle'
  | 'collision'
  | 'bump'
  | 'purchase'
  | 'complete'
  | 'fail'
  | 'warning'
  | 'brake'
  | 'pickup'
  | 'pop'
  | 'honk'
  | 'denied';

class AudioSystem {
  private ctx: AudioContext | null = null;
  private master!: GainNode;
  private sfxBus!: GainNode;
  private musicBus!: GainNode;
  private noise!: AudioBuffer;
  private samples = new Map<string, AudioBuffer>();
  private pendingSamples = new Map<string, string>();

  // Loops
  private engineOsc?: OscillatorNode;
  private engineOsc2?: OscillatorNode;
  private engineGain?: GainNode;
  private engineFilter?: BiquadFilterNode;
  private brushGain?: GainNode;
  private brushFilter?: BiquadFilterNode;
  private foamGain?: GainNode;
  private rainGain?: GainNode;

  private sfxVolume = 0.8;
  private musicVolume = 0.4;
  private musicTimer: number | null = null;
  private musicStep = 0;
  private lastPlayed = new Map<string, number>();

  get ready() {
    return !!this.ctx && this.ctx.state === 'running';
  }

  /** Must be called from a user gesture. Safe to call repeatedly. */
  unlock() {
    if (!this.ctx) {
      const AC = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      if (!AC) return;
      this.ctx = new AC();
      this.master = this.ctx.createGain();
      this.master.connect(this.ctx.destination);
      this.sfxBus = this.ctx.createGain();
      this.sfxBus.connect(this.master);
      this.musicBus = this.ctx.createGain();
      this.musicBus.connect(this.master);
      this.applyVolumes();
      this.noise = this.makeNoise();
      this.setupLoops();
      for (const [name, url] of this.pendingSamples) void this.loadSample(name, url);
      this.startMusic();
    }
    if (this.ctx.state === 'suspended') void this.ctx.resume();
  }

  setVolumes(sfx: number, music: number) {
    this.sfxVolume = sfx;
    this.musicVolume = music;
    this.applyVolumes();
  }

  private applyVolumes() {
    if (!this.ctx) return;
    const t = this.ctx.currentTime;
    this.sfxBus.gain.setTargetAtTime(this.sfxVolume, t, 0.05);
    this.musicBus.gain.setTargetAtTime(this.musicVolume * 0.35, t, 0.05);
  }

  registerSample(name: string, url: string) {
    if (this.ctx) void this.loadSample(name, url);
    else this.pendingSamples.set(name, url);
  }

  private async loadSample(name: string, url: string) {
    try {
      const res = await fetch(url);
      const buf = await this.ctx!.decodeAudioData(await res.arrayBuffer());
      this.samples.set(name, buf);
    } catch {
      /* keep synth fallback */
    }
  }

  private makeNoise() {
    const ctx = this.ctx!;
    const len = ctx.sampleRate * 2;
    const buf = ctx.createBuffer(1, len, ctx.sampleRate);
    const d = buf.getChannelData(0);
    for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
    return buf;
  }

  private noiseSource(loop = false) {
    const src = this.ctx!.createBufferSource();
    src.buffer = this.noise;
    src.loop = loop;
    return src;
  }

  private setupLoops() {
    const ctx = this.ctx!;
    // Engine: two detuned saws through a low-pass.
    this.engineFilter = ctx.createBiquadFilter();
    this.engineFilter.type = 'lowpass';
    this.engineFilter.frequency.value = 400;
    this.engineGain = ctx.createGain();
    this.engineGain.gain.value = 0;
    this.engineOsc = ctx.createOscillator();
    this.engineOsc.type = 'sawtooth';
    this.engineOsc.frequency.value = 45;
    this.engineOsc2 = ctx.createOscillator();
    this.engineOsc2.type = 'square';
    this.engineOsc2.frequency.value = 22.5;
    const g2 = ctx.createGain();
    g2.gain.value = 0.5;
    this.engineOsc.connect(this.engineFilter);
    this.engineOsc2.connect(g2).connect(this.engineFilter);
    this.engineFilter.connect(this.engineGain).connect(this.sfxBus);
    this.engineOsc.start();
    this.engineOsc2.start();

    // Brushes: band-passed noise with a slow wobble.
    const bn = this.noiseSource(true);
    this.brushFilter = ctx.createBiquadFilter();
    this.brushFilter.type = 'bandpass';
    this.brushFilter.frequency.value = 900;
    this.brushFilter.Q.value = 0.8;
    this.brushGain = ctx.createGain();
    this.brushGain.gain.value = 0;
    bn.connect(this.brushFilter).connect(this.brushGain).connect(this.sfxBus);
    bn.start();

    // Foam: high hiss.
    const fn = this.noiseSource(true);
    const ff = ctx.createBiquadFilter();
    ff.type = 'highpass';
    ff.frequency.value = 3500;
    this.foamGain = ctx.createGain();
    this.foamGain.gain.value = 0;
    fn.connect(ff).connect(this.foamGain).connect(this.sfxBus);
    fn.start(0, 0.7);

    // Rain ambience.
    const rn = this.noiseSource(true);
    const rf = ctx.createBiquadFilter();
    rf.type = 'lowpass';
    rf.frequency.value = 2500;
    this.rainGain = ctx.createGain();
    this.rainGain.gain.value = 0;
    rn.connect(rf).connect(this.rainGain).connect(this.sfxBus);
    rn.start(0, 1.3);
  }

  /** Continuous vehicle sound parameters, called every frame while driving. */
  updateVehicle(p: { speed: number; load: number; running: boolean; brushes: boolean; foam: boolean; cleaning: number; rain: boolean }) {
    if (!this.ctx) return;
    const t = this.ctx.currentTime;
    const sp = Math.min(1, Math.abs(p.speed) / 16);
    const rpm = 38 + sp * 70 + p.load * 14;
    this.engineOsc!.frequency.setTargetAtTime(rpm, t, 0.08);
    this.engineOsc2!.frequency.setTargetAtTime(rpm / 2, t, 0.08);
    this.engineFilter!.frequency.setTargetAtTime(260 + sp * 700 + p.load * 400, t, 0.1);
    this.engineGain!.gain.setTargetAtTime(p.running ? 0.11 + p.load * 0.07 + sp * 0.05 : 0, t, 0.15);
    const brushLevel = p.brushes ? 0.07 + Math.min(0.09, p.cleaning * 0.9) : 0;
    this.brushGain!.gain.setTargetAtTime(brushLevel, t, 0.1);
    this.brushFilter!.frequency.setTargetAtTime(p.cleaning > 0.002 ? 1400 : 800, t, 0.1);
    this.foamGain!.gain.setTargetAtTime(p.foam ? 0.08 : 0, t, 0.05);
    this.rainGain!.gain.setTargetAtTime(p.rain ? 0.05 : 0, t, 0.5);
  }

  silenceVehicle() {
    this.updateVehicle({ speed: 0, load: 0, running: false, brushes: false, foam: false, cleaning: 0, rain: false });
  }

  play(name: SfxName, volume = 1) {
    if (!this.ctx || this.ctx.state !== 'running') return;
    const now = this.ctx.currentTime;
    const last = this.lastPlayed.get(name) ?? -1;
    if (now - last < 0.04) return;
    this.lastPlayed.set(name, now);

    const sample = this.samples.get(name);
    if (sample) {
      const src = this.ctx.createBufferSource();
      src.buffer = sample;
      const g = this.ctx.createGain();
      g.gain.value = volume;
      src.connect(g).connect(this.sfxBus);
      src.start();
      return;
    }
    this.synth(name, volume);
  }

  private tone(freq: number, dur: number, type: OscillatorType, vol: number, when = 0, slideTo?: number) {
    const ctx = this.ctx!;
    const t = ctx.currentTime + when;
    const o = ctx.createOscillator();
    o.type = type;
    o.frequency.setValueAtTime(freq, t);
    if (slideTo) o.frequency.exponentialRampToValueAtTime(slideTo, t + dur);
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(vol, t + 0.01);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(g).connect(this.sfxBus);
    o.start(t);
    o.stop(t + dur + 0.05);
  }

  private burst(dur: number, vol: number, filterType: BiquadFilterType, freq: number, when = 0) {
    const ctx = this.ctx!;
    const t = ctx.currentTime + when;
    const src = this.noiseSource();
    const f = ctx.createBiquadFilter();
    f.type = filterType;
    f.frequency.value = freq;
    const g = ctx.createGain();
    g.gain.setValueAtTime(vol, t);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    src.connect(f).connect(g).connect(this.sfxBus);
    src.start(t, Math.random());
    src.stop(t + dur + 0.05);
  }

  private synth(name: SfxName, v: number) {
    switch (name) {
      case 'click':
        this.tone(880, 0.06, 'sine', 0.15 * v);
        break;
      case 'hover':
        this.tone(1200, 0.03, 'sine', 0.04 * v);
        break;
      case 'toggle':
        this.tone(520, 0.05, 'square', 0.06 * v);
        this.tone(780, 0.07, 'square', 0.05 * v, 0.05);
        break;
      case 'collision':
        this.burst(0.35, 0.6 * v, 'lowpass', 500);
        this.tone(90, 0.3, 'sine', 0.5 * v, 0, 40);
        this.burst(0.15, 0.25 * v, 'highpass', 3000, 0.02);
        break;
      case 'bump':
        this.tone(70, 0.15, 'sine', 0.3 * v, 0, 45);
        break;
      case 'purchase':
        [660, 880, 1320].forEach((f, i) => this.tone(f, 0.18, 'triangle', 0.18 * v, i * 0.07));
        this.burst(0.25, 0.1 * v, 'highpass', 6000, 0.15);
        break;
      case 'complete':
        [523, 659, 784, 1046, 1318].forEach((f, i) => this.tone(f, 0.4, 'triangle', 0.18 * v, i * 0.11));
        [1046, 1318, 1568].forEach((f) => this.tone(f, 1.2, 'sine', 0.08 * v, 0.6));
        break;
      case 'fail':
        [392, 330, 262].forEach((f, i) => this.tone(f, 0.45, 'triangle', 0.16 * v, i * 0.2));
        break;
      case 'warning':
        this.tone(880, 0.12, 'square', 0.08 * v);
        this.tone(880, 0.12, 'square', 0.08 * v, 0.2);
        break;
      case 'brake':
        this.burst(0.4, 0.05 * v, 'bandpass', 2600);
        break;
      case 'pickup':
        [784, 988, 1175, 1568].forEach((f, i) => this.tone(f, 0.12, 'sine', 0.14 * v, i * 0.05));
        break;
      case 'pop':
        this.tone(600 + Math.random() * 500, 0.05, 'sine', 0.05 * v, 0, 1400);
        break;
      case 'honk':
        this.tone(415, 0.35, 'sawtooth', 0.05 * v);
        this.tone(440, 0.35, 'sawtooth', 0.05 * v);
        break;
      case 'denied':
        this.tone(200, 0.15, 'square', 0.08 * v);
        break;
    }
  }

  // --- Music: gentle generative lo-fi loop -------------------------------------

  private startMusic() {
    if (this.musicTimer !== null || !this.ctx) return;
    const chords = [
      [57, 60, 64, 67],
      [53, 57, 60, 64],
      [55, 59, 62, 65],
      [52, 55, 59, 62],
    ];
    const beat = 60 / 84;
    let next = this.ctx.currentTime + 0.1;
    const midi = (m: number) => 440 * Math.pow(2, (m - 69) / 12);
    const schedule = () => {
      const ctx = this.ctx!;
      while (next < ctx.currentTime + 0.6) {
        const step = this.musicStep++;
        const chord = chords[Math.floor(step / 8) % chords.length];
        const beatInBar = step % 8;
        if (beatInBar === 0) {
          for (const n of chord) this.pad(midi(n), beat * 8, next);
          this.bass(midi(chord[0] - 12), beat * 1.5, next);
        }
        if (beatInBar === 4) this.bass(midi(chord[0] - 12), beat * 1.5, next);
        if (beatInBar % 2 === 1 && Math.random() < 0.6) {
          const n = chord[Math.floor(Math.random() * chord.length)] + 12;
          this.pluck(midi(n), next);
        }
        next += beat / 2;
      }
    };
    this.musicTimer = window.setInterval(schedule, 150);
  }

  private pad(freq: number, dur: number, t: number) {
    const ctx = this.ctx!;
    const o = ctx.createOscillator();
    o.type = 'triangle';
    o.frequency.value = freq;
    o.detune.value = (Math.random() - 0.5) * 12;
    const f = ctx.createBiquadFilter();
    f.type = 'lowpass';
    f.frequency.value = 900;
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.linearRampToValueAtTime(0.05, t + 1.2);
    g.gain.linearRampToValueAtTime(0.0001, t + dur);
    o.connect(f).connect(g).connect(this.musicBus);
    o.start(t);
    o.stop(t + dur + 0.1);
  }

  private bass(freq: number, dur: number, t: number) {
    const ctx = this.ctx!;
    const o = ctx.createOscillator();
    o.type = 'sine';
    o.frequency.value = freq;
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(0.16, t + 0.02);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(g).connect(this.musicBus);
    o.start(t);
    o.stop(t + dur + 0.1);
  }

  private pluck(freq: number, t: number) {
    const ctx = this.ctx!;
    const o = ctx.createOscillator();
    o.type = 'sine';
    o.frequency.value = freq;
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(0.05, t + 0.01);
    g.gain.exponentialRampToValueAtTime(0.0001, t + 0.6);
    o.connect(g).connect(this.musicBus);
    o.start(t);
    o.stop(t + 0.7);
  }
}

export const audio = new AudioSystem();
