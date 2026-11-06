import { describe, it, expect } from 'vitest';
import { findBannedLanguage, isCleanLanguage } from './clean-language';

describe('clean-language (MV-S6-04 / W03)', () => {
  it('passes ordinary collector text', () => {
    for (const s of [
      'Lovely Skylines!',
      "Varun's Garage",
      'JDM night — bring your R34s',
      'Hot Wheels Treasure Hunt 2024',
      '',
    ]) {
      expect(isCleanLanguage(s)).toBe(true);
    }
  });

  it('never trips on car-world words that contain a banned stem (whole-word matching)', () => {
    for (const s of [
      'Scunthorpe meet',
      'Carbon cockpit',
      'Shelby GT500',
      'My shitbox Civic',
      'Assetto Corsa night',
    ]) {
      expect(isCleanLanguage(s)).toBe(true);
    }
  });

  it('catches plain, suffixed and upper-case profanity', () => {
    expect(findBannedLanguage('this is SHIT')).toBe('shit');
    expect(findBannedLanguage('fucking great')).toBe('fuck');
    expect(findBannedLanguage('what a Bitches move')).toBe('bitch');
  });

  it('catches leet-speak and separator evasions', () => {
    expect(findBannedLanguage('sh1t garage')).toBe('shit');
    expect(findBannedLanguage('f u c k')).toBe('fuck');
    expect(findBannedLanguage('f.u.c.k this')).toBe('fuck');
    expect(findBannedLanguage('fuuuuck')).toBe('fuck');
    expect(findBannedLanguage('a$$hole')).toBe('asshole');
  });

  it('catches slurs including the Hindi placeholders', () => {
    expect(findBannedLanguage('total chutiya')).toBe('chutiya');
    expect(findBannedLanguage('n1gger')).toBe('nigger');
  });
});
