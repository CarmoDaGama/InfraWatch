export type IntegrationEventType =
  | 'device.created'
  | 'device.updated'
  | 'device.deleted'
  | 'device.status_changed'
  | 'sla.violation';

export interface IntegrationEvent {
  type: IntegrationEventType;
  payload: Record<string, unknown>;
  occurredAt: string;
}

export interface IntegrationPlugin {
  provider: 'glpi' | 'docuware';
  enabled(): boolean;
  sendOutbound(event: IntegrationEvent): Promise<void>;
  handleInbound(payload: Record<string, unknown>): Promise<Record<string, unknown>>;
}
