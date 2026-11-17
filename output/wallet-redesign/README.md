# Wallet redesign verification

Implemented Overview, Transactions and Income & Contracts with the shared Anton/Chakra Petch visual style, square panels and responsive layouts.

- Lint: passed.
- Typecheck: passed.
- Backend syntax: passed for server entry point, wallet read service and legacy function router.
- Production build: passed.
- Isolated MySQL/JWT HTTP acceptance: passed (`server/scripts/acceptance/player-wallet.cjs`). Verified authenticated identity isolation, shared account credits, modern agreements, payroll dates/arrears, funded wager stakes, full-history filtering/pagination, date errors and asset-income eligibility. Read calls did not mutate balances.
- Browser: checked overview, search, transaction detail modal, income agreements, Credits explanation, error/Retry recovery and 390px phone layout using the real components with controlled demonstration data.
- Screenshots: overview.png, mobile.png, details.png. Values in screenshots are illustrative.

Credit transaction history is explicitly unavailable because the existing system has no complete credit ledger. The current account credit balance remains available. Club finances stay in Club Office.

No production data changes or deployment. Frontend build and changed backend files must be deployed together; the backend requires restart.

`graphify update .` could not run because graphify is not installed in this environment.

## Previous-response compatibility fix (17 November)

Reproduced the exact `Cannot read properties of undefined (reading 'filter')` crash by returning the previous Wallet balance response to the real component (`scripts/wallet-style-qa.html?state=legacy`). The configured local API proxy targets stageleagues.com; the previous response has no agreements/payroll arrays.

Added a response adapter that retains known balances, safely handles absent lists, distinguishes unavailable financial information from genuine zero/empty results, validates history responses and disables unsupported server filters. The updated server explicitly advertises filter support. Credit-history selection no longer sends a request that an older server could misinterpret as STC history.

Three regression tests passed (`node --test src/lib/__tests__/walletResponse.test.mjs`). Browser reproduction now renders both Overview and Income & Contracts safely. Lint, typecheck, backend syntax and production build passed. Screenshot `legacy-response-fixed.png` uses demonstration data. Full connected data still requires deploying the updated backend and restarting it. No deployment performed. Graphify remains unavailable.
