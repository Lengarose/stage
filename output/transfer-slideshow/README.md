# Transfer Room startup slideshow fix

Cause: TransferMarket initially normalized null config to an empty slideshow, so TransferRoomHero mounted all six built-in images before saved settings arrived. Settings were additionally delayed behind identity resolution and the player market request. A rejected settings request was converted to an empty list, hiding errors behind default artwork.

Fix: separate presentation fetch with loading/ready/error states. Render no artwork or slideshow controls until settings resolve; use only configured photos when present. Built-in slides remain the deliberate fallback for a successfully loaded empty configuration, as documented in Admin. Failed settings show Retry and no unrelated imagery. Retry/unmount updates are guarded.

Regression: scripts/transfer-slideshow-qa.html mounts the real TransferMarket with a delayed custom configuration and polls hero images during initial loading. Before fix: FAIL (built-in artwork before uploaded image). After: PASS (uploaded image only). mode=error verifies no fallback on request failure; Retry successfully loads configured artwork. mode=empty verifies intentional six-photo fallback. All data is mocked; no live mutations.

Lint, typecheck, existing transferRoomPresentation test, backend syntax and diff whitespace pass. Graphify command unavailable. No deployment.
