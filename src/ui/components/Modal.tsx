import { useEffect, useRef, type ReactNode } from 'react';

interface ModalProps {
  readonly open: boolean;
  /** Esc or a "cancel" action; the parent decides whether to close. */
  readonly onCancel: () => void;
  readonly labelledBy: string;
  readonly describedBy?: string;
  readonly children: ReactNode;
  readonly testId?: string;
}

/**
 * Native modal `<dialog>`: focus trapping, Esc handling, inert background and focus
 * restoration come from the browser.
 */
export function Modal({ open, onCancel, labelledBy, describedBy, children, testId }: ModalProps) {
  const ref = useRef<HTMLDialogElement>(null);

  useEffect(() => {
    const dialog = ref.current;
    if (!dialog) return;
    if (open && !dialog.open) dialog.showModal();
    if (!open && dialog.open) dialog.close();
  }, [open]);

  return (
    <dialog
      ref={ref}
      className="panel"
      aria-labelledby={labelledBy}
      aria-describedby={describedBy}
      data-testid={testId}
      onCancel={(event) => {
        event.preventDefault();
        onCancel();
      }}
    >
      {open && children}
    </dialog>
  );
}
