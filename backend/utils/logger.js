import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import winston from 'winston';
import DailyRotateFile from 'winston-daily-rotate-file';
import { getRequestId } from './requestId.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const logsDirectory = path.resolve(__dirname, '../logs');

fs.mkdirSync(logsDirectory, { recursive: true });

const withRequestId = winston.format((info) => {
  const requestId = getRequestId();
  if (requestId && !info.requestId) info.requestId = requestId;
  return info;
});

// Shared format: timestamp + error stack + JSON
const baseFormat = winston.format.combine(
  withRequestId(),
  winston.format.timestamp(),
  winston.format.errors({ stack: true }),
  winston.format.json()
);

// Daily-rotate transport — keeps 14 days, max 20 MB per file
const makeRotatingTransport = (level, filename) =>
  new DailyRotateFile({
    dirname: logsDirectory,
    filename: `${filename}-%DATE%.log`,
    datePattern: 'YYYY-MM-DD',
    zippedArchive: true,       // gzip rotated files to save disk space
    maxSize: '20m',
    maxFiles: '14d',
    level,
    format: baseFormat,
  });

const logger = winston.createLogger({
  level: process.env.LOG_LEVEL || 'info',
  defaultMeta: { service: 'maqder-erp' },
  transports: [
    makeRotatingTransport('error', 'error'),
    makeRotatingTransport('info', 'combined'),
  ],
});

// Console transport: always on in development, opt-in in production via LOG_CONSOLE=true
if (process.env.NODE_ENV !== 'production' || process.env.LOG_CONSOLE === 'true') {
  logger.add(new winston.transports.Console({
    format: winston.format.combine(
      winston.format.colorize(),
      winston.format.simple()
    )
  }));
}

export default logger;
