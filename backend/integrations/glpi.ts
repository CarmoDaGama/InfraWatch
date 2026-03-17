import axios from 'axios';
import { IntegrationEvent, IntegrationPlugin } from './types.js';
import { logOutboundEvent, logInboundEvent } from './events-log.js';

function isEnabled() {
  return String(process.env.GLPI_ENABLED ?? 'false').toLowerCase() === 'true';
}

export const glpiPlugin: IntegrationPlugin = {
  provider: 'glpi',
  enabled: isEnabled,
  async sendOutbound(event: IntegrationEvent) {
    if (!isEnabled()) return;

    const endpoint = process.env.GLPI_WEBHOOK_URL;
    if (!endpoint) {
      console.warn('[InfraWatch] GLPI enabled but GLPI_WEBHOOK_URL is missing');
      logOutboundEvent('glpi', event.type, 'failed', 'GLPI_WEBHOOK_URL is not configured');
      return;
    }

    try {
      await axios.post(
        endpoint,
        {
          source: 'infrawatch',
          provider: 'glpi',
          event,
        },
        {
          timeout: 8000,
          headers: process.env.GLPI_WEBHOOK_TOKEN
            ? { Authorization: `Bearer ${process.env.GLPI_WEBHOOK_TOKEN}` }
            : undefined,
        }
      );
      logOutboundEvent('glpi', event.type, 'success', undefined, event.payload);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Unknown error';
      logOutboundEvent('glpi', event.type, 'failed', message, event.payload);
      console.error('[InfraWatch] GLPI webhook failed:', message);
    }
  },
  async handleInbound(payload: Record<string, unknown>) {
    logInboundEvent('glpi', 'accepted', 'Webhook received', payload);
    return {
      provider: 'glpi',
      accepted: true,
      action: payload.action ?? 'sync',
      received_at: new Date().toISOString(),
    };
  },
};
