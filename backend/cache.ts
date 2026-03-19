import { Redis } from 'ioredis';

let cacheClient: Redis | null = null;

function isTrue(value: string | undefined) {
  return String(value ?? '').toLowerCase() === 'true';
}

function getErrorMessage(err: unknown) {
  return err instanceof Error ? err.message : String(err);
}

export function isRedisEnabled() {
  return isTrue(process.env.REDIS_ENABLED);
}

export async function initCache() {
  if (!isRedisEnabled()) {
    return null;
  }

  if (cacheClient) {
    return cacheClient;
  }

  const rawRedisUrl = process.env.REDIS_URL ?? 'redis://127.0.0.1:6379';
  const shouldUseTls = rawRedisUrl.startsWith('rediss://') || rawRedisUrl.includes('upstash.io');
  const redisUrl = shouldUseTls && rawRedisUrl.startsWith('redis://')
    ? `rediss://${rawRedisUrl.slice('redis://'.length)}`
    : rawRedisUrl;

  const client = new Redis(redisUrl, {
    maxRetriesPerRequest: 1,
    enableReadyCheck: true,
    lazyConnect: true,
    tls: redisUrl.startsWith('rediss://') ? {} : undefined,
  });

  client.on('error', (err) => {
    console.error('[InfraWatch] Redis cache error:', err.message);
  });

  client.on('end', () => {
    if (cacheClient === client) {
      cacheClient = null;
    }
  });

  try {
    await client.connect();
  } catch (err) {
    console.warn('[InfraWatch] Redis unavailable, continuing without cache/session store:', getErrorMessage(err));
    client.disconnect(false);
    return null;
  }

  cacheClient = client;
  return cacheClient;
}

export function getCacheClient() {
  if (!cacheClient) {
    return null;
  }

  if (cacheClient.status !== 'ready') {
    return null;
  }

  return cacheClient;
}

export async function stopCache() {
  if (!cacheClient) return;
  const client = cacheClient;
  cacheClient = null;
  await client.quit().catch(() => undefined);
}

export async function getCachedJson<T>(key: string, ttlSeconds: number, loader: () => Promise<T>) {
  if (!cacheClient) {
    return loader();
  }

  try {
    const cached = await cacheClient.get(key);
    if (cached) {
      return JSON.parse(cached) as T;
    }
  } catch (err) {
    console.warn('[InfraWatch] Redis get failed, bypassing cache:', (err as Error).message);
    return loader();
  }

  const data = await loader();

  try {
    await cacheClient.setex(key, ttlSeconds, JSON.stringify(data));
  } catch (err) {
    console.warn('[InfraWatch] Redis set failed, continuing without cache:', (err as Error).message);
  }

  return data;
}

export async function deleteCacheKeys(keys: string[]) {
  if (!cacheClient || keys.length === 0) return;
  await cacheClient.del(...keys).catch(() => undefined);
}

export async function invalidateByPrefix(prefix: string) {
  if (!cacheClient) return;
  const pattern = `${prefix}*`;
  const keys = await cacheClient.keys(pattern).catch(() => []);
  if (keys.length > 0) {
    await cacheClient.del(...keys).catch(() => undefined);
  }
}

export async function invalidateDeviceStatsCache(deviceId: number) {
  await Promise.allSettled([
    invalidateByPrefix('cache:devices:list'),
    invalidateByPrefix('cache:metrics:uptime:'),
    invalidateByPrefix(`cache:metrics:device:${deviceId}:`),
    invalidateByPrefix(`cache:sla:device:${deviceId}:`),
    invalidateByPrefix('cache:sla:violations:'),
  ]);
}
