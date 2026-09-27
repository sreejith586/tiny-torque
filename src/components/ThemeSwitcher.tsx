'use client';

import { useEffect, useState } from 'react';
import { THEMES, ThemeKey, applyThemeToDocument, getStoredTheme, storeTheme } from '@/lib/theme';

// Swatch picker — ported from renderThemeSwatches() in the prototype.
// Selecting a swatch applies the theme immediately and persists it to
// localStorage only (see src/lib/theme.ts for why it isn't synced to
// Supabase).
export default function ThemeSwitcher() {
  const [current, setCurrent] = useState<ThemeKey | null>(null);

  useEffect(() => {
    setCurrent(getStoredTheme());
  }, []);

  function select(key: ThemeKey) {
    applyThemeToDocument(key);
    storeTheme(key);
    setCurrent(key);
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
