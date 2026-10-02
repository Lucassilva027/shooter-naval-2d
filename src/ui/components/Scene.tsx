import type { ReactNode } from 'react';

/** Full-screen illustrated backdrop shared by every screen outside the battle. */
export function Scene({
  children,
  label,
}: {
  readonly children: ReactNode;
  readonly label: string;
}) {
  return (
    <main className="scene" aria-label={label}>
      {children}
      <img className="scene__brand" src="/assets/logo_jungle_gaming.svg" alt="" />
    </main>
  );
}
