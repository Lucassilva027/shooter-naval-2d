import { useState } from 'react';
import type { Profile } from '@/storage/profile';
import { MuteButton } from '@/ui/components/MuteButton';
import { NicknameDialog } from '@/ui/components/NicknameDialog';
import { Scene } from '@/ui/components/Scene';

interface OptionsScreenProps {
  readonly profile: Profile | null;
  readonly onNickname: (nickname: string) => void;
  readonly onBack: () => void;
}

export function OptionsScreen({ profile, onNickname, onBack }: OptionsScreenProps) {
  const [editingName, setEditingName] = useState(false);

  return (
    <Scene label="Options">
      <section className="panel" aria-labelledby="options-title">
        <h1 id="options-title">Options</h1>

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

        <button type="button" className="btn btn--primary" onClick={onBack} autoFocus>
          Back
        </button>
      </section>

      <NicknameDialog
        open={editingName}
        {...(profile ? { initialValue: profile.nickname } : {})}
        title="Captain's name"
        submitLabel="Save"
        onCancel={() => setEditingName(false)}
        onSubmit={(nickname) => {
          onNickname(nickname);
          setEditingName(false);
        }}
      />
    </Scene>
  );
}
