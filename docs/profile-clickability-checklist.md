# Profile Clickability Regression Checklist

Use this checklist when validating Profile interactions (especially in Edge).

## Manual checklist

- [ ] Edit Mode toggle switches on/off and inputs enable/disable.
- [ ] Edit Profile (persona/avatar) opens editor; keyboard Enter/Space activates it.
- [ ] Theme/Energy pills update and remain clickable after re-render.
- [ ] Inputs focus on click/tap and accept typing.
- [ ] Save persists changes and shows success state.
- [ ] Cancel/Back returns to the expected view.
- [ ] Friend search/bandmate search buttons respond.
- [ ] Tags/pills respond to taps on mobile (≥44px hit target).
- [ ] No console errors when clicking rapidly across the Profile UI.
- [ ] Navigating away/back (Profile → Mixer → Profile) keeps buttons responsive.
- [ ] Works online + offline (no dead UI).

## Debug logging spot-checks

- [ ] With `DEBUG_UI = true`, `elementFromPoint` matches the clicked target.
- [ ] Any interception logs explicitly identify the overlay and class name.
