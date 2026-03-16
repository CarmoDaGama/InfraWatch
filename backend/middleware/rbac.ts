const VALID_ROLES = ['viewer', 'operator', 'admin'];

const ROLE_PERMISSIONS = {
  viewer: new Set([
    'devices:read',
    'metrics:read',
  ]),
  operator: new Set([
    'devices:read',
    'devices:create',
    'devices:update',
    'metrics:read',
  ]),
  admin: new Set(['*']),
};

export function normalizeRole(role) {
  const value = String(role ?? '').trim().toLowerCase();
  return VALID_ROLES.includes(value) ? value : null;
}

export function resolvePermissions(role) {
  const normalized = normalizeRole(role);
  if (!normalized) return [];
  const values = Array.from(ROLE_PERMISSIONS[normalized] ?? []);
  return values;
}

export function hasPermission(role, permission) {
  const normalized = normalizeRole(role);
  if (!normalized) return false;

  const permissions = ROLE_PERMISSIONS[normalized];
  if (!permissions) return false;
  if (permissions.has('*')) return true;
  return permissions.has(permission);
}

export function requirePermission(permission) {
  return (req, res, next) => {
    const role = req.user?.role;
    if (!role) {
      return res.status(401).json({ error: 'Missing authenticated role' });
    }
    if (!hasPermission(role, permission)) {
      return res.status(403).json({ error: 'Forbidden: insufficient permission' });
    }
    return next();
  };
}

export { VALID_ROLES };