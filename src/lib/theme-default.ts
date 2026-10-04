// App default theme (D-054): Aurora Glass.
//
// This lives here rather than in theme.ts because that file is hook-locked (D-027). theme.ts's
// DEFAULT_THEME stays the library-level fallback; APP_DEFAULT_THEME is what the product actually
// boots to, and resolveStoredTheme() is the app's replacement for getStoredTheme() so the applied
// theme (ThemeInit) and the selected swatch (ThemeSwitcher) agree on the default.
import { isThemeKey, type ThemeKey } from './theme';

export const APP_DEFAULT_THEME: ThemeKey = 'aurora-glass';

const STORAGE_KEY = 'mini-vault-theme';

export function resolveStoredTheme(): ThemeKey {
  if (typeof window === 'undefined') return APP_DEFAULT_THEME;
  try {
    const stored = window.localStorage.getItem(STORAGE_KEY);
    return isThemeKey(stored) ? stored : APP_DEFAULT_THEME;
  } catch {
    return APP_DEFAULT_THEME;
  }
}
