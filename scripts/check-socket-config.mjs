import { readFileSync } from 'node:fs';

const stageClient = readFileSync('src/api/stageClient.js', 'utf8');
const socketContext = readFileSync('src/lib/SocketContext.jsx', 'utf8');
const socketServer = readFileSync('socket-server/server.js', 'utf8');
const socketSmokeTest = readFileSync('socket-server/scripts/test-socket.js', 'utf8');

const stageAccessKey = stageClient.match(/const ACCESS_KEY\s*=\s*'([^']+)'/)?.[1];
const socketAccessKey = socketContext.match(/const ACCESS_KEY\s*=\s*'([^']+)'/)?.[1];

if (!stageAccessKey) {
  throw new Error('Could not find ACCESS_KEY in src/api/stageClient.js');
}

if (!socketAccessKey) {
  throw new Error('Could not find ACCESS_KEY in src/lib/SocketContext.jsx');
}

if (socketAccessKey !== stageAccessKey) {
  throw new Error(
    `Socket ACCESS_KEY (${socketAccessKey}) does not match stageClient ACCESS_KEY (${stageAccessKey})`
  );
}

if (!socketContext.includes('VITE_SOCKET_URL')) {
  throw new Error('Socket URL must be configurable through VITE_SOCKET_URL');
}

if (socketServer.includes('e11c51e0d9b810e4a6765904a144361248d4976b')) {
  throw new Error('socket-server/server.js must not fallback to a hardcoded ACCESS_TOKEN_SECRET');
}

if (socketSmokeTest.includes('#1?BCJw[JrZ}Y|>?6CVpCHrSCm$6><#)1O_{mRgIdlw')) {
  throw new Error('socket-server/scripts/test-socket.js must require EMIT_SECRET explicitly');
}

if (socketSmokeTest.includes('e11c51e0d9b810e4a6765904a144361248d4976b')) {
  throw new Error('socket-server/scripts/test-socket.js must require ACCESS_TOKEN_SECRET explicitly');
}

console.log('Socket config is aligned with stageClient auth storage.');
