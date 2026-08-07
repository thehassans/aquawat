import { Server } from 'socket.io';
import jwt from 'jsonwebtoken';
import Redis from 'ioredis';
import { createAdapter } from '@socket.io/redis-adapter';
import logger from '../utils/logger.js';

let io;

export const initSocket = (server) => {
  io = new Server(server, {
    cors: {
      origin: '*', // Adjust this for production
      methods: ['GET', 'POST']
    }
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
  io.use((socket, next) => {
    const token = socket.handshake.auth?.token || socket.handshake.headers?.authorization?.split(' ')[1];
    if (!token) {
      return next(new Error('Authentication error: No token provided'));
    }
    try {
      const decoded = jwt.verify(token, process.env.JWT_SECRET);
      socket.user = decoded; // { id: userId, tenantId, ... }
      
      // Auto-join the tenant's global room
      if (decoded.tenantId) {
        socket.join(`tenant_${decoded.tenantId}`);
        logger.info(`Socket connected: User ${decoded.id} joined room tenant_${decoded.tenantId}`);
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
