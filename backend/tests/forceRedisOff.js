/** Import first in unit tests that pull in auth/redis so ioredis does not keep the process alive. */
process.env.REDIS_ENABLED = 'false';
