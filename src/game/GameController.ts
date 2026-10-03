import { Application, type Ticker } from 'pixi.js';
import type { GameConfig } from '@/config/gameConfig';
import { loadGameTextures } from './assets/gameAssets';
import { audio } from './audio/AudioManager';
import { playEventSounds } from './audio/gameSounds';
import type { GameStore } from './bridge/gameStore';
import type { MatchOutcome } from './core/events';
import { FixedStepLoop } from './core/FixedStepLoop';
import { GameSimulation } from './core/GameSimulation';
import { randomSeed } from './core/random';
import { resolveWorldSize } from './core/worldSize';
import { mergeInputs, type InputCommand, type InputSource } from './input/actions';
import { KeyboardInput } from './input/KeyboardInput';
import type { TouchInput } from './input/TouchInput';
import type { MatchResult } from './matchResult';
import { GameRenderer } from './render/GameRenderer';
import { ManualGameClock, type GameTestState } from './testing/gameTestHooks';

/** `?seed=123` reproduces a match exactly (used by tests); otherwise every match differs. */
function matchSeed(params: URLSearchParams): number {
  const seed = Number.parseInt(params.get('seed') ?? '', 10);
  return Number.isFinite(seed) ? seed >>> 0 : randomSeed();
}

export interface GameControllerOptions {
  readonly host: HTMLElement;
  readonly config: GameConfig;
  readonly store: GameStore;
  /** On-screen controls; merged with the keyboard. */
  readonly touch: TouchInput;
  /** Called once, after the outro, when the match is over. Never called if destroyed first. */
  readonly onFinish: (result: MatchResult) => void;
}

/**
 * Owns one match: assets, Pixi application, input, simulation and render loop.
 * `destroy()` may be called at any time, including while `start()` is still awaiting,
 * which is what React Strict Mode does on its simulated unmount.
 */
export class GameController {
  private destroyed = false;
  private app: Application | null = null;
  private renderer: GameRenderer | null = null;
  private simulation: GameSimulation | null = null;
  private readonly loop: FixedStepLoop;
  private readonly keyboard: KeyboardInput;
  private readonly input: InputSource;
  /** Real seconds left in the outro; null while the match is still being played. */
  private outroRemaining: number | null = null;
  private finished = false;
  /** While true, time stands still (e.g. the leave-battle confirmation is open). */
  private suspended = false;
  private paused = false;
  private readonly testClock: ManualGameClock | null;

  constructor(private readonly options: GameControllerOptions) {
    const { simulation } = options.config;
    this.loop = new FixedStepLoop(simulation.fixedStepSeconds, simulation.maxFrameSeconds);
    this.testClock = import.meta.env.MODE === 'e2e' ? new ManualGameClock() : null;
    this.keyboard = new KeyboardInput(window, this.handleCommand);
    this.input = mergeInputs([this.keyboard, options.touch]);
  }

  /** Freezes or resumes the match. Held keys and touches are dropped either way. */
  setSuspended(suspended: boolean): void {
    if (this.destroyed || this.suspended === suspended) return;
    this.suspended = suspended;
    this.loop.reset();
    if (import.meta.env.MODE === 'e2e') this.testClock?.reset();
    this.updateInputEnabled();
  }

  setPaused(paused: boolean, reason: 'manual' | 'focus' = 'manual'): void {
    if (
      this.destroyed ||
      this.suspended ||
      !this.simulation ||
      this.outroRemaining !== null ||
      this.paused === paused
    ) {
      return;
    }
    this.paused = paused;
    this.loop.reset();
    if (import.meta.env.MODE === 'e2e') this.testClock?.reset();
    this.updateInputEnabled();
    this.options.store.publish({
      paused,
      pauseReason: paused ? reason : null,
    });
  }

  private updateInputEnabled(): void {
    const canReceiveKeyboardCommands =
      !this.suspended && this.simulation !== null && this.outroRemaining === null;
    const canPlay = canReceiveKeyboardCommands && !this.paused;
    this.keyboard.setEnabled(canReceiveKeyboardCommands);
    this.options.touch.setEnabled(canPlay);
    this.input.clear();
  }

  async start(): Promise<void> {
    const { host, config, store } = this.options;
    store.reset();

    try {
      const textures = await loadGameTextures((progress) => {
        if (!this.destroyed) store.publish({ loadProgress: Math.round(progress * 100) });
      });
      if (this.destroyed) return;

      const app = new Application();
      await app.init({
        resizeTo: host,
        autoDensity: true,
        resolution: Math.min(window.devicePixelRatio, 2),
        antialias: true,
        background: 0x0b2233,
        preference: 'webgl',
      });
      if (this.destroyed) {
        destroyApplication(app);
        return;
      }

      this.app = app;
      app.canvas.classList.add('game-canvas');
      host.appendChild(app.canvas);

      const arena = resolveWorldSize(
        { width: host.clientWidth, height: host.clientHeight },
        config.world,
      );
      const params = new URLSearchParams(window.location.search);
      this.simulation = new GameSimulation(config, arena, matchSeed(params));
      this.renderer = new GameRenderer(app, textures, this.simulation, {
        showColliders: params.has('colliders'),
      });
      this.installTestHooks();

      this.keyboard.attach();
      this.updateInputEnabled();
      app.ticker.add(this.tick);
      audio.startLoop('oceanLoop', 0.25);
      audio.play('gameStart', 0.7);
      this.publishHud(this.simulation);
      store.publish({ phase: 'running', loadProgress: 100 });
    } catch (error) {
      if (this.destroyed) return;
      console.warn('[PirateBattle] Failed to start match', error);
      store.publish({
        phase: 'error',
        errorMessage: 'The game assets could not be loaded. Check your connection and try again.',
      });
    }
  }

  destroy(): void {
    if (this.destroyed) return;
    this.destroyed = true;

    this.keyboard.detach();
    this.options.touch.setEnabled(false);
    audio.stopAllLoops();
    this.app?.ticker.remove(this.tick);
    this.renderer?.destroy();
    if (this.app) destroyApplication(this.app);

    this.app = null;
    this.renderer = null;
    this.simulation = null;
    if (
      import.meta.env.MODE === 'e2e' &&
      window.__PIRATE_BATTLE_TEST__?.readState === this.readTestState
    ) {
      delete window.__PIRATE_BATTLE_TEST__;
    }
  }

  private readonly tick = (ticker: Ticker): void => {
    const simulation = this.simulation;
    const renderer = this.renderer;
    if (!simulation || !renderer) return;

    if (this.suspended || this.paused) {
      renderer.render(1, 0);
      return;
    }

    if (import.meta.env.MODE === 'e2e' && this.testClock) {
      const frameSeconds = this.testClock.consumeFrame();
      if (frameSeconds === 0) {
        renderer.render(1, 0);
        return;
      }
      let remaining = frameSeconds;
      let alpha = 1;
      const maxFrameSeconds = this.options.config.simulation.maxFrameSeconds;

      while (remaining > 0 && !this.finished && !this.destroyed) {
        const slice = Math.min(remaining, maxFrameSeconds);
        remaining -= slice;

        if (simulation.outcome) {
          this.stepOutro(simulation, simulation.outcome, slice);
        } else {
          alpha = this.loop.advance(slice, (dt) => {
            simulation.step(dt, this.input.read());
          });

          const events = simulation.drainEvents();
          if (events.length > 0) {
            renderer.handleEvents(events);
            playEventSounds(events);
          }

          if (simulation.outcome) {
            alpha = 1;
            this.stepOutro(simulation, simulation.outcome, slice);
          } else {
            this.playWarnings(simulation);
          }
        }
        this.publishHud(simulation);
      }

      renderer.render(alpha, frameSeconds);
      return;
    }

    const frameSeconds = ticker.deltaMS / 1000;
    if (frameSeconds === 0) {
      renderer.render(1, 0);
      return;
    }
    let alpha = this.loop.advance(frameSeconds, (dt) => {
      simulation.step(dt, this.input.read());
    });

    const events = simulation.drainEvents();
    if (events.length > 0) {
      renderer.handleEvents(events);
      playEventSounds(events);
    }

    if (simulation.outcome) {
      // The simulation no longer advances; draw its final state without interpolation.
      alpha = 1;
      this.stepOutro(simulation, simulation.outcome, frameSeconds);
    } else {
      this.playWarnings(simulation);
    }
    this.publishHud(simulation);
    renderer.render(alpha, frameSeconds);
  };

  private publishHud(simulation: GameSimulation): void {
    const { match } = this.options.config;
    const { player } = simulation;
    this.options.store.publish({
      health: Math.ceil(player.health),
      maxHealth: player.maxHealth,
      score: simulation.score,
      timeLeft: displayedSeconds(simulation.remainingSeconds),
      lowTime: simulation.remainingSeconds <= match.lowTimeSeconds,
      lowHealth: player.health > 0 && player.health <= player.maxHealth * match.lowHealthRatio,
      outcome: simulation.outcome,
    });
  }

  /** Ticks during the last seconds and a one-off alarm when health first drops low. */
  private playWarnings(simulation: GameSimulation): void {
    const previous = this.options.store.getSnapshot();
    const timeLeft = displayedSeconds(simulation.remainingSeconds);
    if (timeLeft !== previous.timeLeft && timeLeft <= this.options.config.match.lowTimeSeconds) {
      audio.play('timeWarning', 0.6);
    }
    const { player } = simulation;
    const lowHealth =
      player.health > 0 &&
      player.health <= player.maxHealth * this.options.config.match.lowHealthRatio;
    if (lowHealth && !previous.lowHealth) audio.play('healthLow', 0.8);
  }

  private stepOutro(simulation: GameSimulation, outcome: MatchOutcome, frameSeconds: number): void {
    if (this.outroRemaining === null) {
      this.outroRemaining = this.options.config.match.outroSeconds;
      this.updateInputEnabled();
      this.options.store.publish({ phase: 'ending' });
    }
    this.outroRemaining -= frameSeconds;
    if (this.outroRemaining > 0 || this.finished) return;

    this.finished = true;
    this.options.onFinish({
      outcome,
      score: simulation.score,
      survivedSeconds: simulation.elapsedSeconds,
      seed: simulation.seed,
      config: simulation.config,
      endedAt: new Date().toISOString(),
    });
  }

  private readonly handleCommand = (command: InputCommand): void => {
    switch (command) {
      case 'pause':
        this.setPaused(!this.paused);
        break;
    }
  };

  private installTestHooks(): void {
    if (import.meta.env.MODE !== 'e2e' || !this.testClock) return;
    window.__PIRATE_BATTLE_TEST__ = {
      advanceTime: (milliseconds) => this.testClock?.advance(milliseconds),
      readState: this.readTestState,
    };
  }

  private readonly readTestState = (): GameTestState | null => {
    const simulation = this.simulation;
    if (!simulation) return null;
    const ui = this.options.store.getSnapshot();
    return {
      phase: ui.phase,
      paused: ui.paused,
      pauseReason: ui.pauseReason,
      seed: simulation.seed,
      elapsedSeconds: simulation.elapsedSeconds,
      remainingSeconds: simulation.remainingSeconds,
      score: simulation.score,
      health: simulation.player.health,
      outcome: simulation.outcome,
      player: {
        x: simulation.player.x,
        y: simulation.player.y,
        rotation: simulation.player.rotation,
      },
      enemies: simulation.enemies.map(({ kind, x, y, health }) => ({ kind, x, y, health })),
      projectileCount: simulation.projectiles.length,
    };
  };
}

/** Rounds up so the timer shows the full duration at the start and hits 0 only at the end. */
function displayedSeconds(remaining: number): number {
  return Math.ceil(remaining - 1e-6);
}

function destroyApplication(app: Application): void {
  // Textures stay in the Assets cache so later matches reuse them.
  app.destroy({ removeView: true, releaseGlobalResources: true }, { children: true });
}
