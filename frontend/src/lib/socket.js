import { io } from 'socket.io-client';

let socket = null;

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

  socket = io(socketUrl, {
    auth: { token },
    reconnection: true,
    reconnectionAttempts: Infinity,
    reconnectionDelay: 1000,
    reconnectionDelayMax: 5000,
  });

  socket.on('connect', () => {
    // console.log('Socket connected:', socket.id);
  });

  socket.on('disconnect', () => {
    // console.log('Socket disconnected');
  });

  socket.on('connect_error', (err) => {
    console.error('Socket connection error:', err.message);
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
