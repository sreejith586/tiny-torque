import { describe, expect, it } from 'vitest';
import {
  canOfferInstall,
  dismissInstall,
  INSTALL_DISMISSED_KEY,
  isIosSafari,
  isStandalone,
  recordVisit,
  VISIT_GAP_MS,
  VISITS_KEY,
  visitCount,
  type KV,
} from './pwa';

function memory(initial: Record<string, string> = {}): KV & { store: Map<string, string> } {
  const store = new Map(Object.entries(initial));
  return {
    store,
    getItem: (k) => store.get(k) ?? null,
    setItem: (k, v) => void store.set(k, v),
  };
}

describe('recordVisit (F-17: install prompt deferred until the 2nd visit)', () => {
  it('counts distinct visits, not reloads inside the gap', () => {
    const kv = memory();
    const t0 = 1_700_000_000_000;
    expect(recordVisit(kv, t0)).toBe(1);
    expect(recordVisit(kv, t0 + 5_000)).toBe(1); // reload a few seconds later
    expect(recordVisit(kv, t0 + VISIT_GAP_MS - 1)).toBe(1);
    expect(recordVisit(kv, t0 + VISIT_GAP_MS)).toBe(2); // came back later → 2nd visit
    expect(visitCount(kv)).toBe(2);
    expect(JSON.parse(kv.store.get(VISITS_KEY)!)).toEqual({ count: 2, last: t0 + VISIT_GAP_MS });
  });

  it('survives garbage in storage and storage that throws', () => {
    expect(recordVisit(memory({ [VISITS_KEY]: 'not json' }), 1)).toBe(1);
    expect(recordVisit(memory({ [VISITS_KEY]: '{"count":-4}' }), 1)).toBe(1);
    const throwing: KV = {
      getItem: () => {
        throw new Error('blocked');
      },
      setItem: () => {
        throw new Error('blocked');
      },
    };
    expect(recordVisit(throwing, 1)).toBe(1);
    expect(canOfferInstall(throwing, 1)).toBe(false);
  });
});

describe('canOfferInstall', () => {
  it('needs two visits and respects a 30-day dismissal', () => {
    const kv = memory();
    const t0 = 1_700_000_000_000;
    recordVisit(kv, t0);
    expect(canOfferInstall(kv, t0)).toBe(false);
    recordVisit(kv, t0 + 2 * VISIT_GAP_MS);
    expect(canOfferInstall(kv, t0 + 2 * VISIT_GAP_MS)).toBe(true);
    dismissInstall(kv, t0 + 2 * VISIT_GAP_MS);
    expect(kv.store.get(INSTALL_DISMISSED_KEY)).toBe(String(t0 + 2 * VISIT_GAP_MS));
    expect(canOfferInstall(kv, t0 + 2 * VISIT_GAP_MS + 29 * 86_400_000)).toBe(false);
    expect(canOfferInstall(kv, t0 + 2 * VISIT_GAP_MS + 31 * 86_400_000)).toBe(true);
  });
});

describe('platform sniffing', () => {
  it('isStandalone: iOS navigator.standalone or the display-mode media query', () => {
    expect(isStandalone({ navigator: { standalone: true } })).toBe(true);
    expect(isStandalone({ navigator: {}, matchMedia: () => ({ matches: true }) })).toBe(true);
    expect(isStandalone({ navigator: {}, matchMedia: () => ({ matches: false }) })).toBe(false);
    expect(isStandalone({ navigator: {} })).toBe(false);
  });

  it('isIosSafari: Safari on iPhone yes; Chrome on iPhone and desktop Safari no', () => {
    const iphoneSafari =
      'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1';
    const iphoneChrome =
      'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) CriOS/119.0 Mobile/15E148 Safari/604.1';
    const macSafari =
      'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Safari/605.1.15';
    expect(isIosSafari(iphoneSafari)).toBe(true);
    expect(isIosSafari(iphoneChrome)).toBe(false);
    expect(isIosSafari(macSafari)).toBe(false);
  });
});
