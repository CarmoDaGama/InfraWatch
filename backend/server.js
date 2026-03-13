import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import rateLimit from 'express-rate-limit';
import db from './db.js';
import authRouter from './routes/auth.js';
import devicesRouter from './routes/devices.js';
import metricsRouter from './routes/metrics.js';
import { verifyToken } from './middleware/auth.js';
import { startMonitoring } from './monitor.js';
import { sendNotification } from './notify.js';

const app = express();

app.use(cors());
app.use(express.json());

const apiLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 120,
  standardHeaders: true,
  legacyHeaders: false,
});
app.use('/api/', apiLimiter);

// Public routes
app.use('/api/auth', authRouter(db));

// Protected routes
app.use('/api/devices', verifyToken, devicesRouter(db));
app.use('/api/metrics', verifyToken, metricsRouter(db));

app.get('/api/health', (_req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

if (process.env.NODE_ENV !== 'test') {
  const PORT = parseInt(process.env.PORT ?? '3001', 10);
  app.listen(PORT, () => {
    console.log(`InfraWatch backend listening on port ${PORT}`);
    startMonitoring(db, sendNotification);
  });
}

export default app;
