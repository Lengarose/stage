const express    = require('express');
const http       = require('http');
const { Server } = require('socket.io');
const jwt        = require('jsonwebtoken');

const app    = express();
const server = http.createServer(app);

app.use(express.json());
app.set('trust proxy', 1);

const PORT =  3001;
const ACCESS_TOKEN_SECRET =
  process.env.ACCESS_TOKEN_SECRET || 'e11c51e0d9b810e4a6765904a144361248d4976b';
// REST server uses SOCKET_SERVER_SECRET; socket server accepts either name.
const EMIT_SECRET =
  process.env.EMIT_SECRET || process.env.SOCKET_SERVER_SECRET || '';

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
  if (!token) return next(new Error('Authentication required'));
  try {
    socket.user = jwt.verify(token, ACCESS_TOKEN_SECRET);
    next();
  } catch {
    next(new Error('Invalid token'));
  }
});

io.on('connection', (socket) => {
  console.log(`[socket] connected: ${socket.id} (user: ${socket.user?.id})`);

  socket.on('JOINLEAVEROOM', ({ action, channel } = {}) => {
    if (!channel) return;
    action === 'join' ? socket.join(channel) : socket.leave(channel);
  });

  socket.on('disconnect', () => console.log(`[socket] disconnected: ${socket.id}`));
});

// Internal endpoint — called by the Gandi REST server to broadcast events
app.post('/emit', (req, res) => {
  if (!EMIT_SECRET || req.headers['x-emit-secret'] !== EMIT_SECRET) {
    return res.status(401).json({ error: 'Unauthorized' });
  }
  const { channel, data } = req.body;
  if (!channel) return res.status(400).json({ error: 'channel required' });
  io.to(channel).emit('update', { _channel: channel, ...(data || {}) });
  res.json({ ok: true });
});

app.get('/health', (_req, res) =>
  res.json({
    ok: true,
    service: 'stage-socket-server',
    connections: io.engine?.clientsCount ?? 0,
  })
);

server.listen(PORT, '0.0.0.0', () => {
  console.log(`[socket] running on 0.0.0.0:${PORT}`);
  console.log(`[socket] CORS origins: ${Array.isArray(allowedOrigins) ? allowedOrigins.join(', ') : allowedOrigins}`);
});
