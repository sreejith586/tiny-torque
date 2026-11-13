// Known issues shown at /legal/known-issues (MV-S10-08, pilot ops kit). Plain data so updating
// the page is a one-file edit: add / remove an item, bump KNOWN_ISSUES_UPDATED. Keep every entry
// true to the product as deployed — an item leaves the list in the PR that fixes it.

export interface KnownIssue {
  title: string;
  detail: string;
}

export interface KnownIssueGroup {
  area: string;
  items: KnownIssue[];
}

export const KNOWN_ISSUES_UPDATED = '12 November 2026';

export const KNOWN_ISSUES: KnownIssueGroup[] = [
  {
    area: 'Signing in',
    items: [
      {
        title: 'Email codes first',
        detail:
          'sign-in is by a code sent to your email for now. Mobile-number sign-in comes later in the pilot.',
      },
      {
        title: 'You land on your garage after signing in',
        detail:
          'if you opened a link while signed out, you are taken to your garage after the code, not back to that link. Open the link again.',
      },
    ],
  },
  {
    area: 'Scanning',
    items: [
      {
        title: 'Out of scans',
        detail:
          'when your scans run out the scan screen shows an error instead of the options to get more. Add the car by hand until your allowance comes back.',
      },
      {
        title: 'Check what the scan suggests',
        detail:
          'the scan proposes brand, model and series from the photo and can be wrong, especially on loose cars and group photos. Edit before you save.',
      },
    ],
  },
  {
    area: 'Tokens and Pro',
    items: [
      {
        title: 'Buying tokens is not open yet',
        detail:
          'the token store is visible but purchases are switched off until payments go live. Choosing a pack shows a message and nothing is charged.',
      },
    ],
  },
  {
    area: 'Marketplace and deals',
    items: [
      {
        title: 'Deals are settled between collectors',
        detail:
          'there is no in-app payment or shipping for cars. Read "Offline deals" under Settings › Legal before your first deal.',
      },
      {
        title: 'Listings expire',
        detail:
          'a listing leaves the market when its time runs out; renew it from My listings › Expired.',
      },
    ],
  },
  {
    area: 'App',
    items: [
      {
        title: 'Offline is read-only',
        detail:
          'without a connection you can look at the last garage page you opened, nothing else. Changes need a connection.',
      },
      {
        title: 'Faint panel outlines in dark themes',
        detail:
          'card borders are subtle in the four dark themes; the content itself meets contrast.',
      },
    ],
  },
];
