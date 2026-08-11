/**
 * Fail-fast production env checks. Call once at process boot before listening.
 */
export function validateProductionEnv({ logger = console } = {}) {
  const isProd = process.env.NODE_ENV === 'production';
  const errors = [];
  const warnings = [];

  const jwt = String(process.env.JWT_SECRET || '').trim();
  if (!jwt || jwt.length < 32) {
    errors.push('JWT_SECRET must be set to a strong value (min 32 chars)');
  }
  if (jwt === 'change-me' || jwt === 'secret' || jwt.toLowerCase().includes('changeme')) {
    errors.push('JWT_SECRET is a known insecure default');
  }

  if (isProd) {
    if (!process.env.MONGODB_URI) {
      errors.push('MONGODB_URI must be set in production');
    }

    const superPass = process.env.SUPER_ADMIN_PASSWORD;
    if (superPass === 'SuperAdmin@123' || superPass === 'admin' || superPass === 'password') {
      errors.push('SUPER_ADMIN_PASSWORD must not use the insecure default in production');
    }

    const hasS3 = Boolean(
      process.env.S3_BUCKET && process.env.S3_ACCESS_KEY && process.env.S3_SECRET_KEY
    );
    if (!hasS3) {
      if (process.env.REQUIRE_OBJECT_STORAGE === 'true') {
        errors.push(
          'S3_BUCKET/S3_ACCESS_KEY/S3_SECRET_KEY required when REQUIRE_OBJECT_STORAGE=true'
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
  }

  for (const w of warnings) {
    logger.warn?.(`[env] ${w}`) || console.warn(`[env] ${w}`);
  }

  if (errors.length) {
    const message = `Environment validation failed:\n- ${errors.join('\n- ')}`;
    if (isProd) {
      throw new Error(message);
    }
    logger.warn?.(`[env] ${message}`) || console.warn(`[env] ${message}`);
  }

  return { ok: errors.length === 0, errors, warnings };
}

export default { validateProductionEnv };
