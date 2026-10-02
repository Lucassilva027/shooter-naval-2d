import { useState } from 'react';
import { audio } from '@/game/audio/AudioManager';
import type { MatchResult } from '@/game/matchResult';
import { MatchScreen } from '@/ui/screens/MatchScreen';
import { ResultScreen } from '@/ui/screens/ResultScreen';

type Screen = { name: 'menu' } | { name: 'match' } | { name: 'result'; result: MatchResult };

export function App() {
  const [screen, setScreen] = useState<Screen>({ name: 'menu' });

  const play = () => {
    audio.unlock();
    setScreen({ name: 'match' });
  };
  const toMenu = () => setScreen({ name: 'menu' });

  switch (screen.name) {
    case 'match':
      return (
        <MatchScreen onExit={toMenu} onFinish={(result) => setScreen({ name: 'result', result })} />
      );
    case 'result':
      return <ResultScreen result={screen.result} onPlayAgain={play} onMenu={toMenu} />;
    case 'menu':
      return (
        <main className="app">
          <h1>Pirate Battle</h1>
          <button type="button" onClick={play} autoFocus>
            Play
          </button>
        </main>
      );
  }
}
