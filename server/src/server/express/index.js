const express    = require('express');
const http       = require('http');
const { Server } = require('socket.io');
const cors       = require('cors');
const jwt        = require('jsonwebtoken');
const { ACCESS_TOKEN_SECRET } = require('../../constants/constants');

const app    = express();
const server = http.createServer(app);

const io = new Server(server, {
  cors: { origin: '*', methods: ['GET', 'POST', 'PATCH', 'DELETE'], credentials: true },
  pingTimeout:  60000,
  pingInterval: 25000,
  transports:   ['websocket', 'polling'],
  allowEIO3:    true,
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

app.use(cors());

io.on('connection', (socket) => {
  console.log(`[socket] connected: ${socket.id} (user: ${socket.user?.id})`);

  socket.on('JOINLEAVEROOM', ({ action, channel } = {}) => {
    if (!channel) return;
    action === 'join' ? socket.join(channel) : socket.leave(channel);
  });

  socket.on('disconnect', () => console.log(`[socket] disconnected: ${socket.id}`));
});

// Shared emit helper — always includes _channel so the client can route the event
const socketEmit = (channel, data) => {
  io.to(channel).emit('update', { _channel: channel, ...(data || {}) });
};

module.exports = { app, io, server, express, socketEmit };
