import { createContext, useContext, useEffect, useRef, useState, useCallback } from 'react';
import { io } from 'socket.io-client';

const SOCKET_URL  = 'https://stageleagues.com';
const ACCESS_KEY  = 'stage_access_token';

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

/** Build a targeted channel, e.g. makeChannel(clubId, CHANNELS.CLUB) → "STAGE_CLUB_abc123" */
export const makeChannel = (id, channel) =>
  id ? `${channel}_${String(id)}` : channel;

// ── Context ────────────────────────────────────────────────────────────────────
const SocketContext = createContext(null);

/** @param {{ children: import('react').ReactNode }} props */
export const SocketProvider = ({ children }) => {
  const socketRef   = useRef(null);
  const listenersRef = useRef(new Map()); // Map<channel, Set<callback>>
  const [isConnected, setIsConnected] = useState(false);

  useEffect(() => {
    const token = localStorage.getItem(ACCESS_KEY);

    const socket = io(SOCKET_URL, {
      transports: ['websocket', 'polling'],
      auth: { token },
      reconnectionAttempts: 10,
      reconnectionDelay:    2000,
    });

    socketRef.current = socket;

    socket.on('connect',    () => setIsConnected(true));
    socket.on('disconnect', () => setIsConnected(false));

    // All socket mutations arrive as 'update' with _channel in the payload
    socket.on('update', (data) => {
      const { _channel, ...payload } = data || {};
      if (!_channel) return;
      listenersRef.current.get(_channel)?.forEach(cb => cb(payload));
    });

    return () => socket.disconnect();
  }, []);

  const joinRoom = useCallback((channel) => {
    socketRef.current?.emit('JOINLEAVEROOM', { action: 'join', channel });
  }, []);

  const leaveRoom = useCallback((channel) => {
    socketRef.current?.emit('JOINLEAVEROOM', { action: 'leave', channel });
    listenersRef.current.delete(channel);
  }, []);

  /** Subscribe to a channel. Returns an unsubscribe function. */
  const subscribe = useCallback((channel, callback) => {
    if (!listenersRef.current.has(channel)) {
      listenersRef.current.set(channel, new Set());
    }
    listenersRef.current.get(channel).add(callback);
    return () => listenersRef.current.get(channel)?.delete(callback);
  }, []);

  return (
    <SocketContext.Provider value={{ isConnected, joinRoom, leaveRoom, subscribe }}>
      {children}
    </SocketContext.Provider>
  );
};

export const useSocket = () => useContext(SocketContext);
