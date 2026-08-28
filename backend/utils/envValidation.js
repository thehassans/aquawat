/**
 * Fail-fast production env checks. Call once at process boot before listening.
 *
 * Hard errors = process must not start (auth would be broken).
 * Warnings = log loudly but allow single-node deploys to recover.
 */
export function validateProductionEnv({ logger = console } = {}) {
  const isProd = process.env.NODE_ENV === 'production';
  const errors = [];
  const warnings = [];

  const jwt = String(process.env.JWT_SECRET || '').trim();
  if (!jwt || jwt.length < 32) {
    // Missing/short secret breaks auth entirely — hard fail in production.
    errors.push('JWT_SECRET must be set to a strong value (min 32 chars)');
  }
  const insecureJwtDefaults = new Set([
    'change-me',
    'secret',
    'changeme',
    'your-super-secret-jwt-key-change-in-production',
    'your-super-secret-jwt-key-change-in-production-min-32',
  ]);
  if (jwt && insecureJwtDefaults.has(jwt.toLowerCase())) {
    const msg = 'JWT_SECRET matches a known insecure example value — set a unique secret';
    if (isProd) errors.push(msg);
    else warnings.push(msg);
  }

  if (isProd) {
    if (!process.env.MONGODB_URI) {
      errors.push('MONGODB_URI must be set in production');
    }

    const superPass = String(process.env.SUPER_ADMIN_PASSWORD || '');
    if (
      !superPass ||
      superPass === 'SuperAdmin@123' ||
      superPass === 'admin' ||
      superPass === 'password' ||
      superPass === 'ChangeMeToAStrongPassword!'
    ) {
      // Warn only — seed already refuses to create a default admin in production.
      // Hard-failing here takes down existing deploys whose .env still has the old default.
      warnings.push(
        'SUPER_ADMIN_PASSWORD is missing or uses an insecure default — rotate it immediately'
      );
    }

    const hasS3 = Boolean(
      process.env.S3_BUCKET && process.env.S3_ACCESS_KEY && process.env.S3_SECRET_KEY
    );
    if (!hasS3) {
      if (process.env.REQUIRE_OBJECT_STORAGE === 'true') {
        errors.push(
          'S3_BUCKET/S3_ACCESS_KEY/S3_SECRET_KEY required when REQUIRE_OBJECT_STORAGE=true'
        );
      } else if (process.env.ALLOW_LOCAL_UPLOADS === 'true') {
        // Explicit single-node uploads — do not warn on every boot.
      } else if (isProd && process.env.NODE_ENV === 'production') {
        warnings.push(
          'Object storage (S3/R2) not configured — set S3_* vars or ALLOW_LOCAL_UPLOADS=true for single-node deploys. Production compose should set REQUIRE_OBJECT_STORAGE=true'
        );
      } else {
        warnings.push(
          'Object storage (S3/R2) not configured — local uploads block horizontal scaling. Set S3_* or ALLOW_LOCAL_UPLOADS=true explicitly'
        );
      }
    }

    if (!process.env.ZATCA_KEY_ENCRYPTION_KEY && jwt) {
      warnings.push('ZATCA_KEY_ENCRYPTION_KEY not set — falling back to JWT_SECRET for key encryption');
    }

    if (!process.env.REDIS_URL && !process.env.REDIS_HOST) {
      warnings.push('Redis not configured — rate limits, Socket.IO adapter, and cron election will be process-local');
    }

    const mongoUri = String(process.env.MONGODB_URI || '');
    if (/mongodb\.net/i.test(mongoUri) && process.env.ATLAS_PITR !== 'true') {
      warnings.push('Atlas cluster detected — enable Continuous Cloud Backup (PITR) in the Atlas UI. File mongodump is not point-in-time recovery');
    }
  }

  for (const w of warnings) {
    if (typeof logger.warn === 'function') logger.warn(`[env] ${w}`);
    else console.warn(`[env] ${w}`);
  }

  if (errors.length) {
    const message = `Environment validation failed:\n- ${errors.join('\n- ')}`;
    if (isProd) {
      throw new Error(message);
    }
    if (typeof logger.warn === 'function') logger.warn(`[env] ${message}`);
    else console.warn(`[env] ${message}`);
  }

  return { ok: errors.length === 0, errors, warnings };
}

export default { validateProductionEnv };
