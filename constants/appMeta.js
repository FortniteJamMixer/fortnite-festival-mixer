// App metadata (single source of truth).
// When you ship changes, add a WHATS_NEW entry.
const APP_VERSION = '1.0.0';

const FEATURE_FLAGS = {
  setlist: true,
  liveProfile: false,
  offlineMode: true,
  statsTiles: true,
  ownedToggle: true
};

const FEATURES = {
  OWNED_SYNC: false,
  PROFILE: false,
  PREVIEW: false,
  SANDBOX: false,
  HELP_POLISH: true
};

if (typeof window !== 'undefined' && typeof window.isFeatureOn !== 'function') {
  window.isFeatureOn = (name) => Boolean(FEATURES?.[name]);
}

const HELP_CONTENT = {
  version: 2,
  basic: {
    quickStart: [
      'Browse → search tracks and mark what you own.',
      'Use + Set to build a Setlist.',
      'Tune key mode + filters to refine your mix picks.'
    ],
    sections: [
      {
        id: 'what_this_app_does',
        title: 'What this app does',
        bullets: [
          'Helps you browse Fortnite Festival tracks and plan mixes.',
          'Lets you mark Owned tracks and build a Setlist.',
          'Keeps your library and settings stored locally.'
        ]
      },
      {
        id: 'browse_tracks',
        title: 'Browse tracks',
        bullets: [
          'Use Browse to search by title or artist.',
          'Tap a track card to see details and mix hints.',
          'Use filters to narrow down the list.'
        ]
      },
      {
        id: 'owned',
        title: 'Owned tracks',
        bullets: [
          'Owned X/Y shows how many tracks you marked as owned.',
          'Tap Mark Owned to add it, or ✓ Owned to remove it.',
          'Use Show All or ✓ Owned Only to switch views.',
          'Owned tracks persist locally on this device.'
        ]
      },
      {
        id: 'setlist',
        title: 'Setlist',
        bullets: [
          'Click + Set on a track to add it.',
          'Open the Setlist tab to see everything you picked.',
          'Remove a song with the ✕ button in Setlist.',
          'The count in Setlist (X) shows how many tracks are in your list.'
        ]
      },
      {
        id: 'offline',
        title: 'Offline vs Online mode',
        bullets: [
          'Offline mode uses cached tracks and local storage.',
          'Owned tracks and settings work the same offline.',
          'No cloud sync is required.'
        ]
      }
    ],
    faq: [
      {
        id: 'cant_see_setlist',
        q: 'Why can’t I see my Setlist?',
        a: ['Click the Setlist tab and check the count.']
      },
      {
        id: 'offline_mode',
        q: 'Why am I in Offline mode?',
        a: ['No connection; the app uses cached tracks.']
      },
      {
        id: 'owned_count_wrong',
        q: 'My Owned count looks wrong',
        a: ['Re-check owned selections or refresh the page.']
      }
    ]
  },
  advanced: {
    sections: [
      {
        id: 'pagination',
        title: 'Pagination & Page Size',
        bullets: [
          'Use Previous / Next to flip pages in Browse tracks.',
          'Change Page size to 12 / 24 / 48 / 96 tracks.',
          '“Showing X–Y of Z tracks” tells you how much you’re viewing.',
          'Pages replace long scrolling (no doom scroll).'
        ],
        steps: [
          'If you can’t find a track, use Search and flip pages.'
        ]
      },
      {
        id: 'troubleshooting',
        title: 'Troubleshooting',
        bullets: [
          'Setlist empty? Add tracks with + Set in Browse.',
          'Owned count looks wrong? Refresh or re-mark your Owned tracks.'
        ]
      },
      {
        id: 'sorting',
        title: 'Sorting / Matching',
        bullets: [
          'Top Matches are sorted by overall compatibility (key + BPM + genre).',
          'Mixable Only keeps just the safest key + tempo combos.'
        ]
      },
      {
        id: 'compat_hints',
        title: 'Compatibility Hints',
        bullets: [
          'Look for the 🎧 icon to spot tracks that are mixable with your selected song.',
          'The ±BPM chip shows how far the tempo gap is.',
          'Camelot and key pills help you see harmonic neighbors fast.'
        ]
      }
    ]
  }
};
const DEFAULT_HELP_CONTENT = HELP_CONTENT;

const DEFAULT_WHATS_NEW = {
  version: 1,
  items: [
    {
      id: 'setlist_fixed',
      text: 'Setlist is now functional.',
      requires: ['setlist']
    },
    {
      id: 'live_profile_stream',
      text: 'Profile supports Stream URL + LIVE status pill.',
      requires: ['liveProfile']
    },
    {
      id: 'offline_cache',
      text: 'Offline browsing uses your last cached tracks.',
      requires: ['offlineMode']
    },
    {
      id: 'stats_tiles',
      text: 'Stats tiles explain live/all-time activity.',
      requires: ['statsTiles']
    },
    {
      id: 'owned_toggle',
      text: 'Owned-only filters help narrow your collection.',
      requires: ['ownedToggle']
    },
    {
      id: 'help_refresh',
      text: 'Help modal got a cleanup for faster guidance.'
    },
    {
      id: 'persona_icons',
      text: 'Persona icons replace profile pics with themed DJ vibes.'
    }
  ]
};

const WHATS_NEW = DEFAULT_WHATS_NEW.items;

window.APP_VERSION = APP_VERSION;
window.WHATS_NEW = WHATS_NEW;
window.FEATURE_FLAGS = FEATURE_FLAGS;
window.FEATURES = FEATURES;
window.HELP_CONTENT = HELP_CONTENT;
window.DEFAULT_HELP_CONTENT = DEFAULT_HELP_CONTENT;
window.DEFAULT_WHATS_NEW = DEFAULT_WHATS_NEW;
