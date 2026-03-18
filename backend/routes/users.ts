import { Router } from 'express';
import bcrypt from 'bcryptjs';
import { Prisma } from '@prisma/client';
import { requirePermission, normalizeRole, VALID_ROLES } from '../middleware/rbac.js';
import { toApiUser } from '../serializers.js';
import { logAudit } from '../audit.js';

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
      void logAudit(db, {
        userId: (req as any).user?.id,
        email: (req as any).user?.email,
        action: 'user.role_changed',
        target: 'user',
        targetId: userId,
        detail: `User "${updated.email}" role changed from ${currentRole} to ${nextRole}`,
        ip: req.ip,
      });
      return res.json(toApiUser(updated));
    } catch (err) {
      if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2025') {
        return res.status(404).json({ error: 'User not found' });
      }
      return res.status(500).json({ error: err.message });
    }
  });

  router.post('/', requirePermission('users:create'), async (req, res) => {
    const { email, password, role = 'viewer' } = req.body ?? {};

    if (!email || !String(email).trim()) {
      return res.status(400).json({ error: 'email is required' });
    }
    if (!password || !String(password).trim()) {
      return res.status(400).json({ error: 'password is required' });
    }

    const normalizedRole = normalizeRole(role);
    if (!normalizedRole) {
      return res.status(400).json({ error: `role must be one of: ${VALID_ROLES.join(', ')}` });
    }

    try {
      const existingUser = await db.user.findUnique({ where: { email: String(email).trim() } });
      if (existingUser) {
        return res.status(409).json({ error: 'A user with that email already exists' });
      }

      const passwordHash = bcrypt.hashSync(String(password), 10);
      const newUser = await db.user.create({
        data: {
          email: String(email).trim(),
          passwordHash,
          role: normalizedRole,
        },
        select: {
          id: true,
          email: true,
          role: true,
          createdAt: true,
        },
      });

      void logAudit(db, {
        userId: (req as any).user?.id,
        email: (req as any).user?.email,
        action: 'user.created',
        target: 'user',
        targetId: newUser.id,
        detail: `User "${newUser.email}" created with role ${normalizedRole}`,
        ip: req.ip,
      });

      res.status(201).json(toApiUser(newUser));
    } catch (err) {
      if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2002') {
        return res.status(409).json({ error: 'A user with that email already exists' });
      }
      res.status(500).json({ error: err.message });
    }
  });

  router.delete('/:id', requirePermission('users:delete'), async (req, res) => {
    const userId = parseInt(req.params.id, 10);

    if (!Number.isInteger(userId) || userId <= 0) {
      return res.status(400).json({ error: 'Invalid user id' });
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

      const userRole = normalizeRole(user.role) ?? 'viewer';
      if (userRole === 'admin') {
        const adminCount = await db.user.count({ where: { role: 'admin' } });
        if (adminCount <= 1) {
          return res.status(400).json({ error: 'Cannot delete the last admin user' });
        }
      }

      await db.user.delete({ where: { id: userId } });

      void logAudit(db, {
        userId: (req as any).user?.id,
        email: (req as any).user?.email,
        action: 'user.deleted',
        target: 'user',
        targetId: userId,
        detail: `User "${user.email}" deleted`,
        ip: req.ip,
      });

      res.json({ success: true });
    } catch (err) {
      if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2025') {
        return res.status(404).json({ error: 'User not found' });
      }
      res.status(500).json({ error: err.message });
    }
  });

  return router;
}