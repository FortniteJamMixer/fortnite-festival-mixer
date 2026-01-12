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

const WHATS_NEW = [
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
];

window.APP_VERSION = APP_VERSION;
window.WHATS_NEW = WHATS_NEW;
window.FEATURE_FLAGS = FEATURE_FLAGS;
