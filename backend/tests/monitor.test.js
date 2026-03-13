import { jest } from '@jest/globals';

// Mock axios before importing monitor
const mockGet = jest.fn();
jest.unstable_mockModule('axios', () => ({
  default: { get: mockGet },
}));

const { checkDevice } = await import('../monitor.js');

describe('Monitor service', () => {
  beforeEach(() => {
    mockGet.mockReset();
  });

  test('checkDevice returns "up" when HTTP request succeeds', async () => {
    mockGet.mockResolvedValueOnce({ status: 200 });
    const result = await checkDevice({ url: 'http://example.com' });
    expect(result.status).toBe('up');
    expect(typeof result.response_time).toBe('number');
  });

  test('checkDevice returns "down" when HTTP request fails', async () => {
    mockGet.mockRejectedValueOnce(new Error('Connection refused'));
    const result = await checkDevice({ url: 'http://unreachable.example.com' });
    expect(result.status).toBe('down');
    expect(result.response_time).toBeNull();
  });

  test('checkDevice returns "down" when HTTP request times out', async () => {
    mockGet.mockRejectedValueOnce(Object.assign(new Error('timeout'), { code: 'ECONNABORTED' }));
    const result = await checkDevice({ url: 'http://slow.example.com' });
    expect(result.status).toBe('down');
    expect(result.response_time).toBeNull();
  });
});
