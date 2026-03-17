import Queue from 'bull';
import { checkAndRecordSLAViolation } from './sla.js';
import { invalidateDeviceStatsCache } from './cache.js';
import { emitIntegrationEvent } from './integrations/manager.js';

type Dependencies = {
  db: any;
  notifyFn: (device: any, newStatus: string, previousStatus: string | null) => Promise<void>;
  slaAlertFn?: ((device: any, message: string) => Promise<void>) | null;
};

let monitorQueue: Queue.Queue | null = null;
let notificationQueue: Queue.Queue | null = null;
let initialized = false;

function isTrue(value: string | undefined) {
  return String(value ?? '').toLowerCase() === 'true';
}

export function isWorkerQueueEnabled() {
  return isTrue(process.env.WORKER_QUEUE_ENABLED);
}

function getRedisConfig() {
  const redisUrl = process.env.REDIS_URL ?? 'redis://127.0.0.1:6379';
  return redisUrl;
}

export async function initQueues(deps: Dependencies) {
  if (!isWorkerQueueEnabled()) {
    return;
  }
  if (initialized) {
    return;
  }

  const redis = getRedisConfig();
  monitorQueue = new Queue('monitor-checks', redis);
  notificationQueue = new Queue('notifications', redis);

  const monitorConcurrency = Number.parseInt(process.env.MONITOR_WORKER_CONCURRENCY ?? '5', 10) || 5;
  const notificationConcurrency =
    Number.parseInt(process.env.NOTIFY_WORKER_CONCURRENCY ?? '8', 10) || 8;

  monitorQueue.process(monitorConcurrency, async (job) => {
    const deviceId = Number.parseInt(String(job.data.deviceId), 10);
    if (!Number.isInteger(deviceId) || deviceId <= 0) {
      return;
    }

    const device = await deps.db.device.findUnique({ where: { id: deviceId } });
    if (!device || !device.enabled) {
      return;
    }

    const { checkDeviceWithCircuitBreaker } = await import('./monitor.js');
    const { status, response_time } = await checkDeviceWithCircuitBreaker(device);

    const previousMetric = await deps.db.metric.findFirst({
      where: { deviceId: device.id },
      select: { status: true },
      orderBy: { checkedAt: 'desc' },
    });

    await deps.db.metric.create({
      data: {
        deviceId: device.id,
        status,
        responseTime: response_time,
      },
    });

    await invalidateDeviceStatsCache(device.id);

    if (deps.slaAlertFn && device.slaTarget && device.slaTarget < 100) {
      await checkAndRecordSLAViolation(deps.db, device, deps.slaAlertFn).catch((err) => {
        console.error(`[Worker] SLA check failed for device ${device.id}:`, err);
      });
    }

    const previousStatus = previousMetric?.status ?? null;
    if (previousStatus !== status && notificationQueue) {
      await notificationQueue.add(
        {
          device,
          newStatus: status,
          previousStatus,
        },
        {
          attempts: 3,
          backoff: { type: 'exponential', delay: 1000 },
          removeOnComplete: true,
        }
      );

      await emitIntegrationEvent('device.status_changed', {
        device,
        previous_status: previousStatus,
        new_status: status,
      });
    }
  });

  notificationQueue.process(notificationConcurrency, async (job) => {
    const { device, newStatus, previousStatus } = job.data;
    await deps.notifyFn(device, newStatus, previousStatus ?? null);
  });

  initialized = true;
}

export async function enqueueMonitorCheck(deviceId: number) {
  if (!monitorQueue) return;
  await monitorQueue.add(
    { deviceId },
    {
      jobId: `monitor:${deviceId}:${Date.now()}`,
      removeOnComplete: true,
      attempts: 2,
      backoff: { type: 'exponential', delay: 1000 },
    }
  );
}

export async function stopQueues() {
  await Promise.allSettled([
    monitorQueue?.close(),
    notificationQueue?.close(),
  ]);
  monitorQueue = null;
  notificationQueue = null;
  initialized = false;
}
