import { readStored, writeStored } from './localStore';

const KEY = 'profile';

export const NICKNAME_MIN_LENGTH = 3;
export const NICKNAME_MAX_LENGTH = 16;
const NICKNAME_PATTERN = /^[\p{L}\p{N} _-]+$/u;

export interface Profile {
  /** Stable anonymous id, generated once per browser. */
  readonly playerId: string;
  readonly nickname: string;
}

export type NicknameValidation =
  { readonly ok: true; readonly value: string } | { readonly ok: false; readonly error: string };

export function validateNickname(raw: string): NicknameValidation {
  const value = raw.trim().replace(/\s+/g, ' ');
  if (value.length < NICKNAME_MIN_LENGTH || value.length > NICKNAME_MAX_LENGTH) {
    return {
      ok: false,
      error: `Use ${NICKNAME_MIN_LENGTH} to ${NICKNAME_MAX_LENGTH} characters.`,
    };
  }
  if (!NICKNAME_PATTERN.test(value)) {
    return { ok: false, error: 'Use only letters, numbers, spaces, "-" and "_".' };
  }
  return { ok: true, value };
}

export function loadProfile(): Profile | null {
  return readStored(KEY, parseProfile);
}

/** Saves a (validated) nickname, keeping the existing player id if there is one. */
export function saveNickname(nickname: string): Profile {
  const profile: Profile = {
    playerId: loadProfile()?.playerId ?? createPlayerId(),
    nickname,
  };
  writeStored(KEY, profile);
  return profile;
}

function createPlayerId(): string {
  if (typeof crypto.randomUUID === 'function') return crypto.randomUUID();

  const bytes = crypto.getRandomValues(new Uint8Array(16));
  bytes[6] = ((bytes[6] ?? 0) & 0x0f) | 0x40;
  bytes[8] = ((bytes[8] ?? 0) & 0x3f) | 0x80;
  const hex = Array.from(bytes, (byte) => byte.toString(16).padStart(2, '0')).join('');

  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
}

function parseProfile(raw: unknown): Profile | null {
  if (typeof raw !== 'object' || raw === null) return null;
  const { playerId, nickname } = raw as Record<string, unknown>;
  if (typeof playerId !== 'string' || playerId === '') return null;
  if (typeof nickname !== 'string' || !validateNickname(nickname).ok) return null;
  return { playerId, nickname };
}
