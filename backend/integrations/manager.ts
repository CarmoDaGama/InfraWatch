import { docuwarePlugin } from './docuware.js';
import { glpiPlugin } from './glpi.js';
import { IntegrationEvent, IntegrationEventType, IntegrationPlugin } from './types.js';
import { logInboundEvent } from './events-log.js';

const plugins: IntegrationPlugin[] = [glpiPlugin, docuwarePlugin];

export async function emitIntegrationEvent(type: IntegrationEventType, payload: Record<string, unknown>) {
  const event: IntegrationEvent = {
    type,
    payload,
    occurredAt: new Date().toISOString(),
  };

  await Promise.allSettled(
    plugins
      .filter((plugin) => plugin.enabled())
      .map((plugin) => plugin.sendOutbound(event))
  );
}

export async function processInboundEvent(provider: string, payload: Record<string, unknown>) {
  const plugin = plugins.find((entry) => entry.provider === provider);
  if (!plugin) {
    logInboundEvent(provider, 'failed', 'Unsupported integration provider', payload);
    throw new Error('Unsupported integration provider');
  }

  if (!plugin.enabled()) {
    logInboundEvent(provider, 'failed', 'Provider is disabled', payload);
    return {
      provider,
      accepted: false,
      reason: 'provider_disabled',
    };
  }

  return plugin.handleInbound(payload);
}
