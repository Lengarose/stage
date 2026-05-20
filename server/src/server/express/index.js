const express = require('express');
const http    = require('http');
const cors    = require('cors');
const axios   = require('axios').default;
const { get } = require('../../constants/env');

const app    = express();
const server = http.createServer(app);

// CORS — allow production origin + localhost dev. Add origins as needed.
const ALLOWED_ORIGINS = [
  'https://stageleagues.com',
  'https://www.stageleagues.com',
  'http://localhost:5173',    // Vite dev
  'http://localhost:3000',    // alt dev
];
app.use(cors({
  origin(origin, cb) {
    // Allow requests with no origin (server-to-server, curl, mobile apps)
    if (!origin || ALLOWED_ORIGINS.includes(origin)) return cb(null, true);
    cb(new Error('Not allowed by CORS'));
  },
  credentials: true,
}));

const SOCKET_SERVER_URL    = get('SOCKET_SERVER_URL')    || '';
const SOCKET_SERVER_SECRET = get('SOCKET_SERVER_SECRET') || '';

// Forward events to the dedicated socket server (runs on a WebSocket-capable host).
// Fire-and-forget — REST responses are never delayed by socket delivery.
const socketEmit = (channel, data) => {
  if (!SOCKET_SERVER_URL) return;
  axios.post(
    `${SOCKET_SERVER_URL}/emit`,
    { channel, data },
    { headers: { 'x-emit-secret': SOCKET_SERVER_SECRET }, timeout: 3000 }
  ).catch((err) => console.error('[socketEmit]', err.message));
};

module.exports = { app, server, express, socketEmit };
