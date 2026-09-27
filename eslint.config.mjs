import { defineConfig, globalIgnores } from 'eslint/config';
import nextVitals from 'eslint-config-next/core-web-vitals';
import nextTs from 'eslint-config-next/typescript';

export default defineConfig([
  globalIgnores(['.next/**', 'node_modules/**', 'supabase/functions/**', 'playwright-report/**', 'coverage/**', 'next-env.d.ts']),
  ...nextVitals,
  ...nextTs,
  {
    rules: {
      '@typescript-eslint/no-explicit-any': 'error',
      '@typescript-eslint/consistent-type-imports': 'error',
    },
  },
  // D-007: Supabase is only touched from repo.ts and lib/supabase. Everything else goes through domain services.
  {
    files: ['src/**/*.{ts,tsx}'],
    ignores: ['src/domain/*/repo.ts', 'src/domain/*/service.ts', 'src/lib/supabase/**', 'src/types/supabase.ts'],
    rules: {
      'no-restricted-imports': [
        'error',
        {
          patterns: [
            { group: ['@supabase/*'], message: 'D-007: import Supabase only in src/domain/*/repo.ts or src/lib/supabase/*.' },
            { group: ['@/domain/*/repo', '@/domain/*/repo.ts', '**/repo'], message: 'D-007: components/routes call domain services, never repo.' },
          ],
        },
      ],
    },
  },
]);
