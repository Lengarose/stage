# Regional Division 2 Rewards

## Selection And Budgets

The shared JSON template (`server/src/server/lib/regionalRewardTemplate.json`) now contains separate Division 1 and Division 2 entries. Frontend defaults and server capture both select Division 2 only when `Number(source.division) === 2`. Names, regions and platforms do not select schedules. Other division values retain their prior defaults; GOST and unrelated tournament policies are unchanged.

- Division 1: 54,000,000 STC first place, declining by 1,700,000 per position; **757,000,000 STC** for 20 clubs.
- Division 2: 33,000,000 STC first place, declining by 1,700,000 per position; **337,000,000 STC** for 20 clubs, ending at 700,000 STC.
- Smaller rosters use only the first N positions. For example, Division 2 with two clubs totals 64,300,000 STC.

Existing league-seeding and next-season creation already pass division metadata into the shared defaults. Initialization now also uses the server-returned source, preventing stale or missing browser metadata from selecting the wrong division. Unconfigured server snapshot capture uses the actual edition division. Captured configurations remain authoritative even after defaults change.

## Existing Configurations

Deploy the changed backend and frontend, then open **Admin → Rewards → Division 2 Source Configuration Review**:

1. Select **Review Division 2 Sources**. This is read-only and returns source identity, division, region/platform, current version/revision, current and proposed budgets, and any captured edition needing separate review.
2. Inspect the proposed schedules, then choose **Apply Reviewed Source Schedules** and supply a reason. The endpoint updates only explicitly identified Division 2 sources. Each source uses the existing locked, transactional, versioned and audited replacement service. Changed revisions conflict rather than overwrite another admin's work. Repeating an already-applied update creates no additional version or payment.
3. Uncaptured draft/registration/qualification sources also receive the correct effective budget, in the same transaction with audit evidence. Captured editions and in-progress/paid/archived historical obligations are not rewritten. Any amendment must use the separate existing edition review/adoption workflow and its payment-evidence guards.
4. Review per-source results. Bulk application is transactional per source, not all-or-nothing across the entire selection. Failed sources remain visible for another review. At most 500 reviewed unique sources may be applied in one request; a larger installation can apply reviewed subsets through the same action.

The authenticated admin-only business action is POST `/api/stage/reward-configs/regional-division-two`. `{}` previews; `{apply:true,reason,sources:[{id,version,revision}]}` applies the reviewed sources. It never settles money or changes trophies. Source settings and snapshots are distinct: a historical edition may deliberately retain the old supported promise until an authorised explicit amendment.

## Changed Files

- Shared policy: `regionalRewardTemplate.json`, `rewardPolicy.js`, `src/lib/prizeDefaults.js`.
- Configuration/capture: `rewardConfigurationService.js`, `competitionPrizeService.js`, `rewardConfigController.js`, `src/lib/rewardsEngine.js`.
- Existing admin UI: `RewardsTab.jsx`, `RewardConfigPanel.jsx`; new `DivisionTwoRewardReview.jsx`.
- Regression tests: `regionalRewards.test.mjs`, `divisionTwoRewards.test.js`, `rewardAndCabinetHttp.test.js`.

No schema change, new payment mechanism, dependency, progression change or trophy eligibility change is needed. The existing archive and nullable reward-position migration fixes were preserved. Upload backend changes and restart Gandi; build/upload the frontend as usual. Source configuration application is a separate authorised admin step, not a startup seed or automatic production mutation.

## Verification And Limits

Controlled local service tests verify every amount and both 20-club totals, two-club subsets, shared region/platform selection, next-season budget/configuration propagation, versioned replacement, stale-review conflicts, legacy rows, immutable captured history and repeat application. A controlled Division 2 completion credited 33,000,000 through 700,000 STC exactly once through the existing club balance/ledger service. No additional participation payment was created. Existing regional/GOST reward flow tests continue to pass.

The new endpoint was exercised over localhost through the real controller with isolated database/identity fixtures: preview, apply, retry and non-admin denial passed. Headless Chrome verified the actual editor at desktop/mobile widths, division-aware reset, 20 fields and the 337 million budget, without horizontal overflow. GOST fields and budget calculation were checked unchanged.

Lint, typecheck, server entry syntax, changed backend syntax, diff whitespace checks and production build passed. Full backend results: **648/652 passed**, with existing failures in legacy captain editing, fixture match creation, registration upload category and a startup-export source assertion. Full frontend results: **376/380 passed**, with existing failures in identity menus, FUT photo frame, GameDay club loading and photo-preview source assertions. All focused Division 2 service/default/lifecycle tests and all three reward/cabinet HTTP tests passed.

`graphify update .` is unavailable because the CLI is not installed, and graph report/wiki files are absent. Real MySQL application, deployed authentication and live source/snapshot inventory were not verified. No production bulk updates or payouts ran. Only controlled local configurations were updated; no specific live editions are claimed to have been amended.
