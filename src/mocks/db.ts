import type { MatchHistoryEntry } from '@/api/contracts';
import { matchFixtures } from './fixtures/matches';

const DATABASE_NAME = 'pirate-battle-api';
const DATABASE_VERSION = 1;
const MATCHES_STORE = 'matches';

export interface MatchesDatabase {
  get(matchId: string): Promise<MatchHistoryEntry | undefined>;
  getAll(): Promise<MatchHistoryEntry[]>;
  add(entry: MatchHistoryEntry): Promise<boolean>;
}

export function createMatchesDatabase(name = DATABASE_NAME): MatchesDatabase {
  let databasePromise: Promise<IDBDatabase> | undefined;

  const openDatabase = () => {
    if (typeof indexedDB === 'undefined') {
      return Promise.reject(new Error('IndexedDB is unavailable; the mock API database cannot start.'));
    }

    databasePromise ??= new Promise<IDBDatabase>((resolve, reject) => {
      const request = indexedDB.open(name, DATABASE_VERSION);

      request.onupgradeneeded = () => {
        const database = request.result;
        const store = database.createObjectStore(MATCHES_STORE, { keyPath: 'matchId' });
        for (const fixture of matchFixtures) store.add(fixture);
      };
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error ?? new Error('Failed to open the mock API database.'));
      request.onblocked = () => reject(new Error('Opening the mock API database was blocked.'));
    });

    return databasePromise;
  };

  return {
    async get(matchId) {
      const database = await openDatabase();
      const transaction = database.transaction(MATCHES_STORE, 'readonly');
      const request = transaction.objectStore(MATCHES_STORE).get(matchId);
      return requestResult(request);
    },
    async getAll() {
      const database = await openDatabase();
      const transaction = database.transaction(MATCHES_STORE, 'readonly');
      const request = transaction.objectStore(MATCHES_STORE).getAll();
      return requestResult(request);
    },
    async add(entry) {
      const database = await openDatabase();
      const transaction = database.transaction(MATCHES_STORE, 'readwrite');
      let inserted = true;
      const request = transaction.objectStore(MATCHES_STORE).add(entry);
      request.onerror = (event) => {
        if (request.error?.name !== 'ConstraintError') return;
        event.preventDefault();
        inserted = false;
      };

      return new Promise<boolean>((resolve, reject) => {
        transaction.oncomplete = () => resolve(inserted);
        transaction.onabort = () =>
          reject(transaction.error ?? new Error('Failed to write to the mock API database.'));
      });
    },
  };
}

function requestResult<T>(request: IDBRequest<T>): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error ?? new Error('Failed to read from the mock API database.'));
  });
}
