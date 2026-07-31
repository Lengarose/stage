# Route Registration

Route modules wire controllers into Express. They should not contain business
logic or SQL.

`registerStageRoutes(app, { verifyToken })` mounts the controller-backed
`/api/stage/*` routes in one place. `server.js` still owns boot-sensitive routes
such as Stripe webhooks, health checks, and public landing content.

When adding a controller:

1. create the controller in `controllers/`
2. register the path in `registerStageRoutes.js`
3. keep public routes above protected routes when order matters
4. keep static assets and SPA fallback in `server.js`
