# Store redesign — 17 November 2026

Admin → Store → Store images contains uploads/URLs for the STAGE Plus badge and
one Store page background. Upload, then select Save Store. The background is
empty by default. Remove + Save clears an image. Existing player-card preset
management remains below these controls. Prices/allowances are read-only because
the existing checkout policy fixes them; this change does not change prices.

Default benefits are shared between frontend, Admin and backend in
`server/src/shared/storeBenefits.json`. Known legacy lists are upgraded on read;
custom Admin copy remains editable. The UI clarifies personal Plus eligibility,
fees/squad rules, monthly allowance refresh, backgrounds and deferred GOST access.

Verification:
- Real authenticated HTTP against a new isolated local MySQL schema: config
  defaults, create/read/update/clear, non-Admin denial and two audit records.
- Controlled browser fixture of real Store and Admin components: category and
  billing switches, €4.99 monthly / €49.99 yearly and 17% saving, user-scoped
  credits (75 rather than the player's stale 999), free/active membership,
  checkout errors, simulated cancellation retaining access, Admin image URL
  save/reload and phone-width rendering. Payment calls were intercepted: no
  Stripe session, real purchase or actual subscription cancellation.
- Regression tests, lint, typecheck, backend syntax and production build.

Preview: `/scripts/store-style-qa.html`; `?state=plus`, `?state=expired` and
`?state=admin` select isolated cases. `/scripts/store-mobile-qa.html` wraps it at
390px. These fixtures do not use real account data.

Deploy the frontend build and changed backend files, including the new shared
JSON file. Restart the backend so its idempotent background column migration
runs. No deployment was performed here. `graphify` is not installed, so its
requested graph update could not run.
