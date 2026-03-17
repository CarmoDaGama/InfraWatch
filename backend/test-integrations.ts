/**
 * Simple Express server to capture mock webhooks
 * Run: npx ts-node test-integrations.ts
 * Runs on port 3100
 */
import express from 'express';

const app = express();
app.use(express.json());

const webhookLog: { timestamp: string; provider: string; event: string; payload: Record<string, unknown> }[] = [];

// Mock endpoints that capture webhook calls
app.post('/test/glpi-webhook', (req, res) => {
  const entry = {
    timestamp: new Date().toISOString(),
    provider: 'GLPI',
    event: req.body.type || 'unknown',
    payload: req.body,
  };
  webhookLog.push(entry);
  console.log('🔔 GLPI Webhook received:', JSON.stringify(entry, null, 2));
  res.json({ accepted: true });
});

app.post('/test/docuware-webhook', (req, res) => {
  const entry = {
    timestamp: new Date().toISOString(),
    provider: 'DocuWare',
    event: req.body.type || 'unknown',
    payload: req.body,
  };
  webhookLog.push(entry);
  console.log('📄 DocuWare Webhook received:', JSON.stringify(entry, null, 2));
  res.json({ accepted: true });
});

// View all captured webhooks
app.get('/test/webhooks', (req, res) => {
  res.json({
    count: webhookLog.length,
    webhooks: webhookLog,
  });
});

// Reset log
app.post('/test/webhooks/reset', (req, res) => {
  webhookLog.length = 0;
  res.json({ reset: true });
});

app.listen(3100, () => {
  console.log('✅ Mock webhook server running on http://localhost:3100');
  console.log('   - POST /test/glpi-webhook');
  console.log('   - POST /test/docuware-webhook');
  console.log('   - GET  /test/webhooks');
  console.log('   - POST /test/webhooks/reset');
});
