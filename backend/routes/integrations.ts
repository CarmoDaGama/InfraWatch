import { Router } from 'express';
import { processInboundEvent } from '../integrations/manager.js';
import { getEventLog, getEventsByProvider } from '../integrations/events-log.js';

function hasValidWebhookSecret(req) {
  const expected = process.env.INTEGRATIONS_WEBHOOK_SECRET;
  if (!expected) return true;

  const provided = String(req.headers['x-integration-secret'] ?? '');
  return provided.length > 0 && provided === expected;
}

export default function integrationsRouter() {
  const router = Router();

  router.post('/webhook/:provider', async (req, res) => {
    if (!hasValidWebhookSecret(req)) {
      return res.status(401).json({ error: 'Invalid integration secret' });
    }

    try {
      const provider = String(req.params.provider ?? '').toLowerCase();
      const payload = (req.body ?? {}) as Record<string, unknown>;
      const result = await processInboundEvent(provider, payload);
      return res.json({ success: true, result });
    } catch (err) {
      return res.status(400).json({
        success: false,
        error: err instanceof Error ? err.message : 'Integration webhook failed',
      });
    }
  });

  // Get integration event logs
  router.get('/events', async (req, res) => {
    try {
      const limit = Math.min(Number(req.query.limit ?? 100), 500);
      const offset = Number(req.query.offset ?? 0);
      const provider = req.query.provider ? String(req.query.provider) : undefined;

      if (provider) {
        // Get events for specific provider
        const events = getEventsByProvider(provider, limit + offset);
        return res.json({
          events: events.slice(offset, offset + limit),
          total: events.length,
          provider,
        });
      }

      // Get all events
      const { events, total } = getEventLog(limit, offset);
      return res.json({ events, total, offset, limit });
    } catch (err) {
      return res.status(400).json({
        success: false,
        error: err instanceof Error ? err.message : 'Failed to fetch events',
      });
    }
  });

  return router;
}
