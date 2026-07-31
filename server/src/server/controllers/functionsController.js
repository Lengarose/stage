const { createFunctionsRouter } = require('../functions/functionsRouter');
const {
  HANDLERS,
  fulfilCheckoutSession,
  retrieveStripeCheckoutSession,
} = require('../functions/legacyFunctions');

const router = createFunctionsRouter(HANDLERS);

module.exports = router;
module.exports.HANDLERS = HANDLERS;
module.exports.fulfilCheckoutSession = fulfilCheckoutSession;
module.exports.retrieveStripeCheckoutSession = retrieveStripeCheckoutSession;
