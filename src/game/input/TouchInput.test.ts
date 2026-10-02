import { describe, expect, it } from 'vitest';
import { EMPTY_INPUT } from './actions';
import { TouchInput } from './TouchInput';

function enabled(): TouchInput {
  const touch = new TouchInput();
  touch.setEnabled(true);
  return touch;
}

describe('TouchInput', () => {
  it('maps the stick to sail, brake and turn with a dead zone', () => {
    const touch = enabled();
    touch.setStick(0.2, -0.2);
    expect(touch.read()).toEqual(EMPTY_INPUT);

    touch.setStick(-0.8, -0.6);
    expect(touch.read()).toMatchObject({ forward: true, turnLeft: true, brake: false });

    touch.setStick(0.9, 0.5);
    expect(touch.read()).toMatchObject({ brake: true, turnRight: true, forward: false });
  });

  it('holds cannon buttons until released', () => {
    const touch = enabled();
    touch.setButton('fireLeft', true);
    touch.setButton('fireFront', true);
    touch.setButton('fireFront', false);
    expect(touch.read()).toMatchObject({ fireLeft: true, fireFront: false, fireRight: false });
  });

  it('reads nothing while disabled and forgets everything when disabled', () => {
    const touch = enabled();
    touch.setStick(0, -1);
    touch.setButton('fireRight', true);
    touch.setEnabled(false);
    expect(touch.read()).toEqual(EMPTY_INPUT);
    touch.setEnabled(true);
    expect(touch.read()).toEqual(EMPTY_INPUT);
  });
});
