/**
 * Audit logging utility.
 *
 * Records user actions in the audit_logs table.
 * All calls are fire-and-forget — logging failures are printed but never
 * bubble up to callers so they don't break the main request flow.
 */

type AuditEntry = {
  userId?: number | null;
  email?: string | null;
  action: string;
  target?: string | null;
  targetId?: string | number | null;
  detail?: string | null;
  ip?: string | null;
};

export async function logAudit(db: any, entry: AuditEntry) {
  try {
    await db.auditLog.create({
      data: {
        userId: entry.userId ?? null,
        email: entry.email ?? null,
        action: entry.action,
        target: entry.target ?? null,
        targetId: entry.targetId != null ? String(entry.targetId) : null,
        detail: entry.detail ?? null,
        ip: entry.ip ?? null,
      },
    });
  } catch (err) {
    console.error('[InfraWatch] Audit log write failed:', err instanceof Error ? err.message : err);
  }
}
