import { Router } from 'express';

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
    const { name, url } = req.body ?? {};
    if (!name || !url) {
      return res.status(400).json({ error: 'name and url are required' });
    }
    try {
      const result = db
        .prepare('INSERT INTO devices (name, url) VALUES (?, ?)')
        .run(name, url);
      const device = db
        .prepare('SELECT * FROM devices WHERE id = ?')
        .get(result.lastInsertRowid);
      res.status(201).json(device);
    } catch (err) {
      if (err.message.includes('UNIQUE')) {
        return res.status(409).json({ error: 'A device with that URL already exists' });
      }
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
