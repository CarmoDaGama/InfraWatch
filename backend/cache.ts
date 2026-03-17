import { Redis } from 'ioredis';

let cacheClient: Redis | null = null;

function isTrue(value: string | undefined) {
  return String(value ?? '').toLowerCase() === 'true';
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

  const redisUrl = process.env.REDIS_URL ?? 'redis://127.0.0.1:6379';
  const client = new Redis(redisUrl, {
    maxRetriesPerRequest: 1,
    enableReadyCheck: true,
  });

  client.on('error', (err) => {
    console.error('[InfraWatch] Redis cache error:', err.message);
  });

  await client.connect().catch(() => undefined);
  cacheClient = client;
  return cacheClient;
}

export function getCacheClient() {
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
