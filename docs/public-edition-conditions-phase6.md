# Published edition conditions on league and Cup pages

Local implementation, 5 November 2026. This follows the GameDay result-conditions
notice and extends access to the already recorded edition terms. No rules change.

## User locations

- Regional league detail → **View league rules** now includes the selected
  edition's recorded participation text and participation/result/Cup policy labels.
  Identical copied league rules are not shown twice. Different additional league
  rules and the existing rules file remain available.
- Regional Cups → selected edition → **Cup rules** now includes that Cup's own
  participation-window snapshot alongside its existing format rules.
- Club → Competitions retains its existing contextual regional-participation link;
  this step adds no separate registration page/navigation item.

The shared EditionParticipationConditions view states that reading conditions
neither registers the club nor changes its accepted terms. Text is rendered as
plain text, not HTML. Older editions without a captured source receive no invented
policy. A marked edition with missing, malformed, unsupported or mismatched source
data displays an unavailable/review message. It never substitutes current defaults.

## Source boundary

The existing regional-public overview now reads registration-window records in
its existing SELECT and resolves only the edition's exact linked window ID.
Region, normalized platform, season and reset series must match. The Cup public
service uses only the embedded edition snapshot, not another/current window.
Archived terms remain readable when their exact source is present.

publicParticipationConditions is a pure allowlisted projection: state, window ID,
participation/result/Cup policy labels and exact recorded rules_text. Private
contacts, seed data, roster/confirmation details and administrative fields are
not included. Unknown registration-policy versions are not interpreted as the
current policy. No new endpoint, table/entity, notification or mutation was added.
No existing snapshots, consent hashes or financial/sporting records were changed.

## Verification and limits

365 selected sequential server regressions and 37 frontend tests pass. The two
historical unrelated server baseline cases remain excluded. Coverage includes
actual local HTTP league/Cup conditions, cross-season/region/platform/reset rejection,
exact archived sources, unchanged reads, absent legacy terms, sanitized projection
and React static rendering/escaping. The HTTP tests use controlled persistence/auth.

Lint, typecheck, backend syntax, build and diff checks pass. Graphify update was
attempted; the executable is unavailable. Real MySQL/JWT, browser/mobile navigation
and live source availability remain unverified. No deployment, production repair
or result decision occurred. This does not close the full rules/tutorial audit or
overall competition programme.
