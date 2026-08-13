import test from 'node:test';
import assert from 'node:assert/strict';
import { validateProductionEnv } from '../utils/envValidation.js';
import { sentryTracesSampleRate } from '../utils/errorTracking.js';

const silent = { warn() {}, error() {}, info() {} };

function withEnv(overrides, fn) {
  const keys = Object.keys(overrides);
  const prev = {};
  for (const key of keys) {
    prev[key] = process.env[key];
    if (overrides[key] === undefined) delete process.env[key];
    else process.env[key] = overrides[key];
  }
  try {
    return fn();
  } finally {
    for (const key of keys) {
      if (prev[key] === undefined) delete process.env[key];
      else process.env[key] = prev[key];
    }
  }
}

test('production hard-fails known example JWT_SECRET', () => {
  withEnv({
    NODE_ENV: 'production',
    JWT_SECRET: 'your-super-secret-jwt-key-change-in-production-min-32',
    MONGODB_URI: 'mongodb://localhost/maqder',
  }, () => {
    assert.throws(
      () => validateProductionEnv({ logger: silent }),
      /insecure example/
    );
  });
});

test('production accepts a unique 32+ JWT_SECRET', () => {
  withEnv({
    NODE_ENV: 'production',
    JWT_SECRET: 'a-unique-production-jwt-secret-value-ok',
    MONGODB_URI: 'mongodb://localhost/maqder',
  }, () => {
    const result = validateProductionEnv({ logger: silent });
    assert.equal(result.ok, true);
  });
});

test('Sentry tracesSampleRate defaults to 5% in production', () => {
  withEnv({ NODE_ENV: 'production', SENTRY_TRACES_SAMPLE_RATE: undefined }, () => {
    assert.equal(sentryTracesSampleRate(), 0.05);
  });
});

test('SENTRY_TRACES_SAMPLE_RATE env overrides default', () => {
  withEnv({ NODE_ENV: 'production', SENTRY_TRACES_SAMPLE_RATE: '0.2' }, () => {
    assert.equal(sentryTracesSampleRate(), 0.2);
  });
});
