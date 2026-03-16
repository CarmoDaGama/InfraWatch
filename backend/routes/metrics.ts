import { Router } from 'express';
import { requirePermission } from '../middleware/rbac.js';

// Returns a SQLite strftime expression that groups timestamps into buckets.
// For short windows (<=2h) returns null → caller uses raw rows.
function bucketExpr(hours) {
  if (hours <= 2)   return null;
  if (hours <= 6)   // 5-min buckets
    return "strftime('%Y-%m-%dT%H:', checked_at) || printf('%02d', (cast(strftime('%M', checked_at) AS INTEGER) / 5) * 5) || ':00.000Z'";
  if (hours <= 24)  // 15-min buckets
    return "strftime('%Y-%m-%dT%H:', checked_at) || printf('%02d', (cast(strftime('%M', checked_at) AS INTEGER) / 15) * 15) || ':00.000Z'";
  // hourly buckets (7d)
  return "strftime('%Y-%m-%dT%H:00:00.000Z', checked_at)";
}

function getQueryValue(value, fallback) {
  if (Array.isArray(value)) {
    return value[0] ?? fallback;
  }
  if (typeof value === 'string') {
    return value;
  }
  return fallback;
}

export default function metricsRouter(db) {
  const router = Router();

  router.get('/', requirePermission('metrics:read'), (req, res) => {
    try {
      const hours = parseInt(getQueryValue(req.query.hours, '24'), 10);
      const limit = parseInt(getQueryValue(req.query.limit, '200'), 10);
      const deviceId = getQueryValue(req.query.device_id, '');

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
      params.push(String(limit));

      const metrics = db.prepare(query).all(...params);
      res.json(metrics);
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  // Per-device time-series endpoint for the history drawer.
  // Returns bucketed data (5 min / 15 min / 1 h) for longer windows to keep
  // the payload small, plus aggregated stats for the period.
  router.get('/device/:id', requirePermission('metrics:read'), (req, res) => {
    try {
      const hours = parseInt(getQueryValue(req.query.hours, '24'), 10);
      const timeFilter = `-${hours} hours`;
      const expr = bucketExpr(hours);

      let metrics;

      if (expr === null) {
        // Raw rows for short windows (≤2 h)
        metrics = db.prepare(`
          SELECT checked_at AS bucket, status,
                 response_time, 1 AS check_count
          FROM metrics
          WHERE device_id = ? AND checked_at >= datetime('now', ?)
          ORDER BY checked_at ASC
          LIMIT 720
        `).all(req.params.id, timeFilter);
      } else {
        metrics = db.prepare(`
          SELECT bucket,
                 CASE WHEN SUM(down_flag) > 0 THEN 'down' ELSE 'up' END AS status,
                 AVG(CASE WHEN status = 'up' THEN response_time END)     AS response_time,
                 COUNT(*)                                                  AS check_count
          FROM (
            SELECT ${expr} AS bucket,
                   status,
                   response_time,
                   CASE WHEN status = 'down' THEN 1 ELSE 0 END AS down_flag
            FROM metrics
            WHERE device_id = ? AND checked_at >= datetime('now', ?)
          )
          GROUP BY bucket
          ORDER BY bucket ASC
        `).all(req.params.id, timeFilter);
      }

      // Aggregated stats for the full period
      const stats = db.prepare(`
        SELECT COUNT(*)                                                   AS total,
               SUM(CASE WHEN status = 'up'   THEN 1 ELSE 0 END)          AS up_count,
               SUM(CASE WHEN status = 'down' THEN 1 ELSE 0 END)          AS down_count,
               AVG(CASE WHEN status = 'up'   THEN response_time END)     AS avg_rt,
               MIN(CASE WHEN status = 'up'   THEN response_time END)     AS min_rt,
               MAX(CASE WHEN status = 'up'   THEN response_time END)     AS max_rt
        FROM metrics
        WHERE device_id = ? AND checked_at >= datetime('now', ?)
      `).get(req.params.id, timeFilter);

      res.json({ metrics, stats });
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  router.get('/uptime', requirePermission('metrics:read'), (req, res) => {
    try {
      const hours = parseInt(getQueryValue(req.query.hours, '24'), 10);

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
