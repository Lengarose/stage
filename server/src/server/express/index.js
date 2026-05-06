const express = require('express');
const http    = require('http');
const cors    = require('cors');
const axios   = require('axios').default;
const { get } = require('../../constants/env');

const app    = express();
const server = http.createServer(app);

app.use(cors());

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
