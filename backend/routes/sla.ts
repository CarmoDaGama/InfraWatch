import { Router } from 'express';
import { requirePermission } from '../middleware/rbac.js';
import {
  getSLAStatus,
  getSLAViolationHistory,
  getTopViolatingDevices,
} from '../sla.js';
import { getCachedJson } from '../cache.js';

export default function slaRouter(db) {
  const router = Router();

  // GET /api/sla/device/:id - Get SLA status for a specific device
  router.get('/device/:id', requirePermission('metrics:read'), async (req, res) => {
    const deviceId = Number.parseInt(req.params.id, 10);
    if (!Number.isInteger(deviceId) || deviceId <= 0) {
      return res.status(400).json({ error: 'Invalid device id' });
    }

    try {
      const device = await db.device.findUnique({
        where: { id: deviceId },
        select: { id: true, name: true, url: true, slaTarget: true },
      });

      if (!device) {
        return res.status(404).json({ error: 'Device not found' });
      }

      const status = await getCachedJson(`cache:sla:device:${deviceId}:status`, 30, async () =>
        getSLAStatus(db, deviceId)
      );
      res.json({
        device,
        sla: status,
      });
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  // GET /api/sla/device/:id/violations - Get SLA violation history for a device
  router.get('/device/:id/violations', requirePermission('metrics:read'), async (req, res) => {
    const deviceId = Number.parseInt(req.params.id, 10);
    if (!Number.isInteger(deviceId) || deviceId <= 0) {
      return res.status(400).json({ error: 'Invalid device id' });
    }

    try {
      const daysBack = Number.parseInt(req.query.days as string, 10) || 30;
      const violations = await getCachedJson(
        `cache:sla:device:${deviceId}:violations:${daysBack}`,
        30,
        async () => getSLAViolationHistory(db, deviceId, daysBack)
      );
      res.json({ device_id: deviceId, days_back: daysBack, violations });
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  // GET /api/sla/violations - Get top violating devices (admin only)
  router.get('/violations', requirePermission('devices:read'), async (req, res) => {
    try {
      const daysBack = Number.parseInt(req.query.days as string, 10) || 30;
      const limit = Number.parseInt(req.query.limit as string, 10) || 10;
      const topDevices = await getCachedJson(
        `cache:sla:violations:${daysBack}:${limit}`,
        30,
        async () => getTopViolatingDevices(db, limit, daysBack)
      );
      res.json({ days_back: daysBack, limit, devices: topDevices });
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  return router;
}
