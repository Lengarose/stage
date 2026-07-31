# Stage League Backend Architecture

This backend is an Express + MySQL application. The target shape is MVC plus
domain services:

- `controllers/`: HTTP adapters. Controllers parse `req`, call models/services,
  and return `res`. They should not own large business workflows.
- `models/`: SQL adapters for persisted entities. Models build CRUD queries and
  do not handle HTTP.
- `services/`: domain modules. Services own business rules such as identity
  resolution, club operations, memberships, account deletion, and future contract
  lifecycle rules.
- `routes/`: route registration modules. They wire controllers to Express so
  `server.js` stays focused on boot order.
- `migrations/`: startup database repair and backfill modules. Fresh schema still
  lives in `server/schema.sql`.
- `functions/`: compatibility RPC function handlers behind
  `POST /api/stage/functions/:name`.

## Bootstrap

`server/src/server.js` should stay small. Its job is:

1. apply env config
2. create and configure the Express app
3. install middleware and rate limiters
4. register routes through `routes/registerStageRoutes.js`
5. serve static files and SPA fallback
6. run startup migrations
7. start the HTTP server

If a change adds business rules, SQL workflows, or large route groups to
`server.js`, move that logic to a module first.

## MVC Rule

For new persisted entities, follow the project convention:

1. schema in `server/schema.sql`
2. startup migration in `migrations/startupMigrations.js`
3. model in `models/<entity>Model.js`
4. controller in `controllers/<entity>Controller.js`
5. route registration in `routes/registerStageRoutes.js`
6. frontend entity registration in `src/api/stageClient.js`

## Function RPC Migration

`functions/legacyFunctions.js` intentionally holds the old large handler map for
compatibility. New work should not grow that module. Extract one domain at a
time into modules such as:

- `functions/contractFunctions.js`
- `functions/inboxFunctions.js`
- `functions/economyFunctions.js`
- `functions/tournamentFunctions.js`
- `services/contractLifecycleService.js`
- `services/messageDeliveryService.js`
- `services/economyLedgerService.js`

Keep `POST /api/stage/functions/:name` stable until the frontend has migrated
to more explicit REST endpoints.

## Inbox And Notifications

Actionable events must be delivered through `services/messageDeliveryService.js`.
Use `sendActionMessage()` when the recipient must respond: it creates or reuses
the inbox document and links the alert notification to `/inbox?id=<messageId>`.
Pass an `idempotencyKey` for every actionable event. If a message is tied to a
business record, the helper can derive the same key from
`messageType:relatedEntityType:relatedEntityId:recipientEmail`.
Use `createNotificationIfEnabled()` only for alert-only events where no user
decision is required.
