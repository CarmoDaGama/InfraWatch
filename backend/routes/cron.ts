import { Router } from 'express';
import { checkDeviceWithCircuitBreaker } from '../monitor.js';
import { invalidateDeviceStatsCache } from '../cache.js';
import { checkAndRecordSLAViolation } from '../sla.js';
import { emitIntegrationEvent } from '../integrations/manager.js';

/**
 * Cron-triggered monitoring endpoint.
 *
 * Vercel (serverless) does not support persistent processes, so the
 * polling-based `startMonitoring()` never runs.  This route provides
 * a stateless alternative: an external cron (Vercel Cron Jobs, GitHub
 * Actions, cron-job.org, …) hits `GET /api/cron/monitor` periodically
 * and the handler performs a full monitoring sweep.
 *
 * Protect via the CRON_SECRET env var so it can't be triggered by
 * random HTTP requests.
 */
export default function cronRouter(db: any, notifyFn: any, slaAlertFn: any) {
  const router = Router();

  router.get('/monitor', async (req, res) => {
    // Protect with a shared secret (Vercel Cron sends Authorization header)
    const cronSecret = process.env.CRON_SECRET;
    const authHeader = req.headers.authorization;

    if (cronSecret) {
      const validBearer = authHeader === `Bearer ${cronSecret}`;
      const validQuery = req.query.secret === cronSecret;
      if (!validBearer && !validQuery) {
        return res.status(401).json({ error: 'Unauthorized' });
      }
    }

    try {
      const devices = await db.device.findMany({
        where: { enabled: true },
      });

      if (devices.length === 0) {
        return res.json({ checked: 0, message: 'No enabled devices' });
      }

      const results = await Promise.all(
        devices.map(async (device: any) => {
          try {
            const { status, response_time } = await checkDeviceWithCircuitBreaker(device);

            const previousMetric = await db.metric.findFirst({
              where: { deviceId: device.id },
              select: { status: true },
              orderBy: { checkedAt: 'desc' },
            });

            await db.metric.create({
              data: {
                deviceId: device.id,
                status,
                responseTime: response_time,
              },
            });

            await invalidateDeviceStatsCache(device.id);

            const previousStatus = previousMetric?.status ?? null;
            if (previousStatus !== status) {
              void notifyFn(device, status, previousStatus);
              void emitIntegrationEvent('device.status_changed', {
                device,
                previous_status: previousStatus,
                new_status: status,
              });
            }

            if (slaAlertFn && device.slaTarget && device.slaTarget < 100) {
              void checkAndRecordSLAViolation(db, device, slaAlertFn).catch(() => {});
            }

            return { id: device.id, name: device.name, status, response_time };
          } catch (err) {
            return {
              id: device.id,
              name: device.name,
              status: 'error',
              error: err instanceof Error ? err.message : String(err),
            };
          }
        }),
      );

      return res.json({ checked: results.length, results });
    } catch (err) {
      return res.status(500).json({
        error: err instanceof Error ? err.message : 'Monitoring sweep failed',
      });
    }
  });

  return router;
}
