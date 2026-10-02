import { useId } from 'react';
import { CONTROL_LEGEND } from '@/game/input/keyboardBindings';
import { Modal } from './Modal';

interface HowToPlayDialogProps {
  readonly open: boolean;
  readonly onClose: () => void;
}

export function HowToPlayDialog({ open, onClose }: HowToPlayDialogProps) {
  const titleId = useId();
  return (
    <Modal open={open} onCancel={onClose} labelledBy={titleId} testId="how-to-play">
      <h2 id={titleId}>How to play</h2>
      <ul className="how-to__rules">
        <li>Sink as many enemy ships as you can before time runs out.</li>
        <li>Each ship you sink with your cannons scores 1 point.</li>
        <li>
          <strong>Chasers</strong> (red) ram you and explode. <strong>Shooters</strong> (black) keep
          their distance and fire.
        </li>
        <li>The match ends when the timer reaches zero or your ship sinks.</li>
      </ul>
      <table className="how-to__controls">
        <caption>Keyboard controls</caption>
        <tbody>
          {CONTROL_LEGEND.map(({ keys, action }) => (
            <tr key={action}>
              <th scope="row">
                <kbd>{keys}</kbd>
              </th>
              <td>{action}</td>
            </tr>
          ))}
        </tbody>
      </table>
      <p className="panel__muted">On touch screens, use the stick and the cannon buttons.</p>
      <button type="button" className="btn btn--primary" onClick={onClose} autoFocus>
        Got it
      </button>
    </Modal>
  );
}
