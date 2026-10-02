import { Container, Graphics, TilingSprite, type Application } from 'pixi.js';
import type { GameTextures } from '../assets/gameAssets';
import type { GameSimulation } from '../core/GameSimulation';
import { ShipView } from './ShipView';

/**
 * Read-only view of the simulation. It never mutates game state; it only mirrors it into
 * the Pixi scene graph and scales the fixed-size world to fit the canvas.
 */
export class GameRenderer {
  /** World-space root; scaled and centred inside the canvas. */
  readonly world = new Container();
  private readonly playerView: ShipView;

  constructor(
    private readonly app: Application,
    textures: GameTextures,
    private readonly simulation: GameSimulation,
  ) {
    const { width, height } = simulation.arena;

    const water = new TilingSprite({ texture: textures.water, width, height });
    const arenaMask = new Graphics().rect(0, 0, width, height).fill(0xffffff);
    this.world.addChild(water, arenaMask);
    this.world.mask = arenaMask;

    this.playerView = new ShipView(textures.ships.player);
    this.world.addChild(this.playerView.container);

    app.stage.addChild(this.world);
    app.renderer.on('resize', this.layout);
    this.layout(app.screen.width, app.screen.height);
  }

  render(alpha: number): void {
    this.playerView.sync(this.simulation.player, alpha);
  }

  destroy(): void {
    this.app.renderer.off('resize', this.layout);
    this.world.destroy({ children: true });
  }

  /** Uniformly fits the arena into the canvas, letterboxing the leftover space. */
  private readonly layout = (screenWidth: number, screenHeight: number): void => {
    const { width, height } = this.simulation.arena;
    const scale = Math.min(screenWidth / width, screenHeight / height);
    this.world.scale.set(scale);
    this.world.position.set((screenWidth - width * scale) / 2, (screenHeight - height * scale) / 2);
  };
}
