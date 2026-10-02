const PREFIX = 'pirate-battle:';

/**
 * JSON helpers over localStorage that never throw: storage can be unavailable (privacy
 * mode, quota exceeded) and the game must keep working without persistence.
 */
export function readStored<T>(key: string, parse: (raw: unknown) => T | null): T | null {
  try {
    const raw = window.localStorage.getItem(PREFIX + key);
    return raw === null ? null : parse(JSON.parse(raw));
  } catch {
    return null;
  }
}

export function writeStored(key: string, value: unknown): boolean {
  try {
    window.localStorage.setItem(PREFIX + key, JSON.stringify(value));
    return true;
  } catch {
    return false;
  }
}

export function removeStored(key: string): void {
  try {
    window.localStorage.removeItem(PREFIX + key);
  } catch {
    // Nothing to clean up when storage is unavailable.
  }
}
