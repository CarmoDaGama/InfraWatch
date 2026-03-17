/**
 * Circuit Breaker Pattern Implementation
 * 
 * Protects against cascading failures by tracking failures per endpoint
 * and temporarily stopping requests when a device becomes unavailable.
 */

export type CircuitState = 'closed' | 'open' | 'half-open';

interface CircuitBreakerConfig {
  failureThreshold?: number; // Consecutive failures to open circuit (default: 5)
  resetTimeoutMs?: number; // Time before trying again (default: 60s)
  backoffMultiplier?: number; // Exponential backoff factor (default: 1.5)
  maxBackoffMs?: number; // Max backoff time (default: 5min)
}

export class CircuitBreaker {
  private state: CircuitState = 'closed';
  private failureCount = 0;
  private lastFailureTime: number | null = null;
  private nextAttemptTime: number = 0;
  private resetTimeoutMs: number;
  private failureThreshold: number;
  private backoffMultiplier: number;
  private maxBackoffMs: number;
  private currentBackoffMs: number;

  constructor(private name: string, config: CircuitBreakerConfig = {}) {
    this.failureThreshold = config.failureThreshold ?? 5;
    this.resetTimeoutMs = config.resetTimeoutMs ?? 60 * 1000; // 60 seconds
    this.backoffMultiplier = config.backoffMultiplier ?? 1.5;
    this.maxBackoffMs = config.maxBackoffMs ?? 5 * 60 * 1000; // 5 minutes
    this.currentBackoffMs = this.resetTimeoutMs;
  }

  /**
   * Get current state of the circuit
   */
  getState(): CircuitState {
    if (this.state === 'open') {
      const now = Date.now();
      if (now >= this.nextAttemptTime) {
        // Try to half-open (allow one request to test)
        this.state = 'half-open';
        console.log(`[CircuitBreaker] ${this.name}: HALF-OPEN (testing...)`);
        return 'half-open';
      }
    }
    return this.state;
  }

  /**
   * Record a successful call
   */
  recordSuccess(): void {
    this.failureCount = 0;
    this.lastFailureTime = null;
    this.currentBackoffMs = this.resetTimeoutMs;

    if (this.state === 'half-open') {
      this.state = 'closed';
      console.log(`[CircuitBreaker] ${this.name}: CLOSED (recovered)`);
    }
  }

  /**
   * Record a failed call
   */
  recordFailure(): void {
    this.lastFailureTime = Date.now();
    this.failureCount += 1;

    if (this.failureCount >= this.failureThreshold) {
      this.state = 'open';
      this.nextAttemptTime = Date.now() + this.currentBackoffMs;
      this.currentBackoffMs = Math.min(
        this.currentBackoffMs * this.backoffMultiplier,
        this.maxBackoffMs
      );
      console.log(
        `[CircuitBreaker] ${this.name}: OPEN (will retry in ${(this.currentBackoffMs / 1000).toFixed(0)}s)`,
      );
    }
  }

  /**
   * Check if request is allowed
   */
  isRequestAllowed(): boolean {
    const state = this.getState();
    if (state === 'closed' || state === 'half-open') {
      return true;
    }
    return false; // 'open' state
  }

  /**
   * Get time until next retry (ms)
   */
  getTimeUntilRetry(): number {
    if (this.state !== 'open') return 0;
    const remaining = this.nextAttemptTime - Date.now();
    return Math.max(0, remaining);
  }

  /**
   * Reset circuit manually
   */
  reset(): void {
    this.state = 'closed';
    this.failureCount = 0;
    this.lastFailureTime = null;
    this.currentBackoffMs = this.resetTimeoutMs;
    console.log(`[CircuitBreaker] ${this.name}: RESET`);
  }

  /**
   * Get metrics for monitoring
   */
  getMetrics() {
    return {
      name: this.name,
      state: this.getState(),
      failure_count: this.failureCount,
      failure_threshold: this.failureThreshold,
      last_failure: this.lastFailureTime ? new Date(this.lastFailureTime).toISOString() : null,
      time_until_retry_ms: this.getTimeUntilRetry(),
    };
  }
}

/**
 * Retry logic with exponential backoff
 */
export interface RetryConfig {
  maxRetries?: number; // Default: 3
  initialDelayMs?: number; // Default: 100ms
  maxDelayMs?: number; // Default: 5000ms
  backoffMultiplier?: number; // Default: 2
}

export async function executeWithRetry<T>(
  operation: () => Promise<T>,
  operationName: string,
  config: RetryConfig = {},
): Promise<T> {
  const maxRetries = config.maxRetries ?? 3;
  const initialDelayMs = config.initialDelayMs ?? 100;
  const maxDelayMs = config.maxDelayMs ?? 5000;
  const backoffMultiplier = config.backoffMultiplier ?? 2;

  let lastError: Error | null = null;
  let delayMs = initialDelayMs;

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      const result = await operation();
      if (attempt > 0) {
        console.log(`[Retry] ${operationName}: succeeded on attempt ${attempt + 1}`);
      }
      return result;
    } catch (error) {
      lastError = error instanceof Error ? error : new Error(String(error));

      if (attempt < maxRetries) {
        console.warn(
          `[Retry] ${operationName}: attempt ${attempt + 1} failed, ` +
          `retrying in ${delayMs}ms: ${lastError.message}`,
        );
        await new Promise((resolve) => setTimeout(resolve, delayMs));
        delayMs = Math.min(delayMs * backoffMultiplier, maxDelayMs);
      }
    }
  }

  throw new Error(
    `[Retry] ${operationName}: Failed after ${maxRetries + 1} attempts: ${lastError?.message}`,
  );
}

/**
 * Global circuit breaker registry per device
 */
const circuitBreakerRegistry = new Map<string, CircuitBreaker>();

export function getOrCreateCircuitBreaker(
  deviceId: number,
  config?: CircuitBreakerConfig,
): CircuitBreaker {
  const key = `device-${deviceId}`;
  if (!circuitBreakerRegistry.has(key)) {
    circuitBreakerRegistry.set(key, new CircuitBreaker(key, config));
  }
  return circuitBreakerRegistry.get(key)!;
}

export function getAllCircuitBreakers() {
  return Array.from(circuitBreakerRegistry.values());
}

export function resetAllCircuitBreakers() {
  circuitBreakerRegistry.forEach((cb) => cb.reset());
  console.log('[CircuitBreaker] All circuit breakers reset');
}
