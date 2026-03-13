import nodemailer from 'nodemailer';
import TelegramBot from 'node-telegram-bot-api';

function buildMessage(device, newStatus, previousStatus) {
  const timestamp = new Date().toISOString();
  return (
    `Device ${device.name} (${device.url}) changed status from ` +
    `${previousStatus ?? 'unknown'} to ${newStatus} at ${timestamp}`
  );
}

export async function sendNotification(device, newStatus, previousStatus) {
  const message = buildMessage(device, newStatus, previousStatus);

  console.log(`[InfraWatch] ${message}`);

  if (process.env.EMAIL_ENABLED === 'true') {
    try {
      const transporter = nodemailer.createTransport({
        host: process.env.EMAIL_HOST,
        port: parseInt(process.env.EMAIL_PORT ?? '587', 10),
        auth: {
          user: process.env.EMAIL_USER,
          pass: process.env.EMAIL_PASS,
        },
      });

      await transporter.sendMail({
        from: process.env.EMAIL_USER,
        to: process.env.EMAIL_TO,
        subject: `InfraWatch Alert: ${device.name} is ${newStatus}`,
        text: message,
      });
    } catch (err) {
      console.error('[InfraWatch] Email send error:', err.message);
    }
  }

  if (process.env.TELEGRAM_ENABLED === 'true') {
    try {
      const bot = new TelegramBot(process.env.TELEGRAM_BOT_TOKEN);
      await bot.sendMessage(process.env.TELEGRAM_CHAT_ID, message);
    } catch (err) {
      console.error('[InfraWatch] Telegram send error:', err.message);
    }
  }
}
