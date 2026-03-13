import axios from 'axios';

let intervalId = null;

export async function checkDevice(device) {
  const start = Date.now();
  try {
    await axios.get(device.url, { timeout: 10000 });
    return { status: 'up', response_time: Date.now() - start };
  } catch {
    return { status: 'down', response_time: null };
  }
}

export function startMonitoring(db, notifyFn) {
  const interval = parseInt(process.env.MONITOR_INTERVAL ?? '5000', 10);

  const poll = async () => {
    const devices = db
      .prepare('SELECT * FROM devices WHERE enabled = 1')
      .all();

    for (const device of devices) {
      const { status, response_time } = await checkDevice(device);

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
