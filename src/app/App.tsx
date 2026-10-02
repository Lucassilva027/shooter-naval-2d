import { useState } from 'react';
import { MatchScreen } from '@/ui/screens/MatchScreen';

type Screen = 'menu' | 'match';

export function App() {
  const [screen, setScreen] = useState<Screen>('menu');

  if (screen === 'match') return <MatchScreen onExit={() => setScreen('menu')} />;

  return (
    <main className="app">
      <h1>Pirate Battle</h1>
      <button type="button" onClick={() => setScreen('match')} autoFocus>
        Play
      </button>
    </main>
  );
}
