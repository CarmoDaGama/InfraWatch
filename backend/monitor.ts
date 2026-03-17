import axios from 'axios';
import ping from 'ping';
import snmp from 'net-snmp';
import { checkAndRecordSLAViolation } from './sla.js';
import {
  getOrCreateCircuitBreaker,
  executeWithRetry,
} from './circuit-breaker.js';
import { invalidateDeviceStatsCache } from './cache.js';
import { emitIntegrationEvent } from './integrations/manager.js';
import { enqueueMonitorCheck, isWorkerQueueEnabled } from './queue.js';

let intervalId = null;
const DEFAULT_FALLBACK_INTERVAL_MS = 5000;

interface CheckResult {
  status: 'up' | 'down';
  response_time: number | null;
}

function resolveDeviceIntervalMs(device, fallbackMs) {
  const intervalSeconds = Number(device?.checkIntervalSeconds ?? device?.check_interval_seconds);
  if (Number.isInteger(intervalSeconds) && intervalSeconds > 0) {
    return intervalSeconds * 1000;
  }
  return fallbackMs;
}

// ── Individual checkers ───────────────────────────────────────────────────────

export async function checkHttp(device): Promise<CheckResult> {
  const start = Date.now();
  try {
    await axios.get(device.url, { timeout: 10000 });
    return { status: 'up', response_time: Date.now() - start };
  } catch {
    return { status: 'down', response_time: null };
  }
}

export async function checkPing(device): Promise<CheckResult> {
  const start = Date.now();
  try {
    const result = await ping.promise.probe(device.url, { timeout: 5, min_reply: 1 });
    if (result.alive) {
      const rt = parseFloat(result.time);
      return {
        status: 'up',
        response_time: Number.isFinite(rt) ? rt : Date.now() - start,
      };
    }
    return { status: 'down', response_time: null };
  } catch {
    return { status: 'down', response_time: null };
  }
}

export function checkSnmp(device): Promise<CheckResult> {
  return new Promise((resolve) => {
    const start     = Date.now();
    const host      = device.url;
    const community = device.snmpCommunity ?? device.snmp_community ?? 'public';
    const oid       = device.snmpOid ?? device.snmp_oid ?? '1.3.6.1.2.1.1.1.0';
    const port      = device.snmpPort ?? device.snmp_port ?? 161;

    let session;
    try {
      session = snmp.createSession(host, community, {
        port,
        timeout: 5000,
        retries: 1,
        version: snmp.Version2c,
      });
    } catch {
      resolve({ status: 'down', response_time: null });
      return;
    }

    session.get([oid], (error, varbinds) => {
      session.close(); // always close to avoid UDP socket leaks
      if (error) {
        resolve({ status: 'down', response_time: null });
        return;
      }
      const ok = varbinds.every((vb) => !snmp.isVarbindError(vb));
      resolve({ status: ok ? 'up' : 'down', response_time: Date.now() - start });
    });
  });
}

// ── Dispatcher ────────────────────────────────────────────────────────────────

export async function checkDevice(device): Promise<CheckResult> {
  switch (device.type) {
    case 'ping': return checkPing(device);
    case 'snmp': return checkSnmp(device);
    default:     return checkHttp(device); // 'http' or missing type
  }
}

// ── Circuit Breaker Integration ────────────────────────────────────────────────

export async function checkDeviceWithCircuitBreaker(
  device,
): Promise<CheckResult> {
  const breaker = getOrCreateCircuitBreaker(device.id, {
    failureThreshold: 5,
    resetTimeoutMs: 60 * 1000, // 1 minute
    backoffMultiplier: 1.5,
    maxBackoffMs: 5 * 60 * 1000, // 5 minutes
  });

  // Check circuit state
  if (!breaker.isRequestAllowed()) {
    const timeUntilRetry = breaker.getTimeUntilRetry();
    console.log(
      `[CircuitBreaker] Device ${device.id} is OPEN, ` +
      `skipping check (retry in ${(timeUntilRetry / 1000).toFixed(0)}s)`,
    );
    return {
      status: 'down',
      response_time: null,
    };
  }

  try {
    // Execute check with exponential backoff retry
    const result = await executeWithRetry(
      () => checkDevice(device),
      `Device check ${device.id} (${device.name})`,
      {
        maxRetries: 2,
        initialDelayMs: 500,
        maxDelayMs: 3000,
        backoffMultiplier: 2,
      },
    );

    breaker.recordSuccess();
    return result;
  } catch (error) {
    breaker.recordFailure();
    console.error(
      `[Monitor] Device ${device.id} check failed: ${error instanceof Error ? error.message : String(error)}`,
    );
    return { status: 'down', response_time: null };
  }
}

// ── Poll loop ─────────────────────────────────────────────────────────────────

export function startMonitoring(db, notifyFn, slaAlertFn = null) {
  const configuredFallback = parseInt(
    process.env.MONITOR_INTERVAL ?? String(DEFAULT_FALLBACK_INTERVAL_MS),
    10
  );
  const fallbackIntervalMs =
    Number.isInteger(configuredFallback) && configuredFallback > 0
      ? configuredFallback
      : DEFAULT_FALLBACK_INTERVAL_MS;

  // Poll frequently enough to support per-device intervals while keeping CPU low.
  const tickMs = Math.min(1000, fallbackIntervalMs);
  const lastCheckAtByDevice = new Map();
  const inFlight = new Set();
  let pollRunning = false;

  const poll = async () => {
    if (pollRunning) return;
    pollRunning = true;

    try {
      const devices = await db.device.findMany({
        where: { enabled: true },
      });

      const enabledIds = new Set(devices.map((device) => device.id));
      for (const deviceId of lastCheckAtByDevice.keys()) {
        if (!enabledIds.has(deviceId)) {
          lastCheckAtByDevice.delete(deviceId);
        }
      }
      for (const deviceId of inFlight) {
        if (!enabledIds.has(deviceId)) {
          inFlight.delete(deviceId);
        }
      }

      const now = Date.now();
      const dueDevices = [];

      for (const device of devices) {
        if (inFlight.has(device.id)) continue;

        const intervalMs = resolveDeviceIntervalMs(device, fallbackIntervalMs);
        const lastCheckAt = lastCheckAtByDevice.get(device.id) ?? 0;
        if (now - lastCheckAt < intervalMs) continue;

        lastCheckAtByDevice.set(device.id, now);
        inFlight.add(device.id);
        dueDevices.push(device);
      }

      if (dueDevices.length === 0) return;

      if (isWorkerQueueEnabled()) {
        await Promise.allSettled(dueDevices.map((device) => enqueueMonitorCheck(device.id)));
        for (const device of dueDevices) {
          inFlight.delete(device.id);
        }
        return;
      }

      const results = await Promise.all(
        dueDevices.map(async (device) => {
          try {
            const { status, response_time } = await checkDeviceWithCircuitBreaker(device);
            return { device, status, response_time };
          } catch {
            return { device, status: 'down', response_time: null };
          }
        })
      );

      for (const { device, status, response_time } of results) {
        try {
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

          // ── Check SLA Violation after metric is recorded ──
          if (slaAlertFn && device.slaTarget && device.slaTarget < 100) {
            void checkAndRecordSLAViolation(db, device, slaAlertFn).catch((err) => {
              console.error(`[Monitor] SLA check error for device ${device.id}:`, err);
            });
          }
        } finally {
          inFlight.delete(device.id);
        }
      }
    } finally {
      pollRunning = false;
    }
  };

  void poll();
  intervalId = setInterval(() => {
    void poll();
  }, tickMs);
  return intervalId;
}

export function stopMonitoring() {
  if (intervalId !== null) {
    clearInterval(intervalId);
    intervalId = null;
  }
}
