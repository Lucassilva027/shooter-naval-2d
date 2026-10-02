import { useId, useState, type FormEvent } from 'react';
import { NICKNAME_MAX_LENGTH, validateNickname } from '@/storage/profile';
import { Modal } from './Modal';

interface NicknameDialogProps {
  readonly open: boolean;
  readonly initialValue?: string;
  readonly title: string;
  readonly submitLabel: string;
  readonly onSubmit: (nickname: string) => void;
  readonly onCancel: () => void;
}

export function NicknameDialog(props: NicknameDialogProps) {
  const titleId = useId();
  return (
    <Modal
      open={props.open}
      onCancel={props.onCancel}
      labelledBy={titleId}
      testId="nickname-dialog"
    >
      <NicknameForm {...props} titleId={titleId} />
    </Modal>
  );
}

/** Mounted only while the dialog is open, so every opening starts from `initialValue`. */
function NicknameForm({
  initialValue = '',
  title,
  submitLabel,
  onSubmit,
  onCancel,
  titleId,
}: NicknameDialogProps & { readonly titleId: string }) {
  const inputId = useId();
  const errorId = useId();
  const [value, setValue] = useState(initialValue);
  const [error, setError] = useState<string | null>(null);

  const submit = (event: FormEvent) => {
    event.preventDefault();
    const validation = validateNickname(value);
    if (validation.ok) onSubmit(validation.value);
    else setError(validation.error);
  };

  return (
    <form onSubmit={submit} noValidate className="panel__form">
      <h2 id={titleId}>{title}</h2>
      <p className="panel__muted">Your name appears on the ranking.</p>
      <div className="field">
        <label htmlFor={inputId}>Captain&apos;s name</label>
        <input
          id={inputId}
          value={value}
          maxLength={NICKNAME_MAX_LENGTH + 8}
          autoComplete="nickname"
          autoFocus
          aria-invalid={error !== null}
          aria-describedby={errorId}
          onChange={(event) => {
            setValue(event.target.value);
            setError(null);
          }}
        />
        <p id={errorId} className="field__error" role="alert">
          {error}
        </p>
      </div>
      <div className="panel__row">
        <button type="submit" className="btn btn--primary">
          {submitLabel}
        </button>
        <button type="button" className="btn btn--secondary" onClick={onCancel}>
          Cancel
        </button>
      </div>
    </form>
  );
}
