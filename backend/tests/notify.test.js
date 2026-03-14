import { jest } from '@jest/globals';

const mockSendMail = jest.fn();
const mockCreateTransport = jest.fn(() => ({ sendMail: mockSendMail }));

jest.unstable_mockModule('nodemailer', () => ({
  default: { createTransport: mockCreateTransport },
}));

const mockTelegramSendMessage = jest.fn();
const mockTelegramCtor = jest.fn(() => ({ sendMessage: mockTelegramSendMessage }));

jest.unstable_mockModule('node-telegram-bot-api', () => ({
  default: mockTelegramCtor,
}));

const mockAxiosPost = jest.fn();

jest.unstable_mockModule('axios', () => ({
  default: { post: mockAxiosPost },
}));

const { sendNotification } = await import('../notify.js');

const originalEnv = { ...process.env };
const baseDevice = {
  id: 1,
  name: 'API Gateway',
  url: 'https://api.example.com',
  type: 'http',
};

describe('sendNotification channels', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    process.env = { ...originalEnv };
    process.env.EMAIL_ENABLED = 'false';
    process.env.TELEGRAM_ENABLED = 'false';
    process.env.SMS_ENABLED = 'false';
    process.env.PUSH_ENABLED = 'false';
  });

  afterAll(() => {
    process.env = originalEnv;
  });

  test('keeps email and telegram notifications working', async () => {
    process.env.EMAIL_ENABLED = 'true';
    process.env.EMAIL_HOST = 'smtp.example.com';
    process.env.EMAIL_PORT = '587';
    process.env.EMAIL_USER = 'alerts@example.com';
    process.env.EMAIL_PASS = 'email-secret';
    process.env.EMAIL_TO = 'ops@example.com';

    process.env.TELEGRAM_ENABLED = 'true';
    process.env.TELEGRAM_BOT_TOKEN = 'telegram-bot-token';
    process.env.TELEGRAM_CHAT_ID = '123456';

    await sendNotification(baseDevice, 'down', 'up');

    expect(mockCreateTransport).toHaveBeenCalled();
    expect(mockSendMail).toHaveBeenCalledWith(
      expect.objectContaining({
        to: 'ops@example.com',
        subject: 'InfraWatch Alert: API Gateway is down',
      })
    );
    expect(mockTelegramCtor).toHaveBeenCalledWith('telegram-bot-token');
    expect(mockTelegramSendMessage).toHaveBeenCalledWith(
      '123456',
      expect.stringContaining('changed status from up to down')
    );
  });

  test('sends SMS notifications through Twilio to all configured recipients', async () => {
    process.env.SMS_ENABLED = 'true';
    process.env.SMS_PROVIDER = 'twilio';
    process.env.SMS_TWILIO_ACCOUNT_SID = 'AC123';
    process.env.SMS_TWILIO_AUTH_TOKEN = 'auth-123';
    process.env.SMS_FROM = '+15550001111';
    process.env.SMS_TO = '+244900000001,+244900000002';

    await sendNotification(baseDevice, 'down', 'up');

    expect(mockAxiosPost).toHaveBeenCalledTimes(2);

    const [endpoint, body, config] = mockAxiosPost.mock.calls[0];
    expect(endpoint).toBe('https://api.twilio.com/2010-04-01/Accounts/AC123/Messages.json');
    expect(body).toContain('From=%2B15550001111');
    expect(body).toContain('To=%2B244900000001');
    expect(config).toEqual(
      expect.objectContaining({
        auth: { username: 'AC123', password: 'auth-123' },
      })
    );
  });

  test('sends push notifications through FCM topic', async () => {
    process.env.PUSH_ENABLED = 'true';
    process.env.PUSH_PROVIDER = 'fcm';
    process.env.PUSH_FCM_SERVER_KEY = 'fcm-key';
    process.env.PUSH_FCM_TOPIC = 'infrawatch-alerts';

    await sendNotification(baseDevice, 'down', 'up');

    expect(mockAxiosPost).toHaveBeenCalledTimes(1);

    const [endpoint, payload, config] = mockAxiosPost.mock.calls[0];
    expect(endpoint).toBe('https://fcm.googleapis.com/fcm/send');
    expect(payload).toEqual(
      expect.objectContaining({
        to: '/topics/infrawatch-alerts',
        notification: expect.objectContaining({
          title: 'InfraWatch Alert: API Gateway is down',
        }),
      })
    );
    expect(config.headers.Authorization).toBe('key=fcm-key');
  });

  test('sends push notifications through webhook provider', async () => {
    process.env.PUSH_ENABLED = 'true';
    process.env.PUSH_PROVIDER = 'webhook';
    process.env.PUSH_WEBHOOK_URL = 'https://push.example.com/hook';
    process.env.PUSH_WEBHOOK_AUTH_TOKEN = 'webhook-secret';

    await sendNotification(baseDevice, 'up', 'down');

    expect(mockAxiosPost).toHaveBeenCalledTimes(1);

    const [url, payload, config] = mockAxiosPost.mock.calls[0];
    expect(url).toBe('https://push.example.com/hook');
    expect(payload).toEqual(
      expect.objectContaining({
        title: 'InfraWatch Alert: API Gateway is up',
        new_status: 'up',
        previous_status: 'down',
      })
    );
    expect(config.headers.Authorization).toBe('Bearer webhook-secret');
  });
});
