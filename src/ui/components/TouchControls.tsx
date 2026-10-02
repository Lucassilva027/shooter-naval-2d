import { useRef, type PointerEvent } from 'react';
import type { TouchButtonAction, TouchInput } from '@/game/input/TouchInput';
import './TouchControls.css';

interface TouchControlsProps {
  readonly touch: TouchInput;
}

/**
 * On-screen stick and cannon buttons, shown only on coarse pointers. They mirror the
 * keyboard controls, which remain the accessible input; hence hidden from assistive tech.
 */
export function TouchControls({ touch }: TouchControlsProps) {
  return (
    <div className="touch-controls" aria-hidden="true" data-testid="touch-controls">
      <Stick touch={touch} />
      <div className="touch-controls__cannons">
        <CannonButton touch={touch} action="fireLeft" icon="fire-left" label="Port" />
        <CannonButton touch={touch} action="fireFront" icon="fire-front" label="Fire" big />
        <CannonButton touch={touch} action="fireRight" icon="fire-right" label="Starboard" />
      </div>
    </div>
  );
}

function Stick({ touch }: TouchControlsProps) {
  const knobRef = useRef<HTMLDivElement>(null);

  const move = (event: PointerEvent<HTMLDivElement>) => {
    const rect = event.currentTarget.getBoundingClientRect();
    const radius = rect.width / 2;
    let x = (event.clientX - (rect.left + radius)) / radius;
    let y = (event.clientY - (rect.top + radius)) / radius;
    const length = Math.hypot(x, y);
    if (length > 1) {
      x /= length;
      y /= length;
    }
    touch.setStick(x, y);
    if (knobRef.current) {
      knobRef.current.style.transform = `translate(${x * 50}%, ${y * 50}%)`;
    }
  };

  const release = () => {
    touch.setStick(0, 0);
    if (knobRef.current) knobRef.current.style.transform = '';
  };

  return (
    <div
      className="touch-stick"
      data-testid="touch-stick"
      onPointerDown={(event) => {
        event.currentTarget.setPointerCapture(event.pointerId);
        move(event);
      }}
      onPointerMove={(event) => {
        if (event.currentTarget.hasPointerCapture(event.pointerId)) move(event);
      }}
      onPointerUp={release}
      onPointerCancel={release}
      onLostPointerCapture={release}
    >
      <div ref={knobRef} className="touch-stick__knob">
        <span className="icon icon--forward" />
      </div>
    </div>
  );
}

interface CannonButtonProps extends TouchControlsProps {
  readonly action: TouchButtonAction;
  readonly icon: string;
  readonly label: string;
  readonly big?: boolean;
}

function CannonButton({ touch, action, icon, label, big }: CannonButtonProps) {
  const set = (element: HTMLElement, pressed: boolean) => {
    touch.setButton(action, pressed);
    if (pressed) element.dataset.pressed = '';
    else delete element.dataset.pressed;
  };

  return (
    <div
      className={`btn-round touch-cannon${big ? ' touch-cannon--big' : ''}`}
      data-testid={`touch-${action}`}
      title={label}
      onPointerDown={(event) => {
        event.currentTarget.setPointerCapture(event.pointerId);
        set(event.currentTarget, true);
      }}
      onPointerUp={(event) => set(event.currentTarget, false)}
      onPointerCancel={(event) => set(event.currentTarget, false)}
      onLostPointerCapture={(event) => set(event.currentTarget, false)}
    >
      <span className={`icon icon--${icon}`} />
    </div>
  );
}
