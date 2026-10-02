import { Container, Sprite, type Texture } from 'pixi.js';
import { lerp, lerpAngle } from '../core/math';
import type { Ship } from '../entities/ship';

/** Hull sprites point their bow towards +y; the simulation's rotation 0 points to +x. */
const SPRITE_ROTATION_OFFSET = -Math.PI / 2;
const HIT_FLASH_SECONDS = 0.15;
const HIT_FLASH_TINT = 0xff7a7a;

export class ShipView {
  readonly container = new Container();
  private readonly hull: Sprite;
  private flashRemaining = 0;

  /** `stages` are hull textures ordered from intact to wrecked. */
  constructor(private readonly stages: readonly Texture[]) {
    const intact = stages[0];
    if (!intact) throw new Error('ShipView needs at least one hull texture');
    this.hull = new Sprite({ texture: intact, anchor: 0.5 });
    this.container.addChild(this.hull);
  }

  /** Draws the ship between its previous and current simulated state. */
  sync(ship: Ship, alpha: number): void {
    this.container.position.set(lerp(ship.prevX, ship.x, alpha), lerp(ship.prevY, ship.y, alpha));
    this.hull.rotation =
      lerpAngle(ship.prevRotation, ship.rotation, alpha) + SPRITE_ROTATION_OFFSET;
    this.hull.texture = this.textureFor(ship);
  }

  flash(): void {
    this.flashRemaining = HIT_FLASH_SECONDS;
  }

  update(dt: number): void {
    this.flashRemaining = Math.max(0, this.flashRemaining - dt);
    this.hull.tint = this.flashRemaining > 0 ? HIT_FLASH_TINT : 0xffffff;
  }

  destroy(): void {
    this.container.destroy({ children: true });
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
