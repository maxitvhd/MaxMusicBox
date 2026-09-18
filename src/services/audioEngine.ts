import { DspSettings, Track } from '../types';
import { tauriBridge } from './tauriBridge';

class AudioDspEngine {
  private ctx: AudioContext | null = null;
  private isRunning: boolean = false;
  private isPlaying: boolean = false;

  // DSP Nodes
  private eqFilters: BiquadFilterNode[] = [];
  private compressorNode: DynamicsCompressorNode | null = null;
  private limiterNode: DynamicsCompressorNode | null = null;
  private agcGainNode: GainNode | null = null;
  private masterGainNode: GainNode | null = null;
  private splitterNode: ChannelSplitterNode | null = null;
  private analyserLeft: AnalyserNode | null = null;
  private analyserRight: AnalyserNode | null = null;
  private masterOutputGain: GainNode | null = null;

  // Music Generator / Synthesizer Loop
  private synthInterval: number | null = null;
  private currentTrack: Track | null = null;
  private step: number = 0;
  private bpm: number = 120;
  private levelDispatchInterval: number | null = null;

  // RMS smoothing
  private leftRms: number = 0;
  private rightRms: number = 0;

  // Current DSP Settings Cache
  private dspSettings: DspSettings = {
    eq: {
      band0_80Hz: 0,
      band1_350Hz: 0,
      band2_1kHz: 0,
      band3_4kHz: 0,
      band4_12kHz: 0
    },
    agcActive: true,
    agcSensitivity: 60,
    compressor: {
      threshold: -24,
      ratio: 4,
      attack: 0.02,
      release: 0.25
    },
    limiterCeiling: -1,
    masterGain: 0.85
  };

  constructor() {
    // Lazy initialize on first user interaction
  }

  public async init(): Promise<void> {
    if (this.ctx) return;
    const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
    this.ctx = new AudioCtx();

    // 1. Create 5-Band EQ
    // 80Hz (Lowshelf), 350Hz (Peaking), 1kHz (Peaking), 4kHz (Peaking), 12kHz (Highshelf)
    const freqs = [80, 350, 1000, 4000, 12000];
    const types: BiquadFilterType[] = ['lowshelf', 'peaking', 'peaking', 'peaking', 'highshelf'];

    this.eqFilters = freqs.map((freq, idx) => {
      const filter = this.ctx!.createBiquadFilter();
      filter.type = types[idx];
      filter.frequency.value = freq;
      filter.Q.value = 1.0;
      filter.gain.value = 0;
      return filter;
    });

    // Connect filters in series
    for (let i = 0; i < this.eqFilters.length - 1; i++) {
      this.eqFilters[i].connect(this.eqFilters[i + 1]);
    }

    // 2. Dynamics Compressor Node
    this.compressorNode = this.ctx.createDynamicsCompressor();
    this.compressorNode.threshold.value = this.dspSettings.compressor.threshold;
    this.compressorNode.ratio.value = this.dspSettings.compressor.ratio;
    this.compressorNode.attack.value = this.dspSettings.compressor.attack;
    this.compressorNode.release.value = this.dspSettings.compressor.release;

    // 3. AGC Gain Node
    this.agcGainNode = this.ctx.createGain();
    this.agcGainNode.gain.value = 1.0;

    // 4. Limiter (hard compressor for ceiling protection)
    this.limiterNode = this.ctx.createDynamicsCompressor();
    this.limiterNode.threshold.value = this.dspSettings.limiterCeiling;
    this.limiterNode.ratio.value = 20; // brickwall
    this.limiterNode.attack.value = 0.001;
    this.limiterNode.release.value = 0.05;

    // 5. Master Gain Node
    this.masterGainNode = this.ctx.createGain();
    this.masterGainNode.gain.value = this.dspSettings.masterGain;

    // 6. Output routing & Analysers
    this.masterOutputGain = this.ctx.createGain();
    this.masterOutputGain.gain.value = 1.0;

    this.splitterNode = this.ctx.createChannelSplitter(2);
    this.analyserLeft = this.ctx.createAnalyser();
    this.analyserRight = this.ctx.createAnalyser();

    this.analyserLeft.fftSize = 256;
    this.analyserRight.fftSize = 256;

    // Connect chain:
    // EQ[last] -> Compressor -> AGC -> Limiter -> MasterGain -> Splitter & Output
    const lastEq = this.eqFilters[this.eqFilters.length - 1];
    lastEq.connect(this.compressorNode);
    this.compressorNode.connect(this.agcGainNode);
    this.agcGainNode.connect(this.limiterNode);
    this.limiterNode.connect(this.masterGainNode);

    this.masterGainNode.connect(this.masterOutputGain);
    this.masterOutputGain.connect(this.ctx.destination);

    // Feed analysers for stereo VU
    this.masterGainNode.connect(this.splitterNode);
    this.splitterNode.connect(this.analyserLeft, 0);
    this.splitterNode.connect(this.analyserRight, 1);

    this.startLevelMonitoring();
  }

  public getDspSettings(): DspSettings {
    return { ...this.dspSettings };
  }

  // Update EQ Band
  public setEqBand(bandIndex: number, gainDb: number): void {
    if (!this.eqFilters[bandIndex] || !this.ctx) return;
    const clamped = Math.max(-12, Math.min(12, gainDb));
    this.eqFilters[bandIndex].gain.setTargetAtTime(clamped, this.ctx.currentTime, 0.02);

    const keys: (keyof DspSettings['eq'])[] = [
      'band0_80Hz',
      'band1_350Hz',
      'band2_1kHz',
      'band3_4kHz',
      'band4_12kHz'
    ];
    this.dspSettings.eq[keys[bandIndex]] = clamped;
  }

  // Update Compressor
  public setCompressor(threshold: number, ratio: number, attack?: number, release?: number): void {
    if (!this.compressorNode || !this.ctx) return;
    this.compressorNode.threshold.setTargetAtTime(threshold, this.ctx.currentTime, 0.02);
    this.compressorNode.ratio.setTargetAtTime(ratio, this.ctx.currentTime, 0.02);
    if (attack !== undefined) this.compressorNode.attack.setTargetAtTime(attack, this.ctx.currentTime, 0.02);
    if (release !== undefined) this.compressorNode.release.setTargetAtTime(release, this.ctx.currentTime, 0.02);

    this.dspSettings.compressor.threshold = threshold;
    this.dspSettings.compressor.ratio = ratio;
    if (attack !== undefined) this.dspSettings.compressor.attack = attack;
    if (release !== undefined) this.dspSettings.compressor.release = release;
  }

  // Update AGC
  public setAgc(active: boolean, sensitivity?: number): void {
    this.dspSettings.agcActive = active;
    if (sensitivity !== undefined) this.dspSettings.agcSensitivity = sensitivity;

    if (!active && this.agcGainNode && this.ctx) {
      this.agcGainNode.gain.setTargetAtTime(1.0, this.ctx.currentTime, 0.05);
    }
  }

  // Update Limiter Ceiling
  public setLimiterCeiling(ceilingDb: number): void {
    if (!this.limiterNode || !this.ctx) return;
    const val = Math.max(-12, Math.min(0, ceilingDb));
    this.limiterNode.threshold.setTargetAtTime(val, this.ctx.currentTime, 0.02);
    this.dspSettings.limiterCeiling = val;
  }

  // Update Master Gain
  public setMasterGain(gain: number): void {
    if (!this.masterGainNode || !this.ctx) return;
    const clamped = Math.max(0, Math.min(1.5, gain));
    this.masterGainNode.gain.setTargetAtTime(clamped, this.ctx.currentTime, 0.02);
    this.dspSettings.masterGain = clamped;
  }

  // Play Track
  public async playTrack(track: Track): Promise<void> {
    await this.init();
    if (this.ctx && this.ctx.state === 'suspended') {
      await this.ctx.resume();
    }

    this.currentTrack = track;
    this.bpm = track.bpm || 120;
    this.isPlaying = true;
    this.step = 0;

    this.startMusicSynthesizer();
  }

  public pause(): void {
    this.isPlaying = false;
    if (this.synthInterval) {
      clearInterval(this.synthInterval);
      this.synthInterval = null;
    }
  }

  public resume(): void {
    if (!this.currentTrack) return;
    if (this.ctx && this.ctx.state === 'suspended') {
      this.ctx.resume();
    }
    this.isPlaying = true;
    this.startMusicSynthesizer();
  }

  public isTrackPlaying(): boolean {
    return this.isPlaying;
  }

  // Real-Time High Fidelity Musical Synthesizer for Jukebox Simulation
  private startMusicSynthesizer(): void {
    if (this.synthInterval) {
      clearInterval(this.synthInterval);
    }

    const intervalMs = (60 / this.bpm / 4) * 1000; // 16th notes
    this.synthInterval = window.setInterval(() => {
      if (!this.isPlaying || !this.ctx || !this.currentTrack) return;
      this.playStepPattern(this.step, this.currentTrack.genre);
      this.step = (this.step + 1) % 32;
    }, intervalMs);
  }

  private playStepPattern(step: number, genre: string): void {
    if (!this.ctx || !this.eqFilters[0]) return;
    const now = this.ctx.currentTime;
    const inputNode = this.eqFilters[0];

    // Common beat patterns:
    const isBeatQuarter = step % 4 === 0;
    const isBeatSnare = step % 8 === 4;

    // 1. Kick Drum
    if (isBeatQuarter || (genre === 'samba' && (step === 0 || step === 6 || step === 14 || step === 22))) {
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(genre === 'flashback' ? 140 : 120, now);
      osc.frequency.exponentialRampToValueAtTime(32, now + 0.12);

      gain.gain.setValueAtTime(0.75, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.2);

      osc.connect(gain);
      gain.connect(inputNode);
      osc.start(now);
      osc.stop(now + 0.22);
    }

    // 2. Snare / Clack
    if (isBeatSnare || (genre === 'forro' && (step % 2 === 1))) {
      const bufferSize = this.ctx.sampleRate * 0.08;
      const buffer = this.ctx.createBuffer(1, bufferSize, this.ctx.sampleRate);
      const data = buffer.getChannelData(0);
      for (let i = 0; i < bufferSize; i++) {
        data[i] = Math.random() * 2 - 1;
      }
      const noise = this.ctx.createBufferSource();
      noise.buffer = buffer;

      const filter = this.ctx.createBiquadFilter();
      filter.type = 'highpass';
      filter.frequency.value = 1000;

      const gain = this.ctx.createGain();
      gain.gain.setValueAtTime(0.35, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.08);

      noise.connect(filter);
      filter.connect(gain);
      gain.connect(inputNode);
      noise.start(now);
    }

    // 3. Hi-Hat / Pandeiro / Triangle
    if (step % 2 === 0 || genre === 'samba' || genre === 'forro') {
      const bufferSize = this.ctx.sampleRate * 0.03;
      const buffer = this.ctx.createBuffer(1, bufferSize, this.ctx.sampleRate);
      const data = buffer.getChannelData(0);
      for (let i = 0; i < bufferSize; i++) {
        data[i] = (Math.random() * 2 - 1) * 0.3;
      }
      const hat = this.ctx.createBufferSource();
      hat.buffer = buffer;

      const filter = this.ctx.createBiquadFilter();
      filter.type = 'bandpass';
      filter.frequency.value = genre === 'forro' ? 8500 : 7000;

      const gain = this.ctx.createGain();
      const accent = step % 4 === 2 ? 0.25 : 0.12;
      gain.gain.setValueAtTime(accent, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.035);

      hat.connect(filter);
      filter.connect(gain);
      gain.connect(inputNode);
      hat.start(now);
    }

    // 4. Bassline / Guitar / Synth Harmony
    if (step % 2 === 0) {
      const notes = this.getBassNotesForGenre(genre, step);
      if (notes.freq > 0) {
        const osc = this.ctx.createOscillator();
        const gain = this.ctx.createGain();
        osc.type = genre === 'flashback' ? 'sawtooth' : genre === 'rock' ? 'square' : 'triangle';
        osc.frequency.setValueAtTime(notes.freq, now);

        const filter = this.ctx.createBiquadFilter();
        filter.type = 'lowpass';
        filter.frequency.setValueAtTime(genre === 'rock' ? 800 : 450, now);

        gain.gain.setValueAtTime(0.3, now);
        gain.gain.exponentialRampToValueAtTime(0.001, now + 0.18);

        osc.connect(filter);
        filter.connect(gain);
        gain.connect(inputNode);

        osc.start(now);
        osc.stop(now + 0.2);
      }
    }

    // 5. Chords / Melodic Keys (Arpeggio)
    if (step % 4 === 0 || step % 4 === 2) {
      const chordFreqs = this.getChordFreqsForGenre(genre, Math.floor(step / 8));
      chordFreqs.forEach((freq, idx) => {
        const osc = this.ctx!.createOscillator();
        const gain = this.ctx!.createGain();
        osc.type = genre === 'flashback' ? 'sawtooth' : 'sine';
        osc.frequency.setValueAtTime(freq, now + idx * 0.015);

        gain.gain.setValueAtTime(0.12, now + idx * 0.015);
        gain.gain.exponentialRampToValueAtTime(0.001, now + 0.3);

        osc.connect(gain);
        gain.connect(inputNode);
        osc.start(now + idx * 0.015);
        osc.stop(now + 0.35);
      });
    }
  }

  private getBassNotesForGenre(genre: string, step: number): { freq: number } {
    // Musical root progression: Am - F - C - G
    const bar = Math.floor(step / 8);
    const roots: Record<number, number> = {
      0: 110, // A2
      1: 87.31, // F2
      2: 130.81, // C3
      3: 98.0 // G2
    };
    const base = roots[bar] || 110;
    const octave = (step % 4 === 2) ? 1.5 : 1.0;
    return { freq: base * octave };
  }

  private getChordFreqsForGenre(genre: string, bar: number): number[] {
    // Chords: Am, F, C, G
    const chords: number[][] = [
      [220, 261.63, 329.63], // Am
      [174.61, 220, 261.63], // F
      [261.63, 329.63, 392], // C
      [196, 246.94, 293.66] // G
    ];
    return chords[bar % 4] || chords[0];
  }

  // Monitor audio levels at 60 FPS (~16ms) and emit to Tauri bridge
  private startLevelMonitoring(): void {
    if (this.levelDispatchInterval) clearInterval(this.levelDispatchInterval);

    const dataLeft = new Uint8Array(256);
    const dataRight = new Uint8Array(256);

    this.levelDispatchInterval = window.setInterval(() => {
      if (!this.analyserLeft || !this.analyserRight) return;

      this.analyserLeft.getByteTimeDomainData(dataLeft);
      this.analyserRight.getByteTimeDomainData(dataRight);

      // Compute RMS
      let sumL = 0;
      let sumR = 0;
      for (let i = 0; i < dataLeft.length; i++) {
        const valL = (dataLeft[i] - 128) / 128;
        const valR = (dataRight[i] - 128) / 128;
        sumL += valL * valL;
        sumR += valR * valR;
      }

      let rawL = Math.sqrt(sumL / dataLeft.length) * 2.2;
      let rawR = Math.sqrt(sumR / dataRight.length) * 2.2;

      // Ensure active musical needle motion whenever a track is playing:
      if (this.isPlaying) {
        const beatFraction = (this.step % 4);
        const kickPulse = (beatFraction === 0) ? 0.38 : (beatFraction === 2 ? 0.22 : 0.12);
        const swingL = (Math.sin(Date.now() / 90) * 0.08);
        const swingR = (Math.cos(Date.now() / 95) * 0.08);

        // Blend with rhythmic pulse if audio levels are low
        if (rawL < 0.2) rawL = Math.max(rawL, 0.32 + kickPulse + swingL);
        if (rawR < 0.2) rawR = Math.max(rawR, 0.32 + kickPulse + swingR);
      } else {
        rawL = 0;
        rawR = 0;
      }

      // Mechanical attack/decay damping for RMS:
      const attack = 0.4;
      const decay = 0.14;

      this.leftRms = rawL > this.leftRms
        ? this.leftRms + (rawL - this.leftRms) * attack
        : this.leftRms + (rawL - this.leftRms) * decay;

      this.rightRms = rawR > this.rightRms
        ? this.rightRms + (rawR - this.rightRms) * attack
        : this.rightRms + (rawR - this.rightRms) * decay;

      // Handle AGC leveling if active
      if (this.dspSettings.agcActive && this.agcGainNode && this.isPlaying) {
        const avg = (this.leftRms + this.rightRms) / 2;
        const target = 0.35;
        if (avg > 0.05) {
          const ratio = target / avg;
          const currentGain = this.agcGainNode.gain.value;
          const newGain = currentGain + (ratio - currentGain) * 0.02;
          this.agcGainNode.gain.setValueAtTime(Math.max(0.5, Math.min(1.8, newGain)), this.ctx!.currentTime);
        }
      }

      // Emit event through Tauri bridge
      tauriBridge.emit('audio_levels', {
        left: Math.min(1.0, this.leftRms),
        right: Math.min(1.0, this.rightRms)
      });
    }, 16); // 60 FPS
  }

  // Get spectrum data for Spectrum Analyzer (Frequency visualizer)
  public getSpectrumData(): Uint8Array {
    if (!this.analyserLeft) return new Uint8Array(16);
    const freqData = new Uint8Array(16);
    const fullData = new Uint8Array(128);
    this.analyserLeft.getByteFrequencyData(fullData);

    for (let i = 0; i < 16; i++) {
      const start = i * 4;
      let sum = 0;
      for (let j = 0; j < 4; j++) {
        sum += fullData[start + j] || 0;
      }
      freqData[i] = Math.round(sum / 4);
    }
    return freqData;
  }

  // Authentic Retro Cash Register sound effect (Caixa Registradora)
  public playCashRegisterSound(): void {
    // Nativo: o som é reproduzido pelo mixer Rust (mesma saída de áudio do player).
    if (tauriBridge.isNative) {
      tauriBridge.invoke('play_sfx');
      return;
    }
    if (!this.ctx) {
      const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
      this.ctx = new AudioCtx();
    }
    if (this.ctx.state === 'suspended') {
      this.ctx.resume();
    }

    const now = this.ctx.currentTime;
    // Bell "Ka-Ching!"
    const bellOsc = this.ctx.createOscillator();
    const bellGain = this.ctx.createGain();
    bellOsc.type = 'sine';
    bellOsc.frequency.setValueAtTime(1480, now); // high chime F#6
    bellOsc.frequency.setValueAtTime(2093, now + 0.08); // C7 chime

    bellGain.gain.setValueAtTime(0.01, now);
    bellGain.gain.linearRampToValueAtTime(0.6, now + 0.08);
    bellGain.gain.exponentialRampToValueAtTime(0.0001, now + 1.2);

    bellOsc.connect(bellGain);
    bellGain.connect(this.ctx.destination);
    bellOsc.start(now);
    bellOsc.stop(now + 1.25);

    // Coin rattle sound
    for (let i = 0; i < 4; i++) {
      const coinOsc = this.ctx.createOscillator();
      const coinGain = this.ctx.createGain();
      coinOsc.type = 'triangle';
      coinOsc.frequency.setValueAtTime(3200 + i * 400, now + 0.15 + i * 0.04);

      coinGain.gain.setValueAtTime(0.25, now + 0.15 + i * 0.04);
      coinGain.gain.exponentialRampToValueAtTime(0.001, now + 0.35 + i * 0.04);

      coinOsc.connect(coinGain);
      coinGain.connect(this.ctx.destination);
      coinOsc.start(now + 0.15 + i * 0.04);
      coinOsc.stop(now + 0.4 + i * 0.04);
    }
  }
}

export const audioEngine = new AudioDspEngine();
