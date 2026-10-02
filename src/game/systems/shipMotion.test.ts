import { describe, expect, it } from 'vitest';
import type { ShipMotionConfig } from '@/config/gameConfig';
import { createShip } from '../entities/ship';
import { stepShipMotion, type MotionControls } from './shipMotion';

const MOTION: ShipMotionConfig = {
  maxSpeed: 200,
  acceleration: 100,
  brakeDeceleration: 100,
  drag: 20,
  turnSpeed: Math.PI,
};
const DT = 1 / 60;
const IDLE: MotionControls = { throttle: false, brake: false, turn: 0 };
const THROTTLE: MotionControls = { throttle: true, brake: false, turn: 0 };

function newShip() {
  return createShip({
    x: 500,
    y: 500,
    rotation: 0,
    maxHealth: 100,
    maxSpeed: 200,
    hull: [{ offset: 0, radius: 20 }],
  });
}

function run(ship: ReturnType<typeof newShip>, controls: MotionControls, seconds: number) {
  for (let i = 0; i < Math.round(seconds / DT); i++) stepShipMotion(ship, controls, MOTION, DT);
}

describe('stepShipMotion', () => {
  it('accelerates gradually up to max speed', () => {
    const ship = newShip();
    run(ship, THROTTLE, 1);
    expect(ship.speed).toBeCloseTo(100);
    run(ship, THROTTLE, 5);
    expect(ship.speed).toBe(200);
  });

  it('brakes gradually with the configured deceleration and never reverses', () => {
    const ship = newShip();
    run(ship, THROTTLE, 2);
    run(ship, { throttle: true, brake: true, turn: 0 }, 1);
    expect(ship.speed).toBeCloseTo(100);
    run(ship, { ...IDLE, brake: true }, 5);
    expect(ship.speed).toBe(0);
  });

  it('coasts to a stop using drag', () => {
    const ship = newShip();
    run(ship, THROTTLE, 1);
    run(ship, IDLE, 1);
    expect(ship.speed).toBeCloseTo(80);
  });

  it('moves along its heading', () => {
    const ship = newShip();
    run(ship, THROTTLE, 1);
    expect(ship.x).toBeGreaterThan(500);
    expect(ship.y).toBeCloseTo(500);
  });

  it('rotates in both directions at turnSpeed', () => {
    const ship = newShip();
    run(ship, { ...IDLE, turn: 1 }, 0.5);
    expect(ship.rotation).toBeCloseTo(Math.PI / 2);
    run(ship, { ...IDLE, turn: -1 }, 1);
    expect(ship.rotation).toBeCloseTo(-Math.PI / 2);
  });
});