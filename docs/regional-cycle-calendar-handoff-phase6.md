# Saved allocation → regional calendar preparation

Local implementation, 4 November 2026. This follows automatic draft allocation;
it does not activate unattended fixture drawing or calendar publication.

## Admin flow

Admin → Regional Leagues → Regional action overview now offers **Prepare this
season calendar** for an allocated cycle missing its league calendar. The same
link appears on the saved cycle after allocation. It opens the existing calendar
panel using `regional_calendar_cycle` in the URL.

The panel loads the saved allocation, lists its groups and displays the current
league statuses available in the Admin list. These labels are not proof that all
fixtures exist; the server validates the complete draw on preview. Opening the
link creates no fixtures or schedules. Admin must draw each group's league
fixtures through the existing lifecycle controls, choose the first playing-week
Monday, preview conflicts and explicitly confirm publication with a reason.

Refresh reloads the saved allocation. Failed reads are shown with a retry action;
older responses cannot replace a newly selected cycle's state. Manual group
selection remains available. Existing published calendars remain immutable through
this action; individual changes use the established controlled rescheduling flow.

## Server boundary

The existing authenticated POST `/api/stage/regional-leagues/calendar` accepts
either `edition_ids` or `cycle_id`, never both. With a cycle, the server derives
every edition ID from its locked stored `allocated_groups`. The stored Admin role
is verified before private cycle lookup. No additional endpoint, table or public
entity was added.

Cycle-based preparation requires a valid allocated, non-invalidated cycle, unique
group IDs, current active editions, matching regional/platform/season/reset scope,
permanent identities, division/group labels and each edition's cycle pointer.
The existing check that every populated current group is included still applies.
Draft groups or incomplete draws cannot be scheduled by this handoff.

The cycle identity/allocation participates in the preview revision. Apply rereads
and locks it; changed evidence rejects publication. The explicit-ID request keeps
its previous revision shape. Result records created through the cycle form retain
`source_cycle_id`. Existing calendar checks, transaction rollback, fixture/engine/
GameDay bindings, audit writes and idempotent replay remain in force.

## Verification and remaining work

- 304 selected sequential service/controller regressions pass; the two previously
  documented unrelated baseline cases remain outside the selection.
- The final 16 calendar tests pass, including cycle-derived multi-group preview
  and publication, unchanged preview state, replay, malformed/reset/mismatched
  sources, role checks before cycle reads, revision changes, parameterized locked
  lookup and actual local HTTP preview/publication with controlled persistence/auth.
- Lint, typecheck, backend syntax, build and diff checks pass. Graphify update was
  attempted; the executable is unavailable.
- Real MySQL/JWT, browser/mobile interaction and production remain unverified.
  Nothing was deployed or changed in production.

Absolute launch dates, placement/transition blocks, North American timing and
other open calendar policies are still activation gates. This handoff automates
selection, not those decisions. Full unattended first-cycle preparation, drawing,
calendar publication and rollover remain on the central delivery checklist.

## Calendar-panel draw controls — follow-up, 4 November 2026

The saved-cycle panel now reads each current group through the existing entity
client and inventories its real fixture rows through the existing paginated GET.
It never trusts cached `actual_fixtures_count` or `fixtures_generated` flags to
offer another draw. Missing, duplicate, reset, mismatched or unreadable group data
blocks the inventory rather than displaying a fabricated zero.

For a live eligible group with zero fixtures, Admin can use **Draw this group's
fixtures** directly here. A reason and explicit confirmation are required for
each action; changing the reason clears confirmation. This calls the existing
protected edition lifecycle action, not CRUD or a new draw implementation. That
action validates the roster, captures the existing reward configuration, inserts
the home-and-away fixtures transactionally and audits the real Admin actor.
A reward capture may remain after a later failed draw, as before; this action does
not pay prizes, create kickoff times or activate GOST/D3.

The optional `expected_regional_cycle_id` guard is restricted to regional draws
with confirmation/reason. It checks the edition's allocation pointer and invalidation
state before reward capture and again before fixture insertion. It is a stale-context
guard, not a permission flag; stored-role authorization remains mandatory. Existing
standalone lifecycle requests retain their original behaviour.

Successful draws refresh all selected group inventories and the parent Admin list.
Existing positive fixture counts never offer another draw. A count of 380 is
labelled as stored, not proof of integrity: full calendar preview still validates
opponents, rounds and bindings. Any draw/refresh failure clears the inventory and
requires **Refresh saved allocation** before retrying or previewing. The message
acknowledges that the draw may already have committed after a lost response.
No attempt is made to reverse or recreate a stored draw.

Verification: 333 selected sequential server regressions and eight frontend-helper
tests pass. Coverage includes a twenty-club 380-fixture draw, role/confirmation
guards, changed allocation after reward capture, actual-row inventory despite a
stale cached count, inventory errors and protected contextual draw over local HTTP.
Lint, typecheck, backend syntax, build and diff checks pass. The historical two
unrelated baseline exclusions remain; real MySQL/JWT/browser/live validation is
still open. Graphify is unavailable; nothing was deployed.
