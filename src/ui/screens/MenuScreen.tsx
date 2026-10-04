import { useState } from 'react';
import type { MatchResult } from '@/game/matchResult';
import type { Profile } from '@/storage/profile';
import { HowToPlayDialog } from '@/ui/components/HowToPlayDialog';
import { MuteButton } from '@/ui/components/MuteButton';
import { NicknameDialog } from '@/ui/components/NicknameDialog';
import { Scene } from '@/ui/components/Scene';
import { formatClock, outcomeLabel } from '@/ui/format';
import type { RecordsTab } from './RecordsScreen';

interface MenuScreenProps {
  readonly profile: Profile | null;
  readonly lastResult: MatchResult | null;
  /** Completed matches stored on this device that the API has not acknowledged yet. */
  readonly pendingSubmissions: number;
  readonly onSendPending: () => void;
  /** Saves the nickname chosen in the first-match dialog. */
  readonly onNickname: (nickname: string) => void;
  readonly onPlay: () => void;
  readonly onOptions: () => void;
  readonly onRecords: (tab: RecordsTab) => void;
}

export function MenuScreen(props: MenuScreenProps) {
  const [askingNickname, setAskingNickname] = useState(false);
  const [showingHelp, setShowingHelp] = useState(false);

  const play = () => {
    if (props.profile) props.onPlay();
    else setAskingNickname(true);
  };

  return (
    <Scene label="Main menu">
      <div className="scene__corner">
        <MuteButton className="btn btn--secondary" />
      </div>

      <section className="panel" aria-labelledby="menu-title">
        <h1 id="menu-title" className="visually-hidden">
          Pirate Battle
        </h1>
        <img
          className="panel__title-art"
          src="/assets/png/default/ui/menu/title_pirate_battle.png"
          srcSet="/assets/png/retina/ui/menu/title_pirate_battle.png 2x"
          width={384}
          height={128}
          alt=""
        />
        <p className="panel__tagline">Set sail. Take command.</p>
        {props.profile && (
          <p className="panel__muted">
            Welcome aboard, <strong>{props.profile.nickname}</strong>
          </p>
        )}

        <button type="button" className="btn btn--primary" onClick={play}>
          Play
        </button>
        <button type="button" className="btn btn--primary" onClick={props.onOptions}>
          Options
        </button>
        <button type="button" className="btn btn--secondary" onClick={() => setShowingHelp(true)}>
          How to play
        </button>

        {props.lastResult && (
          <p className="panel__muted" data-testid="last-result">
            Last battle: {props.lastResult.score} points ·{' '}
            {formatClock(Math.floor(props.lastResult.survivedSeconds))} ·{' '}
            {outcomeLabel(props.lastResult.outcome)}
          </p>
        )}
        {props.pendingSubmissions > 0 && (
          <div className="menu__pending" role="status" data-testid="pending-submissions">
            <p className="panel__muted">
              {props.pendingSubmissions === 1
                ? '1 battle result is waiting to be sent.'
                : `${props.pendingSubmissions} battle results are waiting to be sent.`}
            </p>
            <button type="button" className="btn btn--secondary" onClick={props.onSendPending}>
              Send now
            </button>
          </div>
        )}
        <p className="panel__muted">Navigate the islands. Survive the battle.</p>

        <nav className="panel__row" aria-label="Records">
          <button
            type="button"
            className="btn btn--secondary"
            onClick={() => props.onRecords('ranking')}
          >
            Ranking
          </button>
          <button
            type="button"
            className="btn btn--secondary"
            onClick={() => props.onRecords('history')}
          >
            Match history
          </button>
        </nav>
      </section>

      <NicknameDialog
        open={askingNickname}
        title="Name your captain"
        submitLabel="Set sail"
        onCancel={() => setAskingNickname(false)}
        onSubmit={(nickname) => {
          setAskingNickname(false);
          props.onNickname(nickname);
          props.onPlay();
        }}
      />
      <HowToPlayDialog open={showingHelp} onClose={() => setShowingHelp(false)} />
    </Scene>
  );
}
