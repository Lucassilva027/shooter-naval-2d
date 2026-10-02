import { Container, Graphics, TilingSprite, type Application, type Texture } from 'pixi.js';
import type { GameTextures } from '../assets/gameAssets';
import type { GameEvent } from '../core/events';
import type { GameSimulation } from '../core/GameSimulation';
import { EffectsLayer } from './EffectsLayer';
import { createIslandSprite } from './IslandView';
import { ProjectileLayer } from './ProjectileLayer';
import { ShipView } from './ShipView';

export interface GameRendererOptions {
  /** Draws collision circles on top of the scene. */
  readonly showColliders: boolean;
}

const SAND_TINT = 0xe8c98f;

/**
 * Read-only view of the simulation. It never mutates game state; it only mirrors it into
 * the Pixi scene graph and scales the fixed-size world to fit the canvas.
 */
export class GameRenderer {
  /** World-space root; scaled and centred inside the canvas. */
  readonly world = new Container();
  private readonly playerView: ShipView;
  private readonly projectiles: ProjectileLayer;
  private readonly effects = new EffectsLayer();
  private readonly splashRing: Texture;
  private readonly colliders: Graphics | null;

  constructor(
    private readonly app: Application,
    private readonly textures: GameTextures,
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

    this.playerView = new ShipView(textures.ships.player);
    this.projectiles = new ProjectileLayer(textures.cannonBall);
    this.world.addChild(
      islands,
      this.playerView.container,
      this.projectiles.container,
      this.effects.container,
    );

    const ring = new Graphics().circle(0, 0, 16).stroke({ width: 3, color: 0xffffff });
    this.splashRing = app.renderer.generateTexture(ring);
    ring.destroy();

    this.colliders = options.showColliders ? new Graphics({ label: 'colliders' }) : null;
    if (this.colliders) this.world.addChild(this.colliders);

    app.stage.addChild(this.world);
    app.renderer.on('resize', this.layout);
    this.layout(app.screen.width, app.screen.height);
  }

  /** Turns simulation events into visual feedback. */
  handleEvents(events: readonly GameEvent[]): void {
    for (const event of events) {
      if (event.type === 'shot') this.spawnMuzzleFlash(event.x, event.y, event.direction);
      else if (event.surface === 'water') this.spawnSplash(event.x, event.y);
      else if (event.surface === 'island') this.spawnDust(event.x, event.y);
      else this.spawnShipHit(event.x, event.y, event.shipId);
    }
  }

  /** `frameSeconds` is real elapsed time; cosmetic animations only. */
  render(alpha: number, frameSeconds: number): void {
    this.playerView.sync(this.simulation.player, alpha);
    this.playerView.update(frameSeconds);
    this.projectiles.sync(this.simulation.projectiles, alpha);
    this.effects.update(frameSeconds);
    if (this.colliders) this.drawColliders(this.colliders);
  }

  destroy(): void {
    this.app.renderer.off('resize', this.layout);
    this.projectiles.destroy();
    this.effects.destroy();
    this.world.destroy({ children: true });
    this.splashRing.destroy(true);
  }

  private spawnMuzzleFlash(x: number, y: number, direction: number): void {
    const [, medium, small] = this.textures.explosions;
    if (small) {
      this.effects.spawn(small, x, y, {
        duration: 0.18,
        fromScale: 0.55,
        toScale: 0.95,
        rotation: direction,
      });
    }
    if (medium) {
      this.effects.spawn(medium, x, y, {
        duration: 0.5,
        fromScale: 0.25,
        toScale: 0.55,
        fromAlpha: 0.35,
        tint: 0x9a9a9a,
        vx: Math.cos(direction) * 25,
        vy: Math.sin(direction) * 25,
      });
    }
  }

  private spawnSplash(x: number, y: number): void {
    this.effects.spawn(this.splashRing, x, y, {
      duration: 0.45,
      fromScale: 0.2,
      toScale: 1,
      fromAlpha: 0.9,
    });
  }

  private spawnDust(x: number, y: number): void {
    const small = this.textures.explosions[2];
    if (small) {
      this.effects.spawn(small, x, y, {
        duration: 0.3,
        fromScale: 0.3,
        toScale: 0.6,
        tint: SAND_TINT,
      });
    }
  }

  private spawnShipHit(x: number, y: number, shipId: number | undefined): void {
    const medium = this.textures.explosions[1];
    if (medium) this.effects.spawn(medium, x, y, { duration: 0.3, fromScale: 0.35, toScale: 0.7 });

    for (let i = 0; i < 2; i++) {
      const piece = this.textures.debris[Math.floor(Math.random() * this.textures.debris.length)];
      if (!piece) continue;
      const angle = Math.random() * Math.PI * 2;
      this.effects.spawn(piece, x, y, {
        duration: 0.6,
        fromScale: 1,
        toScale: 0.6,
        rotation: angle,
        vx: Math.cos(angle) * 60,
        vy: Math.sin(angle) * 60,
        spin: 6,
      });
    }

    if (shipId === this.simulation.player.id) this.playerView.flash();
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
