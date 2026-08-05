/**
 * cluster.js — Multi-process entry point for production.
 *
 * Forks one worker per CPU core (max 2 on this VPS) so the app uses both
 * cores. Each worker runs the full server.js. The primary process only
 * manages worker lifecycle — it never handles HTTP requests itself.
 *
 * Usage:
 *   node cluster.js          (production)
 *   node server.js           (dev / single-process debug)
 *
 * Workers share the same port via the OS-level SO_REUSEPORT mechanism that
 * Node cluster uses. No load-balancer config change needed.
 */

import cluster from 'cluster';
import os from 'os';
import { fileURLToPath } from 'url';
import path from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname  = path.dirname(__filename);

// Cap at CLUSTER_WORKERS env-var, or physical core count (max 2 on this VPS)
const MAX_WORKERS  = Number(process.env.CLUSTER_WORKERS || os.cpus().length);
const NUM_WORKERS  = Math.max(1, Math.min(MAX_WORKERS, os.cpus().length));

if (cluster.isPrimary) {
  console.log(`[cluster] Primary ${process.pid} — forking ${NUM_WORKERS} worker(s)`);

  // Fork workers
  for (let i = 0; i < NUM_WORKERS; i++) {
    cluster.fork();
  }

  // Respawn dead workers automatically
  cluster.on('exit', (worker, code, signal) => {
    const reason = signal || code;
    console.warn(`[cluster] Worker ${worker.process.pid} died (${reason}) — respawning`);

    // Brief delay before respawning to prevent tight restart loops
    setTimeout(() => cluster.fork(), 1_000);
  });

  cluster.on('online', (worker) => {
    console.log(`[cluster] Worker ${worker.process.pid} online`);
  });

} else {
  // Worker process: import and run the actual Express server
  await import('./server.js');
}
