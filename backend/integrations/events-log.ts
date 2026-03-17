/**
 * Integration Events Log
 * Tracks outbound and inbound integration events with status
 */

export interface IntegrationEventLog {
  id: string;
  timestamp: string;
  direction: 'outbound' | 'inbound'; // outbound: sent to GLPI/DocuWare, inbound: received from external
  provider: string; // 'glpi', 'docuware'
  eventType: string; // 'device.created', 'device.updated', etc.
  status: 'success' | 'failed' | 'accepted'; // success/failed for outbound, accepted for inbound
  message?: string;
  payload?: Record<string, unknown>;
}

const MAX_EVENTS = 500;
const eventLog: IntegrationEventLog[] = [];

export function logOutboundEvent(
  provider: string,
  eventType: string,
  status: 'success' | 'failed',
  message?: string,
  payload?: Record<string, unknown>
) {
  const event: IntegrationEventLog = {
    id: generateId(),
    timestamp: new Date().toISOString(),
    direction: 'outbound',
    provider,
    eventType,
    status,
    message,
    payload: payload ? sanitizePayload(payload) : undefined,
  };

  eventLog.unshift(event); // newest first
  if (eventLog.length > MAX_EVENTS) {
    eventLog.pop();
  }

  return event;
}

export function logInboundEvent(
  provider: string,
  status: 'accepted' | 'failed',
  message?: string,
  payload?: Record<string, unknown>
) {
  const event: IntegrationEventLog = {
    id: generateId(),
    timestamp: new Date().toISOString(),
    direction: 'inbound',
    provider,
    eventType: 'webhook_received',
    status: status === 'accepted' ? 'accepted' : 'failed',
    message,
    payload: payload ? sanitizePayload(payload) : undefined,
  };

  eventLog.unshift(event);
  if (eventLog.length > MAX_EVENTS) {
    eventLog.pop();
  }

  return event;
}

export function getEventLog(limit = 100, offset = 0): { events: IntegrationEventLog[]; total: number } {
  const total = eventLog.length;
  const events = eventLog.slice(offset, offset + limit);
  return { events, total };
}

export function getEventsByProvider(provider: string, limit = 50): IntegrationEventLog[] {
  return eventLog.filter((e) => e.provider === provider).slice(0, limit);
}

export function clearEventLog() {
  eventLog.length = 0;
}

// ─── helpers ───────────────────────────────────────────────────────

function generateId(): string {
  return `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
}

function sanitizePayload(payload: Record<string, unknown>): Record<string, unknown> {
  // Remove sensitive data like tokens
  const sanitized = { ...payload };
  const sensitiveKeys = ['token', 'secret', 'password', 'apiKey', 'Authorization'];
  for (const key of sensitiveKeys) {
    if (key in sanitized) {
      sanitized[key] = '***REDACTED***';
    }
  }
  return sanitized;
}
