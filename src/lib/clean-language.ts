// Clean-language validator (MV-S6-04, made mandatory by W03 — 07 §2.2 / §9). Pure, server-side,
// shared by garage names, guestbook lines (and, as later sprints adopt it, listing text, bios,
// room messages). Normalises leet-speak and separators and matches WHOLE words, so car names
// ("Scunthorpe", "Cockpit", "Shelby") never trip it (the classic substring-filter failure).
//
// The word list is a deliberately short PLACEHOLDER (English slurs/profanity only): the real list,
// its Hindi/Arabic/transliteration coverage and the car-name allowlist are the deferred MV-S6-04
// decision — see PROGRESS-WORLD › Blockers. Keep it data, not logic: extend BANNED_WORDS and
// ALLOWED_WORDS, never special-case in callers.

const LEET: Record<string, string> = {
  '0': 'o',
  '1': 'i',
  '3': 'e',
  '4': 'a',
  '5': 's',
  '7': 't',
  '8': 'b',
  '@': 'a',
  $: 's',
  '!': 'i',
  '|': 'l',
};

/** PLACEHOLDER — unambiguous English profanity and slurs. Stems only; whole-word match after
 *  normalisation, with the common suffixes handled below. */
const BANNED_WORDS: readonly string[] = [
  'fuck',
  'shit',
  'bitch',
  'cunt',
  'asshole',
  'bastard',
  'dick',
  'pussy',
  'nigger',
  'nigga',
  'faggot',
  'retard',
  'whore',
  'slut',
  'chutiya',
  'madarchod',
  'bhenchod',
];

/** Car-world words that contain or resemble a banned stem and must never be blocked. */
const ALLOWED_WORDS: readonly string[] = [
  'shitbox',
  'dickie',
  'cockpit',
  'scunthorpe',
  'shelby',
  'assetto',
];

const SUFFIXES = [
  '',
  's',
  'es',
  'er',
  'ers',
  'ing',
  'ed',
  'y',
  'ies',
  'head',
  'heads',
  'hole',
  'holes',
];

/** Lower-case, strip diacritics, map leet, collapse repeats ("fuuuck" → "fuck"), keep letters. */
export function normalizeForLanguageCheck(input: string): string[] {
  const folded = input
    .normalize('NFKD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .split('')
    .map((ch) => LEET[ch] ?? ch)
    .join('');
  // separators inside a word ("f.u.c.k", "f u c k") are an evasion: a run of single letters
  // joined by one or two non-letters is read as one word as well as letter by letter
  const tokens = folded.split(/[^a-z]+/).filter(Boolean);
  const spelled = Array.from(
    folded.matchAll(/(?:^|[^a-z])((?:[a-z][^a-z]{1,2}){2,}[a-z])(?=[^a-z]|$)/g),
    (m) => (m[1] ?? '').replace(/[^a-z]/g, '')
  );
  // "fuuuuck" → "fuck": three or more repeats of a letter collapse to one (double letters stay)
  return [...tokens, ...spelled].map((t) => t.replace(/(.)\1{2,}/g, '$1'));
}

function matchesBanned(token: string): string | null {
  if (ALLOWED_WORDS.includes(token)) return null;
  for (const stem of BANNED_WORDS) {
    for (const suffix of SUFFIXES) {
      if (token === stem + suffix) return stem;
    }
    // doubled-letter collapse may have shortened the stem's own double letters ("asshole" → "ashole")
    const collapsedStem = stem.replace(/(.)\1+/g, '$1$1');
    if (collapsedStem !== stem && token === collapsedStem) return stem;
  }
  return null;
}

/** Returns the banned stem found, or null when the text is clean. */
export function findBannedLanguage(input: string): string | null {
  if (!input) return null;
  for (const token of normalizeForLanguageCheck(input)) {
    const hit = matchesBanned(token);
    if (hit) return hit;
  }
  return null;
}

export function isCleanLanguage(input: string): boolean {
  return findBannedLanguage(input) === null;
}

/** Friendly copy for the inline error (never echoes the word back). */
export const CLEAN_LANGUAGE_ERROR = 'Please keep it friendly — that wording is not allowed here.';
