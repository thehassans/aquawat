/**
 * ecosystem.config.cjs — PM2 process manager config for production.
 *
 * Usage:
 *   pm2 start ecosystem.config.cjs --env production
 *   pm2 reload ecosystem.config.cjs --env production   (zero-downtime reload)
 *   pm2 logs
 *   pm2 monit
 *
 * Two-process strategy:
 *   1. maqder-api   — N cluster workers, handles HTTP requests (no crons)
 *   2. maqder-cron  — single process dedicated to all background cron jobs
 *
 * This separation means:
 *   - Zero-downtime deploys: reload API workers without dropping cron jobs
 *   - No duplicate cron execution (was a bug with native cluster.js)
 *   - Memory limit per worker: crashed workers auto-restart
 */

module.exports = {
  apps: [
    {
      name: 'maqder-api',
      script: 'server.js',
      cwd: '/app',
      instances: 2,               // Match CLUSTER_WORKERS
      exec_mode: 'cluster',
      max_memory_restart: '600M', // Restart worker if it exceeds 600 MB
      autorestart: true,
      watch: false,
      env_production: {
        NODE_ENV: 'production',
        PORT: 3000,
        WORKER_ID: 'auto',        // PM2 assigns sequential IDs
        CRON_WORKER: '0',         // Disable crons in API workers
        REDIS_ENABLED: 'true',
      },
    },
    {
      name: 'maqder-cron',
      script: 'server.js',
      cwd: '/app',
      instances: 1,               // Always single cron worker
      exec_mode: 'fork',
      max_memory_restart: '400M',
      autorestart: true,
      watch: false,
      env_production: {
        NODE_ENV: 'production',
        PORT: 3001,               // Different port — not exposed publicly
        WORKER_ID: '1',
        CRON_WORKER: '1',         // Only this process runs cron jobs
        REDIS_ENABLED: 'true',
        // Lower pool size — cron worker doesn't handle HTTP traffic
        MONGODB_MAX_POOL_SIZE: '5',
        MONGODB_MIN_POOL_SIZE: '1',
      },
    },
  ],
};
