import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  fetchSpaceTrackTle,
  loginSpaceTrack,
  resetSessionCookie,
  getCachedCookie,
} from './space-track.client.js';
import { SPACE_TRACK_CATEGORY_PATHS } from './space-track.types.js';

// ─── Fixtures ─────────────────────────────────────────────────────────────────

const NOW = new Date('2026-09-07T18:00:00.000Z');

// Two real-shaped 3LE records (Space-Track's format/3le) — name line prefixed
// with "0 ", same fixed-column TLE content otherwise.
const VALID_3LE = [
  '0 HST',
  '1 20580U 90037B   26250.26690327  .00004356  00000-0  13142-3 0  9996',
  '2 20580  28.4722 239.2289 0001547 342.4899  17.5644 15.31572220801164',
  '0 ISS (ZARYA)',
  '1 25544U 98067A   08264.51782528 -.00002182  00000-0 -11606-4 0  2927',
  '2 25544  51.6416 247.4627 0006703 130.5360 325.0288 15.72125391563537',
].join('\r\n');

const VALID_SET_COOKIE = 'chocolatechip=abc123; Path=/; Secure; HttpOnly';

function makeFetchMock(responses: Array<{ status: number; body: string; cookie?: string }>) {
  let call = 0;
  return vi.fn(() => {
    const r = responses[call++] ?? responses[responses.length - 1]!;
    const headers = new Headers({ 'content-type': 'text/plain' });
    if (r.cookie) headers.set('set-cookie', r.cookie);
    return Promise.resolve(new Response(r.body, { status: r.status, headers }));
  });
}

// ─── Setup ───────────────────────────────────────────────────────────────────

let originalFetch: typeof global.fetch;
let originalEnv: NodeJS.ProcessEnv;

beforeEach(() => {
  originalFetch = global.fetch;
  originalEnv = { ...process.env };
  process.env['SPACETRACK_USERNAME'] = 'test@example.com';
  process.env['SPACETRACK_PASSWORD'] = 'testpass';
  resetSessionCookie();
});

afterEach(() => {
  global.fetch = originalFetch;
  process.env = originalEnv;
  vi.restoreAllMocks();
  resetSessionCookie();
});

// ─── loginSpaceTrack ─────────────────────────────────────────────────────────

describe('loginSpaceTrack', () => {
  it('returns null and logs when credentials are not set', async () => {
    delete process.env['SPACETRACK_USERNAME'];
    delete process.env['SPACETRACK_PASSWORD'];
    const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

    const result = await loginSpaceTrack();

    expect(result).toBeNull();
    expect(consoleSpy).toHaveBeenCalledWith(expect.stringContaining('not set'));
  });

  it('returns the cookie string on a successful login', async () => {
    global.fetch = makeFetchMock([{ status: 200, body: '{}', cookie: VALID_SET_COOKIE }]);

    const result = await loginSpaceTrack();

    expect(result).toBe('chocolatechip=abc123');
    expect(getCachedCookie()).toBe('chocolatechip=abc123');
  });

  it('returns null on a non-200 login response', async () => {
    global.fetch = makeFetchMock([{ status: 401, body: 'Unauthorized' }]);
    vi.spyOn(console, 'error').mockImplementation(() => {});

    const result = await loginSpaceTrack();

    expect(result).toBeNull();
  });

  it('returns null when Set-Cookie header is absent', async () => {
    global.fetch = makeFetchMock([{ status: 200, body: '{}' }]);
    vi.spyOn(console, 'error').mockImplementation(() => {});

    const result = await loginSpaceTrack();

    expect(result).toBeNull();
  });

  it('returns null on network failure', async () => {
    global.fetch = vi.fn().mockRejectedValue(new Error('network error'));
    vi.spyOn(console, 'error').mockImplementation(() => {});

    const result = await loginSpaceTrack();

    expect(result).toBeNull();
  });
});

// ─── fetchSpaceTrackTle ───────────────────────────────────────────────────────

describe('fetchSpaceTrackTle', () => {
  it('returns null for an unknown category', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => {});

    const data = await fetchSpaceTrackTle('does-not-exist', NOW);

    expect(data.records).toBeNull();
    expect(data.fetchedAt).toBe(NOW.toISOString());
  });

  it('logins and fetches 3LE data in a single round trip when no session cached', async () => {
    // call 1: login → set-cookie; call 2: query → 3LE body
    global.fetch = makeFetchMock([
      { status: 200, body: '{}', cookie: VALID_SET_COOKIE },
      { status: 200, body: VALID_3LE },
    ]);

    const data = await fetchSpaceTrackTle('hubble', NOW);

    expect(global.fetch).toHaveBeenCalledTimes(2);
    expect(data.records).not.toBeNull();
    expect(data.records).toHaveLength(2);
    expect(data.records![0]!.name).toBe('HST');
    expect(data.records![0]!.noradCatId).toBe(20580);
    expect(data.fetchedAt).toBe(NOW.toISOString());
  });

  it('reuses the cached cookie and skips login on the second call', async () => {
    global.fetch = makeFetchMock([
      { status: 200, body: '{}', cookie: VALID_SET_COOKIE }, // login
      { status: 200, body: VALID_3LE }, // first query
      { status: 200, body: VALID_3LE }, // second query (no login)
    ]);

    await fetchSpaceTrackTle('hubble', NOW);
    const fetchCallsAfterFirst = (global.fetch as ReturnType<typeof vi.fn>).mock.calls.length;
    await fetchSpaceTrackTle('hubble', NOW);
    const fetchCallsTotal = (global.fetch as ReturnType<typeof vi.fn>).mock.calls.length;

    // First call: 2 (login + query). Second call: 1 (query only, cookie reused).
    expect(fetchCallsAfterFirst).toBe(2);
    expect(fetchCallsTotal).toBe(3);
  });

  it('re-logins once on expired session (HTTP 500) and retries', async () => {
    vi.spyOn(console, 'warn').mockImplementation(() => {});
    global.fetch = makeFetchMock([
      { status: 200, body: '{}', cookie: VALID_SET_COOKIE }, // initial login
      { status: 500, body: '<html>Space-Track</html>' }, // expired session
      { status: 200, body: '{}', cookie: 'chocolatechip=newcookie; Path=/' }, // re-login
      { status: 200, body: VALID_3LE }, // retry query
    ]);

    const data = await fetchSpaceTrackTle('hubble', NOW);

    expect(data.records).not.toBeNull();
    expect(getCachedCookie()).toBe('chocolatechip=newcookie');
    expect(global.fetch).toHaveBeenCalledTimes(4);
  });

  it('returns null when re-login also fails', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => {});
    vi.spyOn(console, 'warn').mockImplementation(() => {});
    global.fetch = makeFetchMock([
      { status: 200, body: '{}', cookie: VALID_SET_COOKIE }, // initial login
      { status: 500, body: '<html>Space-Track</html>' }, // expired session
      { status: 401, body: 'Unauthorized' }, // re-login fails
    ]);

    const data = await fetchSpaceTrackTle('hubble', NOW);

    expect(data.records).toBeNull();
  });

  it('returns null on a failed query response (non-500, non-200)', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => {});
    global.fetch = makeFetchMock([
      { status: 200, body: '{}', cookie: VALID_SET_COOKIE },
      { status: 503, body: 'Service Unavailable' },
    ]);

    const data = await fetchSpaceTrackTle('starlink', NOW);

    expect(data.records).toBeNull();
  });

  it('returns null when response body does not parse as valid TLE triples', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => {});
    global.fetch = makeFetchMock([
      { status: 200, body: '{}', cookie: VALID_SET_COOKIE },
      { status: 200, body: 'not a tle at all\nonly two lines\n' },
    ]);

    const data = await fetchSpaceTrackTle('hubble', NOW);

    expect(data.records).toBeNull();
  });

  it('appends the limit segment when limit is provided', async () => {
    global.fetch = makeFetchMock([
      { status: 200, body: '{}', cookie: VALID_SET_COOKIE },
      { status: 200, body: VALID_3LE },
    ]);

    await fetchSpaceTrackTle('starlink', NOW, 50);

    const queryCall = (global.fetch as ReturnType<typeof vi.fn>).mock.calls[1]![0] as string;
    expect(queryCall).toContain('/limit/50/format/3le');
  });

  it('strips Space-Track 3LE "0 " prefix from name lines', async () => {
    global.fetch = makeFetchMock([
      { status: 200, body: '{}', cookie: VALID_SET_COOKIE },
      { status: 200, body: VALID_3LE },
    ]);

    const data = await fetchSpaceTrackTle('hubble', NOW);

    // Should be "HST", not "0 HST"
    expect(data.records![0]!.name).toBe('HST');
    expect(data.records![1]!.name).toBe('ISS (ZARYA)');
  });
});

// ─── SPACE_TRACK_CATEGORY_PATHS coverage ─────────────────────────────────────

describe('SPACE_TRACK_CATEGORY_PATHS', () => {
  it('defines paths for all 9 expected satellite categories', () => {
    const expected = [
      'stations',
      'starlink',
      'oneweb',
      'gps',
      'weather',
      'geo',
      'cubesat',
      'debris',
      'hubble',
    ];
    for (const cat of expected) {
      expect(SPACE_TRACK_CATEGORY_PATHS[cat]).toBeDefined();
      expect(SPACE_TRACK_CATEGORY_PATHS[cat]!.length).toBeGreaterThan(0);
    }
  });
});
