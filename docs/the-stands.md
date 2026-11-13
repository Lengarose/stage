# The Stands

Find it in **Discover → The Stands**, or open `/the-stands`. Admin can find the same page through Community. The mobile Discover menu uses the same destination.

- **Live now** shows matches marked in progress. A shared stream URL is not evidence that its provider is currently live.
- **Upcoming** lists announced fixtures. A spectator can opt into an in-app reminder around 15 minutes before kickoff.
- **Featured** includes finals, semifinals and playoffs, plus matches selected by Admin in the match centre.
- **All matches** supports searching clubs, players and tournaments, and filtering by competition edition.
- **Rankings** compares exact-score accuracy within one edition. Five settled predictions are required to rank. Accuracy comes first, followed by exact predictions; equal records share a rank.
- **My predictions** shows the signed-in user's prediction history.

## Match centre and streams

GameDay's existing home/away stream URL fields feed the directory and match centre automatically. A spectator never receives private GameDay submissions, proof, contacts, squad controls or financial information through the Stands endpoints.

The tiles and match-centre header reuse Schedule → Fixtures' split-photo, diagonal-slash, smoky background.

Playback starts only after clicking Watch. Twitch and YouTube URLs use dedicated provider embeds. Unsupported or blocked embeds can be opened on their provider; arbitrary supplied HTML is never rendered here. No video files are uploaded or stored.

Provider references: [Twitch video embeds](https://dev.twitch.tv/docs/embed/video-and-clips/), [YouTube embedded players](https://developers.google.com/youtube/player_parameters).

## Predictions

Predictions carry no stakes, points, credits, STC, XP, salary effects or rewards. They use separate `stands_*` records in `league_entities`, not the old points-based predictions table. The old `/predictions` page redirects to Stands rankings.

The authenticated server identity determines the predictor. One saved prediction per user/match is enforced through a deterministic record ID and a locked match transaction. Predictions can change before closing; peers' guesses are hidden until closing. The first saved cutoff is retained so moving a kickoff later does not reopen a closed prediction window. An early actual start closes predictions immediately.

Eligibility checks include the player's own match, current club, active membership, playing/management agreement, club owner/manager, staff and published/saved match selections. A starting-lineup omission does not bypass club affiliation. Participation during the match is excluded from rankings using saved selections and dated contract/membership evidence; joining a club after an old match does not invalidate a legitimate old prediction.

Cancelled, voided and administrative-forfeit matches are excluded. Disputed/unconfirmed results remain pending. Confirmed non-knockout results settle dynamically, so corrections update accuracy without reward transactions.

**Normal time means 90 minutes, excluding extra time and penalties.** Current knockout reports do not reliably separate that score. In the match centre, Admin can record a verified normal-time score and its verification source, with an audit row. This affects predictions only. Until then, knockout guesses stay pending. A later result correction invalidates the old verification and requires a fresh one.

## Admin and deployment

In the match centre's STAGE editorial controls, Admin can feature/unfeature a match and verify its normal-time score. Removing an editorial feature does not suppress an automatically featured final/playoff. Both operations require server-side Admin permission and write an audit record.

Deploy the frontend build and the new backend files together, then restart the backend. The reminder worker starts after startup migrations. There are no new tables or schema migrations. This implementation has not run a production repair or modified live matches.

Spectator chat, reactions, highlights/replay uploads and betting are outside this version.

## Verification

- `node --test server/src/server/lib/__tests__/standsPolicy.test.js`
- `node server/scripts/acceptance/the-stands.cjs /private/tmp/stage-board-ui-fixture.json`

The acceptance runner refuses production database names and uses the named local acceptance socket. It creates disposable records and removes them afterwards. It covers authenticated privacy/eligibility, identity spoofing, concurrent updates, kickoff locks, reminders, ranking corrections, forfeits and history.

Graph maintenance: `graphify update .` was attempted, but the Graphify executable is unavailable in this environment.
