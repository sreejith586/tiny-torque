'use client';

import { useEffect } from 'react';
import { applyThemeToDocument, getStoredTheme } from '@/lib/theme';

// Applies the device's stored theme on first client render. Lives in the
// root layout so every route gets the right CSS variables, not just pages
// that render the swatch picker.
export default function ThemeInit() {
  useEffect(() => {
    applyThemeToDocument(getStoredTheme());
  }, []);

  return null;
}
