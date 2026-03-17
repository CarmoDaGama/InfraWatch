import axios from 'axios';
import nodemailer from 'nodemailer';
import TelegramBot from 'node-telegram-bot-api';

let emailTransporter = null;
let telegramBot = null;

function isEnabled(name) {
  return String(process.env[name] ?? '').toLowerCase() === 'true';
}

function parseCsvList(value) {
  return String(value ?? '')
    .split(',')
    .map((part) => part.trim())
    .filter(Boolean);
}

function buildMessage(device, newStatus, previousStatus) {
  const timestamp = new Date().toISOString();
  return (
    `Device ${device.name} (${device.url}) changed status from ` +
    `${previousStatus ?? 'unknown'} to ${newStatus} at ${timestamp}`
  );
}

function buildTitle(device, newStatus) {
  return `InfraWatch Alert: ${device.name} is ${newStatus}`;
}

function getNotificationData(device, newStatus, previousStatus) {
  const data: Record<string, string> = {
    device_name: String(device.name ?? ''),
    device_url: String(device.url ?? ''),
    new_status: String(newStatus ?? ''),
    previous_status: String(previousStatus ?? 'unknown'),
    timestamp: new Date().toISOString(),
  };

  if (device.id !== undefined && device.id !== null) {
    data.device_id = String(device.id);
  }
  if (device.type) {
    data.device_type = String(device.type);
  }

  return data;
}

async function sendEmailNotification(subject, message) {
  if (!isEnabled('EMAIL_ENABLED')) return;

  const host = process.env.EMAIL_HOST;
  const user = process.env.EMAIL_USER;
  const pass = process.env.EMAIL_PASS;
  const to = process.env.EMAIL_TO;

  if (!host || !user || !pass || !to) {
    console.warn('[InfraWatch] Email notification skipped: missing EMAIL_* configuration');
    return;
  }

  try {
    if (!emailTransporter) {
      const port = parseInt(process.env.EMAIL_PORT ?? '587', 10);
      emailTransporter = nodemailer.createTransport({
        host,
        port,
        secure: port === 465,
        auth: { user, pass },
      });
    }

    await emailTransporter.sendMail({
      from: user,
      to,
      subject,
      text: message,
    });
  } catch (err) {
    console.error('[InfraWatch] Email send error:', err.message);
  }
}

async function sendTelegramNotification(message) {
  if (!isEnabled('TELEGRAM_ENABLED')) return;

  const token = process.env.TELEGRAM_BOT_TOKEN;
  const chatId = process.env.TELEGRAM_CHAT_ID;

  if (!token || !chatId) {
    console.warn('[InfraWatch] Telegram notification skipped: missing TELEGRAM_* configuration');
    return;
  }

  try {
    if (!telegramBot) {
      telegramBot = new TelegramBot(token);
    }
    await telegramBot.sendMessage(chatId, message);
  } catch (err) {
    console.error('[InfraWatch] Telegram send error:', err.message);
  }
}

async function sendSmsNotification(subject, message) {
  if (!isEnabled('SMS_ENABLED')) return;

  const provider = String(process.env.SMS_PROVIDER ?? 'twilio').toLowerCase();
  if (provider !== 'twilio') {
    console.warn(`[InfraWatch] SMS notification skipped: unsupported SMS_PROVIDER "${provider}"`);
    return;
  }

  const accountSid = process.env.SMS_TWILIO_ACCOUNT_SID;
  const authToken = process.env.SMS_TWILIO_AUTH_TOKEN;
  const from = process.env.SMS_FROM;
  const recipients = parseCsvList(process.env.SMS_TO);

  if (!accountSid || !authToken || !from || recipients.length === 0) {
    console.warn('[InfraWatch] SMS notification skipped: missing SMS_* configuration');
    return;
  }

  const endpoint = `https://api.twilio.com/2010-04-01/Accounts/${accountSid}/Messages.json`;
  const bodyText = `${subject}\n${message}`;

  for (const to of recipients) {
    try {
      const payload = new URLSearchParams({
        From: from,
        To: to,
        Body: bodyText,
      });

      await axios.post(endpoint, payload.toString(), {
        auth: {
          username: accountSid,
          password: authToken,
        },
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      });
    } catch (err) {
      const providerMessage = err.response?.data?.message;
      console.error(`[InfraWatch] SMS send error (${to}):`, providerMessage ?? err.message);
    }
  }
}

async function sendFcmPushNotification(title, message, data) {
  const serverKey = process.env.PUSH_FCM_SERVER_KEY;
  const tokens = parseCsvList(process.env.PUSH_FCM_DEVICE_TOKENS);
  const topicValue = String(process.env.PUSH_FCM_TOPIC ?? '').trim();

  if (!serverKey) {
    console.warn('[InfraWatch] Push notification skipped: missing PUSH_FCM_SERVER_KEY');
    return;
  }
  if (tokens.length === 0 && !topicValue) {
    console.warn('[InfraWatch] Push notification skipped: missing PUSH_FCM_DEVICE_TOKENS or PUSH_FCM_TOPIC');
    return;
  }

  const payload = {
    notification: { title, body: message },
    data,
  } as Record<string, unknown>;

  if (topicValue) {
    payload.to = topicValue.startsWith('/topics/')
      ? topicValue
      : `/topics/${topicValue}`;
  } else {
    payload.registration_ids = tokens;
  }

  try {
    await axios.post('https://fcm.googleapis.com/fcm/send', payload, {
      headers: {
        Authorization: `key=${serverKey}`,
        'Content-Type': 'application/json',
      },
    });
  } catch (err) {
    const providerMessage = err.response?.data?.error || err.response?.data?.message;
    console.error('[InfraWatch] Push (FCM) send error:', providerMessage ?? err.message);
  }
}

async function sendWebhookPushNotification(title, message, device, newStatus, previousStatus) {
  const webhookUrl = process.env.PUSH_WEBHOOK_URL;
  if (!webhookUrl) {
    console.warn('[InfraWatch] Push notification skipped: missing PUSH_WEBHOOK_URL');
    return;
  }

  const authToken = process.env.PUSH_WEBHOOK_AUTH_TOKEN;
  const headers = authToken
    ? { Authorization: `Bearer ${authToken}` }
    : undefined;

  try {
    await axios.post(
      webhookUrl,
      {
        title,
        message,
        device,
        new_status: newStatus,
        previous_status: previousStatus,
        timestamp: new Date().toISOString(),
      },
      headers ? { headers } : undefined,
    );
  } catch (err) {
    console.error('[InfraWatch] Push (webhook) send error:', err.message);
  }
}

async function sendPushNotification(device, newStatus, previousStatus, subject, message) {
  if (!isEnabled('PUSH_ENABLED')) return;

  const provider = String(process.env.PUSH_PROVIDER ?? 'fcm').toLowerCase();
  const data = getNotificationData(device, newStatus, previousStatus);

  if (provider === 'fcm') {
    await sendFcmPushNotification(subject, message, data);
    return;
  }
  if (provider === 'webhook') {
    await sendWebhookPushNotification(subject, message, device, newStatus, previousStatus);
    return;
  }

  console.warn(`[InfraWatch] Push notification skipped: unsupported PUSH_PROVIDER "${provider}"`);
}

export async function sendAlert(subject, message) {
  console.log(`[InfraWatch] Alert: ${subject}`);
  await sendEmailNotification(subject, message);
}

export async function sendNotification(device, newStatus, previousStatus) {
  const subject = buildTitle(device, newStatus);
  const message = buildMessage(device, newStatus, previousStatus);

  console.log(`[InfraWatch] ${message}`);

  await Promise.allSettled([
    sendEmailNotification(subject, message),
    sendTelegramNotification(message),
    sendSmsNotification(subject, message),
    sendPushNotification(device, newStatus, previousStatus, subject, message),
  ]);
}

export async function sendSLAViolationAlert(device, message: string) {
  const subject = `InfraWatch SLA Violation: ${device.name}`;
  
  console.log(`[InfraWatch] SLA Violation: ${message}`);

  // Apply criticality-based escalation
  const isCritical = device.criticality === 'critical';
  
  // Send all channels for critical devices, subset for others
  if (isCritical) {
    // Critical: send all channels with higher priority
    await Promise.allSettled([
      sendEmailNotification(subject, message),
      sendTelegramNotification(`🚨 CRITICAL SLA VIOLATION\n\n${message}`),
      sendSmsNotification(subject, `[CRITICAL] ${message}`),
      sendFcmPushNotification('⚠️ SLA Violation', message, {
        device_name: device.name,
        device_id: String(device.id),
        severity: 'critical',
      }),
    ]);
  } else {
    // Non-critical: email and Telegram
    await Promise.allSettled([
      sendEmailNotification(subject, message),
      sendTelegramNotification(`⚠️ SLA Violation\n\n${message}`),
    ]);
  }
}
