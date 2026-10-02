import { Container, Sprite, type Texture } from 'pixi.js';
import { lerp } from '../core/math';
import type { Projectile } from '../entities/projectile';

interface ProjectileSprite {
  readonly sprite: Sprite;
  seenFrame: number;
}

/** Mirrors simulation projectiles into pooled sprites, keyed by projectile id. */
export class ProjectileLayer {
  readonly container = new Container({ label: 'projectiles' });
  private readonly active = new Map<number, ProjectileSprite>();
  private readonly pool: Sprite[] = [];
  private frame = 0;

  constructor(private readonly texture: Texture) {}

  sync(projectiles: readonly Projectile[], alpha: number): void {
    this.frame++;
    for (const projectile of projectiles) {
      let entry = this.active.get(projectile.id);
      if (!entry) {
        entry = { sprite: this.acquire(projectile.radius), seenFrame: 0 };
        this.active.set(projectile.id, entry);
      }
      entry.seenFrame = this.frame;
      entry.sprite.position.set(
        lerp(projectile.prevX, projectile.x, alpha),
        lerp(projectile.prevY, projectile.y, alpha),
      );
    }

    for (const [id, entry] of this.active) {
      if (entry.seenFrame !== this.frame) {
        this.release(entry.sprite);
        this.active.delete(id);
      }
    }
  }

  destroy(): void {
    this.active.clear();
    this.pool.length = 0;
    this.container.destroy({ children: true });
  }

  /** The ball is drawn at its collision size, so what you see is what hits. */
  private acquire(radius: number): Sprite {
    const sprite = this.pool.pop() ?? new Sprite({ texture: this.texture, anchor: 0.5 });
    sprite.setSize(radius * 2);
    sprite.visible = true;
    this.container.addChild(sprite);
    return sprite;
  }

  private release(sprite: Sprite): void {
    sprite.visible = false;
    this.container.removeChild(sprite);
    this.pool.push(sprite);
  }
}
