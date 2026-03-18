import { Router } from 'express';
import { requirePermission } from '../middleware/rbac.js';

export default function auditRouter(db: any) {
  const router = Router();

  // GET /api/audit — admin-only, returns audit logs with pagination and optional action filter
  router.get('/', requirePermission('audit:read'), async (req, res) => {
    try {
      const limit = Math.min(Number(req.query.limit ?? 50), 200);
      const offset = Number(req.query.offset ?? 0);
      const action = req.query.action ? String(req.query.action) : undefined;

      const where: Record<string, unknown> = {};
      if (action) {
        where.action = action;
      }

      const [logs, total] = await Promise.all([
        db.auditLog.findMany({
          where,
          orderBy: { createdAt: 'desc' },
          take: limit,
          skip: offset,
        }),
        db.auditLog.count({ where }),
      ]);

      const items = logs.map((log: any) => ({
        id: log.id,
        user_id: log.userId,
        email: log.email,
        action: log.action,
        target: log.target,
        target_id: log.targetId,
        detail: log.detail,
        ip: log.ip,
        created_at: log.createdAt?.toISOString?.() ?? log.createdAt,
      }));

      res.json({ items, total, limit, offset });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  return router;
}
