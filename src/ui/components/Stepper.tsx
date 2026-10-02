import { useId, type KeyboardEvent } from 'react';
import type { OptionLimit } from '@/config/gameConfig';

interface StepperProps {
  readonly label: string;
  readonly value: number;
  readonly limit: OptionLimit;
  /** Short unit shown next to the value, e.g. "s". */
  readonly unit: string;
  /** Unit read by screen readers, e.g. "seconds". */
  readonly spokenUnit: string;
  readonly onChange: (value: number) => void;
  readonly testId?: string;
}

const BIG_STEPS = 5;

/**
 * ARIA spinbutton: the value is the single tab stop (arrows, Page Up/Down, Home/End);
 * the − / + buttons are for pointer users and stay out of the tab order.
 */
export function Stepper({ label, value, limit, unit, spokenUnit, onChange, testId }: StepperProps) {
  const labelId = useId();
  const set = (next: number) => {
    const clamped = Math.min(limit.max, Math.max(limit.min, next));
    if (clamped !== value) onChange(clamped);
  };

  const handleKeyDown = (event: KeyboardEvent) => {
    const actions: Record<string, () => void> = {
      ArrowUp: () => set(value + limit.step),
      ArrowRight: () => set(value + limit.step),
      ArrowDown: () => set(value - limit.step),
      ArrowLeft: () => set(value - limit.step),
      PageUp: () => set(value + limit.step * BIG_STEPS),
      PageDown: () => set(value - limit.step * BIG_STEPS),
      Home: () => set(limit.min),
      End: () => set(limit.max),
    };
    const action = actions[event.key];
    if (!action) return;
    event.preventDefault();
    action();
  };

  return (
    <div className="stepper">
      <span id={labelId} className="stepper__label">
        {label}
      </span>
      <div className="stepper__controls">
        <button
          type="button"
          className="btn-round stepper__button"
          tabIndex={-1}
          aria-label={`Decrease ${label}`}
          disabled={value <= limit.min}
          onClick={() => set(value - limit.step)}
        >
          <span className="icon icon--minus" />
        </button>
        <div
          className="stepper__value"
          role="spinbutton"
          tabIndex={0}
          aria-labelledby={labelId}
          aria-valuenow={value}
          aria-valuemin={limit.min}
          aria-valuemax={limit.max}
          aria-valuetext={`${value} ${spokenUnit}`}
          data-testid={testId}
          onKeyDown={handleKeyDown}
        >
          {value} {unit}
        </div>
        <button
          type="button"
          className="btn-round stepper__button"
          tabIndex={-1}
          aria-label={`Increase ${label}`}
          disabled={value >= limit.max}
          onClick={() => set(value + limit.step)}
        >
          <span className="icon icon--plus" />
        </button>
      </div>
    </div>
  );
}
