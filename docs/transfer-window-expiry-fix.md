# Transfer-window status and reopening

## Cause

The reported contradiction is reproducible with the same `end_date = 2026-11-15 00:00:00` and a fixed time later that morning. The old UTC server parsed that SQL DATETIME as midnight and extended it through 23:59:59. A Brussels browser parsed it locally (23:00 UTC the previous day), did not recognize it as UTC midnight, and showed Closed. The server therefore rejected the replacement with “A transfer window is already open.” This does not require stale browser data.

## Fix

- Transfer windows store their timezone. Existing records default to Europe/Brussels, matching the application's existing wall-clock convention. Fresh schema and startup migration include the column.
- Closing times are exact, including midnight; there is no implicit extra day.
- The shared backend service returns offset-aware dates and a computed window state. Club operations use this same service rather than a second copy of the old date logic.
- Every expired open row is closed before selecting an active window. Database errors surface instead of pretending there is no window.
- Open/close actions validate stored Admin permissions and write before/after audits. Opening locks the global window range transactionally; duplicate/concurrent opens return conflict rather than creating two active windows. Scheduled windows reserve their slot until cancelled or expired.
- Admin status updates as deadlines pass. Scheduled status is shown separately; failed loads display Retry instead of Closed. The form explains the timezone, midnight deadline and contract flow.

## Flow

The window has one global closing instant. The Transfer Room hero shows its deadline in the viewer's local timezone. Above the player directory, a deadline panel repeats the local time and the Admin window's reference timezone, with an expandable list for Brussels, London and four North American zones. Dates and UTC offsets are included; daylight saving is calculated for the closing date. No separate regional windows are created. Client status updates at the start/end boundary without requiring a reload.

The Transfer Room lists free agents and players in the final 14 days of an agreement. Managers propose contracts, rather than buying players. Players respond in Inbox. Acceptance still follows the current agreement's effective dates, finances and sporting eligibility; opening a manual window does not bypass those rules. Future agreements cannot move a contracted player before their existing agreement ends. The explicit Execute Pending action handles legacy accepted window-waiting contracts only while a window is actually open.

## Evidence

`server/scripts/acceptance/transfer-window-expiry.cjs` runs against a new disposable local MySQL schema, using JWT and the real function endpoint. Before the fix it fails with the exact Closed/already-open mismatch. Afterward it passes expiry/reopening, multiple expired records, exact deadline boundaries across browser zones, genuine duplicate refusal, manual close, invalid dates, Admin restrictions, audits and concurrent opens.

The existing execute-pending controller test and eight related frontend/market tests also pass. Lint, typecheck, backend syntax and frontend build were checked. `graphify update .` is unavailable because the CLI is not installed.

No production windows were opened or closed. Upload the changed backend files and restart the Gandi app to apply the timezone migration; upload the frontend build as usual. Both sides need the update for the reported mismatch to disappear on the live website.
