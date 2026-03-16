import { Router } from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { sendAlert } from '../notify.js';
import { normalizeRole, resolvePermissions } from '../middleware/rbac.js';

function getJwtSecret() {
  return process.env.JWT_SECRET ?? 'dev-secret-change-me';
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
      const token = jwt.sign(
        { sub: user.id, email: user.email, role },
        getJwtSecret(),
        { expiresIn }
      );

      return res.json({
        token,
        user: {
          id: user.id,
          email: user.email,
          role,
          permissions,
        },
      });
    } catch (err) {
      return res.status(500).json({ error: err.message });
    }
  });

  return router;
}
