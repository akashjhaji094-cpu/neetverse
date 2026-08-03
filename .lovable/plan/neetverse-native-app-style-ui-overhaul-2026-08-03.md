# NEETVerse — Native App-Style UI Overhaul

Goal: rebuild the whole interface to match the uploaded NEETVerse mockups so it feels like an Android app, not a website. Mobile is the priority; tablet and desktop scale up cleanly.

## Design system (foundation, done first)
- Indigo/violet brand palette from the mockups: primary `#5B4BE8`-family indigo, soft lavender surfaces, white cards, subtle purple-tinted page background. Success green, warning amber, danger red for palette/answer states.
- Rounded-2xl cards, soft diffuse shadows, generous padding, no heavy borders.
- Typography: bold tight headings, medium-weight body — matching the mockup's clean geometric sans.
- All values as semantic tokens in `index.css` + `tailwind.config.ts`, light and dark variants. No hardcoded colors in components.
- Remove the current 3D tilt/rotate hover effects in favour of app-native press/scale feedback.

## App shell (biggest structural change)
- Mobile/tablet: fixed bottom tab bar — Home, Practice, Test, Analytics, More — with active-tab indicator, exactly as in the mockups. "More" opens a sheet with Notes, PYQs, Revision, Leaderboard, Referral, Settings, Admin.
- Mobile top bar: compact NEETVerse logo + notification bell with badge.
- Desktop/laptop: keep a refined left sidebar (redesigned to the new tokens), no bottom bar.
- Page transitions and tab switches get short native-feel motion; safe-area insets respected.

## Screens redesigned to the mockups
1. **Landing** — hero "Smart Prep. Better Scores. Top Ranks.", trust badge, dual CTA, feature strip, stats band.
2. **Auth** — "Fast. Secure. Hassle-free Access.", Login/Sign Up segmented toggle, Google button, trust strip.
3. **Dashboard** — greeting card with mascot, 3 stat tiles (streak / daily goal / study time), streak banner, Performance Overview with score-trend chart, Upcoming Tests list, Quick Actions icon row.
4. **Practice** — subject pills, chapter cards with question count + accuracy ring, Practice Settings grid, big Start button; in-test view with timer header, lettered option cards, correct/incorrect states, question number grid.
5. **Test / Full Syllabus** — exam header (time left, X/180), subject tabs, option cards, Mark for Review, side/sheet palette with colour legend and Submit.
6. **Custom Test Builder** — numbered steps: subjects → chapters → question count stepper → difficulty → time limit → Test Preview → Create Test.
7. **Analytics** — Overview/Subjects/Chapters/Tests tabs, gradient summary card, score trend line, accuracy bars, time donut, weak-chapter cards.
8. **Premium** — Pro hero, feature list, Free vs Pro comparison table, ₹999 struck through to ₹499 plan card.
9. **Referral** — code card with copy, share row, earnings tiles, How It Works steps.
10. **Notes / PYQs / Revision hub** — banner card, filter chips, content cards with badges, bookmarks.
11. Remaining screens (Leaderboard, Mistake Book, Test History, Weak Chapters, Settings, Account, Adaptive, Battle Arena, QP-to-CBT, Admin) restyled to the same tokens and shell.

## Responsiveness
- Mobile: single column, bottom tabs, large tap targets, thumb-reachable primary actions.
- Tablet: two-column grids, wider cards, bottom tabs retained.
- Desktop: sidebar + multi-column dashboards, max-width content.

## Technical notes
- New `src/components/layout/BottomNav.tsx` and `MobileTopBar.tsx`; `DashboardLayout` switches shell by breakpoint via `useIsMobile`.
- Shared primitives added: `StatTile`, `SectionHeader`, `AppCard`, `PillTabs`, `OptionCard`, `QuestionPalette` — reused across screens so styling stays consistent.
- Only presentation changes: all data hooks, RPCs, scoring, gating and edge functions stay untouched.
- Illustrations/mascots recreated as generated assets rather than embedding the mockup screenshots.

## Order of work
1. Tokens + shell (bottom nav, top bar, sidebar) — visible everywhere immediately.
2. Dashboard, Practice, Test — core daily screens.
3. Analytics, Premium, Notes/PYQs/Revision, Referral, Auth, Landing.
4. Remaining secondary screens + full mobile/tablet/desktop pass.

Send the other 7 mockups whenever ready — screens not yet covered will be matched to them in step 3/4.
