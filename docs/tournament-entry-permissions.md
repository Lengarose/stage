# Tournament entry, schedule consent and inbox fixes

Implemented locally on 14 November 2026. Not deployed; no live registrations or inboxes were changed.

## Behaviour

- Club players can read the schedule and rules and see their club's registration status. Registration, schedule acceptance and withdrawal belong to the club Manager; the server also rejects a player's withdrawal or consent request.
- The full published schedule is collapsed by default under **View playing schedule**.
- Register remains disabled until authenticated participation access has loaded and the current published schedule/rules revision has been accepted. This consent survives reloads. A published schedule is enforced even if a legacy tournament lacks its policy marker. Existing events with no schedule/policy retain their previous rules flow.
- The combined schedule/rules acceptance satisfies the pre-entry rules step; the Manager does not need a second rules acceptance for that same published schedule.
- Board correspondence is saved in the same transaction as club registration and Admin approval. The Manager receives the pending-entry message; on approval, the Manager and active club players receive confirmation, event details, good wishes and GameDay → Match Squad instructions. User-created tournaments also receive ordinary entry correspondence; tournaments never affect management salary or Card XP.
- The existing Board worker retries missed messages for active tournaments, including older registrations without a club-rules revision. Delivery identities prevent repeated messages.

## Causes found

The tournament page treated club membership as permission to show Withdraw and consent controls. Schedule acceptance was isolated inside its component and not connected to Register. Server schedule enforcement skipped older tournaments without the policy marker. Board delivery filtered out older entries, and the old approval mail used a tournament/club/status string longer than the inbox `related_entity_id` column. The mail error was swallowed while approval completed. The old team mail also instructed players to use the removed availability feature.

## Verification

- `node --test server/src/server/services/__tests__/tournamentEntryConsent.test.js` reproduced missing consent enforcement and skipped legacy Board notices before the fix.
- Schedule, registration, review and withdrawal regression tests pass.
- `node server/scripts/acceptance/tournament-entry-consent.cjs /private/tmp/stage-board-ui-fixture.json` passes against the dedicated local test MySQL instance with real JWT/HTTP routes: consent enforcement, role denial, persistent consent, pending/approved entry, actual inbox reads, and retry without duplicate mail. Disposable records are cleaned up.
- Browser verified the player view has no Withdraw/acceptance controls; schedule expands; Manager Register is disabled before consent and enabled after acceptance.
- Required lint/typecheck/server syntax checks and production build were run. Graphify update was attempted but the CLI is not installed.

## Deployment

Upload the changed backend files and deploy the rebuilt frontend together, then restart the Gandi Node app. No schema change is required. Recovery of live missed Board messages happens only after the updated backend/worker is running; live delivery has not been claimed as verified here.

## Approved withdrawal policy (14 November follow-up)

- **Before draw and first published kickoff:** immediate Manager withdrawal. Refund only captured `credits_spent` to `submitted_by_user_id` and `stc_locked` to the club, once. Free/Admin entries do not create refunds. Uncertain historical payments go to review.
- **After draw:** a reasoned request, with entry/fixtures still in force while pending. Only the tournament creator/organizer or Admin can approve/decline it.
- **During play:** the same request process, no automatic refund, no deleted or invented results. Approval marks the club withdrawn while preserving historical participation. Qualification and settlement pause for an explicit sporting resolution through existing fixture/Admin actions. Recording resolution requires affected fixtures to be definitive and cannot allow the withdrawn club to qualify or win. Financial exceptions remain separate explicit Admin decisions.
- Managers use **Withdrawal rules → Withdraw club / Request withdrawal** on the tournament page. Organizers use **Manage withdrawal requests**, with reasoned approval, decline and sporting-resolution recording. Status letters go to the Manager and organizer.
- **How to plan this tournament** is visible only to Admin/the tournament creator. Participants retain the playing schedule and applicable rules.
- Manager ownership has a narrow fallback for older schedule responses that omit permission capabilities; ordinary membership never grants controls, and explicit server denials remain authoritative.

Business actions: GET/POST `/tournaments/:id/withdrawals`, POST `/tournaments/:id/withdrawals/:requestId/respond`; the existing `tournamentWithdrawal` function delegates to the same service. Requests use the existing generic entity store; no new table/migration is required. Admin decisions are audited. Both the updated backend and frontend must be deployed together.

## Draw → start and approved reserves (14 November)

Built for club tournaments, whether created by a user or Admin. Player tournaments also receive the strict draw/start ordering; a player-tournament reserve queue was not requested.

- **Draw Fixtures** requires the full configured confirmed field. **Start Tournament** stays disabled until a saved draw matches that field. Server enforcement prevents direct API bypass. Starting never creates fixtures; repeated starts do not draw or send start notices again. Drawing now commits its fixtures under the tournament lock, with an Admin audit when applicable.
- A withdrawn club no longer counts toward the active field. Pending approvals occupy entry capacity but do not count as confirmed for drawing/starting. A vacancy or unresolved post-draw withdrawal blocks start.
- The tournament page includes collapsed **Reserve waiting list · how it works** and **Withdrawal rules**, readable by people who have not entered. Managers of other eligible clubs can use **Join reserve list · free** when places are full/reserved. Ordinary club members have no join/leave/withdraw authority.
- Queue order is stored as a monotonic sequence under the tournament lock. No organizer cherry-picking. An eligible club receives one exclusive invitation at a time. There is no waiting-list charge. The actual normal entry requirements, schedule/rules acceptance and fees are enforced when it registers.
- Invitations last up to 24 hours, shortened by the first scheduled kickoff and any configured earlier registration deadline. A published playing time takes precedence over a date-only tournament heading. The exact invitation deadline appears in the Manager inbox and tournament page in local time. The current application has no separate organizer-facing registration-deadline field; first kickoff/status closure is used in its absence.
- Expiry or decline advances to the next eligible waiting club. Ineligible entries retain a recorded reason. Leaving/rejoining goes to the back of the queue. Ordinary entries cannot bypass an exclusive invitation. A submitted entry awaiting Admin approval holds its place until decided; no second entry payment is taken for the queue itself.
- The worker runs every minute after startup migrations, using stored entries and a bounded rotating scan; read and registration actions also enforce expiry. It does not require the unrelated tournament-progression worker flag. UI invite status refreshes every minute while registration remains open.
- **After the draw:** withdrawing first requires organizer approval. The invited replacement completes normal entry and approval, then the organizer opens **Manage reserves → Review and confirm inherited fixture slot**. The modal lists the affected fixtures and requires a reason. The replacement inherits the exact group/bracket slot, home/away assignments, opponents, fixture IDs, rounds and published times. No redraw. Old Match Squads/preparations are cleared so no one inherits another club’s selected players. The original withdrawal and payment history remain recorded. A retry cannot apply the replacement twice. Managers of the replacement, opponents, outgoing club and organizer receive correspondence.
- **Once play starts:** no invitations or reserve replacements. Existing withdrawal/result-resolution rules apply; no inheritance of results. Frozen kickoff/live match activity and recorded stats prevent the pre-start replacement path from rewriting played activity.

### New actions and storage

GET/POST `/tournaments/:id/reserves`, POST `/tournaments/:id/reserves/:entryId/leave`, POST `/tournaments/:id/reserves/:entryId/replace-slot`.

`TournamentReserveModel` uses existing `league_entities` rows with `entity_type=tournament_reserve`; no table, migration or generic client entity was added. Mutations use the protected business-action routes. Admin slot confirmations and draws write audit history. Invitation correspondence is internal inbox mail, not an external email-delivery claim.

### Final verification of this addition

- `server/scripts/acceptance/tournament-reserves.cjs` passes using isolated MySQL, actual Express routes and JWT authentication. It exercises every new endpoint, FIFO/idempotence, free waiting, invitation Inbox reads, queue-jump denial, worker expiry, pending approval, organizer permission, exact-slot replacement, cleared preparations, start order and no post-start replacements. Disposable records are removed.
- The existing `tournament-entry-consent.cjs` HTTP script also passes after integration: stored consent, actual Manager/player Board inbox letters, ownership restrictions, original-payer refunds, requests and sporting resolution.
- Eight targeted legacy registration/start regressions and thirteen focused ownership/consent/withdrawal/start/cutoff tests pass. The broad legacy function suite was also attempted: it reports unrelated contract-fixture failures and a sandbox-blocked older HTTP test; it is not reported as fully passing.
- Browser checked the invited Manager page: Register disabled before consent, collapsed playing schedule, public reserve rules, exact invitation deadline, review link and Decline invitation. Screenshot: `output/playwright/tournament-reserves-2026-11-14/manager-invitation.png`.
- Lint, typecheck, backend syntax and production build pass. Graphify update remains unavailable (`graphify: command not found`). These are local changes; no production deployment or production data mutation was performed.
