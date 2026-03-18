# Audit Logs + User Creation — Implementation Plan

## Overview
Implement two missing features from the SDD:
1. **Audit Logs (RNF06)** — track user actions (login, device CRUD, role changes)
2. **User Creation via UI (RF08)** — allow admins to create/delete users from the frontend

---

## Proposed Changes

### Prisma Schema

#### [MODIFY] [schema.prisma](file:///c:/Users/Kivembasoft/Desktop/Projects/InfraWatch/backend/prisma/schema.prisma)

Add `AuditLog` model:
```prisma
model AuditLog {
  id        Int      @id @default(autoincrement())
  userId    Int?     @map("user_id")
  email     String?
  action    String   @db.VarChar(50)
  target    String?  @db.VarChar(100)
  targetId  String?  @map("target_id")
  detail    String?
  ip        String?  @db.VarChar(45)
  createdAt DateTime @default(now()) @map("created_at")

  @@index([createdAt])
  @@index([action])
  @@map("audit_logs")
}
```

Run migration: `npx prisma migrate dev --name add-audit-logs`

---

### Backend — Audit Log Module

#### [NEW] [audit.ts](file:///c:/Users/Kivembasoft/Desktop/Projects/InfraWatch/backend/audit.ts)

Utility function `logAudit(db, { userId, email, action, target, targetId, detail, ip })` that writes to the `AuditLog` table (fire-and-forget, never throws).

#### [NEW] [routes/audit.ts](file:///c:/Users/Kivembasoft/Desktop/Projects/InfraWatch/backend/routes/audit.ts)

- `GET /api/audit` — admin-only, returns audit logs with pagination (`limit`, `offset`) and optional `action` filter

#### [MODIFY] [server.ts](file:///c:/Users/Kivembasoft/Desktop/Projects/InfraWatch/backend/server.ts)

Register: `app.use('/api/audit', verifyToken, auditRouter(db))`

#### [MODIFY] [routes/auth.ts](file:///c:/Users/Kivembasoft/Desktop/Projects/InfraWatch/backend/routes/auth.ts)

Add `logAudit` calls for:
- Successful login → `action: 'user.login'`
- Failed login → `action: 'user.login_failed'`

#### [MODIFY] [routes/devices.ts](file:///c:/Users/Kivembasoft/Desktop/Projects/InfraWatch/backend/routes/devices.ts)

Add `logAudit` calls for:
- `POST /devices` → `action: 'device.created'`
- `PATCH /devices/:id` → `action: 'device.updated'`
- `DELETE /devices/:id` → `action: 'device.deleted'`

#### [MODIFY] [routes/users.ts](file:///c:/Users/Kivembasoft/Desktop/Projects/InfraWatch/backend/routes/users.ts)

Add `logAudit` calls for:
- `POST /users` (new) → `action: 'user.created'`
- `PATCH /users/:id/role` → `action: 'user.role_changed'`
- `DELETE /users/:id` (new) → `action: 'user.deleted'`

---

### Backend — User CRUD

#### [MODIFY] [routes/users.ts](file:///c:/Users/Kivembasoft/Desktop/Projects/InfraWatch/backend/routes/users.ts)

Add two new endpoints:
- `POST /api/users` — admin-only, creates a user with `{ email, password, role }` (hashes password with bcryptjs)
- `DELETE /api/users/:id` — admin-only, deletes a user (blocks deleting the last admin)

---

### Frontend — API Layer

#### [MODIFY] [api.ts](file:///c:/Users/Kivembasoft/Desktop/Projects/InfraWatch/frontend/src/api.ts)

Add:
```ts
export const createUser = (data) => api.post('/users', data)
export const deleteUser = (id) => api.delete(`/users/${id}`)
export const getAuditLogs = (params) => api.get('/audit', { params })
```

---

### Frontend — User Management

#### [MODIFY] [UsersPanel.tsx](file:///c:/Users/Kivembasoft/Desktop/Projects/InfraWatch/frontend/src/components/UsersPanel.tsx)

- Add "Create User" button + inline form (email, password, role select)
- Add delete button per user row (with confirmation)
- Wire to `createUser` and `deleteUser` API calls

---

### Frontend — Audit Logs Page

#### [NEW] [AuditLogsPage.tsx](file:///c:/Users/Kivembasoft/Desktop/Projects/InfraWatch/frontend/src/components/AuditLogsPage.tsx)

Table showing: timestamp, user email, action, target, detail, IP. With pagination and action filter dropdown. Admin-only.

#### [MODIFY] [Sidebar.tsx](file:///c:/Users/Kivembasoft/Desktop/Projects/InfraWatch/frontend/src/components/Sidebar.tsx)

Add "Auditoria" nav item (admin-only), using `HiClipboardDocumentList` icon.

#### [MODIFY] [App.tsx](file:///c:/Users/Kivembasoft/Desktop/Projects/InfraWatch/frontend/src/App.tsx)

Add `activeRoute === 'audit'` rendering for `AuditLogsPage`.

---

### i18n

#### [MODIFY] [pt.json](file:///c:/Users/Kivembasoft/Desktop/Projects/InfraWatch/frontend/src/locales/pt.json) and [en.json](file:///c:/Users/Kivembasoft/Desktop/Projects/InfraWatch/frontend/src/locales/en.json)

Add keys for audit page (`audit.*`) and user creation (`users.create*`, `users.delete*`).

---

## Verification Plan

### Build Check
```bash
cd /mnt/c/Users/Kivembasoft/Desktop/Projects/InfraWatch/backend && npx tsc --noEmit
```

### Manual Verification
After implementation, the user should:
1. Run `npx prisma migrate dev --name add-audit-logs` to apply schema changes
2. Start the backend locally (`npm run dev`)
3. Start the frontend locally (`npm run dev`)
4. **Test User Creation:** Navigate to Users page → click "Criar Utilizador" → fill email/password/role → submit → verify user appears in table
5. **Test User Deletion:** Click delete on a non-admin user → confirm → verify user disappears
6. **Test Audit Logs:** Navigate to Auditoria page → verify login event is visible → create/delete a device → verify events logged → change a user role → verify event logged
