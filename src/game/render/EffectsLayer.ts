import { Container, Sprite, type Texture } from 'pixi.js';
import { lerp } from '../core/math';

export interface EffectOptions {
  readonly duration: number;
  readonly fromScale: number;
  readonly toScale: number;
  readonly fromAlpha?: number;
  readonly rotation?: number;
  readonly tint?: number;
  /** Drift in world units per second. */
  readonly vx?: number;
  readonly vy?: number;
  /** Radians per second. */
  readonly spin?: number;
}

interface ActiveEffect {
  readonly sprite: Sprite;
  readonly options: EffectOptions;
  age: number;
}

/**
 * Short-lived cosmetic sprites (muzzle flashes, splashes, explosions). Purely visual:
 * driven by frame time, never read by the simulation. Sprites are pooled.
 */
export class EffectsLayer {
  readonly container = new Container({ label: 'effects' });
  private readonly active: ActiveEffect[] = [];
  private readonly pool: Sprite[] = [];

  spawn(texture: Texture, x: number, y: number, options: EffectOptions): void {
    const sprite = this.pool.pop() ?? new Sprite({ anchor: 0.5 });
    sprite.texture = texture;
    sprite.position.set(x, y);
    sprite.rotation = options.rotation ?? 0;
    sprite.tint = options.tint ?? 0xffffff;
    sprite.visible = true;
    this.container.addChild(sprite);
    this.active.push({ sprite, options, age: 0 });
    this.apply(this.active[this.active.length - 1] as ActiveEffect);
  }

  update(dt: number): void {
    let write = 0;
    for (const effect of this.active) {
      effect.age += dt;
      if (effect.age >= effect.options.duration) {
        this.release(effect.sprite);
        continue;
      }
      effect.sprite.x += (effect.options.vx ?? 0) * dt;
      effect.sprite.y += (effect.options.vy ?? 0) * dt;
      effect.sprite.rotation += (effect.options.spin ?? 0) * dt;
      this.apply(effect);
      this.active[write++] = effect;
    }
    this.active.length = write;
  }

  get count(): number {
    return this.active.length;
  }

  destroy(): void {
    this.active.length = 0;
    this.pool.length = 0;
    this.container.destroy({ children: true });
  }

  private apply(effect: ActiveEffect): void {
    const { options } = effect;
    const t = effect.age / options.duration;
    effect.sprite.scale.set(lerp(options.fromScale, options.toScale, t));
    effect.sprite.alpha = (options.fromAlpha ?? 1) * (1 - t);
  }

  private release(sprite: Sprite): void {
    sprite.visible = false;
    this.container.removeChild(sprite);
    this.pool.push(sprite);
  }
}
