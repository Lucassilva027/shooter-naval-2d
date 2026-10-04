import { useEffect, useRef, useState } from 'react';
import { DEFAULT_OPTIONS, OPTION_LIMITS, type GameOptions } from '@/config/gameConfig';
import type { Profile } from '@/storage/profile';
import { MuteButton } from '@/ui/components/MuteButton';
import { NicknameDialog } from '@/ui/components/NicknameDialog';
import { Scene } from '@/ui/components/Scene';
import { Stepper } from '@/ui/components/Stepper';

interface OptionsScreenProps {
  readonly options: GameOptions;
  /** Saves immediately; there is no separate Save step. */
  readonly onOptionsChange: (options: GameOptions) => void;
  readonly onResetOptions: () => void;
  readonly profile: Profile | null;
  readonly onNickname: (nickname: string) => void;
  readonly onBack: () => void;
}

export function OptionsScreen(props: OptionsScreenProps) {
  const { options, onOptionsChange, profile } = props;
  const [editingName, setEditingName] = useState(false);
  const [resetNotice, setResetNotice] = useState('');
  const titleRef = useRef<HTMLHeadingElement>(null);
  useEffect(() => titleRef.current?.focus(), []);
  const isDefault =
    options.matchDurationSeconds === DEFAULT_OPTIONS.matchDurationSeconds &&
    options.enemySpawnSeconds === DEFAULT_OPTIONS.enemySpawnSeconds;

  const change = (patch: Partial<GameOptions>) => {
    setResetNotice('');
    onOptionsChange({ ...options, ...patch });
  };

  return (
    <Scene label="Options">
      <section className="panel" aria-labelledby="options-title">
        <h1 id="options-title" ref={titleRef} className="screen-title" tabIndex={-1}>
          Options
        </h1>

        <Stepper
          label="Game session time"
          value={options.matchDurationSeconds}
          limit={OPTION_LIMITS.matchDurationSeconds}
          unit="s"
          spokenUnit="seconds"
          testId="option-duration"
          onChange={(matchDurationSeconds) => change({ matchDurationSeconds })}
        />
        <Stepper
          label="Enemy spawn time"
          value={options.enemySpawnSeconds}
          limit={OPTION_LIMITS.enemySpawnSeconds}
          unit="s"
          spokenUnit="seconds"
          testId="option-spawn"
          onChange={(enemySpawnSeconds) => change({ enemySpawnSeconds })}
        />
        <p className="panel__muted">Rankings only compare battles with the same settings.</p>

        <dl className="options__list">
          <dt>Captain</dt>
          <dd>
            <span data-testid="options-nickname">{profile?.nickname ?? 'Not set'}</span>
            <button
              type="button"
              className="btn btn--secondary"
              onClick={() => setEditingName(true)}
            >
              {profile ? 'Change' : 'Set name'}
            </button>
          </dd>
          <dt>Sound</dt>
          <dd>
            <MuteButton className="btn btn--secondary" />
          </dd>
        </dl>

        <button
          type="button"
          className="btn btn--secondary"
          disabled={isDefault}
          onClick={() => {
            props.onResetOptions();
            setResetNotice('Settings reset to defaults.');
          }}
        >
          Reset to defaults
        </button>
        <p className="visually-hidden" role="status">
          {resetNotice}
        </p>

        <button type="button" className="btn btn--primary" onClick={props.onBack}>
          Main Menu
        </button>
      </section>

      <NicknameDialog
        open={editingName}
        {...(profile ? { initialValue: profile.nickname } : {})}
        title="Captain's name"
        submitLabel="Save"
        onCancel={() => setEditingName(false)}
        onSubmit={(nickname) => {
          props.onNickname(nickname);
          setEditingName(false);
        }}
      />
    </Scene>
  );
}
