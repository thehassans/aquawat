/**
 * cluster.js — Multi-process entry point for production.
 *
 * Forks one worker per CPU core (max 2 on this VPS) so the app uses both
 * cores. Each worker runs the full server.js. The primary process only
 * manages worker lifecycle — it never handles HTTP requests itself.
 *
 * Key improvement: each worker receives a unique WORKER_ID env var.
 * Only worker #1 runs cron jobs (Iqama, ZATCA, IMAP, reports, etc.)
 * to prevent duplicate background job execution across workers.
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

  // Fork workers, assigning each a unique WORKER_ID starting from 1.
  // Worker #1 is the designated cron worker and runs all background jobs.
  for (let i = 1; i <= NUM_WORKERS; i++) {
    cluster.fork({ WORKER_ID: String(i) });
  }

  // Track WORKER_ID per PID so we can reassign it on respawn
  const workerIdMap = new Map();
  let nextWorkerId = NUM_WORKERS + 1;

  cluster.on('fork', (worker) => {
    const wid = worker.process.env?.WORKER_ID || String(nextWorkerId++);
    workerIdMap.set(worker.process.pid, wid);
  });

  // Respawn dead workers automatically
  cluster.on('exit', (worker, code, signal) => {
    const reason = signal || code;
    const deadPid = worker.process.pid;
    console.warn(`[cluster] Worker ${deadPid} died (${reason}) — respawning`);

    // Brief delay before respawning to prevent tight restart loops
    setTimeout(() => {
      // Assign a new unique WORKER_ID (>= 2 so cron doesn't duplicate)
      const newId = String(nextWorkerId++);
      workerIdMap.delete(deadPid);
      cluster.fork({ WORKER_ID: newId });
    }, 1_000);
  });

  cluster.on('online', (worker) => {
    const wid = workerIdMap.get(worker.process.pid) || '?';
    console.log(`[cluster] Worker ${worker.process.pid} (id=${wid}) online${wid === '1' ? ' ← CRON WORKER' : ''}`);
  });

} else {
  // Worker process: import and run the actual Express server
  await import('./server.js');
}
