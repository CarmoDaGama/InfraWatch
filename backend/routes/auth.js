import { Router } from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { sendAlert } from '../notify.js';

export default function authRouter(db) {
  const router = Router();

  // POST /api/auth/login
  router.post('/login', (req, res) => {
    const { email, password } = req.body ?? {};

    if (!email || !password) {
      return res.status(400).json({ error: 'email and password are required' });
    }

    const user = db.prepare('SELECT * FROM users WHERE email = ?').get(email);
    if (!user) {
      sendAlert(
        'InfraWatch Security: Tentativa de Login Falhada',
        `Tentativa de login para email desconhecido "${email}" a partir de IP ${req.ip} em ${new Date().toISOString()}`
      );
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    const valid = bcrypt.compareSync(password, user.password_hash);
    if (!valid) {
      sendAlert(
        'InfraWatch Security: Tentativa de Login Falhada',
        `Senha incorreta para o utilizador "${email}" a partir de IP ${req.ip} em ${new Date().toISOString()}`
      );
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    const token = jwt.sign(
      { sub: user.id, email: user.email },
      process.env.JWT_SECRET,
      { expiresIn: process.env.JWT_EXPIRES_IN ?? '8h' }
    );

    return res.json({ token });
  });

  return router;
}
