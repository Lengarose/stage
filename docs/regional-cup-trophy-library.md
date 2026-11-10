# Regional Cup trophy linking

In Admin → Trophies, **Regional Cups** appears next to **Regional League**, in both the add and edit forms. Select the permanent Cup and save the trophy. Approved Cups are available for existing active, unambiguous Division 1 regional systems even before Cup setup. Opening the list changes nothing. Saving a trophy creates the permanent Cup identity if needed and assigns its default atomically; no season or fixtures are started.

Saving creates/updates the catalogue item and the permanent Cup trophy default in one database transaction. The server derives the Admin identity and the Cup name, writes audit evidence, clears a displaced catalogue link and preserves recorded edition/award snapshots. Invalid targets roll back rather than leaving an uploaded catalogue item partly linked. Changing an image updates the default artwork used by future editions. Unlinking clears that trophy's corresponding default. Existing saved editions retain their captured design.

Selecting the Cup in its preparation wizard now loads the assignment automatically and preselects **Trophy from Trophies**. The existing View / change action remains available for a refresh or manual adjustment.

Verification on 10 November 2026:

- Real isolated local HTTP create/edit/replace/unlink, invalid-source rollback, non-Admin denial and immutable edition snapshots passed (`server/scripts/acceptance/cup-trophy-library.cjs`).
- Browser verified the new source option, editing an existing library trophy, saved Cup link and automatic dropdown selection. Screenshots 41–43 are in `output/playwright/admin-walkthrough-2026-11-09/`.
- Lint, typecheck, backend syntax and diff whitespace checks passed.
- Existing Cup/Cup reward suites: all 18 cases passed, including both HTTP cases. The first attempt could not open sandbox test ports (`listen EPERM`); after the user approved local port access, the complete rerun passed. The separate real local API acceptance above also passed.
- `graphify update .` was attempted; the command is not installed.

No schema changes, production data changes, deployment or push were performed. Deploy the changed backend files and restart Gandi, alongside the usual frontend build/upload, for this feature to appear on production.

## Empty dropdown correction — 10 November 2026

The original picker only returned persisted Cup definitions, which left it empty before the first Cup setup. The catalogue now includes a separate `trophy_sources` list derived from existing active, unambiguous regional Division 1 identities and the six approved Cup names. Existing Cup management continues using persisted `definitions`. Reading targets does not create records. Trophy save materializes the same stable region/platform Cup identity inside the audited library transaction, so later configuration and editions reuse it.

Regression coverage includes an unconfigured Benelux system, no mutation on read, single permanent identity on repeated linking, normalized platforms, and ambiguous/retired systems. All 21 Cup/reward tests passed. The real isolated HTTP acceptance (`server/scripts/acceptance/cup-trophy-unprepared.cjs`) verified six selectable targets, initial Benelux linkage/default and unchanged edition snapshots. The existing library HTTP acceptance also passed. Browser proof: `47-regional-cup-dropdown.jpg` in the walkthrough output directory. Lint, typecheck and backend syntax passed; Graphify remains unavailable.
