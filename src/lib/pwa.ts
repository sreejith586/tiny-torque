// PWA client helpers (MV-S9-02, F-17): the visit counter behind the "install on the 2nd visit"
// rule and the install-prompt dismissal window. Pure functions over a tiny key/value store so the
// rules are unit-testable without a browser; the components pass window.localStorage.

export const VISITS_KEY = 'mv-pwa-visits';
export const INSTALL_DISMISSED_KEY = 'mv-pwa-install-dismissed';
/** F-17: the install prompt is deferred until the 2nd visit. */
export const INSTALL_MIN_VISITS = 2;
/** A dismissed prompt stays away for this long before it may show again. */
export const INSTALL_DISMISS_DAYS = 30;
/** Visits closer together than this count as one (a reload is not a return visit). */
export const VISIT_GAP_MS = 30 * 60 * 1000;

export interface KV {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
}

interface VisitRecord {
  count: number;
  last: number;
}

function readVisits(kv: KV): VisitRecord {
  try {
    const raw = kv.getItem(VISITS_KEY);
    if (!raw) return { count: 0, last: 0 };
    const parsed = JSON.parse(raw) as Partial<VisitRecord>;
    return {
      count: typeof parsed.count === 'number' && parsed.count >= 0 ? Math.floor(parsed.count) : 0,
      last: typeof parsed.last === 'number' ? parsed.last : 0,
    };
  } catch {
    return { count: 0, last: 0 };
  }
}

/** Counts this page load as a visit unless the previous one was under VISIT_GAP_MS ago. Returns the
 *  visit count after this load. Storage failures (private mode) count as a first visit. */
export function recordVisit(kv: KV, now: number = Date.now()): number {
  const v = readVisits(kv);
  const isReload = v.count > 0 && now - v.last < VISIT_GAP_MS;
  const next = isReload ? v : { count: v.count + 1, last: now };
  try {
    kv.setItem(VISITS_KEY, JSON.stringify(next));
  } catch {
    // not persisted — fine, the prompt simply waits for a visit that does persist
  }
  return next.count;
}

export function visitCount(kv: KV): number {
  return readVisits(kv).count;
}

/** True when the install prompt may be offered: ≥ 2 visits and not dismissed in the last 30 days. */
export function canOfferInstall(kv: KV, now: number = Date.now()): boolean {
  if (visitCount(kv) < INSTALL_MIN_VISITS) return false;
  try {
    const dismissed = Number(kv.getItem(INSTALL_DISMISSED_KEY) ?? 0);
    if (dismissed && now - dismissed < INSTALL_DISMISS_DAYS * 86_400_000) return false;
  } catch {
    // unreadable → treat as not dismissed
  }
  return true;
}

export function dismissInstall(kv: KV, now: number = Date.now()): void {
  try {
    kv.setItem(INSTALL_DISMISSED_KEY, String(now));
  } catch {
    // ignore
  }
}

/** Running as an installed app (home-screen launch) — no prompt needed then. */
export function isStandalone(win: {
  matchMedia?: (q: string) => { matches: boolean };
  navigator: unknown;
}): boolean {
  // iOS Safari exposes the non-standard navigator.standalone
  if ((win.navigator as { standalone?: boolean }).standalone === true) return true;
  return !!win.matchMedia?.('(display-mode: standalone)').matches;
}

/** iOS Safari has no beforeinstallprompt — the prompt there is an "Add to Home Screen" hint. */
export function isIosSafari(userAgent: string): boolean {
  const ios = /iPhone|iPad|iPod/i.test(userAgent);
  const safari = /Safari/i.test(userAgent) && !/CriOS|FxiOS|EdgiOS|OPiOS/i.test(userAgent);
  return ios && safari;
}
