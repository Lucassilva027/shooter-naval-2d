import { createRandom, type Random } from '@/game/core/random';

export type NetworkScenario =
  | 'normal'
  | 'empty'
  | 'many-pages'
  | 'slow'
  | 'variable-latency'
  | 'out-of-order'
  | 'records-timeout'
  | 'connection-failure'
  | 'client-error'
  | 'server-error'
  | 'ranking-error'
  | 'history-error'
  | 'submission-error'
  | 'submission-timeout';

export const NETWORK_SCENARIOS: readonly {
  readonly id: NetworkScenario;
  readonly label: string;
  readonly description: string;
}[] = [
  { id: 'normal', label: 'Normal', description: 'Use the standard mock response.' },
  { id: 'empty', label: 'Empty lists', description: 'Return empty ranking and history pages.' },
  {
    id: 'many-pages',
    label: 'Many pages',
    description: 'Add 60 generated captains to every ranking and history page.',
  },
  { id: 'slow', label: 'Slow connection', description: 'Delay records responses by 1.5 seconds.' },
  {
    id: 'variable-latency',
    label: 'Variable latency',
    description: 'Delay each records response by a seeded random 0.1 to 2.5 seconds.',
  },
  {
    id: 'out-of-order',
    label: 'Out-of-order responses',
    description: 'Earlier records requests answer after later ones (2.4 s, 1.7 s, 1.0 s, 0.3 s, …).',
  },
  {
    id: 'records-timeout',
    label: 'Records timeout',
    description: 'Hold records responses past the client timeout.',
  },
  {
    id: 'connection-failure',
    label: 'Connection failure',
    description: 'Fail every API request, including match submissions, with a network error.',
  },
  {
    id: 'client-error',
    label: 'Client error (429)',
    description: 'Return HTTP 429 for records requests; client errors are not retried.',
  },
  { id: 'server-error', label: 'Server error', description: 'Return HTTP 503 for records requests.' },
  { id: 'ranking-error', label: 'Ranking error', description: 'Return HTTP 500 for the ranking only.' },
  { id: 'history-error', label: 'History error', description: 'Return HTTP 500 for the match history only.' },
  {
    id: 'submission-error',
    label: 'Submission error',
    description: 'Reject match submissions with HTTP 503.',
  },
  {
    id: 'submission-timeout',
    label: 'Submission timeout',
    description: 'Store a match, then delay its first acknowledgement beyond the client timeout.',
  },
];

const STORAGE_KEY = 'pirate-battle:network-scenario';
const DEFAULT_SEED = 1;

interface ScenarioState {
  readonly scenario: NetworkScenario;
  readonly seed: number;
  random: Random;
  requestCount: number;
}

let state = createState('normal', DEFAULT_SEED);

function createState(scenario: NetworkScenario, seed: number): ScenarioState {
  return { scenario, seed, random: createRandom(seed), requestCount: 0 };
}

export function isNetworkScenario(value: unknown): value is NetworkScenario {
  return NETWORK_SCENARIOS.some(({ id }) => id === value);
}

export function getNetworkScenario(): NetworkScenario {
  return state.scenario;
}

export function getNetworkScenarioSeed(): number {
  return state.seed;
}

/** Selecting a scenario restarts its seeded latency sequence, so runs are reproducible. */
export function setNetworkScenario(scenario: NetworkScenario, seed = state.seed): void {
  state = createState(scenario, seed);
  persist();
}

export function resetNetworkScenario(): void {
  state = createState('normal', DEFAULT_SEED);
  persist();
}

/**
 * Restores the last selected scenario, letting `?scenario=<id>&scenarioSeed=<n>` override
 * it so a failure can be reproduced from a link.
 */
export function initNetworkScenario(search: string): void {
  const stored = readStored();
  const params = new URLSearchParams(search);
  const fromUrl = params.get('scenario');
  const seedFromUrl = Number.parseInt(params.get('scenarioSeed') ?? '', 10);
  const scenario = isNetworkScenario(fromUrl) ? fromUrl : (stored?.scenario ?? 'normal');
  const seed = Number.isSafeInteger(seedFromUrl) ? seedFromUrl : (stored?.seed ?? DEFAULT_SEED);
  state = createState(scenario, seed);
  if (fromUrl !== null || params.has('scenarioSeed')) persist();
}

/** Delay for the next records response under the active latency scenario, in milliseconds. */
export function nextRecordsDelayMs(): number {
  const index = state.requestCount++;
  switch (state.scenario) {
    case 'slow':
      return 1_500;
    case 'variable-latency':
      return Math.round(100 + state.random() * 2_400);
    case 'out-of-order':
      return 2_400 - (index % 4) * 700;
    default:
      return 0;
  }
}

function storage(): Storage | null {
  return typeof window === 'undefined' ? null : window.localStorage;
}

function readStored(): { scenario: NetworkScenario; seed: number } | null {
  try {
    const raw = storage()?.getItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed: unknown = JSON.parse(raw);
    if (typeof parsed !== 'object' || parsed === null) return null;
    const { scenario, seed } = parsed as Record<string, unknown>;
    if (!isNetworkScenario(scenario) || !Number.isSafeInteger(seed)) return null;
    return { scenario, seed: seed as number };
  } catch {
    return null;
  }
}

function persist(): void {
  try {
    storage()?.setItem(
      STORAGE_KEY,
      JSON.stringify({ scenario: state.scenario, seed: state.seed }),
    );
  } catch {
    // Scenario selection still works for this page when storage is unavailable.
  }
}
