import { useState } from 'react';
import { audio } from '@/game/audio/AudioManager';
import { MatchScreen } from '@/ui/screens/MatchScreen';

type Screen = 'menu' | 'match';

export function App() {
  const [screen, setScreen] = useState<Screen>('menu');

  if (screen === 'match') return <MatchScreen onExit={() => setScreen('menu')} />;

  const play = () => {
    audio.unlock();
    setScreen('match');
  };

  return (
    <main className="app">
      <h1>Pirate Battle</h1>
      <button type="button" onClick={play} autoFocus>
        Play
      </button>
    </main>
  );
}
