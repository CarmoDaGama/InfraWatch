import { Router } from 'express';
import { Prisma } from '@prisma/client';
import { sendAlert } from '../notify.js';
import { requirePermission } from '../middleware/rbac.js';
import { toApiDevice } from '../serializers.js';
import { getCachedJson, invalidateDeviceStatsCache } from '../cache.js';
import { emitIntegrationEvent } from '../integrations/manager.js';
import { logAudit } from '../audit.js';

const VALID_TYPES        = ['http', 'ping', 'snmp'];
const VALID_CRITICALITY  = ['low', 'medium', 'high', 'critical'];
const MIN_CHECK_INTERVAL_SECONDS = 5;
const MAX_CHECK_INTERVAL_SECONDS = 3600;

function parseCheckIntervalSeconds(value) {
  const num = Number(value);
  if (!Number.isInteger(num)) return null;
  if (num < MIN_CHECK_INTERVAL_SECONDS || num > MAX_CHECK_INTERVAL_SECONDS) return null;
  return num;
}

export default function devicesRouter(db) {
  const router = Router();

  router.get('/', requirePermission('devices:read'), async (_req, res) => {
    try {
      const devices = await getCachedJson('cache:devices:list', 30, async () => {
        const rows = await db.device.findMany({
          orderBy: { createdAt: 'asc' },
          include: {
            metrics: {
              orderBy: { checkedAt: 'desc' },
              take: 1,
              select: {
                status: true,
                checkedAt: true,
                responseTime: true,
              },
            },
          },
        });

        return rows.map(toApiDevice);
      });
      res.json(devices);
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  router.post('/', requirePermission('devices:create'), async (req, res) => {
    const {
      name,
      url,
      type           = 'http',
      snmp_community = 'public',
      snmp_oid       = '1.3.6.1.2.1.1.1.0',
      snmp_port      = 161,
      sla_target     = 99.0,
      criticality    = 'medium',
      check_interval_seconds = 60,
    } = req.body ?? {};

    if (!name || !String(name).trim()) {
      return res.status(400).json({ error: 'name is required' });
    }
    if (!url || !String(url).trim()) {
      return res.status(400).json({ error: 'url is required' });
    }
    if (!VALID_TYPES.includes(type)) {
      return res.status(400).json({ error: `type must be one of: ${VALID_TYPES.join(', ')}` });
    }
    if (type === 'http' && !/^https?:\/\/.+/.test(String(url).trim())) {
      return res.status(400).json({ error: 'url must start with http:// or https:// for HTTP devices' });
    }
    const portNum = parseInt(snmp_port, 10);
    if (type === 'snmp' && (!Number.isInteger(portNum) || portNum < 1 || portNum > 65535)) {
      return res.status(400).json({ error: 'snmp_port must be an integer between 1 and 65535' });
    }
    const slaNum = parseFloat(sla_target);
    if (isNaN(slaNum) || slaNum < 0 || slaNum > 100) {
      return res.status(400).json({ error: 'sla_target must be a number between 0 and 100' });
    }
    if (!VALID_CRITICALITY.includes(criticality)) {
      return res.status(400).json({ error: `criticality must be one of: ${VALID_CRITICALITY.join(', ')}` });
    }
    const checkIntervalNum = parseCheckIntervalSeconds(check_interval_seconds);
    if (checkIntervalNum === null) {
      return res.status(400).json({
        error: `check_interval_seconds must be an integer between ${MIN_CHECK_INTERVAL_SECONDS} and ${MAX_CHECK_INTERVAL_SECONDS}`,
      });
    }

    try {
      const device = await db.device.create({
        data: {
          name: String(name).trim(),
          url: String(url).trim(),
          type,
          snmpCommunity: String(snmp_community),
          snmpOid: String(snmp_oid),
          snmpPort: type === 'snmp' ? portNum : 161,
          slaTarget: slaNum,
          criticality,
          checkIntervalSeconds: checkIntervalNum,
        },
      });
      void logAudit(db, {
        userId: (req as any).user?.id,
        email: (req as any).user?.email,
        action: 'device.created',
        target: 'device',
        targetId: device.id,
        detail: `Device "${device.name}" (${device.url}) created`,
        ip: req.ip,
      });
      void sendAlert(
        `InfraWatch: Device Adicionado - ${device.name}`,
        `O device "${device.name}" (${device.url}) foi adicionado ao monitoramento em ${new Date().toISOString()}`
      );
      void invalidateDeviceStatsCache(device.id);
      void emitIntegrationEvent('device.created', { device });
      res.status(201).json(toApiDevice(device));
    } catch (err) {
      if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2002') {
        return res.status(409).json({ error: 'A device with that URL/host already exists' });
      }
      res.status(500).json({ error: err.message });
    }
  });

  router.patch('/:id', requirePermission('devices:update'), async (req, res) => {
    const { sla_target, criticality, check_interval_seconds } = req.body ?? {};
    const deviceId = parseInt(req.params.id, 10);

    if (!Number.isInteger(deviceId) || deviceId <= 0) {
      return res.status(400).json({ error: 'Invalid device id' });
    }

    if (sla_target === undefined && criticality === undefined && check_interval_seconds === undefined) {
      return res.status(400).json({ error: 'Provide at least one of: sla_target, criticality, check_interval_seconds' });
    }

    const updates = [];
    const data: { slaTarget?: number; criticality?: string; checkIntervalSeconds?: number } = {};

    if (sla_target !== undefined) {
      const slaNum = parseFloat(sla_target);
      if (isNaN(slaNum) || slaNum < 0 || slaNum > 100) {
        return res.status(400).json({ error: 'sla_target must be a number between 0 and 100' });
      }
      updates.push('sla_target');
      data.slaTarget = slaNum;
    }

    if (criticality !== undefined) {
      if (!VALID_CRITICALITY.includes(criticality)) {
        return res.status(400).json({ error: `criticality must be one of: ${VALID_CRITICALITY.join(', ')}` });
      }
      updates.push('criticality');
      data.criticality = criticality;
    }

    if (check_interval_seconds !== undefined) {
      const checkIntervalNum = parseCheckIntervalSeconds(check_interval_seconds);
      if (checkIntervalNum === null) {
        return res.status(400).json({
          error: `check_interval_seconds must be an integer between ${MIN_CHECK_INTERVAL_SECONDS} and ${MAX_CHECK_INTERVAL_SECONDS}`,
        });
      }
      updates.push('check_interval_seconds');
      data.checkIntervalSeconds = checkIntervalNum;
    }

    try {
      const device = await db.device.update({
        where: { id: deviceId },
        data,
      });
      void logAudit(db, {
        userId: (req as any).user?.id,
        email: (req as any).user?.email,
        action: 'device.updated',
        target: 'device',
        targetId: device.id,
        detail: `Device "${device.name}" updated: ${updates.join(', ')}`,
        ip: req.ip,
      });
      void sendAlert(
        `InfraWatch: Configuração Alterada - ${device.name}`,
        `A configuração do device "${device.name}" (${device.url}) foi alterada em ${new Date().toISOString()}\nCampos alterados: ${updates.join(', ')}`
      );
      void invalidateDeviceStatsCache(device.id);
      void emitIntegrationEvent('device.updated', { device, fields: updates });
      res.json(toApiDevice(device));
    } catch (err) {
      if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2025') {
        return res.status(404).json({ error: 'Device not found' });
      }
      res.status(500).json({ error: err.message });
    }
  });

  router.delete('/:id', requirePermission('devices:delete'), async (req, res) => {
    const deviceId = parseInt(req.params.id, 10);

    if (!Number.isInteger(deviceId) || deviceId <= 0) {
      return res.status(400).json({ error: 'Invalid device id' });
    }

    try {
      const device = await db.device.findUnique({ where: { id: deviceId } });
      if (!device) {
        return res.status(404).json({ error: 'Device not found' });
      }

      await db.device.delete({ where: { id: deviceId } });
      void logAudit(db, {
        userId: (req as any).user?.id,
        email: (req as any).user?.email,
        action: 'device.deleted',
        target: 'device',
        targetId: device.id,
        detail: `Device "${device.name}" (${device.url}) deleted`,
        ip: req.ip,
      });
      void sendAlert(
        `InfraWatch: Device Removido - ${device.name}`,
        `O device "${device.name}" (${device.url}) foi removido do monitoramento em ${new Date().toISOString()}`
      );
      void invalidateDeviceStatsCache(deviceId);
      void emitIntegrationEvent('device.deleted', { device });
      res.json({ success: true });
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  return router;
}
