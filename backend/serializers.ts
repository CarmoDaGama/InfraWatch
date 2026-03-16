import type { Device, Metric, User } from '@prisma/client';

function toIsoString(value: Date | string | null | undefined) {
  if (!value) return null;
  return new Date(value).toISOString();
}

type DeviceWithLatestMetric = Device & {
  metrics?: Array<Pick<Metric, 'status' | 'checkedAt' | 'responseTime'>>;
};

type MetricWithDevice = Metric & {
  device?: {
    name: string;
    url: string;
  };
};

export function toApiDevice(device: DeviceWithLatestMetric) {
  const latestMetric = device.metrics?.[0] ?? null;

  return {
    id: device.id,
    name: device.name,
    url: device.url,
    created_at: toIsoString(device.createdAt),
    enabled: device.enabled,
    type: device.type,
    snmp_community: device.snmpCommunity ?? 'public',
    snmp_oid: device.snmpOid ?? '1.3.6.1.2.1.1.1.0',
    snmp_port: device.snmpPort ?? 161,
    sla_target: device.slaTarget ?? 99.0,
    criticality: device.criticality ?? 'medium',
    check_interval_seconds: device.checkIntervalSeconds ?? 60,
    last_status: latestMetric?.status ?? null,
    last_checked: toIsoString(latestMetric?.checkedAt),
    last_response_time: latestMetric?.responseTime ?? null,
  };
}

export function toApiMetric(metric: MetricWithDevice) {
  return {
    id: metric.id,
    device_id: metric.deviceId,
    status: metric.status,
    response_time: metric.responseTime,
    checked_at: toIsoString(metric.checkedAt),
    device_name: metric.device?.name,
    device_url: metric.device?.url,
  };
}

export function toApiUser(user: Pick<User, 'id' | 'email' | 'role' | 'createdAt'>) {
  return {
    id: user.id,
    email: user.email,
    role: user.role,
    created_at: toIsoString(user.createdAt),
  };
}

export { toIsoString };