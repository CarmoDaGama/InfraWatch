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

---

## Running Tests

```bash
cd backend
npm test
```

---

## Project Structure

```
InfraWatch/
├── backend/
│   ├── server.js          # Express app + startup
│   ├── db.js              # SQLite schema & connection
│   ├── monitor.js         # HTTP polling service
│   ├── notify.js          # Email + Telegram alerts
│   ├── routes/
│   │   ├── devices.js     # Device CRUD endpoints
│   │   └── metrics.js     # Metrics query endpoints
│   ├── tests/             # Jest + supertest test suite
│   ├── Dockerfile
│   └── .env.example
├── frontend/
│   ├── src/
│   │   ├── App.jsx        # Root component (auto-refresh)
│   │   ├── api.js         # Axios API helpers
│   │   └── components/
│   │       ├── Header.jsx
│   │       ├── DeviceTable.jsx
│   │       ├── AddDeviceForm.jsx
│   │       ├── UptimeChart.jsx
│   │       └── StatusBadge.jsx
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
