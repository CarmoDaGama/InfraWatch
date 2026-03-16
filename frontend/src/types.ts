export type DeviceType = 'http' | 'ping' | 'snmp';

export interface Device {
  id: number;
  name: string;
  url: string;
  type?: DeviceType;
  status?: 'up' | 'down' | null;
  last_status?: 'up' | 'down' | null;
  lastChecked?: string | null;
  last_checked?: string | null;
  responseTime?: number | null;
  last_response_time?: number | null;
  snmp_community?: string;
  snmp_oid?: string;
  snmp_port?: number;
  sla_target?: number;
  criticality?: 'low' | 'medium' | 'high' | 'critical';
  check_interval_seconds?: number;
}

export interface UptimeStat {
  id: number;
  name: string;
  url: string;
  sla_target: number;
  criticality: 'low' | 'medium' | 'high' | 'critical';
  uptime_pct: number | null;
  sla_met: boolean | null;
  total_checks: number;
  up_count: number;
}

export interface User {
  id: number;
  email: string;
  role: 'viewer' | 'operator' | 'admin';
  created_at: string;
}

export interface AuthUser {
  id: number;
  email: string;
  role: User['role'];
  permissions: string[];
}
