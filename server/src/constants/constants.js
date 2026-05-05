const { get } = require('./env');

const PORT = get('PORT') || 8080;

const ACCESS_TOKEN_SECRET  = get('ACCESS_TOKEN_SECRET')  || 'stage-access-secret';
const REFRESH_TOKEN_SECRET = get('REFRESH_TOKEN_SECRET') || 'stage-refresh-secret';

const PAGESIZE = 25;

const BASE_URL = get('BASE_URL') || 'http://localhost:3000';
const BASE_URL_API = `${BASE_URL}/api/stage`;

const MAKE_SOCKET_CHANNEL = (id, channel) => (id ? `${channel}_${String(id)}` : channel);

const SOCKET_CHANNELS = {
  PLAYER:        'STAGE_PLAYER',
  CLUB:          'STAGE_CLUB',
  MATCH:         'STAGE_MATCH',
  POST:          'STAGE_POST',
  NOTIFICATION:  'STAGE_NOTIFICATION',
  INBOX:         'STAGE_INBOX',
  DRESSING_ROOM: 'STAGE_DRESSING_ROOM',
  CHAT_MESSAGE:  'STAGE_CHAT_MESSAGE',
  TOURNAMENT:    'STAGE_TOURNAMENT',
};

module.exports = {
  PORT, ACCESS_TOKEN_SECRET, REFRESH_TOKEN_SECRET,
  PAGESIZE, BASE_URL, BASE_URL_API,
  MAKE_SOCKET_CHANNEL, SOCKET_CHANNELS,
};
