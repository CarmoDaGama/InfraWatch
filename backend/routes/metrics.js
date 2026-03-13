import { Router } from 'express';

export default function metricsRouter(db) {
  const router = Router();

  router.get('/', (req, res) => {
    try {
      const hours = parseInt(req.query.hours ?? '24', 10);
      const limit = parseInt(req.query.limit ?? '200', 10);
      const deviceId = req.query.device_id;

      let query = `SELECT m.*, d.name AS device_name, d.url AS device_url
                   FROM metrics m
                   JOIN devices d ON d.id = m.device_id
                   WHERE m.checked_at >= datetime('now', ?)`;
      const params = [`-${hours} hours`];

      if (deviceId) {
        query += ' AND m.device_id = ?';
        params.push(deviceId);
      }

      query += ' ORDER BY m.checked_at DESC LIMIT ?';
      params.push(limit);

      const metrics = db.prepare(query).all(...params);
      res.json(metrics);
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  router.get('/uptime', (req, res) => {
    try {
      const hours = parseInt(req.query.hours ?? '24', 10);

      const rows = db
        .prepare(
          `SELECT d.id, d.name, d.url, d.sla_target, d.criticality,
                  COUNT(m.id)                                       AS total,
                  SUM(CASE WHEN m.status = 'up' THEN 1 ELSE 0 END) AS up_count
           FROM devices d
           LEFT JOIN metrics m
             ON m.device_id = d.id
            AND m.checked_at >= datetime('now', ?)
           GROUP BY d.id`
        )
        .all(`-${hours} hours`);

      const uptime = rows.map((r) => {
        const uptime_pct =
          r.total > 0 ? Math.round((r.up_count / r.total) * 10000) / 100 : null;
        const sla_target   = r.sla_target   ?? 99.0;
        const criticality  = r.criticality  ?? 'medium';
        const sla_met      = uptime_pct !== null ? uptime_pct >= sla_target : null;
        return {
          id: r.id,
          name: r.name,
          url: r.url,
          sla_target,
          criticality,
          uptime_pct,
          sla_met,
          total_checks: r.total,
          up_count: r.up_count,
        };
      });

      res.json(uptime);
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  return router;
}
