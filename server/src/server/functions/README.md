# Function RPC Modules

This folder contains the compatibility layer behind:

```text
POST /api/stage/functions/:name
```

`functionsRouter.js` is the HTTP dispatcher. It should stay generic: find the
handler by name, attach `_auth_user_id`, return JSON, and format errors.

`legacyFunctions.js` contains the old large handler map moved out of
`controllers/functionsController.js`. Treat it as a migration source, not the
place for new features.

Message delivery has already started moving into domain services:
`services/messageDeliveryService.js` owns notification opt-in checks,
notification de-duplication, and contract-offer inbox delivery.

## Extraction Rule

When touching a large handler family, move that family into a domain module:

```text
contractActions / contractManagement -> contractFunctions.js
sendInboxMessage / respondInboxMessage -> inboxFunctions.js
playerWallet / clubFinance -> economyFunctions.js
tournamentRegistration / tournamentCancellation -> tournamentFunctions.js
```

The domain module should export a small handler map that can be merged into the
main `HANDLERS` object. Shared business rules belong in `services/`.
