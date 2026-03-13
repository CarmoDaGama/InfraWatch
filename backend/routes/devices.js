import { Router } from 'express';

const VALID_TYPES        = ['http', 'ping', 'snmp'];
const VALID_CRITICALITY  = ['low', 'medium', 'high', 'critical'];

export default function devicesRouter(db) {
  const router = Router();

  router.get('/', (req, res) => {
    try {
      const devices = db
        .prepare(
          `SELECT d.*,
                  m.status        AS last_status,
                  m.checked_at    AS last_checked,
                  m.response_time AS last_response_time
           FROM devices d
           LEFT JOIN metrics m ON m.id = (
             SELECT id FROM metrics
             WHERE device_id = d.id
             ORDER BY checked_at DESC
             LIMIT 1
           )
           ORDER BY d.created_at ASC`
        )
        .all();
      res.json(devices);
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  router.post('/', (req, res) => {
    const {
      name,
      url,
      type           = 'http',
      snmp_community = 'public',
      snmp_oid       = '1.3.6.1.2.1.1.1.0',
      snmp_port      = 161,
      sla_target     = 99.0,
      criticality    = 'medium',
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

    try {
      const result = db
        .prepare(
          `INSERT INTO devices (name, url, type, snmp_community, snmp_oid, snmp_port, sla_target, criticality)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
        )
        .run(
          String(name).trim(),
          String(url).trim(),
          type,
          String(snmp_community),
          String(snmp_oid),
          type === 'snmp' ? portNum : 161,
          slaNum,
          criticality,
        );
      const device = db
        .prepare('SELECT * FROM devices WHERE id = ?')
        .get(result.lastInsertRowid);
      res.status(201).json(device);
    } catch (err) {
      if (err.message.includes('UNIQUE')) {
        return res.status(409).json({ error: 'A device with that URL/host already exists' });
      }
      res.status(500).json({ error: err.message });
    }
  });

  router.patch('/:id', (req, res) => {
    const { sla_target, criticality } = req.body ?? {};

    if (sla_target === undefined && criticality === undefined) {
      return res.status(400).json({ error: 'Provide at least one of: sla_target, criticality' });
    }

    const updates = [];
    const params  = [];

    if (sla_target !== undefined) {
      const slaNum = parseFloat(sla_target);
      if (isNaN(slaNum) || slaNum < 0 || slaNum > 100) {
        return res.status(400).json({ error: 'sla_target must be a number between 0 and 100' });
      }
      updates.push('sla_target = ?');
      params.push(slaNum);
    }

    if (criticality !== undefined) {
      if (!VALID_CRITICALITY.includes(criticality)) {
        return res.status(400).json({ error: `criticality must be one of: ${VALID_CRITICALITY.join(', ')}` });
      }
      updates.push('criticality = ?');
      params.push(criticality);
    }

    params.push(req.params.id);

    try {
      const result = db
        .prepare(`UPDATE devices SET ${updates.join(', ')} WHERE id = ?`)
        .run(...params);
      if (result.changes === 0) {
        return res.status(404).json({ error: 'Device not found' });
      }
      const device = db.prepare('SELECT * FROM devices WHERE id = ?').get(req.params.id);
      res.json(device);
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  router.delete('/:id', (req, res) => {
    try {
      const result = db
        .prepare('DELETE FROM devices WHERE id = ?')
        .run(req.params.id);
      if (result.changes === 0) {
        return res.status(404).json({ error: 'Device not found' });
      }
      res.json({ success: true });
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  return router;
}
