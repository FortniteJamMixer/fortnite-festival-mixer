// App metadata (single source of truth).
// When you ship changes, add a WHATS_NEW entry.
const APP_VERSION = '1.0.0';

const FEATURE_FLAGS = {
  setlist: true,
  liveProfile: false,
  offlineMode: false,
  statsTiles: true,
  ownedToggle: true
};

const HELP_CONTENT = {
  version: 3,
  basic: {
    quickStart: [
      'Browse tracks, search, and mark Owned.',
      'Use Owned-only to focus your library.',
      'Add tracks to Setlist and manage them in Setlist view.',
      'Select a track to unlock Mixable-only matches.',
      'Open Profile to check owned counts and bandmates.'
    ],
    sections: [
      {
        id: 'mixer_basics',
        title: 'Mixer Basics',
        bullets: [
          'Browse the full Fortnite Festival catalog in the Browse view.',
          'Select a track to see mix hints and compatibility chips.',
          'Use Setlist to collect ideas for a session.'
        ]
      },
      {
        id: 'owned',
        title: 'Mark Owned',
        bullets: [
          'Click the Owned toggle on any track card to save it.',
          'Owned tracks are stored locally and sync to cloud when signed in.',
          'Epic doesn’t share ownership, so you must mark tracks manually.'
        ]
      },
      {
        id: 'owned_filter',
        title: 'Owned-only filter',
        bullets: [
          'Use Owned-only in Browse to show just your saved library.',
          'Owned-only works with Search and Sort to narrow your list.'
        ]
      },
      {
        id: 'search',
        title: 'Search',
        bullets: [
          'Search by title or artist from the Browse view.',
          'Clear Search to reset filters quickly.'
        ]
      },
      {
        id: 'setlist',
        title: 'Setlist',
        bullets: [
          'Click + Set on a track to add it.',
          'Remove a track from Setlist with the ✕ button.',
          'The Setlist tab shows your current picks.'
        ]
      },
      {
        id: 'camelot_bpm',
        title: 'Camelot & BPM',
        bullets: [
          'Camelot is the harmonic key wheel; same key or adjacent numbers mix best.',
          'Compatible keys usually match the same number or ±1 on the wheel.',
          'BPM tips: keep tempos close, or use half/double-time for big jumps.'
        ]
      },
      {
        id: 'mixable',
        title: 'Mixable Filter',
        bullets: [
          'Mixable filter requires a selected track first.',
          'It highlights the safest tempo + key matches for smooth transitions.'
        ]
      },
      {
        id: 'bandmates',
        title: 'Bandmates',
        bullets: [
          'Add a bandmate by username from Profile.',
          'Bandmates are read-only; you can view their collections.'
        ]
      }
    ],
    faq: [
      {
        id: 'owned_count_wrong',
        q: 'Why does my Owned count look off?',
        a: [
          'Owned counts are based on the current track list. If tracks change, re-check your Owned selections.'
        ]
      },
      {
        id: 'mixable_needs_track',
        q: 'Why is Mixable empty?',
        a: ['Select a track first, then enable Mixable to see compatible matches.']
      }
    ]
  },
  advanced: {
    sections: [
      {
        id: 'camelot_compat',
        title: 'Camelot compatibility basics',
        bullets: [
          'Same number + same letter is a safe harmonic blend.',
          'Move +1 or -1 on the Camelot number for a smooth shift.',
          'Swap A/B on the same number for relative major/minor.'
        ]
      },
      {
        id: 'bpm_tips',
        title: 'BPM tips',
        bullets: [
          'Aim for small tempo gaps (±4–6 BPM) for clean transitions.',
          'Half/double-time mixing can connect wider BPM differences.'
        ]
      }
    ]
  }
};
const DEFAULT_HELP_CONTENT = HELP_CONTENT;
const HELP_LAST_UPDATED = '2026-01-24';

const DEFAULT_WHATS_NEW = {
  version: 2,
  items: [
    {
      id: 'profile_refresh',
      text: 'Profile now focuses on DJ name, owned tracks, and bandmates.'
    },
    {
      id: 'owned_toggle',
      text: 'Owned-only filters help narrow your collection.',
      requires: ['ownedToggle']
    },
    {
      id: 'help_refresh',
      text: 'Help modal now documents only working features.'
    }
  ]
};

const WHATS_NEW = DEFAULT_WHATS_NEW.items;

window.APP_VERSION = APP_VERSION;
window.WHATS_NEW = WHATS_NEW;
window.FEATURE_FLAGS = FEATURE_FLAGS;
window.HELP_CONTENT = HELP_CONTENT;
window.DEFAULT_HELP_CONTENT = DEFAULT_HELP_CONTENT;
window.HELP_LAST_UPDATED = HELP_LAST_UPDATED;
window.DEFAULT_WHATS_NEW = DEFAULT_WHATS_NEW;
