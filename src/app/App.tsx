import { useState } from 'react';
import { audio } from '@/game/audio/AudioManager';
import type { MatchResult } from '@/game/matchResult';
import { loadProfile, saveNickname, type Profile } from '@/storage/profile';
import { loadLastResult, recordCompletedMatch, type CompletedMatch } from '@/storage/results';
import { RotateNotice } from '@/ui/components/RotateNotice';
import { MatchScreen } from '@/ui/screens/MatchScreen';
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
  const [screen, setScreen] = useState<Screen>({ name: 'menu' });
  const [profile, setProfile] = useState<Profile | null>(loadProfile);
  const [lastResult, setLastResult] = useState<MatchResult | null>(loadLastResult);

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
        return <MatchScreen key={screen.id} onExit={toMenu} onFinish={finishMatch} />;
      case 'result':
        return <ResultScreen completed={screen.completed} onPlayAgain={play} onMenu={toMenu} />;
      case 'options':
        return <OptionsScreen profile={profile} onNickname={changeNickname} onBack={toMenu} />;
      case 'records':
        return (
          <RecordsScreen
            tab={screen.tab}
            onTabChange={(tab) => setScreen({ name: 'records', tab })}
            onBack={toMenu}
          />
        );
      case 'menu':
        return (
          <MenuScreen
            profile={profile}
            lastResult={lastResult}
            onNickname={changeNickname}
            onPlay={play}
            onOptions={() => setScreen({ name: 'options' })}
            onRecords={(tab) => setScreen({ name: 'records', tab })}
          />
        );
    }
  }
}
