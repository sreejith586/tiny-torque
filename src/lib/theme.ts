// Theme system — ported from the prototype's THEMES object (garage-log.html,
// ~line 3725). Theme choice is a per-device preference, not synced to
// Supabase (matches the note in the prototype's api.js: mixing device
// preferences into the DB would mean a network round-trip for something
// that doesn't need one), so this is plain localStorage, no API calls.

export type ThemeKey =
  | 'workshop-light'
  | 'racing-green'
  | 'sunset-amber'
  | 'graphite-steel'
  | 'aurora-glass'
  | 'leather-chrome';

export interface ThemeDef {
  label: string;
  is3D?: boolean;
  isLeather?: boolean;
  vars: Record<string, string>;
}

export const THEMES: Record<ThemeKey, ThemeDef> = {
  'workshop-light': {
    label: 'Workshop Light',
    vars: {
      '--bg': '#F6F1E7', '--panel': '#FFFFFF', '--panel-alt': '#EFE7D6', '--cream': '#1C1712',
      '--orange': '#B84509', '--teal': '#146358', '--gold': '#7A5F08', '--muted': '#5C5445',
      '--border': '#C9BC9E', '--danger': '#9A2E1A', '--btn-text': '#FFFFFF', '--violet': '#5B3FA0',
    },
  },
  'racing-green': {
    label: 'Racing Green',
    vars: {
      '--bg': '#0D1811', '--panel': '#132119', '--panel-alt': '#1A2C20', '--cream': '#EDF3EA',
      '--orange': '#F0B429', '--teal': '#1FD8A8', '--gold': '#FFD23F', '--muted': '#8FA093',
      '--border': '#294536', '--danger': '#FF5C4D', '--btn-text': '#0D1811', '--violet': '#B08CE8',
    },
  },
  'sunset-amber': {
    label: 'Sunset Amber',
    vars: {
      '--bg': '#1C1210', '--panel': '#251813', '--panel-alt': '#301F19', '--cream': '#FBEDE0',
      '--orange': '#FF7A29', '--teal': '#8B4FE0', '--gold': '#FFAB40', '--muted': '#B89C87',
      '--border': '#4A322A', '--danger': '#FF4D4D', '--btn-text': '#1C1210', '--violet': '#A377E0',
    },
  },
  'graphite-steel': {
    label: 'Graphite Steel',
    vars: {
      '--bg': '#121417', '--panel': '#1A1D21', '--panel-alt': '#22262B', '--cream': '#EDEFF2',
      '--orange': '#3E9EDB', '--teal': '#1FE0C0', '--gold': '#E8B93E', '--muted': '#8D95A0',
      '--border': '#30353C', '--danger': '#FF5A54', '--btn-text': '#121417', '--violet': '#9B7FF5',
    },
  },
  'aurora-glass': {
    label: 'Aurora Glass',
    is3D: true,
    vars: {
      '--bg': '#050608', '--panel': '#14172A', '--panel-alt': '#1B2038', '--cream': '#F0F3FB',
      '--orange': '#FF9E1A', '--teal': '#3D8BFF', '--gold': '#FFC94D', '--muted': '#8B96B8',
      '--border': '#232B4A', '--danger': '#FF6B85', '--btn-text': '#1A0F00', '--violet': '#B98CFF',
    },
  },
  'leather-chrome': {
    label: 'Leather & Chrome',
    isLeather: true,
    vars: {
      '--bg': '#111114', '--panel': '#1A1A1E', '--panel-alt': '#202024', '--cream': '#F0EEE9',
      '--orange': '#C07A3E', '--teal': '#8A9BA8', '--gold': '#D99257', '--muted': '#8A8A90',
      '--border': '#33333A', '--danger': '#E85D5D', '--btn-text': '#1A1410', '--violet': '#9B8AA8',
    },
  },
};

export const DEFAULT_THEME: ThemeKey = 'workshop-light';
const STORAGE_KEY = 'mini-vault-theme';

export function isThemeKey(value: string | null): value is ThemeKey {
  return !!value && Object.prototype.hasOwnProperty.call(THEMES, value);
}

export function getStoredTheme(): ThemeKey {
  if (typeof window === 'undefined') return DEFAULT_THEME;
  try {
    const stored = window.localStorage.getItem(STORAGE_KEY);
    return isThemeKey(stored) ? stored : DEFAULT_THEME;
  } catch {
    return DEFAULT_THEME;
  }
}

export function storeTheme(theme: ThemeKey) {
  try {
    window.localStorage.setItem(STORAGE_KEY, theme);
  } catch {
    // localStorage can throw in private browsing / blocked storage — theme
    // still applies for this page load, it just won't persist.
  }
}

export function applyThemeToDocument(theme: ThemeKey) {
  const def = THEMES[theme];
  if (!def) return;
  const root = document.documentElement;
  Object.entries(def.vars).forEach(([key, value]) => root.style.setProperty(key, value));
  root.classList.toggle('theme-3d', !!def.is3D);
  root.classList.toggle('theme-leather', !!def.isLeather);
  root.setAttribute('data-theme', theme);
}
