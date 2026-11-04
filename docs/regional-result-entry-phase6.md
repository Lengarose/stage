# Either club may report full time first

Local implementation, 3 November 2026. Implements the already approved
masterplan §9 rule: the home club normally submits, but the away club need not
wait if the finished match has no proposal yet.

## Published terms and compatibility

New registration windows capture `regional_result_review_v2`. The published
English rules include either-side first reporting, one proposal, mandatory
opponent review and the existing 24-hour response/Admin-review rule.
`regional_result_review_v1` retains its 24-hour review behaviour and prior
home-first entry terms. Editions without a captured result policy retain their
legacy conditions. No already accepted policy snapshot is rewritten.

The backend resolves the stored source window, never a request-body permission.
V2 first entry requires an `in_progress` official match, a home/away actor,
mandatory screenshot evidence, valid participants and no existing proposal or
submission evidence. As with the existing home workflow, reporting is the
participant's declaration of full time; this change does not claim independent
EA verification of the actual final whistle or create an actual-finish clock.

## Single proposal and review

Initial entry writes the submitting side, its submission, the response deadline,
state and history together through the existing guarded result transaction.
Two simultaneous first entries can produce only one proposal. The other request
receives a conflict and must refresh to review the stored proposal.

The opponent receives the Inbox/notification prompt. Confirmation, amendments,
corrections and acceptance follow the stored submitting side. Correction notices
now return to the original submitter, including when that is the away club.
Home–Away scores retain their fixture orientation throughout.

## User interface

The existing official preparation HTTP response now exposes `match_id` and
`allow_either_initial_result` from the captured source terms. GameDay checks both
the capability and match identity before enabling the away report action. Old
preparation state from another selected match cannot enable it.

The report dialog carries that capability to the form. The form supports an
away-first proposal, shows the actual submitting/correcting club, and prefills
the actual correction during review. String `"0"` submission flags no longer
count as a submitted result. Existing server permissions remain authoritative.

## Verification

- 262 selected service/controller regressions pass, including actual local
  preparation and registration HTTP routes with controlled persistence/auth.
- Workflow coverage includes away-first confirmation, home correction accepted by
  away, first-entry races, self-confirmation rejection, missing proof, premature
  entry, existing evidence and attempted client permission overrides.
- Frontend controls cover legacy home-first behaviour, v2 away entry, opponent
  confirmation, stale submission flags/evidence and scheduled-match restrictions.
- Final frontend/snapshot/result-write run: 31 tests pass.
- Lint, typecheck, server syntax and production build pass. Two known unrelated
  functionsController cases remain excluded as in earlier handoffs.
- Real MySQL/JWT/browser and production are unverified. No deployment or data
  repair occurred. Graphify update was attempted; executable unavailable.

The full competition programme remains incomplete. Remaining actual-finish
deadlines, proof-only amendment timing, exceptions and complete season
orchestration stay on the central delivery checklist.
