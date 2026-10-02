import { readStored, writeStored } from '@/storage/localStore';

const SOUND_FILES = {
  cannonFire1: 'cannon_fire_1',
  cannonFire2: 'cannon_fire_2',
  cannonFire3: 'cannon_fire_3',
  broadside: 'cannon_broadside',
  waterHit1: 'cannonball_water_hit_1',
  waterHit2: 'cannonball_water_hit_2',
  woodHit1: 'ship_wood_hit_1',
  woodHit2: 'ship_wood_hit_2',
  explosion1: 'ship_explosion_1',
  explosion2: 'ship_explosion_2',
  shipSinking: 'ship_sinking',
  gameStart: 'game_start',
  gameOver: 'game_over',
  gameComplete: 'game_complete',
  timeWarning: 'time_warning',
  healthLow: 'health_low',
  oceanLoop: 'ocean_ambience_loop',
} as const;

export type SoundId = keyof typeof SOUND_FILES;

/** Same-sound plays closer together than this are merged (e.g. the 3 broadside shots). */
const MIN_REPEAT_SECONDS = 0.05;
const MUTED_KEY = 'muted';
const MASTER_VOLUME = 0.7;

/**
 * Web Audio playback for the provided WAV files. Buffers are decoded once and shared by
 * every match. Audio is optional: load or playback failures are logged and ignored so
 * they can never block or interrupt gameplay.
 */
class AudioManager {
  private context: AudioContext | null = null;
  private master: GainNode | null = null;
  private readonly buffers = new Map<SoundId, AudioBuffer>();
  private loading: Promise<void> | null = null;
  private readonly lastPlayed = new Map<SoundId, number>();
  private readonly loops = new Map<SoundId, AudioBufferSourceNode>();
  private readonly wantedLoops = new Set<SoundId>();
  private muted = readStored(MUTED_KEY, (raw) => (typeof raw === 'boolean' ? raw : null)) ?? false;
  private readonly listeners = new Set<() => void>();

  /** Must be called from a user gesture (e.g. the Play button) to satisfy autoplay rules. */
  unlock(): void {
    try {
      if (!this.context) {
        this.context = new AudioContext();
        this.master = this.context.createGain();
        this.master.gain.value = this.muted ? 0 : MASTER_VOLUME;
        this.master.connect(this.context.destination);
      }
      if (this.context.state === 'suspended') void this.context.resume();
      this.loading ??= this.loadAll();
    } catch (error) {
      console.warn('[PirateBattle] Audio unavailable', error);
    }
  }

  play(id: SoundId, volume = 1): void {
    const context = this.context;
    const buffer = this.buffers.get(id);
    if (!context || !this.master || !buffer || this.muted) return;

    const now = context.currentTime;
    if (now - (this.lastPlayed.get(id) ?? -Infinity) < MIN_REPEAT_SECONDS) return;
    this.lastPlayed.set(id, now);

    const source = context.createBufferSource();
    source.buffer = buffer;
    const gain = context.createGain();
    gain.gain.value = volume;
    source.connect(gain).connect(this.master);
    source.start();
  }

  playOneOf(ids: readonly SoundId[], volume = 1): void {
    const id = ids[Math.floor(Math.random() * ids.length)];
    if (id) this.play(id, volume);
  }

  startLoop(id: SoundId, volume: number): void {
    this.wantedLoops.add(id);
    const context = this.context;
    const buffer = this.buffers.get(id);
    if (!context || !this.master || this.loops.has(id)) return;
    if (!buffer) {
      void this.loading?.then(() => {
        if (this.wantedLoops.has(id) && this.buffers.has(id)) this.startLoop(id, volume);
      });
      return;
    }
    const source = context.createBufferSource();
    source.buffer = buffer;
    source.loop = true;
    const gain = context.createGain();
    gain.gain.value = volume;
    source.connect(gain).connect(this.master);
    source.start();
    this.loops.set(id, source);
  }

  stopLoop(id: SoundId): void {
    this.wantedLoops.delete(id);
    const source = this.loops.get(id);
    if (!source) return;
    source.stop();
    source.disconnect();
    this.loops.delete(id);
  }

  stopAllLoops(): void {
    this.wantedLoops.clear();
    for (const id of [...this.loops.keys()]) this.stopLoop(id);
  }

  isMuted = (): boolean => this.muted;

  setMuted(muted: boolean): void {
    if (muted === this.muted) return;
    this.muted = muted;
    writeStored(MUTED_KEY, muted);
    if (this.master) this.master.gain.value = muted ? 0 : MASTER_VOLUME;
    for (const listener of this.listeners) listener();
  }

  subscribe = (listener: () => void): (() => void) => {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  };

  private async loadAll(): Promise<void> {
    const context = this.context;
    if (!context) return;
    await Promise.all(
      (Object.entries(SOUND_FILES) as [SoundId, string][]).map(async ([id, file]) => {
        try {
          const response = await fetch(`${import.meta.env.BASE_URL}assets/sounds/${file}.wav`);
          if (!response.ok) throw new Error(`HTTP ${response.status}`);
          this.buffers.set(id, await context.decodeAudioData(await response.arrayBuffer()));
        } catch (error) {
          console.warn(`[PirateBattle] Could not load sound "${file}"`, error);
        }
      }),
    );
  }
}

export const audio = new AudioManager();
