import axios from 'axios';
import { IntegrationEvent, IntegrationPlugin } from './types.js';
import { logOutboundEvent, logInboundEvent } from './events-log.js';

function isEnabled() {
  return String(process.env.DOCUWARE_ENABLED ?? 'false').toLowerCase() === 'true';
}

export const docuwarePlugin: IntegrationPlugin = {
  provider: 'docuware',
  enabled: isEnabled,
  async sendOutbound(event: IntegrationEvent) {
    if (!isEnabled()) return;

    const endpoint = process.env.DOCUWARE_WEBHOOK_URL;
    if (!endpoint) {
      console.warn('[InfraWatch] DocuWare enabled but DOCUWARE_WEBHOOK_URL is missing');
      logOutboundEvent('docuware', event.type, 'failed', 'DOCUWARE_WEBHOOK_URL is not configured');
      return;
    }

    try {
      await axios.post(
        endpoint,
        {
          source: 'infrawatch',
          provider: 'docuware',
          event,
        },
        {
          timeout: 8000,
          headers: process.env.DOCUWARE_WEBHOOK_TOKEN
            ? { Authorization: `Bearer ${process.env.DOCUWARE_WEBHOOK_TOKEN}` }
            : undefined,
        }
      );
      logOutboundEvent('docuware', event.type, 'success', undefined, event.payload);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Unknown error';
      logOutboundEvent('docuware', event.type, 'failed', message, event.payload);
      console.error('[InfraWatch] DocuWare webhook failed:', message);
    }
  },
  async handleInbound(payload: Record<string, unknown>) {
    logInboundEvent('docuware', 'accepted', 'Webhook received', payload);
    return {
      provider: 'docuware',
      accepted: true,
      action: payload.action ?? 'sync',
      received_at: new Date().toISOString(),
    };
  },
};
