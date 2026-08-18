const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');

const root = path.resolve(__dirname, '../../../../..');

function readRepoFile(...parts) {
  return fs.readFileSync(path.join(root, ...parts), 'utf8');
}

test('server bootstrap delegates public tournament routes to a controller module', () => {
  const server = readRepoFile('server/src/server.js');
  const routeRegistry = readRepoFile('server/src/server/routes/registerStageRoutes.js');
  const publicTournamentController = readRepoFile('server/src/server/controllers/publicTournamentController.js');

  const publicMount = "app.use('/api/stage/public', require('../controllers/publicTournamentController'))";
  const protectedMount = "app.use('/api/stage/upload', verifyToken, require('../controllers/uploadController'))";

  assert.doesNotMatch(server, /publicTournamentController/);
  assert.match(routeRegistry, /app\.use\('\/api\/stage\/public', require\('\.\.\/controllers\/publicTournamentController'\)\)/);
  assert.equal(routeRegistry.includes("app.use('/api/stage/public', verifyToken"), false);
  assert.ok(routeRegistry.indexOf(publicMount) < routeRegistry.indexOf(protectedMount));
  assert.doesNotMatch(server, /SELECT \* FROM tournaments WHERE id = \? LIMIT 1/);
  assert.match(publicTournamentController, /resolve-entrance-token/);
  assert.match(publicTournamentController, /SELECT \* FROM tournaments WHERE id = \? LIMIT 1/);
});

test('server bootstrap delegates stage route mounting to a route registry', () => {
  const server = readRepoFile('server/src/server.js');
  const routeRegistry = readRepoFile('server/src/server/routes/registerStageRoutes.js');

  assert.match(server, /registerStageRoutes\(app, \{ verifyToken \}\)/);
  assert.doesNotMatch(server, /app\.use\('\/api\/stage\/players'/);
  assert.match(routeRegistry, /\/api\/stage\/players/);
  assert.match(routeRegistry, /\/api\/stage\/functions/);
  assert.match(routeRegistry, /makeLeagueRouter\('regional_league'\)/);
});

test('server bootstrap delegates startup migrations to a migrations module', () => {
  const server = readRepoFile('server/src/server.js');
  const startupMigrations = readRepoFile('server/src/server/migrations/startupMigrations.js');

  assert.match(server, /runStartupMigrations\(\)\.catch/);
  assert.match(server, /require\('\.\/server\/migrations\/startupMigrations'\)/);
  assert.doesNotMatch(server, /async function runStartupMigrations/);
  assert.match(startupMigrations, /async function runStartupMigrations/);
  assert.match(startupMigrations, /CREATE TABLE IF NOT EXISTS club_memberships/);
  assert.match(startupMigrations, /module\.exports = \{ runStartupMigrations \}/);
});

test('functions controller delegates RPC dispatching to a functions router module', () => {
  const functionsController = readRepoFile('server/src/server/controllers/functionsController.js');
  const functionsRouter = readRepoFile('server/src/server/functions/functionsRouter.js');

  assert.match(functionsController, /createFunctionsRouter\(HANDLERS\)/);
  assert.doesNotMatch(functionsController, /router\.post\('\/:name'/);
  assert.match(functionsRouter, /router\.post\('\/:name'/);
  assert.match(functionsRouter, /Function '\$\{name\}' not found/);
});

test('functions controller is a thin adapter over legacy function handlers', () => {
  const functionsController = readRepoFile('server/src/server/controllers/functionsController.js');
  const legacyFunctions = readRepoFile('server/src/server/functions/legacyFunctions.js');

  assert.match(functionsController, /require\('\.\.\/functions\/legacyFunctions'\)/);
  assert.doesNotMatch(functionsController, /const HANDLERS = \{/);
  assert.match(legacyFunctions, /const HANDLERS = \{/);
  assert.match(legacyFunctions, /contractManagement/);
  assert.match(legacyFunctions, /fulfilCheckoutSession/);
});

test('legacy function handlers delegate message delivery to a service module', () => {
  const legacyFunctions = readRepoFile('server/src/server/functions/legacyFunctions.js');
  const messageDeliveryService = readRepoFile('server/src/server/services/messageDeliveryService.js');

  assert.match(legacyFunctions, /messageDeliveryService/);
  assert.doesNotMatch(legacyFunctions, /async function createNotificationIfEnabled/);
  assert.doesNotMatch(legacyFunctions, /async function deliverContractOfferMessage/);
  assert.doesNotMatch(legacyFunctions, /function messageTypeToNotificationType/);
  assert.match(messageDeliveryService, /async function createNotificationIfEnabled/);
  assert.match(messageDeliveryService, /async function deliverContractOfferMessage/);
  assert.match(messageDeliveryService, /function messageTypeToNotificationType/);
});

test('live match and club chat honor the Messages notification switch', () => {
  const chatMessageController = readRepoFile('server/src/server/controllers/chatMessageController.js');
  const matchRoutes = readRepoFile('server/src/server/mobile/matchRoutes.js');
  const teamRoutes = readRepoFile('server/src/server/mobile/teamRoutes.js');
  const messageDeliveryService = readRepoFile('server/src/server/services/messageDeliveryService.js');
  const chatNotifications = readRepoFile('src/lib/ChatNotificationsContext.jsx');

  assert.match(chatMessageController, /notifyLiveChatIfEnabled\(record\)/);
  assert.match(matchRoutes, /notifyLiveChatIfEnabled\(created\)/);
  assert.match(teamRoutes, /notifyLiveChatIfEnabled\(created\)/);
  assert.match(messageDeliveryService, /async function notifyLiveChatIfEnabled/);
  assert.match(messageDeliveryService, /resolveDelivery\(settings, 'messages'\)/);
  assert.match(messageDeliveryService, /live_chat:\$\{meta\.channelId\}/);
  assert.match(chatNotifications, /isNotificationEnabled\("message"/);
  assert.match(chatNotifications, /messagesEnabledRef/);
  const notificationSettings = readRepoFile('src/components/NotificationSettings.jsx');
  const notificationTypes = readRepoFile('src/lib/notificationTypes.js');
  assert.match(notificationSettings, /useIsPhoneOrPwa/);
  assert.match(notificationSettings, /Web notifications/);
  assert.match(notificationSettings, /NOTIFICATION_CHANNELS/);
  assert.match(notificationTypes, /Email notifications/);
  assert.match(notificationTypes, /Mobile notifications/);
  assert.match(notificationTypes, /Push notifications/);
});

test('auth sends a welcome email on sign-up and never on sign-in', () => {
  const authController = readRepoFile('server/src/server/controllers/authController.js');
  const oauthController = readRepoFile('server/src/server/controllers/oauthController.js');
  const mobileAuth = readRepoFile('server/src/server/mobile/authRoutes.js');
  const notifications = readRepoFile('server/src/server/services/notifications.js');
  const messageDeliveryService = readRepoFile('server/src/server/services/messageDeliveryService.js');
  const matchController = readRepoFile('server/src/server/controllers/matchController.js');
  const notifyParticipant = readRepoFile('server/src/server/services/notify-participant.js');

  assert.doesNotMatch(notifications, /function notifyLogin/);
  assert.match(notifications, /function notifySignup/);
  assert.match(notifications, /function sendEventEmail/);
  assert.doesNotMatch(authController, /notifyLogin/);
  assert.match(authController, /notifySignup/);
  assert.match(authController, /router\.post\('\/register'/);
  assert.doesNotMatch(oauthController, /notifyLogin/);
  assert.match(oauthController, /player\.__isNewUser/);
  assert.match(oauthController, /notifySignup/);
  assert.match(mobileAuth, /notifySignup/);
  assert.match(messageDeliveryService, /sendEventEmail\(\{ to: recipientEmail/);
  assert.match(matchController, /createNotificationIfEnabled/);
  assert.doesNotMatch(matchController, /notifyMatchDay/);
  assert.doesNotMatch(matchController, /notifyMatchResultPlayer/);
  assert.match(notifyParticipant, /createNotificationIfEnabled/);
  assert.doesNotMatch(notifyParticipant, /notifyTournamentAssigned/);
});
