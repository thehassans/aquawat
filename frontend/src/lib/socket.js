import { io } from 'socket.io-client';

let socket = null;
let connectErrorCount = 0;
let lastErrorLogAt = 0;

export const initSocket = (token) => {
  if (socket) {
    socket.disconnect();
  }

  // Determine the WebSocket URL based on the current environment/Vite config
  // VITE_API_URL might look like '/api' or 'http://localhost:5000/api'
  let socketUrl = import.meta.env.VITE_API_URL || '';
  if (socketUrl.endsWith('/api')) {
    socketUrl = socketUrl.replace('/api', '');
  }
  if (!socketUrl || socketUrl === '') {
    socketUrl = window.location.origin;
  }

  connectErrorCount = 0;

  socket = io(socketUrl, {
    auth: { token },
    reconnection: true,
    reconnectionAttempts: Infinity,
    reconnectionDelay: 2000,
    reconnectionDelayMax: 30000,
    randomizationFactor: 0.5,
    // Skip the HTTP long-polling handshake entirely and connect straight
    // over WebSocket. The backend runs multiple cluster workers/containers
    // without sticky sessions, so polling's multi-request handshake can land
    // on a different worker mid-negotiation and fail; a single persistent
    // WebSocket connection has no such requirement.
    transports: ['websocket'],
    // During deploys proxies may return HTML 200 instead of 101 — fail fast
    // and back off rather than hammering the handshake.
    timeout: 12000,
  });

  socket.on('connect', () => {
    connectErrorCount = 0;
  });

  socket.on('disconnect', () => {
    // Quiet — reconnect is automatic.
  });

  socket.on('connect_error', (err) => {
    connectErrorCount += 1;
    const msg = String(err?.message || err || '');
    const now = Date.now();
    // Rate-limit console noise (WS handshake 200 / deploy pages spam otherwise).
    const shouldLog = import.meta.env.DEV || (now - lastErrorLogAt > 15000 && connectErrorCount <= 3);
    if (shouldLog) {
      lastErrorLogAt = now;
      console.warn('Socket connection error:', msg);
    }
    // After repeated failures (maintenance / upstream down), pause briefly so
    // we do not spin the browser WebSocket constructor against HTML 200 pages.
    if (connectErrorCount >= 5 && socket?.io?.opts) {
      socket.io.opts.reconnectionDelay = Math.min(
        30000,
        2000 * Math.min(connectErrorCount, 10)
      );
    }
  });

  return socket;
};

export const getSocket = () => {
  return socket;
};

export const disconnectSocket = () => {
  if (socket) {
    socket.disconnect();
    socket = null;
  }
};
