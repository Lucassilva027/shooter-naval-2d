import { Container, Graphics, TilingSprite, type Application } from 'pixi.js';
import type { GameTextures } from '../assets/gameAssets';
import type { GameSimulation } from '../core/GameSimulation';
import { createIslandSprite } from './IslandView';
import { ShipView } from './ShipView';

export interface GameRendererOptions {
  /** Draws collision circles on top of the scene. */
  readonly showColliders: boolean;
}

/**
 * Read-only view of the simulation. It never mutates game state; it only mirrors it into
 * the Pixi scene graph and scales the fixed-size world to fit the canvas.
 */
export class GameRenderer {
  /** World-space root; scaled and centred inside the canvas. */
  readonly world = new Container();
  private readonly playerView: ShipView;
  private readonly colliders: Graphics | null;

  constructor(
    private readonly app: Application,
    textures: GameTextures,
    private readonly simulation: GameSimulation,
    options: GameRendererOptions,
  ) {
    const { width, height } = simulation.arena;

    const water = new TilingSprite({ texture: textures.water, width, height });
    const arenaMask = new Graphics().rect(0, 0, width, height).fill(0xffffff);
    this.world.addChild(water, arenaMask);
    this.world.mask = arenaMask;

    const islands = new Container({ label: 'islands' });
    for (const island of simulation.islands) {
      islands.addChild(createIslandSprite(island, textures.islands[island.art]));
    }
    this.world.addChild(islands);

    this.playerView = new ShipView(textures.ships.player);
    this.world.addChild(this.playerView.container);

    this.colliders = options.showColliders ? new Graphics({ label: 'colliders' }) : null;
    if (this.colliders) this.world.addChild(this.colliders);

    app.stage.addChild(this.world);
    app.renderer.on('resize', this.layout);
    this.layout(app.screen.width, app.screen.height);
  }

  render(alpha: number): void {
    this.playerView.sync(this.simulation.player, alpha);
    if (this.colliders) this.drawColliders(this.colliders);
  }

  destroy(): void {
    this.app.renderer.off('resize', this.layout);
    this.world.destroy({ children: true });
  }

  private drawColliders(graphics: Graphics): void {
    const { islands, player } = this.simulation;
    graphics.clear();
    for (const island of islands) {
      for (const collider of island.colliders) {
        graphics.circle(collider.x, collider.y, collider.radius);
      }
    }
    const cos = Math.cos(player.rotation);
    const sin = Math.sin(player.rotation);
    for (const hull of player.hull) {
      graphics.circle(player.x + cos * hull.offset, player.y + sin * hull.offset, hull.radius);
    }
    graphics.stroke({ width: 2, color: 0xff3366 });
  }

  /** Uniformly fits the arena into the canvas, letterboxing the leftover space. */
  private readonly layout = (screenWidth: number, screenHeight: number): void => {
    const { width, height } = this.simulation.arena;
    const scale = Math.min(screenWidth / width, screenHeight / height);
    this.world.scale.set(scale);
    this.world.position.set((screenWidth - width * scale) / 2, (screenHeight - height * scale) / 2);
  };
}
