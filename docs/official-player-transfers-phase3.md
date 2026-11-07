# Official player transfers and removal of loans — 7 November 2026

This is a local implementation handoff, not deployment or completion of the eight-phase programme.

## Confirmed policy update

The user confirmed that placement already belongs to the ongoing edition after
the shared confirmation deadline. They replaced the loan-return question with an
explicit product decision: permanent transfers only; remove player loans.

New registration windows capture `regional_player_transfers_v1` and disclose the
English rules before consent. Older accepted window hashes are unchanged.
Confirmation and reserve acceptance capture the whole existing club roster, not
just the three selected Plus players. This lets an existing reserve become
eligible when their Plus becomes active. Later additions require a permanent
transfer receipt as well as current club membership and personal Plus.

The ordinary European transfer window is playing week six in Europe/Brussels,
with an exclusive following-Monday boundary. Between-edition movement is allowed
after week twelve, including the transition week before a recurring next edition.
Placement is closed to ordinary moves. An eligible free player may enter outside
these periods if they have not declared actual play for another club in that cycle.
Bench nomination is not participation. Cross-region cycle/priority policy remains
an outstanding integration boundary; this file does not claim a complete global
transfer or disciplinary engine.

## Implementation

- `officialPlayerTransferService` applies captured rules at contract acceptance,
  stores a stable contract/window/player receipt in the existing generic entity
  store and validates it during official selection, readiness and kickoff.
- The contract-offer path uses the official policy when applicable, rather than
  requiring an unrelated manual global transfer window for an eligible free
  player. Legacy nonofficial offers retain the existing manual-window policy.
- Contract acceptance requires the stored recipient's linked user. The existing
  pending-window worker uses a private in-process token for already accepted
  queued contracts; an HTTP request cannot supply that token. A repeated active
  acceptance returns its existing dates without a second fee or signing bonus.
- Generic contract PATCH cannot activate or rewrite a contract. Official profile
  club changes use contract/departure workflows. Founder and legacy club-join
  paths cannot silently bypass captured official rights.
- Published player selections and direct individual tournament matches are
  checked for overlapping 40-minute league / 60-minute knockout blocks. This
  does not introduce an unapproved extra buffer. Drafts do not reserve time.
- Publication/readiness/kickoff still enforce personal Plus and minimum three;
  kickoff evidence remains frozen. Expiry after actual kickoff is not rewritten
  into retroactive nonparticipation.
- The transfer UI supports permanent offers to players at other clubs. Official
  recruitment remains reachable when the manual global window is closed; this
  is an opportunity to request an eligibility check, not a guaranteed transfer.

## Removal of loans

Request dialogs, Inbox response widgets, profile/squad actions, badges, filters,
notification preferences and tutorial instructions have been removed. Old Inbox
loan messages are historical and never actionable. The frontend entity factory
no longer exposes `PlayerLoan`. The authenticated old `/player-loans` URL returns
410 for every role and verb; it cannot create, activate, recall or purchase.
Internal mutation entry points are also retired, and old loan workers do no work.

At the next authorized backend deployment/startup, the idempotent
`retirePlayerLoans` migration archives the exact source row in
`league_entities` (`retired_player_loan`), then marks live loans `RETIRED` in one
transaction. Physical `players.club_id` already holds the parent/permanent club;
retirement does not sell or reassign the player. Previously purchased permanent
moves and completed loans remain historical. Paid fees, wallets, contracts,
ledger rows and awards are not deleted or refunded. No compensation amount or
pending historical purchase-obligation settlement is invented here. Inspect
those archived obligations as part of the existing financial-exception handoff.
The old table and internal historical interpretation helpers remain deliberately;
removing a product feature does not erase its paid history.

## Evidence and remaining work

- The normal real-MySQL/JWT season route was rerun successfully: 84 placement,
  760 league, 39 Cup and three promotion matches, next-edition play and a fresh
  process recovery. See the saved 6 November normal-season report.
- The isolated player exception script now exercises actual HTTP contract offers,
  recipient/outsider roles, forbidden placement moves, week-six acceptance,
  free-player entry outside the general window, retry accounting, generic PATCH
  rejection, expired Plus at three stages, persisted individual overlap and
  idempotent loan retirement. See the 7 November player-exceptions report.
- Relevant regression and browser final results are recorded in the acceptance
  handoff when the current run finishes. A partial/failed browser run is not a
  browser acceptance pass.
- Still missing from the overall approved programme: complete cross-region and
  sanction enforcement, full no-show/withdrawal/stat correction integration,
  financial exception integration, organizer scheduling and the rest of the
  exception acceptance matrix. GOST and D3 remain closed. Do not mark complete.

Rerun on the explicitly isolated local MySQL socket:

```sh
STAGE_ACCEPTANCE_SOCKET=/private/tmp/stage-season-acceptance.sock node server/scripts/acceptance/player-exceptions.cjs
```

No production connection, reset, payout, upload, push or deployment was performed.

Active cross-region free-player evidence is explicitly held for Admin review;
the offer and acceptance paths do not infer new cycle rights. The latest real
HTTP script also covers that refusal before allowing bench-only evidence. The
pending cross-region policy is not treated as permission to bypass participation.
