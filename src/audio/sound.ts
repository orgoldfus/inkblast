import type { GameEvent, MatchSettings } from "../core/types";
import { EFFECT_FILES, MUSIC_FILE, type SampleEffect } from "./assets";

export class Sound {
  private context: AudioContext | null = null;
  private musicGain: GainNode | null = null;
  private effectsGain: GainNode | null = null;
  private voiceGain: GainNode | null = null;
  private voices = new Set<AudioScheduledSourceNode>();
  private timer: number | null = null;
  private beat = 0;
  private theme = 0;
  private hurry = false;
  private settings: MatchSettings | null = null;
  private buffers = new Map<string, AudioBuffer>();
  private loading = new Map<string, Promise<AudioBuffer | null>>();
  private musicSource: AudioBufferSourceNode | null = null;
  private musicSession = 0;
  private active = false;
  private lastEffect = new Map<SampleEffect, number>();
  async unlock(): Promise<void> {
    try {
      if (!this.context) {
        this.context = new AudioContext();
        this.musicGain = this.context.createGain();
        this.musicGain.connect(this.context.destination);
        this.effectsGain = this.context.createGain();
        this.effectsGain.connect(this.context.destination);
        this.voiceGain = this.context.createGain();
        this.voiceGain.connect(this.context.destination);
      }
      if (this.context.state === "suspended") await this.context.resume();
      if (this.settings) this.configure(this.settings);
      if (this.active) void this.startSampleMusic();
    } catch {
      /* Silent play remains available when audio is blocked by the browser. */
    }
  }
  configure(settings: MatchSettings): void {
    const volume = (value: number): number =>
      Number.isFinite(value) ? Math.max(0, Math.min(1, value)) : 0;
    this.settings = {
      ...settings,
      music: volume(settings.music),
      effects: volume(settings.effects),
      voices: volume(settings.voices),
    };
    if (this.musicGain) this.musicGain.gain.value = this.settings.music * 0.6;
    if (this.effectsGain)
      this.effectsGain.gain.value = this.settings.effects * 0.35;
    if (this.voiceGain) this.voiceGain.gain.value = this.settings.voices * 0.2;
    if (this.context && this.settings.effects > 0)
      for (const path of Object.values(EFFECT_FILES)) void this.load(path);
    if (this.active && this.settings.music > 0) void this.startSampleMusic();
  }
  start(theme: number, hurry = false): void {
    this.stop();
    this.theme = theme;
    this.beat = 0;
    this.hurry = hurry;
    this.active = true;
    this.timer = window.setInterval(() => this.musicBeat(), 160);
    void this.startSampleMusic();
  }
  stop(): void {
    this.active = false;
    this.musicSession++;
    if (this.timer !== null) window.clearInterval(this.timer);
    this.timer = null;
    this.musicSource?.stop();
    this.musicSource?.disconnect();
    this.musicSource = null;
  }
  private load(path: string): Promise<AudioBuffer | null> {
    const ctx = this.context;
    if (!ctx) return Promise.resolve(null);
    const cached = this.buffers.get(path);
    if (cached) return Promise.resolve(cached);
    const pending = this.loading.get(path);
    if (pending) return pending;
    const request = (async () => {
      try {
        const response = await fetch(`${import.meta.env.BASE_URL}${path}`);
        if (!response.ok) return null;
        const buffer = await ctx.decodeAudioData(await response.arrayBuffer());
        this.buffers.set(path, buffer);
        return buffer;
      } catch {
        // Keep the synthesized sounds available if a static asset cannot load.
        return null;
      } finally {
        this.loading.delete(path);
      }
    })();
    this.loading.set(path, request);
    return request;
  }
  private async startSampleMusic(): Promise<void> {
    if (!this.active || !this.settings?.music || this.musicSource) return;
    const session = this.musicSession;
    const buffer = await this.load(MUSIC_FILE);
    const ctx = this.context;
    if (
      !buffer ||
      !ctx ||
      !this.musicGain ||
      !this.active ||
      session !== this.musicSession ||
      this.musicSource ||
      !this.settings?.music
    )
      return;
    const source = ctx.createBufferSource();
    source.buffer = buffer;
    source.loop = true;
    source.playbackRate.value = this.hurry ? 1.12 : 1;
    source.connect(this.musicGain);
    source.start();
    this.musicSource = source;
    if (this.timer !== null) window.clearInterval(this.timer);
    this.timer = null;
  }
  private sample(effect: SampleEffect): boolean {
    const ctx = this.context;
    const gain = this.effectsGain;
    const buffer = this.buffers.get(EFFECT_FILES[effect]);
    if (!ctx || !gain || !buffer) return false;
    if (!this.settings?.effects || this.voices.size >= 20) return true;
    const last = this.lastEffect.get(effect) ?? -Infinity;
    // Chain reactions should hit hard without stacking dozens of identical peaks.
    if (ctx.currentTime - last < 0.045) return true;
    this.lastEffect.set(effect, ctx.currentTime);
    const source = ctx.createBufferSource();
    source.buffer = buffer;
    source.connect(gain);
    this.voices.add(source);
    source.onended = () => {
      this.voices.delete(source);
      source.disconnect();
    };
    source.start();
    return true;
  }
  private tone(
    frequency: number,
    duration: number,
    type: OscillatorType,
    gain: GainNode,
    volume: number,
    endFrequency = frequency,
  ): void {
    const ctx = this.context;
    if (!ctx || this.voices.size >= 20) return;
    const oscillator = ctx.createOscillator();
    const envelope = ctx.createGain();
    oscillator.type = type;
    oscillator.frequency.setValueAtTime(frequency, ctx.currentTime);
    oscillator.frequency.exponentialRampToValueAtTime(
      Math.max(20, endFrequency),
      ctx.currentTime + duration,
    );
    envelope.gain.setValueAtTime(0, ctx.currentTime);
    envelope.gain.linearRampToValueAtTime(volume, ctx.currentTime + 0.008);
    envelope.gain.exponentialRampToValueAtTime(
      0.001,
      ctx.currentTime + duration,
    );
    oscillator.connect(envelope);
    envelope.connect(gain);
    oscillator.start();
    oscillator.stop(ctx.currentTime + duration + 0.02);
    this.voices.add(oscillator);
    oscillator.onended = () => {
      this.voices.delete(oscillator);
      oscillator.disconnect();
      envelope.disconnect();
    };
  }
  private noise(duration: number): void {
    const ctx = this.context;
    if (!ctx || !this.effectsGain || this.voices.size >= 20) return;
    const buffer = ctx.createBuffer(
      1,
      Math.ceil(ctx.sampleRate * duration),
      ctx.sampleRate,
    );
    const samples = buffer.getChannelData(0);
    for (let i = 0; i < samples.length; i++)
      samples[i] = (Math.random() * 2 - 1) * (1 - i / samples.length) ** 2;
    const source = ctx.createBufferSource();
    source.buffer = buffer;
    const filter = ctx.createBiquadFilter();
    filter.type = "lowpass";
    filter.frequency.value = 1100;
    source.connect(filter);
    filter.connect(this.effectsGain);
    this.voices.add(source);
    source.start();
    source.onended = () => {
      this.voices.delete(source);
      source.disconnect();
      filter.disconnect();
    };
  }
  private musicBeat(): void {
    if (!this.musicGain || !this.settings?.music) return;
    const scale = [0, 3, 7, 10, 7, 3, 5, 10];
    const root = 110 * 2 ** ((this.theme % 6) / 12);
    const step = this.beat++;
    if (step % 2 === 0)
      this.tone(
        root * (step % 8 < 4 ? 1 : 0.75),
        0.19,
        "triangle",
        this.musicGain,
        0.75,
      );
    if (step % (this.hurry ? 1 : 2) === 0)
      this.tone(
        root * 4 * 2 ** (scale[(step + this.theme) % scale.length] / 12),
        0.11,
        "square",
        this.musicGain,
        0.12,
      );
    if (step % 4 === 0) this.tone(120, 0.09, "sine", this.musicGain, 0.8, 35);
  }
  play(events: GameEvent[]): void {
    const gain = this.effectsGain;
    if (!gain) return;
    for (const event of events) {
      if (
        this.voiceGain &&
        ["pickup", "death", "result"].includes(event.type)
      ) {
        const pitch = event.player === 1 ? 300 : 400;
        this.tone(
          pitch,
          0.22,
          "triangle",
          this.voiceGain,
          0.5,
          event.type === "death" ? pitch / 2 : pitch * 1.5,
        );
      }
      switch (event.type) {
        case "plant":
          this.tone(180, 0.09, "sine", gain, 0.8, 70);
          break;
        case "explode":
          if (this.sample("explode")) break;
          this.noise(0.3);
          this.tone(100, 0.25, "sine", gain, 1, 25);
          break;
        case "pickup":
          if (this.sample("pickup")) break;
          this.tone(700, 0.18, "triangle", gain, 0.7, 1400);
          break;
        case "death":
          this.tone(380, 0.48, "sawtooth", gain, 0.32, 55);
          break;
        case "throw":
        case "kick":
          this.tone(150, 0.16, "triangle", gain, 0.6, 700);
          break;
        case "warp":
          this.tone(240, 0.4, "sine", gain, 0.7, 1600);
          break;
        case "hurry":
          this.hurry = true;
          if (this.musicSource)
            this.musicSource.playbackRate.setTargetAtTime(
              1.12,
              this.context!.currentTime,
              0.3,
            );
          this.tone(880, 0.35, "square", gain, 0.3, 660);
          break;
        case "result":
          if (this.sample("result")) break;
          this.tone(523, 0.65, "triangle", gain, 0.7, 1046);
          break;
      }
    }
  }
}
