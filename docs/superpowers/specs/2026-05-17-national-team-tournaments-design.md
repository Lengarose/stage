# National Team Tournaments Design

## Goal

Add an international layer to Stage League where players can represent their country in World Cup and continent cup tournaments. The feature should make national identity matter without replacing club careers: players continue playing for clubs, but strong and visible players can also earn selection to national squads.

## Core Concept

Each international tournament has a pre-tournament representative election for every eligible country. Players vote for a country representative, and the elected representative selects that country's squad using visible player ratings and profile data.

The representative role is temporary. A winner represents the country for one tournament only, so each World Cup or continent cup creates a fresh voting cycle.

## Tournament Types

International tournaments should support:

- World Cup
- Euro-style continent cup
- AFCON-style continent cup
- Copa America-style continent cup
- Asian Cup-style continent cup
- Other admin-defined international cups

The tournament type determines which countries are eligible. A World Cup can include all countries. A continent cup includes countries from the configured continent or region.

## Country Eligibility

Countries are detected from player nationality data, using the existing `players.country_code` field first and `players.country` as the fallback display value. A country becomes eligible for a tournament when it has enough eligible players for the configured squad requirements or when an admin explicitly includes it.

Players can only participate in the country tied to their player profile nationality for that tournament.

## Representative Election

Before each international tournament starts, the app opens a voting phase per eligible country.

Election rules:

- Every player from that country is automatically a candidate.
- A player can only vote in their own country's election.
- A player cannot vote for themselves.
- Each player gets one vote per tournament.
- Voting closes before squad selection starts.
- The top vote-getter becomes the country's representative for that tournament.
- If there is a tie, the admin can decide the winner or use highest overall rating as the automatic tiebreaker.
- Only players who existed before the voting window opened can vote in that tournament election.

## Representative Permissions

The elected country representative can:

- View eligible players from their country.
- Sort and filter players by overall rating, position, club, recent form, and availability.
- Open player profiles and recent stats.
- Build a shortlist.
- Select the final national squad.
- View the 18-player matchday squad rules as read-only guidance in the first implementation.

The representative cannot:

- Edit player ratings.
- Change player nationality.
- Vote again after voting closes.
- Select players from another country.
- Modify the locked squad after the tournament starts, unless an admin reopens or overrides it.

## Squad Rules

Recommended default rules:

- Full tournament squad: 26 players
- Matchday squad: 18 players
- Starting lineup: 11 players
- Bench: 7 players

The 18-player matchday squad aligns with EA FC-style play: 11 starters plus 7 substitutes. The 26-player full squad gives representatives enough depth for World Cup-style tournaments.

The first implementation uses the default squad sizes above. Configurable squad sizes are intentionally out of scope for the first release.

## Tournament Flow

1. Admin creates an international tournament.
2. Admin configures tournament type, eligible countries or region, voting dates, squad lock date, and tournament start date.
3. The app creates country election records for eligible countries.
4. Players vote for their country representative.
5. Voting closes.
6. The app elects one representative per country.
7. Representatives review eligible players and select a 26-player national squad.
8. Squads lock before the tournament starts.
9. Tournament fixtures proceed using the selected national squads.

Per-match 18-player squad selection is a follow-up phase. The first implementation stores and locks the 26-player tournament squad only.

## Data Model Direction

This feature is larger than a generic `league_entities` concept because it needs strict election rules, one-vote constraints, squad locks, and representative permissions. It should use dedicated tables rather than the generic entity store.

Likely persisted entities:

- `international_tournaments`
- `national_team_elections`
- `national_team_votes`
- `national_team_representatives`
- `national_team_squads`
- `national_team_squad_players`

Fresh installs should define these in `server/schema.sql`. Existing deployments should get matching startup migrations in `server/src/server.js`.

## Backend API Direction

Use dedicated business endpoints for election and squad actions rather than plain CRUD for the sensitive actions.

Suggested endpoints:

- `POST /api/stage/international-tournaments`
- `GET /api/stage/international-tournaments`
- `POST /api/stage/international-tournaments/:id/open-voting`
- `POST /api/stage/national-team-elections/:id/vote`
- `GET /api/stage/international-tournaments/:id/elections`
- `POST /api/stage/international-tournaments/:id/close-voting`
- `GET /api/stage/international-tournaments/:id/eligible-players?country_code=BE`
- `POST /api/stage/international-tournaments/:id/squads`
- `POST /api/stage/international-tournaments/:id/squads/:squadId/lock`

Admin mutations and overrides must write to `admin_audit_log`.

## Frontend Direction

Admin views should allow admins to:

- Create international tournaments.
- Configure country eligibility and dates.
- Monitor voting results.
- Resolve ties.
- Review and override squads if needed.

Player-facing views should allow players to:

- See open national elections for their country.
- Vote for a representative, excluding themselves from the available vote targets.
- See election results after voting closes.
- See national squad announcements.

Representative views should allow representatives to:

- See their tournament and country assignment.
- Browse eligible players with ratings.
- Filter by position, club, rating, form, and availability.
- Build and submit the 26-player squad.
- See locked squad status.
- See the 18-player matchday squad rule as guidance, without managing per-match selections yet.

## Error Handling And Guardrails

The backend should enforce all important rules, even if the frontend also hides invalid actions.

Required validations:

- Reject votes outside the voting window.
- Reject self-votes.
- Reject duplicate votes by the same player in the same tournament election.
- Reject votes for candidates from another country.
- Reject voting by players created after the election opened.
- Reject squad selection by non-representatives.
- Reject squad selection for another country.
- Reject squads with more than 26 players.
- Reject locked squad edits unless performed by an admin override endpoint.

## Testing Strategy

Backend tests should cover:

- Voting eligibility.
- Self-vote rejection.
- Duplicate vote rejection.
- Country mismatch rejection.
- Representative election and tie handling.
- Squad size validation.
- Representative permission checks.
- Locked squad protection.

Frontend verification should cover:

- A player sees only their country election.
- The current player is not available as a vote target.
- A representative can sort eligible players by rating.
- A representative cannot submit more than 26 players.
- Locked squads display read-only state.

## Deferred Follow-Up

Per-match squad selection is deferred until international fixtures are wired in. That follow-up should let representatives choose 18 players for each match: 11 starters and 7 bench players.
