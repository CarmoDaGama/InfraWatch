import { Router } from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { sendAlert } from '../notify.js';
import { normalizeRole, resolvePermissions } from '../middleware/rbac.js';
import { createSession, isSessionStoreEnabled } from '../session-store.js';

function getJwtSecret() {
  return process.env.JWT_SECRET ?? 'dev-secret-change-me';
}

function parseDurationToSeconds(value: string | undefined) {
  const input = String(value ?? '8h').trim();
  const match = input.match(/^(\d+)([smhd]?)$/i);
  if (!match) return 8 * 60 * 60;

  const amount = Number.parseInt(match[1], 10);
  const unit = (match[2] || 's').toLowerCase();
  if (unit === 'm') return amount * 60;
  if (unit === 'h') return amount * 60 * 60;
  if (unit === 'd') return amount * 24 * 60 * 60;
  return amount;
}

export default function authRouter(db) {
  const router = Router();

  // POST /api/auth/login
  router.post('/login', async (req, res) => {
    const { email, password } = req.body ?? {};

    if (!email || !password) {
      return res.status(400).json({ error: 'email and password are required' });
    }

    try {
      const user = await db.user.findUnique({ where: { email } });
      if (!user) {
        void sendAlert(
          'InfraWatch Security: Tentativa de Login Falhada',
          `Tentativa de login para email desconhecido "${email}" a partir de IP ${req.ip} em ${new Date().toISOString()}`
        );
        return res.status(401).json({ error: 'Invalid credentials' });
      }

      const valid = bcrypt.compareSync(password, user.passwordHash);
      if (!valid) {
        void sendAlert(
          'InfraWatch Security: Tentativa de Login Falhada',
          `Senha incorreta para o utilizador "${email}" a partir de IP ${req.ip} em ${new Date().toISOString()}`
        );
        return res.status(401).json({ error: 'Invalid credentials' });
      }

      const role = normalizeRole(user.role) ?? 'viewer';
      const permissions = resolvePermissions(role);

      const expiresIn = (process.env.JWT_EXPIRES_IN ?? '8h') as jwt.SignOptions['expiresIn'];
      const sessionTtlSeconds = parseDurationToSeconds(process.env.JWT_EXPIRES_IN);
      const jti = await createSession(
        {
          id: user.id,
          email: user.email,
          role,
        },
        sessionTtlSeconds,
      );

      const token = jwt.sign(
        { sub: user.id, email: user.email, role },
        getJwtSecret(),
        {
          expiresIn,
          ...(jti ? { jwtid: jti } : {}),
        }
      );

      return res.json({
        token,
        user: {
          id: user.id,
          email: user.email,
          role,
          permissions,
        },
        session_store: isSessionStoreEnabled() ? 'redis' : 'jwt-only',
      });
    } catch (err) {
      return res.status(500).json({ error: err.message });
    }
  });

  return router;
}
