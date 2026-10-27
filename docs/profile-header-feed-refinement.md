# Player And Club Profile Refinement

## Result

- My Profile, Player Profile and club profiles use the same thin cyan/blue light
  streak, with tapered gradient ends and a restrained glow.
- The divider is local to the banner, pointer-events:none, and has a clear
  segment matching the overlapping 168px/208px card. Transparent artwork cannot
  expose a line through the card. Card geometry and crop controls are unchanged.
- Names and unframed metadata are now inside the banner flow, above the divider.
  The verified gaming handle is directly below the player tags, formatted as
  `PS5 - handle`. On narrow screens and desktop this block is beside the
  overlapping card; the banner grows naturally for wrapping text. The card
  retains its original 168px/208px width, 4:5 proportions and banner overlap.
- Position/platform/country text has no individual background, border or pill.
  Club platform/region/country/member-count text follows the same convention.
  Verification badges, club tags, role badges and record badges are retained.
- Only My Profile's redundant banner notification button was removed. Its
  notification view/service remains, as does the global NotificationBell.
  Club profiles had no banner notification bell; the separate chat-mute bell
  was deliberately retained.
- Player and club feeds have square composers, media previews, post tiles,
  empty/error states, local post-viewer frames and action buttons. Avatars stay
  circular. Post uses a dark surface, thin cyan border, cyan text/send icon,
  keyboard focus and disabled/submitting states.

## Platform Labels

`formatProfilePlatform` is display-only. Generic PlayStation maps to PS5 because
the application explicitly routes its PlayStation option to common-gen5 in
eafcClient. Explicit PS4/PlayStation 4 remains PS4. Xbox family aliases display
Xbox; PC/Windows display PC. Explicit crossplay/Cross-Platform stays
Cross-Platform. Unknown values (including common-gen4/common-gen5 and PSN) remain
truthful raw labels, not guessed hardware. Stored identity/matchmaking values,
filters and authentication are unchanged. Header handles and the club card use
the same display helper.

## Feed Integration

Inspection found Post.subscribe is a compatibility no-op for these feeds, so a
successful create previously did not reliably refresh the list. Both feeds now
insert the returned server record and deduplicate its ID against subscription
events. No client-authoritative likes/comments or backend changes were added.

Upload/load failures previously had no catch/finally recovery. They now show
errors and restore loading controls. Uploading also disables submission; empty
posts remain rejected. Owner-only player composition and member-only club
composition remain controlled by the existing permission props and routes.

## Changed Files

- src/components/profile/gamer/GamerProfileHero.jsx
- src/components/profile/gamer/GamerClubProfileHero.jsx
- src/components/profile/gamer/GamerClubCard.jsx
- src/components/profile/gamer/ProfileBannerDivider.jsx
- src/components/profile/gamer/ProfileBannerIdentity.jsx
- src/pages/Profile.jsx
- src/pages/PlayerProfile.jsx
- src/components/PlayerFeed.jsx
- src/components/ClubFeed.jsx
- src/components/feed/FeedPostModal.jsx (opt-in square variant)
- src/lib/profilePlatform.js
- src/lib/__tests__/profilePlatform.test.mjs
- scripts/profile-header-qa.html (isolated real-route fixture)

No global navigation, generated UI primitive, trophy cabinet, subscription
panel, Command Overview styling or backend was modified.

## Verification

Local browser fixture: /scripts/profile-header-qa.html on the running Vite
server at http://127.0.0.1:5194. Query options include view=owner, view=public,
view=club&member=1, view=club&member=0, state=populated/loading/error,
platform=PS4 and theme=light. This fixture has a simple test toolbar, not a
replacement global navigation, and mocks API/auth/upload calls.

Browser checks performed:

- Actual My Profile, Player Profile and ClubDetail components were mounted.
- Desktop and 390px mobile player/club metadata measured above the divider,
  with no main-content horizontal overflow. Player handle was also above it.
- Divider gap matched the actual card's horizontal bounds on desktop/mobile.
- Transparent PNG artwork rendered without a line crossing the card.
- Player owner composer: empty disabled, text create and immediate refresh,
  image-only upload/create, visible publish failure with retained draft, and
  upload failure recovery. Player post viewer opened with its square variant.
- Public player: no composer/Edit Profile; explicit PS4 stayed PS4 in both header
  labels. Public loading and load-error states rendered correctly.
- Club member: composer available; text create refreshed immediately; empty
  submit disabled. Nonmember: no composer/Edit Club; PS4 preserved.
- Club mobile light-theme composer/Post control remained readable, square, and
  free of horizontal overflow. Physical touch/trackpad hardware was not tested.
- Global NotificationBell component rendered its unread count in the fixture;
  its source and destination remain unchanged. Production notification delivery
  was not tested. Public moderation and actual persisted uploads/posts were not
  exercised against a real authenticated backend.

The browser session was interrupted during some checks; fresh local tabs were
used to verify the final tag/handle alignment and club nonmember permissions.

Checks: lint, typecheck, server syntax and production build pass. The 12 focused
platform/feed-media/profile-tab tests pass. Full frontend suite: 394/398 pass;
the same four pre-existing failures remain (header identity menus, FUT photo
frame, GameDay club loading, profile photo preview). graphify update . could not
run because the CLI is absent; graph report/wiki are absent too.

Deployment is frontend-only: upload the new build/ output to Gandi. No migration
or backend restart is required for these changes. No production data was changed
and nothing was deployed.

## Follow-Up: Identity Beside The Original Card

The latest request supersedes the earlier mobile card-first option. Player and
club identity now share a responsive inset beside the original card. Names,
metadata and player handles remain above the divider. Cards are not scaled or
moved into the banner: the existing negative margins and divider gap remain.
Long names and handles wrap rather than widening the page. Owner edit actions
retain their original handlers and minimum 44px target. DRC is a display-only
short label; full country selectors and canonical codes are unchanged.

Follow-up checks: lint, typecheck, server syntax, production build and all nine
focused country/platform/profile-tab tests pass. The local fixture uses mocked
API data; no production writes or deployment occurred. Graphify remains
unavailable in this environment.
