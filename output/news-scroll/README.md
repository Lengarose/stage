# News scroll regression — 16 November 2026

Open `/scripts/news-scroll-qa.html` on the local Vite server and click **Run News scroll check**. The fixture mounts the real News and Layout with mocked read-only data. It dispatches 30 wheel inputs of 16px over the clipped hero, then checks that at least 430 of the requested 480px were travelled.

Before: FAIL, 112px; repeat FAIL, 114.67px.
After: PASS, 480px. Normal browser scrolling and story open/close also verified.

Cause: News set `scroll-behavior:smooth`, restarting the animation with each forwarded wheel delta in Layout. News now uses `auto`; shared Layout is unchanged.

Verification: lint, typecheck and backend syntax passed. Graphify update could not run because the command is not installed. No deployment.
