/**
 * Dedicated invoice PDF worker (BullMQ + Puppeteer).
 *
 *   node workers/invoicePdfWorker.js
 *   npm run worker:pdf
 *
 * On API processes set PDF_WORKER_DEDICATED=true so they only enqueue.
 */
import dotenv from 'dotenv';
import mongoose from 'mongoose';
import { startPdfQueueWorker, closePdfQueue } from '../services/invoicePdfQueue.js';
import logger from '../utils/logger.js';

dotenv.config();
process.env.PDF_WORKER_DEDICATED = 'false';

const mongoUri = process.env.MONGODB_URI || 'mongodb://localhost:27017/zatca-erp';

async function main() {
  logger.info('[pdfWorker] starting');
  await mongoose.connect(mongoUri, {
    serverSelectionTimeoutMS: Number(process.env.MONGODB_SERVER_SELECTION_TIMEOUT_MS || 5000),
    maxPoolSize: Number(process.env.MONGODB_MAX_POOL_SIZE || 5),
  });
  logger.info('[pdfWorker] MongoDB connected');
  startPdfQueueWorker();
}

async function shutdown(signal) {
  logger.info(`[pdfWorker] ${signal} — closing`);
  try {
    await closePdfQueue();
  } catch { /* ignore */ }
  try {
    await mongoose.disconnect();
  } catch { /* ignore */ }
  process.exit(0);
}

process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('SIGINT', () => shutdown('SIGINT'));

main().catch((error) => {
  logger.error(`[pdfWorker] fatal: ${error.message}`);
  process.exit(1);
});
