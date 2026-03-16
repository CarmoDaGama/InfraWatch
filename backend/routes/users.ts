import { Router } from 'express';
import { requirePermission, normalizeRole, VALID_ROLES } from '../middleware/rbac.js';

export default function usersRouter(db) {
  const router = Router();

  router.get('/', requirePermission('users:read'), (_req, res) => {
    try {
      const users = db
        .prepare(
          `SELECT id, email, role, created_at
           FROM users
           ORDER BY created_at ASC`
        )
        .all();
      res.json(users);
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  router.patch('/:id/role', requirePermission('users:update'), (req, res) => {
    const userId = parseInt(req.params.id, 10);
    if (!Number.isInteger(userId) || userId <= 0) {
      return res.status(400).json({ error: 'Invalid user id' });
    }

    const nextRole = normalizeRole(req.body?.role);
    if (!nextRole) {
      return res.status(400).json({ error: `role must be one of: ${VALID_ROLES.join(', ')}` });
    }

    try {
      const user = db.prepare('SELECT id, role FROM users WHERE id = ?').get(userId);
      if (!user) {
        return res.status(404).json({ error: 'User not found' });
      }

      const currentRole = normalizeRole(user.role) ?? 'viewer';
      if (currentRole === nextRole) {
        const unchanged = db
          .prepare('SELECT id, email, role, created_at FROM users WHERE id = ?')
          .get(userId);
        return res.json(unchanged);
      }

      // Prevent locking out administration by demoting the last admin.
      if (currentRole === 'admin' && nextRole !== 'admin') {
        const admins = db.prepare("SELECT COUNT(*) AS count FROM users WHERE role = 'admin'").get();
        if ((admins?.count ?? 0) <= 1) {
          return res.status(400).json({ error: 'Cannot demote the last admin user' });
        }
      }

      db.prepare('UPDATE users SET role = ? WHERE id = ?').run(nextRole, userId);
      const updated = db
        .prepare('SELECT id, email, role, created_at FROM users WHERE id = ?')
        .get(userId);
      return res.json(updated);
    } catch (err) {
      return res.status(500).json({ error: err.message });
    }
  });

  return router;
}