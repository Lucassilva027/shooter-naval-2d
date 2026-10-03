export type NetworkScenario =
  | 'normal'
  | 'slow'
  | 'server-error'
  | 'submission-error'
  | 'submission-timeout';

export const NETWORK_SCENARIOS: readonly {
  readonly id: NetworkScenario;
  readonly label: string;
  readonly description: string;
}[] = [
  { id: 'normal', label: 'Normal', description: 'Use the standard mock response.' },
  { id: 'slow', label: 'Slow connection', description: 'Delay records responses by 1.5 seconds.' },
  { id: 'server-error', label: 'Server error', description: 'Return HTTP 503 for records requests.' },
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

let currentScenario: NetworkScenario = 'normal';

export function getNetworkScenario(): NetworkScenario {
  return currentScenario;
}

export function setNetworkScenario(scenario: NetworkScenario): void {
  currentScenario = scenario;
}

export function resetNetworkScenario(): void {
  currentScenario = 'normal';
}
