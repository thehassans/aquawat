/**
 * Dedicated cron worker — runs scheduled jobs without blocking API cluster workers.
 * Start: node workers/cronWorker.js  (docker-compose service: cron-worker)
 */
import dotenv from 'dotenv';
import mongoose from 'mongoose';
import http from 'http';
import { applySecretFiles } from '../utils/secretFiles.js';
import { validateProductionEnv } from '../utils/envValidation.js';
import { startCronJobs } from '../services/cronScheduler.js';
import logger from '../utils/logger.js';

dotenv.config();
applySecretFiles();
validateProductionEnv({ logger });

process.env.CRON_WORKER = '1';
process.env.WORKER_ID = process.env.WORKER_ID || '1';

const mongoUri = process.env.MONGODB_URI || 'mongodb://localhost:27017/maqder';
const healthPort = Number(process.env.CRON_WORKER_HEALTH_PORT || 3002);

const server = http.createServer((_req, res) => {
  res.writeHead(200, { 'Content-Type': 'application/json' });
  res.end(JSON.stringify({ status: 'OK', role: 'cron-worker', ts: new Date().toISOString() }));
});

async function boot() {
  await mongoose.connect(mongoUri, {
    maxPoolSize: Number(process.env.MONGODB_MAX_POOL_SIZE || 5),
    serverSelectionTimeoutMS: 5000,
  });
  logger.info('[cron-worker] MongoDB connected');

  await startCronJobs({ dbReady: () => mongoose.connection.readyState === 1 });
  server.listen(healthPort, () => {
    logger.info(`[cron-worker] Health on :${healthPort}`);
  });
}

boot().catch((err) => {
  logger.error('[cron-worker] Boot failed:', err);
  process.exit(1);
});

const shutdown = async (signal) => {
  logger.info(`[cron-worker] ${signal} — shutting down`);
  server.close();
  await mongoose.disconnect().catch(() => {});
  process.exit(0);
};

process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('SIGINT', () => shutdown('SIGINT'));
