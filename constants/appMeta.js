// App metadata (single source of truth).
// When you ship changes, add a WHATS_NEW entry.
const APP_VERSION = '1.0.0';

const FEATURE_FLAGS = {
  setlist: true,
  liveProfile: true,
  offlineMode: true,
  statsTiles: true,
  ownedToggle: true
};

const DEFAULT_HELP_CONTENT = {
  version: 1,
  basic: {
    quickStart: [
      'Step 1: Browse tracks.',
      'Step 2: Click a track and hit + Set to add it to Setlist.',
      'Step 3: Click Setlist to view/remove tracks.',
      'Step 4: Open Profile → paste your Stream URL → toggle Go Live.',
      'Step 5: Click the bright green LIVE pill to open your stream.'
    ],
    sections: [
      {
        id: 'setlist',
        title: 'Setlist',
        body: [
          'Click + Set on a track to add it.',
          'Open the Setlist tab to see everything you picked.',
          'Remove a song with the ✕ button in Setlist.',
          'The count in Setlist (X) shows how many tracks are in your list.'
        ]
      },
      {
        id: 'live',
        title: 'Profile: Live Streaming',
        body: [
          'Open Profile and paste your Stream URL.',
          'Go Live stays disabled until the URL is valid.',
          'When live, the bright green LIVE pill opens your stream.',
          'Tap End Live when you’re done.'
        ]
      },
      {
        id: 'offline',
        title: 'Online vs Offline',
        body: [
          'Online means you’re connected and can sync normally.',
          'Offline means no connection; the app uses your last cached tracks.',
          'Some profile sync features may wait until you’re back online.'
        ]
      },
      {
        id: 'owned',
        title: 'Owned / Inventory',
        body: [
          'Owned X/Y shows how many tracks you marked as owned.',
          'Use Show All or ✓ Owned Only to switch views.',
          'Tap Mark Owned on a card to add it to your inventory.'
        ]
      }
    ],
    faq: [
      {
        id: 'go_live_disabled',
        q: 'Why is Go Live disabled?',
        a: ['Add a valid Stream URL first.']
      },
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
        id: 'sorting',
        title: 'Sorting / Matching',
        body: [
          'Top Matches are sorted by overall compatibility first.',
          'Tempo / Camelot / Genre decide how ties get nudged.',
          'Priority Strength changes how hard the tie-break nudge is.',
          'Mixable Only keeps just the safest key + tempo combos.'
        ]
      },
      {
        id: 'compat_hints',
        title: 'Compatibility Hints',
        body: [
          'Look for the 🎧 icon to spot tracks that are mixable with your selected song.',
          'The ±BPM chip shows how far the tempo gap is.',
          'Camelot and key pills help you see harmonic neighbors fast.'
        ]
      }
    ]
  }
};

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
    }
  ]
};

const WHATS_NEW = DEFAULT_WHATS_NEW.items;

window.APP_VERSION = APP_VERSION;
window.WHATS_NEW = WHATS_NEW;
window.FEATURE_FLAGS = FEATURE_FLAGS;
window.DEFAULT_HELP_CONTENT = DEFAULT_HELP_CONTENT;
window.DEFAULT_WHATS_NEW = DEFAULT_WHATS_NEW;
