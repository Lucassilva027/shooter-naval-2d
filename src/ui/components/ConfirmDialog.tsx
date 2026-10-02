import { useId } from 'react';
import { Modal } from './Modal';

interface ConfirmDialogProps {
  readonly open: boolean;
  readonly title: string;
  readonly message: string;
  readonly confirmLabel: string;
  readonly cancelLabel: string;
  readonly onConfirm: () => void;
  readonly onCancel: () => void;
}

/** The safe choice (cancel) gets initial focus, so Enter never confirms by accident. */
export function ConfirmDialog(props: ConfirmDialogProps) {
  const titleId = useId();
  const messageId = useId();
  return (
    <Modal
      open={props.open}
      onCancel={props.onCancel}
      labelledBy={titleId}
      describedBy={messageId}
      testId="confirm-dialog"
    >
      <h2 id={titleId}>{props.title}</h2>
      <p id={messageId}>{props.message}</p>
      <div className="panel__row">
        <button type="button" className="btn btn--primary" onClick={props.onCancel} autoFocus>
          {props.cancelLabel}
        </button>
        <button type="button" className="btn btn--secondary" onClick={props.onConfirm}>
          {props.confirmLabel}
        </button>
      </div>
    </Modal>
  );
}
