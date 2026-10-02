import { Application, type Ticker } from 'pixi.js';
import type { GameConfig } from '@/config/gameConfig';
import { loadGameTextures } from './assets/gameAssets';
import { audio } from './audio/AudioManager';
import { playEventSounds } from './audio/gameSounds';
import type { GameStore } from './bridge/gameStore';
import { FixedStepLoop } from './core/FixedStepLoop';
import { GameSimulation } from './core/GameSimulation';
import { resolveWorldSize } from './core/worldSize';
import type { InputCommand } from './input/actions';
import { KeyboardInput } from './input/KeyboardInput';
import { GameRenderer } from './render/GameRenderer';

export interface GameControllerOptions {
  readonly host: HTMLElement;
  readonly config: GameConfig;
  readonly store: GameStore;
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

  constructor(private readonly options: GameControllerOptions) {
    const { simulation } = options.config;
    this.loop = new FixedStepLoop(simulation.fixedStepSeconds, simulation.maxFrameSeconds);
    this.keyboard = new KeyboardInput(window, this.handleCommand);
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
      this.simulation = new GameSimulation(config, arena);
      this.renderer = new GameRenderer(app, textures, this.simulation, {
        showColliders: new URLSearchParams(window.location.search).has('colliders'),
      });

      this.keyboard.attach();
      this.keyboard.setEnabled(true);
      app.ticker.add(this.tick);
      audio.startLoop('oceanLoop', 0.25);
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
    audio.stopAllLoops();
    this.app?.ticker.remove(this.tick);
    this.renderer?.destroy();
    if (this.app) destroyApplication(this.app);

    this.app = null;
    this.renderer = null;
    this.simulation = null;
  }

  private readonly tick = (ticker: Ticker): void => {
    const simulation = this.simulation;
    const renderer = this.renderer;
    if (!simulation || !renderer) return;

    const frameSeconds = ticker.deltaMS / 1000;
    const alpha = this.loop.advance(frameSeconds, (dt) => {
      simulation.step(dt, this.keyboard.read());
    });

    const events = simulation.drainEvents();
    if (events.length > 0) {
      renderer.handleEvents(events);
      playEventSounds(events);
    }
    renderer.render(alpha, frameSeconds);
  };

  private readonly handleCommand = (command: InputCommand): void => {
    switch (command) {
      case 'pause':
        // Pause flow is implemented in a later phase.
        break;
    }
  };
}

function destroyApplication(app: Application): void {
  // Textures stay in the Assets cache so later matches reuse them.
  app.destroy({ removeView: true, releaseGlobalResources: true }, { children: true });
}
