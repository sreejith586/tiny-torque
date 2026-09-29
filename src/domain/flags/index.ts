// Server-safe exports only. Client components: import { useFlag, FlagsProvider } from
// '@/domain/flags/client' instead — keeping that 'use client' module out of this barrel avoids
// pulling it into server-only bundles that never render it.
export * from './service';
export * from './types';
export { isFlagActive, isInAudience, stableBucket } from './evaluate';
