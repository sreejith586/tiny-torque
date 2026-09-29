'use client';
// Client-side flag access. A server component fetches flag states once via
// getAllFlagStates() and passes them down through <FlagsProvider>; client
// components then read them with useFlag() instead of fetching themselves.
import { createContext, useContext, type ReactNode } from 'react';
import type { FlagKey } from './types';

const FlagsContext = createContext<Record<string, boolean>>({});

export function FlagsProvider({
  flags,
  children,
}: {
  flags: Record<string, boolean>;
  children: ReactNode;
}) {
  return <FlagsContext.Provider value={flags}>{children}</FlagsContext.Provider>;
}

export function useFlag(key: FlagKey): boolean {
  const flags = useContext(FlagsContext);
  return flags[key] ?? false;
}
