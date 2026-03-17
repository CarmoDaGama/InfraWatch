# InfraWatch

Uma plataforma de monitoramento em tempo real de infraestruturas com dashboards e alertas.

> **MVP developed for a hackathon** – monitors HTTP/HTTPS endpoints and servers, displays live status on a dashboard, charts uptime history, and sends alerts via email or Telegram when a device goes offline.

---

## Features

- 🟢 **Real-time monitoring** – polling interval configurable per device (RNF02)
- 📊 **Dashboard** – live status table + 24-hour uptime bar chart
- 🔔 **Alerts** – email, Telegram, SMS (Twilio), and push (FCM/Webhook) on status change
- ➕ **Device management** – add/remove devices via a web form
- 🗃️ **Persistence** – SQLite stores device configurations and metric history
- ⚡ **Redis cache (P1)** – 30-second cache for device stats and uptime queries
- 🧵 **Bull worker queue (P1)** – queued monitoring checks + notification workers
- 🔌 **Integrations (P1)** – plugin-based GLPI/DocuWare outbound + inbound webhook sync

---

## Tech Stack

| Layer | Technology |
|-------|------------|
| Frontend | React 18, Vite, Tailwind CSS, Chart.js |
| Backend | Node.js 20, Express 4, better-sqlite3 |
| Notifications | Nodemailer (email), Telegram Bot API |
| Container | Docker + Docker Compose |

---

## Quick Start (Docker Compose)

```bash
# Clone the repository
git clone https://github.com/CarmoDaGama/InfraWatch.git
cd InfraWatch

# (Optional) configure notifications
cp backend/.env.example backend/.env
# edit backend/.env with your email / Telegram credentials

# Start everything
docker compose up --build
```

- Frontend: http://localhost:5173
- Backend API: http://localhost:3001

---

## Manual Setup (Development)

### Backend

```bash
nvm install 20
nvm use 20
cd backend
npm install
cp .env.example .env     # edit as needed
npm run dev              # starts on port 3001 with auto-reload
```

### Frontend

```bash
cd frontend
npm install
npm run dev              # starts on port 5173, proxies /api → localhost:3001
```

---

## Environment Variables

Copy `backend/.env.example` to `backend/.env` and adjust:

| Variable | Default | Description |
|----------|---------|-------------|
| `PORT` | `3001` | Backend HTTP port |
| `MONITOR_INTERVAL` | `5000` | Fallback polling interval in milliseconds (used when a device has no custom interval) |
| `EMAIL_ENABLED` | `false` | Enable email alerts |
| `EMAIL_HOST` | `smtp.gmail.com` | SMTP server |
| `EMAIL_PORT` | `587` | SMTP port |
| `EMAIL_USER` | – | SMTP username |
| `EMAIL_PASS` | – | SMTP password / app password |
| `EMAIL_TO` | – | Alert recipient address |
| `TELEGRAM_ENABLED` | `false` | Enable Telegram alerts |
| `TELEGRAM_BOT_TOKEN` | – | Bot token from @BotFather |
| `TELEGRAM_CHAT_ID` | – | Target chat/user ID |
| `SMS_ENABLED` | `false` | Enable SMS alerts |
| `SMS_PROVIDER` | `twilio` | SMS provider (`twilio`) |
| `SMS_TWILIO_ACCOUNT_SID` | – | Twilio Account SID |
| `SMS_TWILIO_AUTH_TOKEN` | – | Twilio Auth Token |
| `SMS_FROM` | – | Twilio sender number |
| `SMS_TO` | – | Comma-separated destination numbers |
| `PUSH_ENABLED` | `false` | Enable push alerts |
| `PUSH_PROVIDER` | `fcm` | Push provider (`fcm` or `webhook`) |
| `PUSH_FCM_SERVER_KEY` | – | FCM server key |
| `PUSH_FCM_DEVICE_TOKENS` | – | Comma-separated FCM device tokens |
| `PUSH_FCM_TOPIC` | – | FCM topic name (optional alternative to tokens) |
| `PUSH_WEBHOOK_URL` | – | Push webhook endpoint (when provider is `webhook`) |
| `PUSH_WEBHOOK_AUTH_TOKEN` | – | Optional bearer token for push webhook |
| `REDIS_ENABLED` | `false` | Enable Redis-backed cache and distributed session store |
| `REDIS_URL` | `redis://127.0.0.1:6379` | Redis connection URL |
| `REDIS_SESSION_ENABLED` | `true` | Enforce JWT session IDs (`jti`) against Redis |
| `WORKER_QUEUE_ENABLED` | `false` | Enable Bull queues for monitor and notification jobs |
| `MONITOR_WORKER_CONCURRENCY` | `5` | Monitor worker pool size |
| `NOTIFY_WORKER_CONCURRENCY` | `8` | Notification worker pool size |
| `INTEGRATIONS_WEBHOOK_SECRET` | – | Shared secret for inbound integration webhooks (`x-integration-secret`) |
| `GLPI_ENABLED` | `false` | Enable GLPI plugin |
| `GLPI_WEBHOOK_URL` | – | GLPI outbound webhook endpoint |
| `GLPI_WEBHOOK_TOKEN` | – | Optional bearer token for GLPI webhook |
| `DOCUWARE_ENABLED` | `false` | Enable DocuWare plugin |
| `DOCUWARE_WEBHOOK_URL` | – | DocuWare outbound webhook endpoint |
| `DOCUWARE_WEBHOOK_TOKEN` | – | Optional bearer token for DocuWare webhook |

---

## Access Control (RBAC)

The backend uses JWT authentication with role-based access control.

Roles:

- `viewer`: read-only access to devices and metrics
- `operator`: viewer permissions + create/update devices
- `admin`: full access, including device deletion

Bootstrap admin user via environment variables:

- `ADMIN_EMAIL`
- `ADMIN_PASSWORD`
- `ADMIN_ROLE` (`admin` by default)

`POST /api/auth/login` returns the token plus user role and resolved permissions.

---

## API Reference

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/health` | Health check |
| GET | `/api/devices` | List all devices with latest status |
| POST | `/api/devices` | Add a device `{ name, url, type, check_interval_seconds, ... }` |
| PATCH | `/api/devices/:id` | Update device SLA/criticality/interval |
| DELETE | `/api/devices/:id` | Remove a device |
| GET | `/api/metrics` | Query metrics (`device_id`, `hours`, `limit`) |
| GET | `/api/metrics/uptime` | Uptime % per device (`hours`) |
| GET | `/api/users` | List users and roles (admin) |
| PATCH | `/api/users/:id/role` | Update user role (`viewer`, `operator`, `admin`) (admin) |
| POST | `/api/integrations/webhook/:provider` | Inbound sync endpoint for `glpi` / `docuware` |

---

## Running Tests

```bash
cd backend
npm test
```

---

## Troubleshooting

### `npm install` fails on `better-sqlite3`

The backend is pinned to Node 20. If you run `npm install` with a newer major version such as Node 25, `better-sqlite3` may not have a prebuilt binary for that ABI and npm falls back to compiling from source.

On Linux that source build also requires a C toolchain (`cc`/`gcc`, `make`, Python). If `cc` is missing, the install fails with errors like `make: cc: No such file or directory`.

Use the supported runtime:

```bash
nvm install 20
nvm use 20
cd backend
npm install
```

If you intentionally want to build native modules from source on Linux, install the toolchain first:

```bash
sudo apt update
sudo apt install build-essential python3 make
```

Docker avoids the host Node mismatch entirely:

```bash
docker compose up --build
```

---

## Project Structure

```
InfraWatch/
├── backend/
│   ├── server.ts          # Express app + startup
│   ├── db.ts              # SQLite schema & connection
│   ├── monitor.ts         # HTTP polling service
│   ├── notify.ts          # Email + Telegram alerts
│   ├── routes/
│   │   ├── devices.ts     # Device CRUD endpoints
│   │   └── metrics.ts     # Metrics query endpoints
│   ├── tests/             # Jest + supertest test suite
│   ├── Dockerfile
│   └── .env.example
├── frontend/
│   ├── src/
│   │   ├── App.tsx        # Root component (auto-refresh)
│   │   ├── api.ts         # Axios API helpers
│   │   └── components/
│   │       ├── Header.tsx
│   │       ├── DeviceTable.tsx
│   │       ├── AddDeviceForm.tsx
│   │       ├── UptimeChart.tsx
│   │       └── StatusBadge.tsx
│   ├── Dockerfile
│   └── nginx.conf
└── docker-compose.yml
```

---

## Hackathon Demo Scenario

1. Start the app with `docker compose up --build`
2. Add a few devices (e.g. `https://google.com`, a local service)
3. Stop one of the local services to simulate an outage
4. Watch the dashboard turn red and receive an alert notification in real time
