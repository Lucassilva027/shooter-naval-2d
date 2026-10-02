import { Container, Graphics, Sprite, type Texture } from 'pixi.js';
import { lerp, lerpAngle } from '../core/math';
import type { Ship } from '../entities/ship';

/** Hull sprites point their bow towards +y; the simulation's rotation 0 points to +x. */
const SPRITE_ROTATION_OFFSET = -Math.PI / 2;
const HIT_FLASH_SECONDS = 0.15;
const HIT_FLASH_TINT = 0xff7a7a;
const SPAWN_FADE_SECONDS = 0.6;

const BAR_WIDTH = 56;
const BAR_HEIGHT = 6;
const BAR_GAP = 10;

export interface ShipViewOptions {
  /** Fill colour of the health bar. */
  readonly barColor: number;
  /** Fade in from transparent (enemies appearing mid-match). */
  readonly fadeIn?: boolean;
}

export class ShipView {
  readonly container = new Container();
  private readonly hull: Sprite;
  private readonly healthBar = new Graphics();
  private readonly barOffsetY: number;
  private flashRemaining = 0;
  private fadeElapsed: number;
  private drawnHealth = Number.NaN;

  /** `stages` are hull textures ordered from intact to wrecked. */
  constructor(
    private readonly stages: readonly Texture[],
    private readonly options: ShipViewOptions,
  ) {
    const intact = stages[0];
    if (!intact) throw new Error('ShipView needs at least one hull texture');
    this.hull = new Sprite({ texture: intact, anchor: 0.5 });
    // The container is never rotated, so the bar stays upright above the hull.
    this.barOffsetY = -Math.max(intact.width, intact.height) / 2 - BAR_GAP;
    this.container.addChild(this.hull, this.healthBar);
    this.fadeElapsed = options.fadeIn ? 0 : SPAWN_FADE_SECONDS;
    this.container.alpha = options.fadeIn ? 0 : 1;
  }

  /** Draws the ship between its previous and current simulated state. */
  sync(ship: Ship, alpha: number): void {
    this.container.position.set(lerp(ship.prevX, ship.x, alpha), lerp(ship.prevY, ship.y, alpha));
    this.hull.rotation =
      lerpAngle(ship.prevRotation, ship.rotation, alpha) + SPRITE_ROTATION_OFFSET;
    this.hull.texture = this.textureFor(ship);
    if (ship.health !== this.drawnHealth) this.drawHealthBar(ship);
  }

  flash(): void {
    this.flashRemaining = HIT_FLASH_SECONDS;
  }

  update(dt: number): void {
    this.flashRemaining = Math.max(0, this.flashRemaining - dt);
    this.hull.tint = this.flashRemaining > 0 ? HIT_FLASH_TINT : 0xffffff;
    if (this.fadeElapsed < SPAWN_FADE_SECONDS) {
      this.fadeElapsed = Math.min(SPAWN_FADE_SECONDS, this.fadeElapsed + dt);
      this.container.alpha = this.fadeElapsed / SPAWN_FADE_SECONDS;
    }
  }

  destroy(): void {
    this.container.destroy({ children: true });
  }

  private drawHealthBar(ship: Ship): void {
    this.drawnHealth = ship.health;
    const ratio = Math.max(0, ship.health / ship.maxHealth);
    const x = -BAR_WIDTH / 2;
    const y = this.barOffsetY - BAR_HEIGHT;
    this.healthBar
      .clear()
      .rect(x - 1, y - 1, BAR_WIDTH + 2, BAR_HEIGHT + 2)
      .fill({ color: 0x000000, alpha: 0.55 });
    if (ratio > 0) {
      this.healthBar.rect(x, y, BAR_WIDTH * ratio, BAR_HEIGHT).fill(this.options.barColor);
    }
  }

  /** Intact while healthy, then progressively damaged sprites; the last stage is the wreck. */
  private textureFor(ship: Ship): Texture {
    const last = this.stages.length - 1;
    if (ship.health <= 0) return this.stages[last] as Texture;
    const damaged = 1 - ship.health / ship.maxHealth;
    const stage = Math.min(last - 1, Math.floor(damaged * last));
    return this.stages[stage] as Texture;
  }
}
