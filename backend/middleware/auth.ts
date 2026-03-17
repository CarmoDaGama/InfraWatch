import jwt from 'jsonwebtoken';
import { hasActiveSession, isSessionStoreEnabled } from '../session-store.js';

export async function verifyToken(req, res, next) {
  const auth = req.headers.authorization;

  if (!auth?.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Missing or malformed token' });
  }

  try {
    const payload = jwt.verify(auth.slice(7), process.env.JWT_SECRET) as jwt.JwtPayload;

    if (isSessionStoreEnabled()) {
      const jti = typeof payload.jti === 'string' ? payload.jti : undefined;
      const active = await hasActiveSession(jti);
      if (!active) {
        return res.status(401).json({ error: 'Session expired or revoked' });
      }
    }

    req.user = payload;
    next();
  } catch {
    return res.status(401).json({ error: 'Invalid or expired token' });
  }
}
