import { Router } from 'express';
import { requirePermission } from '../middleware/rbac.js';
import { toApiMetric, toIsoString } from '../serializers.js';
import { getCachedJson } from '../cache.js';

function getBucketSizeMinutes(hours) {
  if (hours <= 2) return null;
  if (hours <= 6) return 5;
  if (hours <= 24) return 15;
  return 60;
}

function getQueryValue(value, fallback) {
  if (Array.isArray(value)) {
    return value[0] ?? fallback;
  }
  if (typeof value === 'string') {
    return value;
  }
  return fallback;
}

function parsePositiveInteger(value, fallback) {
  const parsed = Number.parseInt(String(value), 10);
  if (!Number.isInteger(parsed) || parsed <= 0) {
    return fallback;
  }
  return parsed;
}

function getBucketStart(timestamp, bucketSizeMinutes) {
  const bucket = new Date(timestamp);
  bucket.setUTCSeconds(0, 0);

  if (bucketSizeMinutes === 60) {
    bucket.setUTCMinutes(0);
  } else {
    bucket.setUTCMinutes(Math.floor(bucket.getUTCMinutes() / bucketSizeMinutes) * bucketSizeMinutes);
  }

  return bucket.toISOString();
}

type MetricBucket = {
  bucket: string;
  hasDown: boolean;
  responseTimeTotal: number;
  upChecks: number;
  check_count: number;
};

export default function metricsRouter(db) {
  const router = Router();

  router.get('/', requirePermission('metrics:read'), async (req, res) => {
    try {
      const hours = parsePositiveInteger(getQueryValue(req.query.hours, '24'), 24);
      const limit = parsePositiveInteger(getQueryValue(req.query.limit, '200'), 200);
      const deviceId = getQueryValue(req.query.device_id, '');
      const parsedDeviceId = deviceId ? Number.parseInt(deviceId, 10) : null;

      if (deviceId && (!Number.isInteger(parsedDeviceId) || parsedDeviceId <= 0)) {
        return res.status(400).json({ error: 'Invalid device_id' });
      }

      const since = new Date(Date.now() - hours * 60 * 60 * 1000);
      const metrics = await db.metric.findMany({
        where: {
          checkedAt: { gte: since },
          ...(parsedDeviceId ? { deviceId: parsedDeviceId } : {}),
        },
        include: {
          device: {
            select: {
              name: true,
              url: true,
            },
          },
        },
        orderBy: { checkedAt: 'desc' },
        take: limit,
      });

      res.json(metrics.map(toApiMetric));
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  // Per-device time-series endpoint for the history drawer.
  // Returns bucketed data (5 min / 15 min / 1 h) for longer windows to keep
  // the payload small, plus aggregated stats for the period.
  router.get('/device/:id', requirePermission('metrics:read'), async (req, res) => {
    const deviceId = Number.parseInt(req.params.id, 10);
    if (!Number.isInteger(deviceId) || deviceId <= 0) {
      return res.status(400).json({ error: 'Invalid device id' });
    }

    try {
      const hours = parsePositiveInteger(getQueryValue(req.query.hours, '24'), 24);
      const since = new Date(Date.now() - hours * 60 * 60 * 1000);
      const bucketSizeMinutes = getBucketSizeMinutes(hours);
      const cacheKey = `cache:metrics:device:${deviceId}:hours:${hours}`;
      const payload = await getCachedJson(cacheKey, 30, async () => {
        const rows = await db.metric.findMany({
          where: {
            deviceId,
            checkedAt: { gte: since },
          },
          select: {
            status: true,
            responseTime: true,
            checkedAt: true,
          },
          orderBy: { checkedAt: 'asc' },
          take: bucketSizeMinutes === null ? 720 : undefined,
        });

        const metrics =
          bucketSizeMinutes === null
            ? rows.map((row) => ({
                bucket: toIsoString(row.checkedAt),
                status: row.status,
                response_time: row.responseTime,
                check_count: 1,
              }))
            : (() => {
                const buckets = rows.reduce((accumulator, row) => {
                  const bucket = getBucketStart(row.checkedAt, bucketSizeMinutes);
                  const current = accumulator.get(bucket) ?? {
                    bucket,
                    hasDown: false,
                    responseTimeTotal: 0,
                    upChecks: 0,
                    check_count: 0,
                  };

                  current.hasDown = current.hasDown || row.status === 'down';
                  current.check_count += 1;
                  if (row.status === 'up' && typeof row.responseTime === 'number') {
                    current.responseTimeTotal += row.responseTime;
                    current.upChecks += 1;
                  }

                  accumulator.set(bucket, current);
                  return accumulator;
                }, new Map<string, MetricBucket>());
                const bucketValues = Array.from(buckets.values()) as MetricBucket[];

                return bucketValues
                  .sort((left, right) => left.bucket.localeCompare(right.bucket))
                  .map((bucket) => ({
                    bucket: bucket.bucket,
                    status: bucket.hasDown ? 'down' : 'up',
                    response_time: bucket.upChecks > 0 ? bucket.responseTimeTotal / bucket.upChecks : null,
                    check_count: bucket.check_count,
                  }));
              })();

        const upResponseTimes = rows
          .filter((row) => row.status === 'up' && typeof row.responseTime === 'number')
          .map((row) => row.responseTime as number);
        const stats = {
          total: rows.length,
          up_count: rows.filter((row) => row.status === 'up').length,
          down_count: rows.filter((row) => row.status === 'down').length,
          avg_rt:
            upResponseTimes.length > 0
              ? upResponseTimes.reduce((sum, value) => sum + value, 0) / upResponseTimes.length
              : null,
          min_rt: upResponseTimes.length > 0 ? Math.min(...upResponseTimes) : null,
          max_rt: upResponseTimes.length > 0 ? Math.max(...upResponseTimes) : null,
        };

        return { metrics, stats };
      });

      res.json(payload);
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  router.get('/uptime', requirePermission('metrics:read'), async (req, res) => {
    try {
      const hours = parsePositiveInteger(getQueryValue(req.query.hours, '24'), 24);
      const since = new Date(Date.now() - hours * 60 * 60 * 1000);
      const cacheKey = `cache:metrics:uptime:hours:${hours}`;
      const payload = await getCachedJson(cacheKey, 30, async () => {
        const devices = await db.device.findMany({
          orderBy: { createdAt: 'asc' },
          include: {
            metrics: {
              where: { checkedAt: { gte: since } },
              select: { status: true },
            },
          },
        });

        return devices.map((device) => {
          const totalChecks = device.metrics.length;
          const upCount = device.metrics.filter((metric) => metric.status === 'up').length;
          const uptimePct =
            totalChecks > 0 ? Math.round((upCount / totalChecks) * 10000) / 100 : null;
          const slaTarget = device.slaTarget ?? 99.0;
          const criticality = device.criticality ?? 'medium';
          const slaMet = uptimePct !== null ? uptimePct >= slaTarget : null;

          return {
            id: device.id,
            name: device.name,
            url: device.url,
            sla_target: slaTarget,
            criticality,
            uptime_pct: uptimePct,
            sla_met: slaMet,
            total_checks: totalChecks,
            up_count: upCount,
          };
        });
      });

      res.json(payload);
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  return router;
}
