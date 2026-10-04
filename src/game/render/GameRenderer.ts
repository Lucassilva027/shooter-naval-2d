import { Container, Graphics, TilingSprite, type Application, type Texture } from 'pixi.js';
import type { EnemyKind } from '@/config/gameConfig';
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
const PLAYER_BAR_COLOR = 0x4cd964;
const ENEMY_BAR_COLOR = 0xff4d4d;
const WRECK_SECONDS = 2.2;
/** Camera shake when the player is hit, in world units and seconds. */
const HIT_SHAKE = { amplitude: 6, seconds: 0.25 };
const SINK_SHAKE = { amplitude: 12, seconds: 0.6 };
/**
 * Read-only view of the simulation. It never mutates game state; it only mirrors it into
 * the Pixi scene graph and scales the fixed-size world to fit the canvas.
 */
export class GameRenderer {
  /** World-space root; scaled and centred inside the canvas. */
  readonly world = new Container();
  private readonly playerView: ShipView;
  private readonly enemyViews = new Map<number, ShipView>();
  private readonly enemyLayer = new Container({ label: 'enemies' });
  private readonly projectiles: ProjectileLayer;
  /** Sinking wrecks, drawn under the ships. */
  private readonly wrecks = new EffectsLayer();
  private readonly effects = new EffectsLayer();
  private readonly splashRing: Texture;
  private readonly colliders: Graphics | null;
  /** Letterboxed world position; shake offsets are applied on top of it. */
  private readonly origin = { x: 0, y: 0 };
  private shake = { amplitude: 0, seconds: 0, remaining: 0 };
  private readonly reducedMotion =
    typeof window.matchMedia === 'function' &&
    window.matchMedia('(prefers-reduced-motion: reduce)').matches;

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

    this.playerView = new ShipView(textures.ships.player, { barColor: PLAYER_BAR_COLOR });
    this.projectiles = new ProjectileLayer(textures.cannonBall);
    this.world.addChild(
      islands,
      this.wrecks.container,
      this.enemyLayer,
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
      switch (event.type) {
        case 'shot':
          this.spawnMuzzleFlash(event.x, event.y, event.direction);
          break;
        case 'impact':
          if (event.surface === 'water') this.spawnSplash(event.x, event.y);
          else if (event.surface === 'island') this.spawnDust(event.x, event.y);
          else this.spawnShipHit(event.x, event.y, event.shipId);
          break;
        case 'enemySpawned':
          this.addEnemyView(event.shipId, event.kind);
          break;
        case 'shipDestroyed':
          this.sinkShip(event);
          break;
        case 'matchEnded':
          break;
      }
    }
  }

  /** `frameSeconds` is real elapsed time; cosmetic animations only. */
  render(alpha: number, frameSeconds: number): void {
    this.playerView.sync(this.simulation.player, alpha);
    this.playerView.update(frameSeconds);
    for (const enemy of this.simulation.enemies) {
      const view = this.enemyViews.get(enemy.id);
      if (!view) continue;
      view.sync(enemy, alpha);
      view.update(frameSeconds);
    }
    this.projectiles.sync(this.simulation.projectiles, alpha);
    this.wrecks.update(frameSeconds);
    this.effects.update(frameSeconds);
    this.updateShake(frameSeconds);
    if (this.colliders) this.drawColliders(this.colliders);
  }

  /** A weaker shake never cuts a stronger one short. */
  private startShake({ amplitude, seconds }: { amplitude: number; seconds: number }): void {
    if (this.reducedMotion || amplitude < this.shakeStrength()) return;
    this.shake = { amplitude, seconds, remaining: seconds };
  }

  private shakeStrength(): number {
    const { amplitude, seconds, remaining } = this.shake;
    return remaining > 0 ? amplitude * (remaining / seconds) : 0;
  }

  /** Frozen while paused (no elapsed time), so the arena stays still. */
  private updateShake(frameSeconds: number): void {
    if (this.shake.remaining <= 0 || frameSeconds === 0) return;
    this.shake.remaining = Math.max(0, this.shake.remaining - frameSeconds);
    const strength = this.shakeStrength();
    const scale = this.world.scale.x;
    this.world.position.set(
      this.origin.x + (Math.random() * 2 - 1) * strength * scale,
      this.origin.y + (Math.random() * 2 - 1) * strength * scale,
    );
  }

  /** Sprites currently in the scene, for performance instrumentation. */
  get entityCounts(): { ships: number; projectiles: number; effects: number } {
    return {
      ships: 1 + this.enemyViews.size,
      projectiles: this.simulation.projectiles.length,
      effects: this.effects.count + this.wrecks.count,
    };
  }

  destroy(): void {
    this.app.renderer.off('resize', this.layout);
    this.enemyViews.clear();
    this.projectiles.destroy();
    this.wrecks.destroy();
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

    this.spawnDebris(x, y, 2, 60);

    if (shipId === this.simulation.player.id) {
      this.playerView.flash();
      this.startShake(HIT_SHAKE);
    } else if (shipId !== undefined) this.enemyViews.get(shipId)?.flash();
  }

  private addEnemyView(id: number, kind: EnemyKind): void {
    const view = new ShipView(this.textures.ships[kind], {
      barColor: ENEMY_BAR_COLOR,
      fadeIn: true,
    });
    const enemy = this.simulation.enemies.find((e) => e.id === id);
    if (enemy) view.sync(enemy, 1);
    this.enemyViews.set(id, view);
    this.enemyLayer.addChild(view.container);
  }

  private sinkShip(event: Extract<GameEvent, { type: 'shipDestroyed' }>): void {
    const view = this.enemyViews.get(event.shipId);
    if (view) {
      this.enemyViews.delete(event.shipId);
      view.destroy();
    } else if (event.shipId === this.simulation.player.id) {
      this.playerView.container.visible = false;
      this.startShake(SINK_SHAKE);
    }

    const skin = event.kind ?? 'player';
    const wreck = this.textures.ships[skin][this.textures.ships[skin].length - 1];
    if (wreck) {
      this.wrecks.spawn(wreck, event.x, event.y, {
        duration: WRECK_SECONDS,
        fromScale: 1,
        toScale: 0.8,
        rotation: event.rotation - Math.PI / 2,
        spin: 0.15,
      });
    }

    const big = this.textures.explosions[0];
    if (big)
      this.effects.spawn(big, event.x, event.y, { duration: 0.6, fromScale: 0.6, toScale: 1.4 });
    const flame = this.textures.flames[0];
    if (flame) {
      this.effects.spawn(flame, event.x, event.y, {
        duration: 1.2,
        fromScale: 1,
        toScale: 0.4,
        vy: -12,
      });
    }
    this.spawnDebris(event.x, event.y, 5, 110);
  }

  private spawnDebris(x: number, y: number, count: number, speed: number): void {
    for (let i = 0; i < count; i++) {
      const piece = this.textures.debris[Math.floor(Math.random() * this.textures.debris.length)];
      if (!piece) continue;
      const angle = Math.random() * Math.PI * 2;
      this.effects.spawn(piece, x, y, {
        duration: 0.6,
        fromScale: 1,
        toScale: 0.6,
        rotation: angle,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed,
        spin: 6,
      });
    }
  }

  private drawColliders(graphics: Graphics): void {
    const { islands, player, enemies } = this.simulation;
    graphics.clear();
    for (const island of islands) {
      for (const collider of island.colliders) {
        graphics.circle(collider.x, collider.y, collider.radius);
      }
    }
    for (const ship of [player, ...enemies]) {
      const cos = Math.cos(ship.rotation);
      const sin = Math.sin(ship.rotation);
      for (const hull of ship.hull) {
        graphics.circle(ship.x + cos * hull.offset, ship.y + sin * hull.offset, hull.radius);
      }
    }
    graphics.stroke({ width: 2, color: 0xff3366 });
  }

  /** Uniformly fits the arena into the canvas, letterboxing the leftover space. */
  private readonly layout = (screenWidth: number, screenHeight: number): void => {
    const { width, height } = this.simulation.arena;
    const scale = Math.min(screenWidth / width, screenHeight / height);
    this.world.scale.set(scale);
    this.origin.x = (screenWidth - width * scale) / 2;
    this.origin.y = (screenHeight - height * scale) / 2;
    this.world.position.set(this.origin.x, this.origin.y);
  };
}
