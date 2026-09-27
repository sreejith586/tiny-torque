'use client';

import { useSyncExternalStore } from 'react';
import type { ThemeKey} from '@/lib/theme';
import { THEMES, applyThemeToDocument, getStoredTheme, storeTheme } from '@/lib/theme';

const listeners = new Set<() => void>();
function subscribeTheme(cb: () => void) {
  listeners.add(cb);
  return () => listeners.delete(cb);
}
function notifyTheme() {
  listeners.forEach((l) => l());
}

// Swatch picker — ported from renderThemeSwatches() in the prototype.
// Selecting a swatch applies the theme immediately and persists it to
// localStorage only (see src/lib/theme.ts for why it isn't synced to
// Supabase).
export default function ThemeSwitcher() {
  // Read the stored theme without a setState-in-effect (hydration-safe: null on the server).
  const current = useSyncExternalStore(subscribeTheme, getStoredTheme, () => null);

  function select(key: ThemeKey) {
    applyThemeToDocument(key);
    storeTheme(key);
    notifyTheme();
  }

  return (
    <div className="theme-swatches" id="themeSwatches">
      {Object.entries(THEMES).map(([key, def]) => (
        <div
          key={key}
          className={`theme-swatch ${current === key ? 'selected' : ''}`}
          onClick={() => select(key as ThemeKey)}
          title={def.label}
          role="button"
          tabIndex={0}
        >
          <div className="swatch-dots">
            <span style={{ background: def.vars['--bg'] }} />
            <span style={{ background: def.vars['--orange'] }} />
            <span style={{ background: def.vars['--teal'] }} />
          </div>
          <div className="swatch-label">{def.label}</div>
        </div>
      ))}
    </div>
  );
}
