import { Server } from 'socket.io';
import jwt from 'jsonwebtoken';
import { getRedisClient } from './redis.js';
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

  const redisClient = getRedisClient();
  // If Redis is ready, use the Redis adapter so events are shared across PM2 cluster workers
  if (redisClient) {
    const subClient = redisClient.duplicate();
    io.adapter(createAdapter(redisClient, subClient));
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
