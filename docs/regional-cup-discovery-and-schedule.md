# Regional Cup discovery and Schedule — 8 November 2026

Regional Leagues has a top-level in-page **Leagues / Regional Cups** switch.
The Cup directory lives at `/leagues?view=cups`; `/regional-cups` remains compatible.
Select a Cup to see its trophy, published editions, sporting progress, participants,
rounds and GameDay links, rules, captured rewards and completed-edition history.
Shared Schedule links target the exact edition using
`/leagues?view=cups&edition=<edition-id>`.

The existing authenticated `GET /regional-leagues/cups/public` response adds a
sanitized `definitions` directory. It lists the six approved regional identities,
with current explicitly assigned catalogue artwork for configured Cups. An identity
without a published edition remains discoverable as awaiting publication. This does
not publish draft edition IDs, participants, draws, seeds or administrative reports.
Playable editions retain their captured trophy and conditions. An older backend
without `definitions` still supports the frontend's published-edition fallback.

Admin Cup cards have a **View / change trophy** shortcut. This opens the existing
Cup wizard's permanent-Cup/trophy phase; assignment still requires the existing
administrative reason, revision check and audited server action.

Schedule gives Regional Cups their own orange category (`#fb923c`) and
`regional_cup` dropdown scope. League games remain in `regional`. Confirmed Cup
matches appear once in General and Regional Cups, with both an exact Cup-edition
link and the existing GameDay match link. Unpublished drafts and byes create no
calendar events. Fixtures-list match details use the same published Cup identity.

## Confirmed North American Cup time

User confirmed **Sunday 20:00 America/New_York** on 8 November 2026.
New Cup rounds use this IANA timezone, with 60-minute blocks and the existing
approved round-week schedule. Eastern daylight-saving transitions change the UTC
instant while keeping the local 20:00 kickoff. European Cup slots remain Sunday
20:00 Europe/Brussels. Stored calendars are not rescheduled by this change.
Cup load checks group days and weeks in the Cup's own timezone.

The Cup still requires a valid published source league calendar and accepted Cup
participation conditions. The automatic **league** calendar planner still supports
only its previously confirmed European profiles; this change does not invent a
North American league matchday policy or publish/activate production competitions.

## Verification

Targeted Cup lifecycle, directory privacy, schedule normalization and HTTP endpoint
tests use controlled persistence/authentication. Browser verification uses an
isolated fixture catalogue and confirms Cup navigation, stages, participants,
calendar dropdown, orange event display and the exact edition link. These are not
live MySQL/JWT or production deployment checks.
