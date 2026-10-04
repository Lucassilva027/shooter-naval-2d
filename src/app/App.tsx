import { useCallback, useEffect, useMemo, useState, useSyncExternalStore } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import type { GameOptions } from '@/config/gameConfig';
import { createMatchConfig } from '@/config/gameConfig';
import { audio } from '@/game/audio/AudioManager';
import { configKey, type MatchResult } from '@/game/matchResult';
import { useMatchSubmission } from '@/api/matchSubmission';
import { flushPendingSubmissions } from '@/api/pendingSubmissions';
import { loadOptions, resetOptions, saveOptions } from '@/storage/options';
import { loadProfile, saveNickname, type Profile } from '@/storage/profile';
import {
  countPendingSubmissions,
  createMatchSubmission,
  subscribePendingSubmissions,
} from '@/storage/pendingSubmissions';
import { loadLastResult, recordCompletedMatch, type CompletedMatch } from '@/storage/results';
import { RotateNotice } from '@/ui/components/RotateNotice';
import { LazyMatchScreen } from '@/ui/screens/LazyMatchScreen';
import { MenuScreen } from '@/ui/screens/MenuScreen';
import { OptionsScreen } from '@/ui/screens/OptionsScreen';
import { RecordsScreen, type RecordsTab } from '@/ui/screens/RecordsScreen';
import { ResultScreen } from '@/ui/screens/ResultScreen';

type Screen =
  | { readonly name: 'menu' }
  | { readonly name: 'options' }
  | { readonly name: 'records'; readonly tab: RecordsTab }
  | { readonly name: 'match'; readonly id: number }
  | { readonly name: 'result'; readonly completed: CompletedMatch };

export function App() {
  const queryClient = useQueryClient();
  const [screen, setScreen] = useState<Screen>({ name: 'menu' });
  const [profile, setProfile] = useState<Profile | null>(loadProfile);
  const [lastResult, setLastResult] = useState<MatchResult | null>(loadLastResult);
  const [options, setOptions] = useState<GameOptions>(loadOptions);
  const { mutation: submission, status: mutationStatus } = useMatchSubmission();
  const [missingProfile, setMissingProfile] = useState(false);
  const submissionStatus = missingProfile ? 'failed' : mutationStatus;
  const pendingCount = useSyncExternalStore(subscribePendingSubmissions, countPendingSubmissions);
  const recordsConfigKey = useMemo(
    () => configKey(createMatchConfig(options)),
    [options],
  );
  const syncPendingSubmissions = useCallback(
    () => void flushPendingSubmissions(queryClient),
    [queryClient],
  );

  useEffect(() => {
    syncPendingSubmissions();
    window.addEventListener('online', syncPendingSubmissions);
    return () => window.removeEventListener('online', syncPendingSubmissions);
  }, [syncPendingSubmissions]);

  const play = () => {
    audio.unlock();
    // A fresh id remounts the match, so "Play again" always starts from scratch.
    setScreen({ name: 'match', id: Date.now() });
  };
  const toMenu = () => setScreen({ name: 'menu' });
  const changeNickname = (nickname: string) => setProfile(saveNickname(nickname));

  const finishMatch = (result: MatchResult) => {
    const completed = recordCompletedMatch(result);
    setLastResult(result);
    setScreen({ name: 'result', completed });
    if (!profile) {
      console.error('Completed match was not submitted because the player profile is unavailable.');
      submission.reset();
      setMissingProfile(true);
      return;
    }
    setMissingProfile(false);
    submission.mutate(createMatchSubmission(profile.playerId, profile.nickname, result));
  };

  const retrySubmission = () => {
    if (submission.variables) submission.mutate(submission.variables);
  };

  return (
    <>
      {renderScreen()}
      <RotateNotice />
    </>
  );

  function renderScreen() {
    switch (screen.name) {
      case 'match':
        return (
          <LazyMatchScreen
            key={screen.id}
            options={options}
            onExit={toMenu}
            onFinish={finishMatch}
          />
        );
      case 'result':
        return (
          <ResultScreen
            completed={screen.completed}
            submissionStatus={submissionStatus}
            onRetrySubmission={retrySubmission}
            onPlayAgain={play}
            onMenu={toMenu}
          />
        );
      case 'options':
        return (
          <OptionsScreen
            options={options}
            onOptionsChange={(next) => setOptions(saveOptions(next))}
            onResetOptions={() => setOptions(resetOptions())}
            profile={profile}
            onNickname={changeNickname}
            onBack={toMenu}
          />
        );
      case 'records':
        return (
          <RecordsScreen
            tab={screen.tab}
            onTabChange={(tab) => setScreen({ name: 'records', tab })}
            onBack={toMenu}
            configKey={recordsConfigKey}
            playerId={profile?.playerId ?? null}
          />
        );
      case 'menu':
        return (
          <MenuScreen
            profile={profile}
            lastResult={lastResult}
            pendingSubmissions={pendingCount}
            onSendPending={syncPendingSubmissions}
            onNickname={changeNickname}
            onPlay={play}
            onOptions={() => setScreen({ name: 'options' })}
            onRecords={(tab) => setScreen({ name: 'records', tab })}
          />
        );
    }
  }
}
