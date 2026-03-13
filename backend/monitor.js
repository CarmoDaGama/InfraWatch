import axios from 'axios';
import ping from 'ping';
import snmp from 'net-snmp';

let intervalId = null;

// ── Individual checkers ───────────────────────────────────────────────────────

export async function checkHttp(device) {
  const start = Date.now();
  try {
    await axios.get(device.url, { timeout: 10000 });
    return { status: 'up', response_time: Date.now() - start };
  } catch {
    return { status: 'down', response_time: null };
  }
}

export async function checkPing(device) {
  const start = Date.now();
  try {
    const result = await ping.promise.probe(device.url, { timeout: 5, min_reply: 1 });
    if (result.alive) {
      const rt = parseFloat(result.time);
      return {
        status: 'up',
        response_time: Number.isFinite(rt) ? rt : Date.now() - start,
      };
    }
    return { status: 'down', response_time: null };
  } catch {
    return { status: 'down', response_time: null };
  }
}

export function checkSnmp(device) {
  return new Promise((resolve) => {
    const start     = Date.now();
    const host      = device.url;
    const community = device.snmp_community ?? 'public';
    const oid       = device.snmp_oid       ?? '1.3.6.1.2.1.1.1.0';
    const port      = device.snmp_port      ?? 161;

    let session;
    try {
      session = snmp.createSession(host, community, {
        port,
        timeout: 5000,
        retries: 1,
        version: snmp.Version2c,
      });
    } catch {
      resolve({ status: 'down', response_time: null });
      return;
    }

    session.get([oid], (error, varbinds) => {
      session.close(); // always close to avoid UDP socket leaks
      if (error) {
        resolve({ status: 'down', response_time: null });
        return;
      }
      const ok = varbinds.every((vb) => !snmp.isVarbindError(vb));
      resolve({ status: ok ? 'up' : 'down', response_time: Date.now() - start });
    });
  });
}

// ── Dispatcher ────────────────────────────────────────────────────────────────

export async function checkDevice(device) {
  switch (device.type) {
    case 'ping': return checkPing(device);
    case 'snmp': return checkSnmp(device);
    default:     return checkHttp(device); // 'http' or missing type
  }
}

// ── Poll loop ─────────────────────────────────────────────────────────────────

export function startMonitoring(db, notifyFn) {
  const interval = parseInt(process.env.MONITOR_INTERVAL ?? '5000', 10);

  const poll = async () => {
    const devices = db
      .prepare('SELECT * FROM devices WHERE enabled = 1')
      .all();

    // Run all device checks concurrently — SNMP in particular can have 5 s timeouts.
    const results = await Promise.all(
      devices.map(async (device) => {
        const { status, response_time } = await checkDevice(device);
        return { device, status, response_time };
      })
    );

    // DB writes and notifications are sequential (better-sqlite3 is synchronous).
    for (const { device, status, response_time } of results) {
      const prev = db
        .prepare(
          `SELECT status FROM metrics
           WHERE device_id = ?
           ORDER BY checked_at DESC
           LIMIT 1`
        )
        .get(device.id);

      db.prepare(
        'INSERT INTO metrics (device_id, status, response_time) VALUES (?, ?, ?)'
      ).run(device.id, status, response_time);

      const previousStatus = prev?.status ?? null;
      if (previousStatus !== status) {
        notifyFn(device, status, previousStatus);
      }
    }
  };

  intervalId = setInterval(poll, interval);
  return intervalId;
}

export function stopMonitoring() {
  if (intervalId !== null) {
    clearInterval(intervalId);
    intervalId = null;
  }
}
