import { Container, Sprite, type Texture } from 'pixi.js';
import { lerp, lerpAngle } from '../core/math';
import type { Ship } from '../entities/ship';

/** Hull sprites point their bow towards +y; the simulation's rotation 0 points to +x. */
const SPRITE_ROTATION_OFFSET = -Math.PI / 2;

export class ShipView {
  readonly container = new Container();
  private readonly hull: Sprite;

  constructor(stages: readonly Texture[]) {
    const intact = stages[0];
    if (!intact) throw new Error('ShipView needs at least one hull texture');
    this.hull = new Sprite({ texture: intact, anchor: 0.5 });
    this.container.addChild(this.hull);
  }

  /** Draws the ship between its previous and current simulated state. */
  sync(ship: Ship, alpha: number): void {
    this.container.position.set(lerp(ship.prevX, ship.x, alpha), lerp(ship.prevY, ship.y, alpha));
    this.hull.rotation = lerpAngle(ship.prevRotation, ship.rotation, alpha) + SPRITE_ROTATION_OFFSET;
  }

  destroy(): void {
    this.container.destroy({ children: true });
  }
}
