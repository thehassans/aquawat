import { Server } from 'socket.io';
import jwt from 'jsonwebtoken';
import Redis from 'ioredis';
import { createAdapter } from '@socket.io/redis-adapter';
import logger from '../utils/logger.js';
import User from '../models/User.js';

let io;

const socketAllowedOrigins = () => {
  const configured = String(process.env.FRONTEND_URL || 'http://localhost:5173')
    .split(',')
    .map((origin) => origin.trim())
    .filter(Boolean);
  if (process.env.NODE_ENV !== 'production') {
    return [...new Set([...configured, 'http://localhost:5173', 'http://127.0.0.1:5173'])];
  }
  return configured;
};

export const initSocket = (server) => {
  const allowedOrigins = socketAllowedOrigins();
  io = new Server(server, {
    cors: {
      origin: (origin, callback) => {
        if (!origin || allowedOrigins.includes(origin)) {
          return callback(null, true);
        }
        return callback(new Error('Not allowed by Socket CORS'));
      },
      methods: ['GET', 'POST'],
    },
    // Websocket-only: avoids the multi-request HTTP long-polling handshake,
    // which requires sticky sessions to consistently reach the same cluster
    // worker/container. A single persistent WebSocket connection lands on
    // one worker for its whole lifetime, so this scales across the cluster
    // (and multiple backend replicas behind Nginx) without sticky sessions.
    transports: ['websocket'],
  });

  // Create dedicated Redis clients for Socket.io Pub/Sub
  const REDIS_URL = process.env.REDIS_URL || 'redis://localhost:6379';
  const REDIS_ENABLED = process.env.REDIS_ENABLED !== 'false';

  if (REDIS_ENABLED) {
    try {
      const pubClient = new Redis(REDIS_URL, {
        maxRetriesPerRequest: 1,
        // For socket.io pub/sub, we must keep the offline queue enabled (default)
        // or handle errors gracefully, otherwise socket.io crashes the server.
        retryStrategy: (times) => {
          if (times > 3) return null; // stop retrying
          return Math.min(times * 500, 2000);
        },
      });
      const subClient = pubClient.duplicate();
      
      pubClient.on('error', (err) => logger.warn(`[Socket.io Redis Pub] ${err.message}`));
      subClient.on('error', (err) => logger.warn(`[Socket.io Redis Sub] ${err.message}`));

      io.adapter(createAdapter(pubClient, subClient));
      logger.info('Socket.io Redis adapter initialized successfully');
    } catch (err) {
      logger.warn(`Failed to initialize Socket.io Redis adapter: ${err.message}`);
    }
  }

  // Authentication Middleware
  io.use(async (socket, next) => {
    const token = socket.handshake.auth?.token || socket.handshake.headers?.authorization?.split(' ')[1];
    if (!token) {
      return next(new Error('Authentication error: No token provided'));
    }
    try {
      const decoded = jwt.verify(token, process.env.JWT_SECRET);
      socket.user = { id: decoded.id, tenantId: decoded.tenantId ? String(decoded.tenantId) : null };

      // Backfill tenantId for older tokens that only carry { id }
      if (!socket.user.tenantId && socket.user.id) {
        const user = await User.findById(socket.user.id).select('tenantId').lean();
        if (user?.tenantId) {
          socket.user.tenantId = String(user.tenantId);
        }
      }
      
      // Auto-join the tenant's global room
      if (socket.user.tenantId) {
        socket.join(`tenant_${socket.user.tenantId}`);
        logger.info(`Socket connected: User ${socket.user.id} joined room tenant_${socket.user.tenantId}`);
      }
      
      next();
    } catch (err) {
      next(new Error('Authentication error: Invalid token'));
    }
  });

  io.on('connection', (socket) => {
    // Client can explicitly request to join specific sub-rooms (e.g., kitchen, kds)
    socket.on('join_room', (roomName) => {
      if (socket.user?.tenantId) {
        const fullRoomName = `tenant_${socket.user.tenantId}_${roomName}`;
        socket.join(fullRoomName);
        logger.info(`Socket ${socket.id} joined room ${fullRoomName}`);
      }
    });

    socket.on('leave_room', (roomName) => {
      if (socket.user?.tenantId) {
        const fullRoomName = `tenant_${socket.user.tenantId}_${roomName}`;
        socket.leave(fullRoomName);
      }
    });

    socket.on('disconnect', () => {
      // logger.info(`Socket disconnected: ${socket.id}`);
    });
  });

  return io;
};

export const getIO = () => {
  if (!io) {
    throw new Error('Socket.io has not been initialized!');
  }
  return io;
};

/**
 * Emit an event to a specific tenant's room.
 * @param {string} tenantId 
 * @param {string} event 
 * @param {any} data 
 * @param {string} [subRoom] Optional. Emit to a specific sub-room (e.g., 'kitchen')
 */
export const emitToTenant = (tenantId, event, data, subRoom = null) => {
  if (!io) return;
  const room = subRoom ? `tenant_${tenantId}_${subRoom}` : `tenant_${tenantId}`;
  io.to(room).emit(event, data);
};
