import crypto from 'crypto';
import { getCacheClient, isRedisEnabled } from './cache.js';

const SESSION_PREFIX = 'session:';

export function isSessionStoreEnabled() {
  return isRedisEnabled() && String(process.env.REDIS_SESSION_ENABLED ?? 'true').toLowerCase() === 'true';
}

export async function createSession(user: { id: number; email: string; role: string }, ttlSeconds: number) {
  const cache = getCacheClient();
  if (!cache || !isSessionStoreEnabled()) {
    return null;
  }

  const jti = crypto.randomUUID();
  const key = `${SESSION_PREFIX}${jti}`;
  await cache.setex(
    key,
    ttlSeconds,
    JSON.stringify({
      user_id: user.id,
      email: user.email,
      role: user.role,
      created_at: new Date().toISOString(),
    })
  );

  return jti;
}

export async function hasActiveSession(jti: string | undefined) {
  if (!jti) return false;

  const cache = getCacheClient();
  if (!cache || !isSessionStoreEnabled()) {
    return true;
  }

  const value = await cache.get(`${SESSION_PREFIX}${jti}`).catch(() => null);
  return Boolean(value);
}

export async function revokeSession(jti: string | undefined) {
  if (!jti) return;

  const cache = getCacheClient();
  if (!cache || !isSessionStoreEnabled()) {
    return;
  }

  await cache.del(`${SESSION_PREFIX}${jti}`).catch(() => undefined);
}
