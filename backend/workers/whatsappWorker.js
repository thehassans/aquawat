/**
 * Dedicated WhatsApp (whatsapp-web.js / Chromium) worker.
 *
 * Run with:
 *   node workers/whatsappWorker.js
 *   npm run worker:whatsapp
 *
 * Set WHATSAPP_WORKER=1 on this process (done below).
 * On API replicas, set WHATSAPP_WORKER_EXTERNAL=1 so initClient refuses
 * to launch Chromium in-process and operators use this worker instead.
 */
import dotenv from 'dotenv';
dotenv.config();

process.env.WHATSAPP_WORKER = '1';

import mongoose from 'mongoose';
import whatsappService from '../services/whatsappService.js';

const mongoUri = process.env.MONGODB_URI || 'mongodb://localhost:27017/zatca-erp';

async function main() {
  console.log('[whatsappWorker] Dedicated WA worker starting (WHATSAPP_WORKER=1)');
  await mongoose.connect(mongoUri);
  console.log('[whatsappWorker] MongoDB connected');
  console.log('[whatsappWorker] whatsappService loaded; keep this process alive for Chromium sessions');
  // Export / retain the service so sessions can be driven from this process.
  // API routes that call initClient will fail while WHATSAPP_WORKER_EXTERNAL=1.
  void whatsappService;
}

main().catch((err) => {
  console.error('[whatsappWorker] Fatal:', err);
  process.exit(1);
});

// Keep the process alive for long-running Chromium clients
setInterval(() => {}, 60_000);

export { whatsappService };
export default whatsappService;
