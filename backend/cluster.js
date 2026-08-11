/**
 * cluster.js — Multi-process entry point for production.
 *
 * Forks workers and preserves WORKER_ID on respawn so cron ownership
 * (worker #1) can recover when Redis election is unavailable.
 */

import cluster from 'cluster';
import os from 'os';
import { fileURLToPath } from 'url';
import path from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const MAX_WORKERS = Number(process.env.CLUSTER_WORKERS || os.cpus().length);
const NUM_WORKERS = Math.max(1, Math.min(MAX_WORKERS, os.cpus().length));

if (cluster.isPrimary) {
  console.log(`[cluster] Primary ${process.pid} — forking ${NUM_WORKERS} worker(s)`);

  /** pid -> WORKER_ID */
  const workerIdByPid = new Map();
  /** freed WORKER_IDs ready for reuse (prefer reusing #1 for cron) */
  const freeIds = [];
  let nextWorkerId = 1;

  const allocateWorkerId = () => {
    if (freeIds.length) {
      freeIds.sort((a, b) => Number(a) - Number(b));
      return freeIds.shift();
    }
    return String(nextWorkerId++);
  };

  for (let i = 0; i < NUM_WORKERS; i++) {
    const wid = allocateWorkerId();
    const worker = cluster.fork({ WORKER_ID: wid });
    workerIdByPid.set(worker.process.pid, wid);
  }

  cluster.on('exit', (worker, code, signal) => {
    const reason = signal || code;
    const deadPid = worker.process.pid;
    const deadId = workerIdByPid.get(deadPid) || null;
    workerIdByPid.delete(deadPid);
    if (deadId) freeIds.push(String(deadId));

    console.warn(`[cluster] Worker ${deadPid} (id=${deadId || '?'}) died (${reason}) — respawning`);

    setTimeout(() => {
      const newId = allocateWorkerId();
      const replacement = cluster.fork({ WORKER_ID: newId });
      workerIdByPid.set(replacement.process.pid, newId);
      console.log(`[cluster] Respawned worker ${replacement.process.pid} as id=${newId}${newId === '1' ? ' ← CRON WORKER' : ''}`);
    }, 1_000);
  });

  cluster.on('online', (worker) => {
    const wid = workerIdByPid.get(worker.process.pid) || worker.process.env?.WORKER_ID || '?';
    console.log(`[cluster] Worker ${worker.process.pid} (id=${wid}) online${wid === '1' ? ' ← CRON WORKER' : ''}`);
  });
} else {
  await import('./server.js');
}
