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

const HELP_CONTENT = {
  version: 2,
  basic: {
    quickStart: [
      'Browse → search tracks and mark what you own.',
      'Use + Set to build a Setlist.',
      'Open Profile → set DJ Name and Customize your look.',
      'Add a Stream URL + tap Go Live when you’re streaming.',
      'Open Friends / Bandmates (Online mode) to add friends.'
    ],
    sections: [
      {
        id: 'what_this_app_does',
        title: 'What this app does',
        bullets: [
          'Helps you browse Fortnite Festival tracks and plan mixes.',
          'Lets you mark Owned tracks and build a Setlist.',
          'Gives you a DJ Profile with Live Status and friends.'
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
          'Your Owned list also appears in Profile.'
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
        id: 'profile_basics',
        title: 'Profile basics',
        bullets: [
          'Open Profile to edit Username and DJ Name.',
          'Profile shows your avatar, bio, and Owned tracks.',
          'Click Save Profile to keep changes.'
        ]
      },
      {
        id: 'profile_picture_rules',
        title: 'Profile Picture Rules',
        bullets: [
          'Verified avatars are online-only and may pause to keep the app free.',
          'Local-only photos stay on your device and aren’t visible to others.',
          'Rejected images are not stored.',
          'Verified uploads require Online mode.'
        ]
      },
      {
        id: 'offline',
        title: 'Offline vs Online mode',
        bullets: [
          'Online mode syncs your Profile to Firestore.',
          'Offline mode uses cached tracks and local storage.',
          'Friends / Bandmates and search are disabled offline.',
          'Verified avatars require Online mode.'
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
        id: 'profile_customization',
        title: 'Profile Customization (Myspace vibe)',
        bullets: [
          'Customize gives your profile a Myspace vibe with colors, bio, and avatar.',
          'Changes save offline to local storage, and online to Firestore too.'
        ],
        steps: [
          'Go to Profile.',
          'Expand Customize.',
          'Set Bio (160 characters max).',
          'Pick a Theme Accent to change highlights.',
          'Use the Generated Avatar Builder: pick a palette, pick an icon (optional), and Randomize Seed for a new look.',
          'Click Save Profile.'
        ]
      },
      {
        id: 'avatar',
        title: 'Avatar (Generated + Local + Verified)',
        bullets: [
          'Generated Avatar Builder lets you choose a palette, icon, and seed.',
          'Local-only photos stay on your device and aren’t visible to others.',
          'Verified avatars are online-only and may pause to keep the app free.',
          'If Storage is not configured or you are Offline, verified upload is disabled.'
        ]
      },
      {
        id: 'friends',
        title: 'Friends / Bandmates',
        bullets: [
          'Find the Friends / Bandmates panel inside Profile.',
          'Search by DJ Name or username (prefix matches work).',
          'Add Friend sends a request; check Requests to Accept or Decline.',
          'Friends list lets you view profiles, see LIVE pills, and watch if live.',
          'Friends and search require Online mode; Offline shows a disabled message.'
        ]
      },
      {
        id: 'privacy_controls',
        title: 'Privacy Controls',
        bullets: [
          'Public Profile: turn off to hide from search.',
          'Allow Friend Requests: turn off to block new requests.'
        ]
      },
      {
        id: 'live',
        title: 'Live streaming + LIVE pills',
        bullets: [
          'Add a Stream URL (Twitch, YouTube, Kick).',
          'Live Status shows Go Live / End Live and needs a valid URL.',
          'The green LIVE pill appears on your profile and opens your stream.',
          'Friends may show a LIVE pill and a Watch button when streaming.'
        ]
      },
      {
        id: 'pagination',
        title: 'Pagination & Page Size',
        bullets: [
          'Use Previous / Next to flip pages in Browse and Profile owned tracks.',
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
          'Go Live disabled? Add a valid Stream URL.',
          'Setlist empty? Add tracks with + Set in Browse.',
          'Friends missing? Switch to Online mode and search again.',
          'Owned count looks wrong? Refresh or re-mark your Owned tracks.'
        ]
      },
      {
        id: 'sorting',
        title: 'Sorting / Matching',
        bullets: [
          'Top Matches are sorted by overall compatibility first.',
          'Tempo / Camelot / Genre decide how ties get nudged.',
          'Priority Strength changes how hard the tie-break nudge is.',
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
      id: 'verified_avatars',
      text: 'Verified avatars now support moderation and public display.'
    }
  ]
};

const WHATS_NEW = DEFAULT_WHATS_NEW.items;

window.APP_VERSION = APP_VERSION;
window.WHATS_NEW = WHATS_NEW;
window.FEATURE_FLAGS = FEATURE_FLAGS;
window.HELP_CONTENT = HELP_CONTENT;
window.DEFAULT_HELP_CONTENT = DEFAULT_HELP_CONTENT;
window.DEFAULT_WHATS_NEW = DEFAULT_WHATS_NEW;
