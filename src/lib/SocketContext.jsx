import { createContext, useContext, useEffect, useState } from 'react';
import { io } from 'socket.io-client';

const viteEnv = /** @type {any} */ (import.meta).env;
const rawSocketUrl = (viteEnv && viteEnv.VITE_SOCKET_URL) || '';
let SOCKET_URL = rawSocketUrl || window.location.origin;
try {
  const parsed = rawSocketUrl ? new URL(rawSocketUrl, window.location.origin) : null;
  const currentHost = window.location.hostname;
  const socketHost = parsed ? parsed.hostname : '';
  const envPointsToLocalhost = socketHost === 'localhost' || socketHost === '127.0.0.1';
  const appNotLocalhost = currentHost !== 'localhost' && currentHost !== '127.0.0.1';
  if (rawSocketUrl && envPointsToLocalhost && appNotLocalhost) {
    SOCKET_URL = window.location.origin;
  }
} catch {
  SOCKET_URL = window.location.origin;
}
const ACCESS_KEY = 'stage_access_token';

// ── Channel constants (mirrors server/src/constants/constants.js) ──────────────
export const CHANNELS = {
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

/** Build a targeted channel e.g. makeChannel(clubId, CHANNELS.CLUB) → "STAGE_CLUB_abc123" */
export const makeChannel = (id, channel) =>
  id ? `${channel}_${String(id)}` : channel;

// ── Singleton socket client ────────────────────────────────────────────────────
export const SOCKET_CLIENT = io(SOCKET_URL, {
  // Polling-first is more reliable on shared hosts/proxies.
  transports: ['polling', 'websocket'],
  upgrade: true,
  auth: { token: localStorage.getItem(ACCESS_KEY) },
  reconnectionAttempts: 10,
  reconnectionDelay:    2000,
  autoConnect:          false,
});

// Internal listener registry: Map<channel, callback>
const _listeners = new Map();

SOCKET_CLIENT.on('update', (data) => {
  const { _channel, ...payload } = data || {};
  if (!_channel) return;
  _listeners.get(_channel)?.(payload);
});

/**
 * Join a room and register a callback for that channel.
 * Replaces any previous callback for the same channel (prevents duplicates).
 *
 * Usage (in useEffect):
 *   setSocketListeners(makeChannel(matchId, CHANNELS.MATCH), (data) => { ... });
 *   return () => offSocketListeners(makeChannel(matchId, CHANNELS.MATCH));
 */
export const setSocketListeners = (channel, callback) => {
  _listeners.set(channel, callback);
  SOCKET_CLIENT.emit('JOINLEAVEROOM', { action: 'join', channel });
};

/**
 * Leave a room and remove its callback.
 */
export const offSocketListeners = (channel) => {
  SOCKET_CLIENT.emit('JOINLEAVEROOM', { action: 'leave', channel });
  _listeners.delete(channel);
};

// ── Context (connection status only) ──────────────────────────────────────────
const SocketContext = createContext({ isConnected: false });

export const SocketProvider = ({ children }) => {
  const [isConnected, setIsConnected] = useState(SOCKET_CLIENT.connected);

  useEffect(() => {
    SOCKET_CLIENT.auth = { token: localStorage.getItem(ACCESS_KEY) };
    SOCKET_CLIENT.connect();

    const onConnect    = () => setIsConnected(true);
    const onDisconnect = () => setIsConnected(false);

    SOCKET_CLIENT.on('connect',    onConnect);
    SOCKET_CLIENT.on('disconnect', onDisconnect);

    return () => {
      SOCKET_CLIENT.off('connect',    onConnect);
      SOCKET_CLIENT.off('disconnect', onDisconnect);
    };
  }, []);

  return (
    <SocketContext.Provider value={{ isConnected }}>
      {children}
    </SocketContext.Provider>
  );
};

export const useSocket = () => useContext(SocketContext);
