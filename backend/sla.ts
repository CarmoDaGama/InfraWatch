/**
 * SLA Tracking Module
 * 
 * Handles calculation of uptime percentages, detection of SLA violations,
 * and triggering alerts when metrics drop below configured targets.
 */

/**
 * Calculate uptime percentage for a device over a given period
 */
export async function calculateUptime(
  db,
  deviceId: number,
  hoursBack: number = 24
): Promise<{ uptime: number; totalChecks: number; downChecks: number }> {
  const since = new Date(Date.now() - hoursBack * 60 * 60 * 1000);

  const metrics = await db.metric.findMany({
    where: {
      deviceId,
      checkedAt: { gte: since },
    },
    select: {
      status: true,
    },
  });

  if (metrics.length === 0) {
    // No data in period, assume 100%
    return { uptime: 100, totalChecks: 0, downChecks: 0 };
  }

  const downChecks = metrics.filter((m) => m.status === 'down').length;
  const totalChecks = metrics.length;
  const uptime = ((totalChecks - downChecks) / totalChecks) * 100;

  return {
    uptime: Math.round(uptime * 100) / 100, // Round to 2 decimals
    totalChecks,
    downChecks,
  };
}

/**
 * Different SLA periods to track
 */
export const SLA_PERIODS = {
  DAILY: 24,
  WEEKLY: 24 * 7,
  MONTHLY: 24 * 30,
} as const;

/**
 * Get SLA status for a device across multiple periods
 */
export async function getSLAStatus(db, deviceId: number) {
  const [status24h, status7d, status30d] = await Promise.all([
    calculateUptime(db, deviceId, SLA_PERIODS.DAILY),
    calculateUptime(db, deviceId, SLA_PERIODS.WEEKLY),
    calculateUptime(db, deviceId, SLA_PERIODS.MONTHLY),
  ]);

  // Get last violation
  const lastViolation = await db.sLAViolation.findFirst({
    where: { deviceId },
    orderBy: { createdAt: 'desc' },
    select: {
      createdAt: true,
      actualUptime: true,
      slaTarget: true,
    },
  });

  return {
    uptime_24h: status24h.uptime,
    uptime_7d: status7d.uptime,
    uptime_30d: status30d.uptime,
    checks_24h: status24h.totalChecks,
    down_checks_24h: status24h.downChecks,
    last_violation: lastViolation
      ? {
          at: lastViolation.createdAt,
          actual_uptime: lastViolation.actualUptime,
          target: lastViolation.slaTarget,
        }
      : null,
  };
}

/**
 * Check if device violates SLA target in last 24h and register violation
 */
export async function checkAndRecordSLAViolation(
  db,
  device,
  alertFn?: (device, message: string) => Promise<void>
): Promise<boolean> {
  if (!device.slaTarget || device.slaTarget >= 100) {
    // No SLA target or already at max
    return false;
  }

  const { uptime, totalChecks } = await calculateUptime(db, device.id, 24);

  // Check if violation already recorded recently (within last hour)
  const recentViolation = await db.sLAViolation.findFirst({
    where: {
      deviceId: device.id,
      createdAt: {
        gte: new Date(Date.now() - 60 * 60 * 1000), // Last hour
      },
    },
  });

  if (recentViolation) {
    // Already recorded in last hour, skip duplicate
    return false;
  }

  if (uptime < device.slaTarget && totalChecks > 0) {
    // SLA violated: record it
    const violation = await db.sLAViolation.create({
      data: {
        deviceId: device.id,
        violationType: 'threshold',
        actualUptime: uptime,
        slaTarget: device.slaTarget,
        periodStartAt: new Date(Date.now() - 24 * 60 * 60 * 1000),
        periodEndAt: new Date(),
        alertSent: false,
      },
    });

    // If alert function provided, send it
    if (alertFn) {
      try {
        const message =
          `SLA Violation: Device "${device.name}" has uptime of ${uptime.toFixed(2)}% ` +
          `in the last 24h, below target of ${device.slaTarget}% ` +
          `(Criticality: ${device.criticality ?? 'medium'})`;
        await alertFn(device, message);
        // Mark alert as sent
        await db.sLAViolation.update({
          where: { id: violation.id },
          data: { alertSent: true },
        });
      } catch (err) {
        console.error('[SLA] Failed to send violation alert:', err);
      }
    }

    return true;
  }

  return false;
}

/**
 * Get SLA violations for a device in a time window
 */
export async function getSLAViolationHistory(
  db,
  deviceId: number,
  daysBack: number = 30
) {
  const since = new Date(Date.now() - daysBack * 24 * 60 * 60 * 1000);

  const violations = await db.sLAViolation.findMany({
    where: {
      deviceId,
      createdAt: { gte: since },
    },
    orderBy: { createdAt: 'desc' },
    select: {
      id: true,
      violationType: true,
      actualUptime: true,
      slaTarget: true,
      periodStartAt: true,
      periodEndAt: true,
      alertSent: true,
      createdAt: true,
    },
  });

  return violations;
}

/**
 * Get top violating devices (those with most violations)
 */
export async function getTopViolatingDevices(
  db,
  limit: number = 10,
  daysBack: number = 30
) {
  const since = new Date(Date.now() - daysBack * 24 * 60 * 60 * 1000);

  // Raw query would be better but Prisma doesn't easily support GROUP BY aggregation
  // So we fetch all and sort manually (not optimal but fine for MVP)
  const allViolations = await db.sLAViolation.findMany({
    where: {
      createdAt: { gte: since },
    },
    include: {
      device: {
        select: {
          id: true,
          name: true,
          slaTarget: true,
        },
      },
    },
  });

  const violationsByDevice = allViolations.reduce((acc, v) => {
    const key = v.deviceId;
    if (!acc[key]) {
      acc[key] = { device: v.device, count: 0, avgUptime: 0, uptimeSum: 0 };
    }
    acc[key].count += 1;
    acc[key].uptimeSum += v.actualUptime;
    return acc;
  }, {});

  const results = Object.values(violationsByDevice)
    .map((item: any) => ({
      device: item.device,
      violation_count: item.count,
      avg_uptime: Math.round((item.uptimeSum / item.count) * 100) / 100,
    }))
    .sort((a, b) => b.violation_count - a.violation_count)
    .slice(0, limit);

  return results;
}
