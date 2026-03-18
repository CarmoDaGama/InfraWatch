import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import { rateLimit } from 'express-rate-limit';
import db, { ensureDbReady } from './db.js';
import authRouter from './routes/auth.js';
import devicesRouter from './routes/devices.js';
import metricsRouter from './routes/metrics.js';
import usersRouter from './routes/users.js';
import slaRouter from './routes/sla.js';
import integrationsRouter from './routes/integrations.js';
import cronRouter from './routes/cron.js';
import auditRouter from './routes/audit.js';
import { verifyToken } from './middleware/auth.js';
import { startMonitoring } from './monitor.js';
import { sendNotification, sendAlert, sendSLAViolationAlert } from './notify.js';
import { initCache, stopCache } from './cache.js';
import { initQueues, stopQueues } from './queue.js';

await initCache();
await ensureDbReady();
await initQueues({ db, notifyFn: sendNotification, slaAlertFn: sendSLAViolationAlert });

const app = express();

// Trust proxy headers (required for Vercel / reverse proxy deployments)
app.set('trust proxy', 1);

app.use(cors());
app.use(express.json());

const apiLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 120,
  standardHeaders: true,
  legacyHeaders: false,
  validate: { xForwardedForHeader: false },
});
app.use('/api/', apiLimiter);

// Public routes
app.use('/api/auth', authRouter(db));
app.use('/api/integrations', integrationsRouter());
app.use('/api/cron', cronRouter(db, sendNotification, sendSLAViolationAlert));

// Protected routes
app.use('/api/devices', verifyToken, devicesRouter(db));
app.use('/api/metrics', verifyToken, metricsRouter(db));
app.use('/api/sla', verifyToken, slaRouter(db));
app.use('/api/users', verifyToken, usersRouter(db));
app.use('/api/audit', verifyToken, auditRouter(db));

app.get('/api/health', (_req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

if (process.env.NODE_ENV !== 'test') {
  const PORT = parseInt(process.env.PORT ?? '3001', 10);
  app.listen(PORT, () => {
    console.log(`InfraWatch backend listening on port ${PORT}`);
    startMonitoring(db, sendNotification, sendSLAViolationAlert);
  });

  process.on('uncaughtException', (err) => {
    sendAlert(
      'InfraWatch: Erro Crítico no Servidor',
      `Exceção não tratada: ${err.message}\n${err.stack ?? ''}\nTimestamp: ${new Date().toISOString()}`
    ).finally(() => process.exit(1));
  });

  process.on('unhandledRejection', (reason) => {
    sendAlert(
      'InfraWatch: Erro Assíncrono Não Tratado',
      `Promise rejeitada sem tratamento: ${reason}\nTimestamp: ${new Date().toISOString()}`
    );
  });

  process.on('SIGINT', async () => {
    await stopQueues();
    await stopCache();
    process.exit(0);
  });

  process.on('SIGTERM', async () => {
    await stopQueues();
    await stopCache();
    process.exit(0);
  });
}

export default app;
