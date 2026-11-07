# Competition navigation and operation guide — 7 November 2026

This describes local implementation. Deployment and live verification have not
happened. The whole eight-phase programme is not finished; consult
`competition-delivery-status.md` for missing code and undecided policy separately.

## Where participants find things

| Location | What to do |
| --- | --- |
| Regional Leagues (`/leagues`) | Browse supported regional systems, divisions and groups. Open the same permanent league across editions. |
| League detail (`/leagues/:slug`) | Select a season. Overview shows that edition's state; Clubs is a searchable directory; Stages, Table, Stats, Rewards and History remain edition-specific. Tabs wrap on mobile and use white text/glow without underline or a tab scrollbar. |
| Your club's participation | Open registration contextually from the regional hub/league or club. Apply during the four-week period, confirm during the common confirmation week, respond to any reserve invitation before the one shared deadline. No guaranteed D1 place. |
| Regional Cups (`/regional-cups`) | Follow the region's captured Cup edition, fixtures, results and rewards. Cup entry and its schedule are disclosed before confirmation. |
| GOST (`/competitions`) | Read the existing competition information. Qualification is not activated and regional results do not reserve a future GOST place. |
| GameDay (`/game-day?match=...`) | Publish the club selection, check personal Plus, mark ready and use the match's official result/confirmation workflow. New terms allow either participant's first report; silence after 24 hours goes to Admin review. |
| Player profile / Transfer Market / Contracts | An authorized club officer proposes a permanent contract. The recipient accepts in Inbox. Official transfer eligibility is checked server-side even when the general manual window is closed. |
| Inbox | Respond to current contract and match actions. Old loan messages are historical; no loan response or temporary playing-right action is available. |
| Page Guide and onboarding | Brief contextual help for useful surfaces. Existing Lifestyle guidance is retained. English is the default copy; localization support remains. |

Only permanent player transfers are supported. For new captured regional terms,
ordinary moves are allowed between seasons and in playing week six. Placement
counts as in-season after shared confirmation. An eligible free player can enter
outside the ordinary window if they have not actually played for another club
in that cycle. A bench nomination alone is not actual participation. Cross-region
cycle mapping and discipline integration are not represented as complete.

Every selected player, including reserves, still needs personal Plus and current
playing registration. Official selections require the captured original roster
or a valid permanent transfer receipt. Three human starting players are required;
ANY is allowed and goalkeeper optional. The application records official
participation declarations; it does not claim automatic EA verification.

## Where Admin finds things

| Location | Purpose |
| --- | --- |
| `/admin/leagues` → Regional Leagues | Permanent structure controls, registration windows, action overview, cycles, calendar previews/publication and recovery. Ordinary automatic progression should not require repeated button presses. |
| `/admin/gost` | Existing GOST configuration and trophy assignment. GOST activation remains closed. |
| `/admin/trophies` | Maintain the reusable trophy artwork catalogue. No second trophy upload system was added. |
| `/admin/rewards` | Captured reward configurations, payouts, awards and historical review. Paid history remains authoritative; sporting corrections do not silently erase payments. |
| `/admin/disputes` and `/admin/forfeits` | Existing evidence and explicit decisions. The complete approved withdrawal/no-show/correction package is still an implementation gap; a timer is not an automatic forfeit. |

The loan removal needs no new Admin loan-management page. The next authorized
backend startup archives live loan source rows and retires their temporary
assignment. Completed/purchased history and paid ledgers remain. The prepared
migration has not been run against production. Do not invent refunds or silently
settle old purchase obligations.

## Automatic versus human work

Automatic in the supported normal captured route: reminders, common deadlines,
accepted reserve processing, supported field/cycle preparation, saved draws,
configured calendars, accepted Cup creation/progression, promotion progression,
next registration/season handoff, stable obligations/awards and worker recovery.
Retries must not draw, pay or award twice. The normal isolated route has evidence
through the first game of season two and a fresh worker process.

Humans still play EA matches, declare/prove results, confirm or dispute them,
respond to participation and contract offers, and keep their actual squad eligible.
Admin sets absolute launch dates and approved published rules, handles evidence
and genuine exceptions, and later authorizes production deployment/repair.

Still to finish: full withdrawal/stat and financial exceptions, discipline and
cross-region integration, organizer scheduling, remaining browser/Admin flows and
the full acceptance exception matrix. Undecided NA times, unsupported counts/
shrinkage, 180→240 extra calendar and financial/premium exceptions stay gated.

## Evidence and reruns

Read `competition-acceptance-phase8.md`. Saved normal-season and player-exception
JSONs distinguish passing routes from the incomplete overall matrix. Actual Chrome
reports/screenshots are under `docs/acceptance-results/browser-2026-11-07/`.
The combined upload list is `competition-deployment-manifest-2026-11-07.md`.
No push, deployment, production reset/repair, payout or subscription operation has
been performed under this request.
