'use client';

import { useEffect } from 'react';
import { applyThemeToDocument } from '@/lib/theme';
import { resolveStoredTheme } from '@/lib/theme-default';

// Applies the device's stored theme on first client render. Lives in the
// root layout so every route gets the right CSS variables, not just pages
// that render the swatch picker. Falls back to the app default (Aurora
// Glass, D-054) when nothing is stored.
export default function ThemeInit() {
  useEffect(() => {
    applyThemeToDocument(resolveStoredTheme());
  }, []);

  return null;
}
