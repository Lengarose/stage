# GameDay Redesign: Implementation and Verification

## Local Implementation

- Kept global navigation, configured banner artwork, tile customisation and portrait frames. Shortened the banner modestly; square surrounding panels, category accents, independently scrollable match list and normally scrolling page.
- Arrange Game, Live Stream and Chat are frameless actions with focus/hover treatment. The report action is now a compact cyan flag and "Report Result" label, not a red full-width button, following the latest feedback.
- Search, General/GOST/Regional/Tournament/Friendly scopes and All/Upcoming/Live/Completed filters combine. Selection moves to the first visible record or an empty state. Scoped paginated server data enriches existing identity loaders. Stale loads are cancelled/version-checked.
- Head-to-Head uses permanent player/club pairs, either home/away order, confirmed outcomes only, stable source identities and edition IDs. It excludes the selected logical match and later matches when kickoff chronology is available. Distinct legs remain separate. Forfeits and penalty winners use recorded outcomes. Undated history is labelled honestly. Archived tournaments retain their canonical matches.
- Highlights has separate persistent publication records. Private result proof is never copied into this API. Explicit participant/admin binary uploads support JPG/PNG/WebP only, signature/envelope validation and 10 MB limits. Same-match hashes are unique. Removal is uploader/moderator-only, soft-removes the publication, and removes the stored public image. Admin publication/removal writes an audit. Reads use existing trusted participant/club identity access; this does not introduce a public spectator directory.
- Result reporting reuses the existing form, participation/GK/award fields and result handlers in a centred Radix dialog. Header/footer remain visible and the body scrolls. It freezes the match ID, warns on dirty close, preserves failed input, disables submitting/uploading duplicates and checks fresh state before submission. Read-only completed reports show recorded statistics. Distinct component keys prevent report/insights collisions.

## Penalty Correction

The reproduction showed that the old normaliser erased a valid winner whenever the individual leg was not drawn. Server policy now resolves permanent identities, actual stage, deciding leg, configured tournament legs and confirmed prior-leg results. The 2-1 return leg with a 3-3 aggregate retains the selected penalty winner. A drawn first leg, nonlevel aggregate or league/group phase rejects a shootout; missing first-leg evidence blocks completion explicitly.

Ordinary scores, derived aggregate totals and penalty decisions are separate. Confirmation preserves the proposed decision; changing the decision with unchanged goals is a correction rather than implicit confirmation. Finalisation revalidates inside the existing transaction. Native competition-engine agreement compares penalty decisions too and locks finalisation. Existing whole-round club draws, player bracket progression and downstream conflict checks remain in place. The archive's narrow score-only edit refuses competition ties and directs administrators to the existing correction/review workflow.

The shared label is used in GameDay, reports, Head-to-Head, tournament stage lists/previews/modals, brackets, league competition stages, Schedule match details and admin archives. Competition serializers retain the fields. Historical aggregate values are not fabricated or mass-backfilled.

## Persistence and Deployment

- `server/schema.sql` and startup migrations both create `match_highlights`, its match/hash uniqueness constraint and publication index.
- Both add nullable `matches.aggregate_home_score` and `aggregate_away_score`. No financial or trophy schema/settlement changes.
- New frontend entity: `MatchHighlight`; generic editing is refused in favour of explicit publication/removal actions.
- New authenticated routes: `GET /game-day/matches`, `GET /game-day/:id/history`, `GET /game-day/:id/penalties`; `GET /match-highlights`, `GET /match-highlights/:id`, `POST /match-highlights/publish/:matchId`, `DELETE /match-highlights/:id`. Generic POST/PATCH return 405.
- Upload the changed/new backend controllers, services, model, library, route registration, functions, schema and startup migration files via Gandi FTP/SFTP. Restart the backend explicitly in the Gandi console so migrations run. FTP alone does not restart Node.
- Upload the complete new `build/` frontend output. No new dependencies or socket-server changes are required. Preserve uploads and host secrets. No deployment or live mutation was performed.

Changed frontend areas: `GameDay.jsx`, GameDay card/detail/arena/result components, new Insights and ResultDialog, `gameDayHub`, `penaltyOutcome`, stage/bracket/schedule/archive result displays and `stageClient`. Backend changes are concentrated in penalty policy/negotiation/finalisation, GameDay read views and screenshot publication. The local-only QA harness is `scripts/gameday-qa.html`; its sample records/images are not production content.

## Verification

- `npm run lint`: pass.
- `npm run typecheck`: pass.
- `node --check server/src/server.js`: pass; competition engine syntax check also passes.
- `npm run build`: pass; existing large-chunk and old Browserslist warnings remain.
- Focused policy, aggregation/history, engine, progression and filtering tests: 60/60 pass.
- Local HTTP integration test: pass. Exercises all new route paths, validation/401/403/404/405, history privacy, image signature/size rejection, duplicate publication, removal and moderation audit using isolated database/identity seams and temporary storage.
- Full backend suite: 692/696 pass. Four existing failures: legacy captain profile edit; legacy fixture snapshot creation; tournament registration proof expectation; startup migration export source regex.
- Full frontend suite: 404/408 pass. Four existing failures: header identity menu source expectation; FUT avatar frame source expectation; GameDay club/president loader source expectation; profile-photo preview source expectation.
- Browser checks at 1440x1000, 390x844 and 320x740: combined filters and selection, empty state, report opening, dirty-close warning, retained score after controlled failure, fitted modal bounds, long club-form wheel scrolling and full-size highlight viewer. Fixed the component-key collision and 320px modal width found during these checks. Latest compact report action opens the same modal.
- `git diff --check`: pass.
- `graphify update .`: unavailable (`graphify` not installed). `graphify-out/` is empty, so no report/wiki was available.

## Unverified or Limited

Local `server/.env` and `server/src/constants/env.local.js` are absent. New APIs were exercised over real local HTTP with injected, isolated database/identity seams, not against a configured MySQL application. Startup migrations, real authenticated account flows, physical MySQL concurrency/locks and live deployment remain unverified. Nothing here claims the production environment is updated.

Older matches without reliable IDs, source links, confirmed prior legs or chronology cannot be repaired by guessing. Head-to-Head omits unavailable chronology from a dated comparison; penalty reporting returns a blocking reason for missing prior-leg evidence. Media validation checks supported binary formats/envelopes, not a full image codec decode/re-encode. No new away-goals, extra-time or historical lineups were invented. Existing configured extra-time requirements must already be represented by the application before penalties are accepted.
