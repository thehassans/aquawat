import logger from '../utils/logger.js';
import { captureException } from '../utils/errorTracking.js';

export const notFound = (req, res, next) => {
  const error = new Error(`Not Found - ${req.originalUrl}`);
  res.status(404);
  next(error);
};

export const errorHandler = (err, req, res, next) => {
  let statusCode = res.statusCode === 200 ? 500 : res.statusCode;
  let message = err.message;
  const isProd = process.env.NODE_ENV === 'production';

  // Mongoose bad ObjectId
  if (err.name === 'CastError' && err.kind === 'ObjectId') {
    statusCode = 404;
    message = 'Resource not found';
  }

  // Mongoose duplicate key
  if (err.code === 11000) {
    statusCode = 400;
    const field = Object.keys(err.keyValue || {})[0] || 'field';
    message = `Duplicate value for ${field}`;
  }

  // Mongoose validation error
  if (err.name === 'ValidationError') {
    statusCode = 400;
    message = Object.values(err.errors || {}).map((e) => e.message).join(', ');
  }

  logger.error({
    message: err.message,
    stack: err.stack,
    url: req.originalUrl,
    method: req.method,
    user: req.user?.id || req.user?._id,
    requestId: req.requestId,
  });

  if (statusCode >= 500) {
    captureException(err, {
      user: req.user?.id || req.user?._id,
      url: req.originalUrl,
      method: req.method,
      requestId: req.requestId,
    });
  }

  // Never leak internal exception text on 5xx in production
  if (isProd && statusCode >= 500) {
    message = 'Internal server error';
  }

  res.status(statusCode).json({
    error: message,
    ...(req.requestId ? { requestId: req.requestId } : {}),
    ...(!isProd && { stack: err.stack }),
  });
};

export default { notFound, errorHandler };
