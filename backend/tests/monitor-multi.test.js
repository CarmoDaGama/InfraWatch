import { jest } from '@jest/globals';

// All jest.unstable_mockModule calls must appear before any dynamic import
// of the module under test (ESM module mock system requirement).

// ── Mock 'ping' ───────────────────────────────────────────────────────────────
const mockProbe = jest.fn();
jest.unstable_mockModule('ping', () => ({
  default: { promise: { probe: mockProbe } },
}));

// ── Mock 'net-snmp' ───────────────────────────────────────────────────────────
const mockSessionClose = jest.fn();
const mockSessionGet   = jest.fn();
const mockCreateSession = jest.fn(() => ({ get: mockSessionGet, close: mockSessionClose }));
const mockIsVarbindError = jest.fn(() => false);

jest.unstable_mockModule('net-snmp', () => ({
  default: {
    createSession: mockCreateSession,
    Version2c: 1,
    isVarbindError: mockIsVarbindError,
  },
}));

// ── Mock 'axios' (so checkHttp doesn't make real network calls) ───────────────
const mockAxiosGet = jest.fn();
jest.unstable_mockModule('axios', () => ({
  default: { get: mockAxiosGet },
}));

const { checkDevice, checkPing, checkSnmp } = await import('../monitor.js');

// ── Ping tests ────────────────────────────────────────────────────────────────

describe('checkPing', () => {
  beforeEach(() => mockProbe.mockReset());

  test('returns "up" with numeric response_time when host is alive', async () => {
    mockProbe.mockResolvedValueOnce({ alive: true, time: '12.345' });
    const result = await checkPing({ url: '192.168.1.1' });
    expect(result.status).toBe('up');
    expect(result.response_time).toBeCloseTo(12.345);
  });

  test('returns "up" with fallback response_time when time is "unknown"', async () => {
    mockProbe.mockResolvedValueOnce({ alive: true, time: 'unknown' });
    const result = await checkPing({ url: '192.168.1.1' });
    expect(result.status).toBe('up');
    expect(typeof result.response_time).toBe('number');
    expect(result.response_time).toBeGreaterThanOrEqual(0);
  });

  test('returns "down" when host is not alive', async () => {
    mockProbe.mockResolvedValueOnce({ alive: false, time: 'unknown' });
    const result = await checkPing({ url: '10.255.255.1' });
    expect(result.status).toBe('down');
    expect(result.response_time).toBeNull();
  });

  test('returns "down" when probe rejects', async () => {
    mockProbe.mockRejectedValueOnce(new Error('ping binary not found'));
    const result = await checkPing({ url: 'bad-host' });
    expect(result.status).toBe('down');
    expect(result.response_time).toBeNull();
  });
});

// ── SNMP tests ────────────────────────────────────────────────────────────────

describe('checkSnmp', () => {
  beforeEach(() => {
    mockCreateSession.mockClear();
    mockSessionGet.mockReset();
    mockSessionClose.mockClear();
    mockIsVarbindError.mockReset();
    mockIsVarbindError.mockReturnValue(false);
  });

  test('returns "up" with response_time when GET succeeds', async () => {
    mockSessionGet.mockImplementation((_oids, cb) =>
      cb(null, [{ oid: '1.3.6.1.2.1.1.1.0', value: 'Linux' }])
    );
    const result = await checkSnmp({
      url: '192.168.1.1',
      snmp_community: 'public',
      snmp_oid: '1.3.6.1.2.1.1.1.0',
      snmp_port: 161,
    });
    expect(result.status).toBe('up');
    expect(typeof result.response_time).toBe('number');
    expect(mockSessionClose).toHaveBeenCalledTimes(1);
  });

  test('returns "down" when GET returns an error', async () => {
    mockSessionGet.mockImplementation((_oids, cb) =>
      cb(new Error('Request timed out'), null)
    );
    const result = await checkSnmp({ url: '10.0.0.99', snmp_community: 'public' });
    expect(result.status).toBe('down');
    expect(result.response_time).toBeNull();
    expect(mockSessionClose).toHaveBeenCalledTimes(1);
  });

  test('returns "down" when varbind is an SNMP error type', async () => {
    mockIsVarbindError.mockReturnValue(true);
    mockSessionGet.mockImplementation((_oids, cb) =>
      cb(null, [{ oid: '1.3.6.1.2.1.1.1.0' }])
    );
    const result = await checkSnmp({ url: '192.168.1.1', snmp_community: 'public' });
    expect(result.status).toBe('down');
    expect(mockSessionClose).toHaveBeenCalledTimes(1);
  });

  test('returns "down" when createSession throws synchronously', async () => {
    mockCreateSession.mockImplementationOnce(() => { throw new Error('Invalid host'); });
    const result = await checkSnmp({ url: '', snmp_community: 'public' });
    expect(result.status).toBe('down');
    expect(result.response_time).toBeNull();
  });

  test('uses device defaults when snmp fields are undefined', async () => {
    mockSessionGet.mockImplementation((_oids, cb) => cb(null, [{}]));
    await checkSnmp({ url: '192.168.1.1' }); // no snmp_community/oid/port
    expect(mockCreateSession).toHaveBeenCalledWith(
      '192.168.1.1',
      'public',
      expect.objectContaining({ port: 161 })
    );
  });
});

// ── Dispatcher tests ──────────────────────────────────────────────────────────

describe('checkDevice dispatcher', () => {
  beforeEach(() => {
    mockProbe.mockReset();
    mockAxiosGet.mockReset();
    mockSessionGet.mockReset();
    mockSessionClose.mockReset();
    mockIsVarbindError.mockReturnValue(false);
  });

  test('dispatches to checkPing for type="ping"', async () => {
    mockProbe.mockResolvedValueOnce({ alive: true, time: '5' });
    const result = await checkDevice({ url: '192.168.1.1', type: 'ping' });
    expect(result.status).toBe('up');
    expect(mockProbe).toHaveBeenCalledTimes(1);
    expect(mockAxiosGet).not.toHaveBeenCalled();
  });

  test('dispatches to checkHttp for type="http"', async () => {
    mockAxiosGet.mockResolvedValueOnce({ status: 200 });
    const result = await checkDevice({ url: 'http://example.com', type: 'http' });
    expect(result.status).toBe('up');
    expect(mockAxiosGet).toHaveBeenCalledTimes(1);
    expect(mockProbe).not.toHaveBeenCalled();
  });

  test('falls back to checkHttp when type is undefined', async () => {
    mockAxiosGet.mockResolvedValueOnce({ status: 200 });
    const result = await checkDevice({ url: 'http://example.com' });
    expect(result.status).toBe('up');
    expect(mockAxiosGet).toHaveBeenCalledTimes(1);
  });
});
