export type NetworkScenario = 'normal' | 'slow' | 'server-error';

export const NETWORK_SCENARIOS: readonly {
  readonly id: NetworkScenario;
  readonly label: string;
  readonly description: string;
}[] = [
  { id: 'normal', label: 'Normal', description: 'Use the standard mock response.' },
  { id: 'slow', label: 'Slow connection', description: 'Delay records responses by 1.5 seconds.' },
  { id: 'server-error', label: 'Server error', description: 'Return HTTP 503 for records requests.' },
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
