const express    = require('express');
const http       = require('http');
const { Server } = require('socket.io');
const jwt        = require('jsonwebtoken');

const app    = express();
const server = http.createServer(app);

app.disable('x-powered-by');
app.use(express.json({ limit: '256kb' }));
app.set('trust proxy', 1);

const PORT = Number(process.env.PORT || 3001);
const ACCESS_TOKEN_SECRET = process.env.ACCESS_TOKEN_SECRET || '';
// REST server uses SOCKET_SERVER_SECRET; socket server accepts either name.
const EMIT_SECRET =
  process.env.EMIT_SECRET || process.env.SOCKET_SERVER_SECRET || '';
const startedAt = new Date();
const metrics = {
  totalConnections: 0,
  currentConnections: 0,
  joinAccepted: 0,
  joinRejected: 0,
  emitsAccepted: 0,
  emitsRejected: 0,
  emittedPackets: 0,
  authRejected: 0,
};

if (!ACCESS_TOKEN_SECRET) console.warn('[socket] WARNING: ACCESS_TOKEN_SECRET not set');
if (!EMIT_SECRET) console.warn('[socket] WARNING: EMIT_SECRET / SOCKET_SERVER_SECRET not set');

function parseAllowedOrigins() {
  const raw =
    process.env.ALLOWED_ORIGINS ||
    process.env.FRONTEND_URL ||
    '*';
  if (raw === '*') return '*';
  return raw
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);
}

const allowedOrigins = parseAllowedOrigins();

const io = new Server(server, {
  cors: {
    origin: allowedOrigins,
    methods: ['GET', 'POST'],
    credentials: true,
  },
  transports: ['websocket', 'polling'],
  pingTimeout: 60000,
  pingInterval: 25000,
  allowEIO3: true,
});

// Verify JWT on every socket connection
io.use((socket, next) => {
  const token = socket.handshake.auth?.token;
  if (!token) {
    metrics.authRejected += 1;
    return next(new Error('Authentication required'));
  }
  try {
    socket.user = jwt.verify(token, ACCESS_TOKEN_SECRET, { algorithms: ['HS256'] });
    if (!socket.user?.id && !socket.user?.email) {
      metrics.authRejected += 1;
      return next(new Error('Invalid token payload'));
    }
    next();
  } catch {
    metrics.authRejected += 1;
    next(new Error('Invalid token'));
  }
});

function canJoinChannel(user, channel) {
  const value = String(channel || '');
  if (!value || value.length > 160) return false;
  if (!/^STAGE_[A-Z_]+(?:_[A-Za-z0-9@._:-]+)?$/.test(value)) return false;

  const email = String(user?.email || '').toLowerCase();
  const userId = String(user?.id || '');
  const playerId = String(user?.player_id || '');

  if (value.startsWith('STAGE_NOTIFICATION_')) {
    return Boolean(email && value.slice('STAGE_NOTIFICATION_'.length).toLowerCase() === email);
  }
  if (value.startsWith('STAGE_INBOX_')) {
    const target = value.slice('STAGE_INBOX_'.length);
    return Boolean(
      (email && target.toLowerCase() === email) ||
      (playerId && target === playerId) ||
      (userId && target === userId)
    );
  }
  return true;
}

io.on('connection', (socket) => {
  metrics.totalConnections += 1;
  metrics.currentConnections += 1;
  console.log(`[socket] connected: ${socket.id} (user: ${socket.user?.id})`);

  socket.on('JOINLEAVEROOM', ({ action, channel } = {}) => {
    if (!channel) return;
    if (!canJoinChannel(socket.user, channel)) {
      metrics.joinRejected += 1;
      socket.emit('join_error', { channel, error: 'Forbidden channel' });
      return;
    }
    metrics.joinAccepted += 1;
    action === 'join' ? socket.join(channel) : socket.leave(channel);
  });

  socket.on('disconnect', () => {
    metrics.currentConnections = Math.max(0, metrics.currentConnections - 1);
    console.log(`[socket] disconnected: ${socket.id}`);
  });
});

// Internal endpoint — called by the Gandi REST server to broadcast events
app.post('/emit', (req, res) => {
  if (!EMIT_SECRET || req.headers['x-emit-secret'] !== EMIT_SECRET) {
    metrics.emitsRejected += 1;
    return res.status(401).json({ error: 'Unauthorized' });
  }
  const { channel, data } = req.body;
  if (!channel) {
    metrics.emitsRejected += 1;
    return res.status(400).json({ error: 'channel required' });
  }
  if (typeof channel !== 'string' || channel.length > 160 || !/^STAGE_[A-Z_]+(?:_[A-Za-z0-9@._:-]+)?$/.test(channel)) {
    metrics.emitsRejected += 1;
    return res.status(400).json({ error: 'invalid channel' });
  }
  const packet = { _channel: channel, ...(data || {}) };
  io.to(channel).emit('update', packet);
  metrics.emitsAccepted += 1;
  metrics.emittedPackets += io.sockets.adapter.rooms.get(channel)?.size || 0;
  res.json({ ok: true, recipients: io.sockets.adapter.rooms.get(channel)?.size || 0, eventId: packet.event_id || packet.id || null });
});

app.get('/health', (_req, res) =>
  res.json({
    ok: true,
    service: 'stage-socket-server',
    uptimeSeconds: Math.round(process.uptime()),
    startedAt: startedAt.toISOString(),
    connections: io.engine?.clientsCount ?? 0,
  })
);

app.get('/metrics', (_req, res) => {
  res.json({
    ok: true,
    service: 'stage-socket-server',
    uptimeSeconds: Math.round(process.uptime()),
    startedAt: startedAt.toISOString(),
    rooms: Math.max(0, io.sockets.adapter.rooms.size - (io.engine?.clientsCount ?? 0)),
    ...metrics,
    currentConnections: io.engine?.clientsCount ?? metrics.currentConnections,
  });
});

server.listen(PORT, '0.0.0.0', () => {
  console.log(`[socket] running on 0.0.0.0:${PORT}`);
  console.log(`[socket] CORS origins: ${Array.isArray(allowedOrigins) ? allowedOrigins.join(', ') : allowedOrigins}`);
});
