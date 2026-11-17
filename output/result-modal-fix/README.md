# Result dialog and draw refund verification

17 November 2026. Screenshots use isolated demonstration data.

## Cause and fix
Scorer/assist Radix menus were portalled at z-index 50 behind the dialog overlay (80) and content (81). Reproduced with the actual GameDayResultDialog; the accessibility tree contained options while the screenshot showed no visible menu. Replaced these two controls with labelled native selects inside the dialog, preserving selected-squad players, AI, own goals and optional assists. Shared generated UI primitives were not changed.

The modal now uses Anton/Chakra Petch, blue accents, square panels, larger scores, accessible 44px inputs and responsive scrolling.

Also corrected self-assists surviving scorer changes, hidden goal events after manually changing the club score to zero, and amendment ratings being overwritten by asynchronous squad loading. Missing selected player records now show a load error rather than entering the rendered roster as null.

## Verification
- Browser: human scorer/assist selection, self-assist clearing, own-goal assist disabling, amended 7.0 ratings preserved, report payload with correct scorer/assist and derived player statistics, zero-goal event clearing; desktop and 390px phone layout.
- Existing wager tests: 7 passed.
- Isolated MySQL/JWT HTTP: arranged club and player wagers, three counter-proposals, acceptance, insufficient-funds rollback/retry, duplicate protection, and outsider denial. Unconfirmed 2–2 retains funded stakes; confirmed 2–2 refunds each original stake exactly once even after repeated requests. Existing finalization invokes the same settlement service; no payout policy change was required.
- Lint, typecheck, backend entry syntax, diff whitespace and production build passed.
- Graphify could not run because the command is not installed.

No production matches, money or accounts were changed. No deployment performed.
