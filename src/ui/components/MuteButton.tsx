import { useSyncExternalStore } from 'react';
import { audio } from '@/game/audio/AudioManager';

export function MuteButton({ className }: { readonly className?: string }) {
  const muted = useSyncExternalStore(audio.subscribe, audio.isMuted);
  return (
    <button
      type="button"
      className={className}
      aria-pressed={muted}
      onClick={() => audio.setMuted(!muted)}
    >
      {muted ? 'Sound: off' : 'Sound: on'}
    </button>
  );
}
