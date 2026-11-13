# Club Board and Inbox — local implementation and walkthrough

12 November 2026. Production was not changed. No push, deployment, production reset or historical payout correction was performed.

## What changed and where to find it

- **Inbox:** restrained dark email reader, sharp frames, readable paragraphs, sender/recipient/date and review dialogs. Board review reads the live proposal and permitted actions. Counters remain separate from accepted pay. Polling no longer closes an open review merely because an older message status refreshes.
- **Inbox controls:** account-wide Mark All as Read; delete one message; delete related correspondence for the same recipient, sender and linked request. Deletion removes mail from the Inbox and retains a tombstone; it does not delete contracts, fixtures or financial evidence. Read/delete broadcasts retain the existing realtime channel.
- **My Club → Club Office → Contracts:** Board finance, active/scheduled agreements, proposals, objectives/evidence, recorded bonuses, payroll and arrears. Manager management/player pay is separate. Player amendments, renewals and termination use dedicated actions. Termination refreshes playing membership before removing a player from the displayed squad.
- **Transfer Market / player recruitment / Create Contract:** one versioned proposal form with server-provided Card bands and duration options. Squad importance is independent of salary. Trial is 14 days. Bonuses are capped and only offered for signings. Existing player objectives/captaincy can be included without inventing automatic extra payments.
- **Profiles, player cards and directories:** visible OVR badges and manual OVR inputs removed. Shared player cards display server Card Level; player profile shows XP progress. Historic database columns are retained. Display role terminology is Manager; compatibility identifiers and routes remain unchanged.
- **GameDay → Match Squad:** authorized representatives select eligible starters/reserves and declare goalkeeper/ANY before kickoff. Previous selection is a suggestion. Existing official readiness/freeze checks remain. No personal availability response is required.
- **GameDay → Report Result:** actual selected participants; human/AI/own-goal scorer choices; human/AI/no assist; no invented default match rating. AI and own goals do not credit human goals.
- **Create Tournament:** minimum 2–11 humans, goalkeeper requirement, ANY permission, written rules or template and existing rulebook attachment. Player-only tournaments do not receive club lineup rules.
- **Tournament rules and entry:** structured requirements in View Rules; server roster preflight before fees; published rule revision passed on registration. Schedule consent now captures structured club rules too, requiring renewed consent after a permitted pre-entry rule change.
- **Settings → How STAGE works:** compact six-step tutorial, maximum three useful points per slide. Registration explanations and page guides align with Board offers, Card progression and Match Squad.
- **Mobile GameDay:** explicit single-column grid and shrinking content constraints prevent the match list/detail from expanding beyond the viewport. Verified with populated data at 320 and 390 CSS pixels; the page remains vertically scrollable.

## What the Manager/player does versus automation

The Manager proposes ordinary player terms and confirms each Match Squad. Recipients review, counter, accept or decline their proposals. The Board controls personal management offers and validates the Manager’s playing terms. Accepted agreements, weekly payroll/arrears, official XP and trophy notices use the existing server workers; this UI does not invent payments or sporting outcomes. Tournament creators publish requirements and playing conditions; entrants accept the current conditions before paying.

## Verification actually completed

- Required lint and typecheck passed; backend entry syntax check passed; frontend build passed.
- Existing frontend suite: **483 passed**. Expectations for retired availability/self-assigned founder wages, Manager labels and Logout-only identity menus were updated to the approved behavior.
- Focused policy/controller/eligibility backend suite: **36 passed**.
- Existing scheduling/result negotiation suite: **13 passed**.
- Fresh isolated MySQL/JWT acceptance: **15 scenarios passed**, including versioned responses, decline/withdraw, active-term preservation, signing-bonus exactly-once accounting, weekly payroll/arrears, renewal scheduling, permission checks, roster publication, XP/revocation, real tournament creation and insufficient/sufficient roster entry, current rules consent, STC/credit charges and duplicate-entry protection.
- Additional actual HTTP walkthrough checks: 205-message bulk read, recipient isolation, conversation tombstones, contract options, roster preflight, public rules revision, payroll response and persistence after read/delete/reload.
- Visible browser: sign in with disposable Manager; management offer counter 5,000→6,000 STC while accepted pay stays zero; explicit acceptance at version 3; Club Office shows the active agreement; select three starters and required goalkeeper with ANY disabled; publish Match Squad; read tournament rules; open shortened tutorial; bulk read; both deletion controls; mobile offer and squad views.
- No new production endpoints were tested against production. Browser checks used the local API and disposable accounts.
- The full legacy Inbox scheduling/trial-action matrix, real PDF upload/download and every mobile route were **not exhaustively replayed** in this walkthrough. Existing components/tests remain, but this report does not claim those manual scenarios passed.
- `graphify update .` could not run: the `graphify` command is unavailable.

## Screenshots

Saved under `output/playwright/board-ui-2026-11-12/` (local artifacts, outside the production build):

- board-offer-desktop.png
- board-counter-pending.png
- board-accepted.png
- contracts-desktop.png
- inbox-mobile.png
- board-offer-mobile.png
- match-squad-confirmed.png
- match-squad-mobile.png
- tournament-rules-desktop.png
- tutorial-desktop.png
- gameday-mobile-width-fixed.png
- gameday-mobile-320.png

`responsive.html` runs the actual local app in a selectable phone-width iframe. It is a test harness, not a production page. Width evidence is retained alongside the screenshots. The visible walkthrough uses frontend port 4176 and isolated API port 18091; no production proxy is used.

## Material remaining limits

The earlier implementation handover’s unresolved policy limits remain: no invented position-weighted within-band salary formula; renewal counters outside the preserved approved opening remain restricted; GOST stays closed and its future official selection adapter must be connected before opening it. Historical bonus promises have not been paid or silently corrected. This report is not a declaration that the entire competition programme and every legacy path are fully signed off.

## Deployment requirements

Upload the changed backend controller/model/service/function/route files and synchronized `server/schema.sql` / startup migration file through the existing Gandi FTP/SFTP process, then restart the Gandi Node app so migrations run (including Inbox `deleted_at`). The fresh schema now also includes the existing migrated users.location and matches.timezone fields. Deploy the built frontend from `build/`. Do not upload the disposable acceptance harness as a production entry point. No new runtime package dependency was introduced. Existing socket event names are reused; no socket-server code change was required. Take the normal database backup and preserve historical payment/trophy evidence. No deployment was performed here.
