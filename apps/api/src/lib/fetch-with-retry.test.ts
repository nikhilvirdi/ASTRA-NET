import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  fetchWithRetry,
  FETCH_TIMEOUT_MS,
  MAX_ATTEMPTS,
  INITIAL_BACKOFF_MS,
} from './fetch-with-retry.js';

describe('fetchWithRetry', () => {
  let originalFetch: typeof global.fetch;

  beforeEach(() => {
    originalFetch = global.fetch;
  });

  afterEach(() => {
    global.fetch = originalFetch;
    vi.useRealTimers();
  });

  it('returns the parsed JSON body on a successful first attempt', async () => {
    const fetchMock = vi.fn(() =>
      Promise.resolve(new Response(JSON.stringify({ ok: true }), { status: 200 })),
    );
    global.fetch = fetchMock as unknown as typeof fetch;

    const result = await fetchWithRetry<{ ok: boolean }>('https://example.test/data');

    expect(result).toEqual({ ok: true });
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it('uses a custom parseResponse for non-JSON bodies (e.g. plain text)', async () => {
    const fetchMock = vi.fn(() =>
      Promise.resolve(new Response('plain text body', { status: 200 })),
    );
    global.fetch = fetchMock as unknown as typeof fetch;

    const result = await fetchWithRetry<string>('https://example.test/text', (r) => r.text());

    expect(result).toBe('plain text body');
  });

  it('does not retry a 4xx response', async () => {
    const fetchMock = vi.fn(() => Promise.resolve(new Response('bad request', { status: 400 })));
    global.fetch = fetchMock as unknown as typeof fetch;

    await expect(fetchWithRetry('https://example.test/data')).rejects.toThrow(
      /HTTP 400 .* not retrying/,
    );
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it('retries a 5xx response up to maxAttempts, then throws', async () => {
    const fetchMock = vi.fn(() => Promise.resolve(new Response('server error', { status: 503 })));
    global.fetch = fetchMock as unknown as typeof fetch;

    await expect(
      fetchWithRetry('https://example.test/data', undefined, FETCH_TIMEOUT_MS, 3, 1),
    ).rejects.toThrow(/HTTP 503/);
    expect(fetchMock).toHaveBeenCalledTimes(3);
  });

  it('retries a network-level rejection and succeeds if a later attempt works', async () => {
    const fetchMock = vi
      .fn()
      .mockRejectedValueOnce(new Error('network down'))
      .mockResolvedValueOnce(new Response(JSON.stringify({ recovered: true }), { status: 200 }));
    global.fetch = fetchMock as unknown as typeof fetch;

    const result = await fetchWithRetry<{ recovered: boolean }>(
      'https://example.test/data',
      undefined,
      FETCH_TIMEOUT_MS,
      MAX_ATTEMPTS,
      1,
    );

    expect(result).toEqual({ recovered: true });
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it('doubles the backoff delay between retries', async () => {
    vi.useFakeTimers();
    const fetchMock = vi.fn(() => Promise.resolve(new Response('server error', { status: 503 })));
    global.fetch = fetchMock as unknown as typeof fetch;

    const promise = fetchWithRetry(
      'https://example.test/data',
      undefined,
      FETCH_TIMEOUT_MS,
      3,
      INITIAL_BACKOFF_MS,
    );
    // Swallow the eventual rejection so it doesn't surface as an unhandled
    // rejection while fake timers are being advanced below.
    promise.catch(() => {});

    await vi.advanceTimersByTimeAsync(0);
    expect(fetchMock).toHaveBeenCalledTimes(1);

    await vi.advanceTimersByTimeAsync(INITIAL_BACKOFF_MS);
    expect(fetchMock).toHaveBeenCalledTimes(2);

    await vi.advanceTimersByTimeAsync(INITIAL_BACKOFF_MS * 2);
    expect(fetchMock).toHaveBeenCalledTimes(3);

    await expect(promise).rejects.toThrow(/HTTP 503/);
  });

  it('aborts and retries when a request exceeds its per-attempt timeout', async () => {
    vi.useFakeTimers();
    const fetchMock = vi.fn(
      (_url: string, init?: { signal?: AbortSignal }) =>
        new Promise<Response>((resolve, reject) => {
          init?.signal?.addEventListener('abort', () => reject(new Error('aborted')));
        }),
    );
    global.fetch = fetchMock as unknown as typeof fetch;

    const promise = fetchWithRetry('https://example.test/slow', undefined, 100, 2, 1);
    promise.catch(() => {});

    await vi.advanceTimersByTimeAsync(100); // first attempt times out
    expect(fetchMock).toHaveBeenCalledTimes(1);

    await vi.advanceTimersByTimeAsync(1); // backoff delay
    await vi.advanceTimersByTimeAsync(100); // second attempt times out
    expect(fetchMock).toHaveBeenCalledTimes(2);

    await expect(promise).rejects.toThrow();
  });
});
