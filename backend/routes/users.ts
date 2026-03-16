import { Router } from 'express';
import { Prisma } from '@prisma/client';
import { requirePermission, normalizeRole, VALID_ROLES } from '../middleware/rbac.js';
import { toApiUser } from '../serializers.js';

export default function usersRouter(db) {
  const router = Router();

  router.get('/', requirePermission('users:read'), async (_req, res) => {
    try {
      const users = await db.user.findMany({
        select: {
          id: true,
          email: true,
          role: true,
          createdAt: true,
        },
        orderBy: { createdAt: 'asc' },
      });
      res.json(users.map(toApiUser));
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  router.patch('/:id/role', requirePermission('users:update'), async (req, res) => {
    const userId = parseInt(req.params.id, 10);
    if (!Number.isInteger(userId) || userId <= 0) {
      return res.status(400).json({ error: 'Invalid user id' });
    }

    const nextRole = normalizeRole(req.body?.role);
    if (!nextRole) {
      return res.status(400).json({ error: `role must be one of: ${VALID_ROLES.join(', ')}` });
    }

    try {
      const user = await db.user.findUnique({
        where: { id: userId },
        select: {
          id: true,
          email: true,
          role: true,
          createdAt: true,
        },
      });
      if (!user) {
        return res.status(404).json({ error: 'User not found' });
      }

      const currentRole = normalizeRole(user.role) ?? 'viewer';
      if (currentRole === nextRole) {
        return res.json(toApiUser(user));
      }

      // Prevent locking out administration by demoting the last admin.
      if (currentRole === 'admin' && nextRole !== 'admin') {
        const adminCount = await db.user.count({ where: { role: 'admin' } });
        if (adminCount <= 1) {
          return res.status(400).json({ error: 'Cannot demote the last admin user' });
        }
      }

      const updated = await db.user.update({
        where: { id: userId },
        data: { role: nextRole },
        select: {
          id: true,
          email: true,
          role: true,
          createdAt: true,
        },
      });
      return res.json(toApiUser(updated));
    } catch (err) {
      if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2025') {
        return res.status(404).json({ error: 'User not found' });
      }
      return res.status(500).json({ error: err.message });
    }
  });

  return router;
}