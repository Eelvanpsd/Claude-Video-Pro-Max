import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  configuredRemoteBackend,
  disableRemoteBackend,
  probeRemoteBackend,
} from './remoteBackendProbe';
import { ADMIN_SESSION_STORAGE_KEY } from '../api/authSession';

const response = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status });

describe('remote backend probe', () => {
  beforeEach(() => localStorage.clear());
  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });

  it('reads only the configured URL, leaving a pending legacy master for the migration', () => {
    localStorage.setItem('ov_backend_url', 'https://gpu-box:3900/');
    localStorage.setItem('ov_api_key', 'secret');
    expect(configuredRemoteBackend()).toEqual({ url: 'https://gpu-box:3900' });
    // Deleted only by a successful session exchange (api/client.ts bootstrap) —
    // wiping it here would strand a user whose backend is down at launch.
    expect(localStorage.getItem('ov_api_key')).toBe('secret');
  });

  it('probes the auth-exempt health endpoint without any credential', async () => {
    localStorage.setItem('ov_api_key', 'secret');
    const fetchImpl = vi
      .fn()
      .mockResolvedValue(response({ status: 'ok', version: '0.4.2', device: 'cuda' }));

    await expect(probeRemoteBackend('https://gpu-box:3900/', { fetchImpl })).resolves.toEqual({
      ok: true,
      detail: '0.4.2 on cuda',
      target: 'https://gpu-box:3900',
    });
    expect(fetchImpl).toHaveBeenCalledWith(
      'https://gpu-box:3900/health',
      expect.not.objectContaining({ headers: expect.anything() }),
    );
    expect(JSON.stringify(fetchImpl.mock.calls)).not.toContain('secret');
  });

  it.each([
    ['https://gpu-box:3900', new TypeError('certificate verify failed'), 'tls'],
    ['https://gpu-box:3900', new TypeError('Failed to fetch'), 'network'],
    ['https://gpu-box:3900', new TypeError('blocked by CORS policy'), 'cors'],
    ['http://gpu-box:3900', new TypeError('Failed to fetch'), 'network'],
    ['https://gpu-box:7443', new TypeError('Failed to fetch'), 'wrong_port'],
    ['https://gpu-box:7443', new DOMException('aborted', 'AbortError'), 'wrong_port'],
  ])('classifies %s transport failures as %s', async (url, error, kind) => {
    const result = await probeRemoteBackend(url, {
      fetchImpl: vi.fn().mockRejectedValue(error),
    });
    expect(result).toMatchObject({ ok: false, kind, target: url });
  });

  it('classifies HTTP failures and non-VoiceStudio services', async () => {
    await expect(
      probeRemoteBackend('https://gpu-box:3900', {
        fetchImpl: vi.fn().mockResolvedValue(response({}, 503)),
      }),
    ).resolves.toMatchObject({ ok: false, kind: 'http', status: 503 });
    await expect(
      probeRemoteBackend('https://gpu-box:7443', {
        fetchImpl: vi.fn().mockResolvedValue(response({ status: 'ok' })),
      }),
    ).resolves.toMatchObject({ ok: false, kind: 'wrong_port' });
  });

  it('rejects an oversized health response without consuming it', async () => {
    const getReader = vi.fn();
    const fetchImpl = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      headers: new Headers({ 'content-length': '20000' }),
      body: { getReader },
    });
    await expect(
      probeRemoteBackend('https://gpu-box:3900', {
        fetchImpl: fetchImpl as typeof fetch,
      }),
    ).resolves.toMatchObject({ ok: false, kind: 'wrong_port' });
    expect(getReader).not.toHaveBeenCalled();
  });

  it('cancels a chunked health response once it exceeds the byte limit', async () => {
    const cancel = vi.fn().mockResolvedValue(undefined);
    const releaseLock = vi.fn();
    const chunks = [new Uint8Array(10_000), new Uint8Array(7_000)];
    const read = vi
      .fn()
      .mockResolvedValueOnce({ done: false, value: chunks[0] })
      .mockResolvedValueOnce({ done: false, value: chunks[1] });
    const fetchImpl = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      headers: new Headers(),
      body: { getReader: () => ({ read, cancel, releaseLock }) },
    });

    await expect(
      probeRemoteBackend('https://gpu-box:3900', {
        fetchImpl: fetchImpl as typeof fetch,
      }),
    ).resolves.toMatchObject({ ok: false, kind: 'wrong_port' });
    expect(cancel).toHaveBeenCalledOnce();
    expect(read).toHaveBeenCalledTimes(2);
  });

  it('does not request or disclose credentials embedded in a legacy URL', async () => {
    const fetchImpl = vi.fn();
    await expect(
      probeRemoteBackend('https://user:secret@gpu-box:3900', { fetchImpl }),
    ).resolves.toEqual({
      ok: false,
      kind: 'network',
      target: 'https://gpu-box:3900',
    });
    expect(fetchImpl).not.toHaveBeenCalled();
  });

  it('aborts a probe at its bounded deadline', async () => {
    vi.useFakeTimers();
    const fetchImpl = vi.fn((_url, init) => {
      return new Promise<Response>((_resolve, reject) => {
        init?.signal?.addEventListener('abort', () =>
          reject(new DOMException('aborted', 'AbortError')),
        );
      });
    });
    const pending = probeRemoteBackend('http://gpu-box:3900', {
      fetchImpl: fetchImpl as typeof fetch,
      timeoutMs: 25,
    });
    await vi.advanceTimersByTimeAsync(25);
    await expect(pending).resolves.toMatchObject({ ok: false, kind: 'timeout' });
  });

  it('clears URL, legacy master, and short-lived session before reloading', async () => {
    localStorage.setItem('ov_backend_url', 'http://gpu-box:3900');
    localStorage.setItem('ov_api_key', 'secret');
    localStorage.setItem(ADMIN_SESSION_STORAGE_KEY, 'session');
    const reload = vi.fn();
    await disableRemoteBackend(reload);
    expect(localStorage.getItem('ov_backend_url')).toBeNull();
    expect(localStorage.getItem('ov_api_key')).toBeNull();
    expect(localStorage.getItem(ADMIN_SESSION_STORAGE_KEY)).toBeNull();
    expect(reload).toHaveBeenCalledOnce();
  });

  it.each([null, 'http://configured-box:3900'])(
    'discards a tested session when returning to local from %s',
    async (configured) => {
      const fetchImpl = vi.fn().mockResolvedValue(new Response(null, { status: 204 }));
      vi.stubGlobal('fetch', fetchImpl);
      if (configured) localStorage.setItem('ov_backend_url', configured);
      localStorage.setItem(
        ADMIN_SESSION_STORAGE_KEY,
        JSON.stringify({
          apiBase: 'http://tested-box:3900',
          token: `ovs_admin_session_${'a'.repeat(43)}`,
          expiresAt: Date.now() / 1000 + 3600,
        }),
      );
      const reload = vi.fn();
      await disableRemoteBackend(reload);
      expect(localStorage.getItem(ADMIN_SESSION_STORAGE_KEY)).toBeNull();
      expect(fetchImpl).toHaveBeenCalledExactlyOnceWith(
        'http://tested-box:3900/api/auth/session',
        expect.objectContaining({
          method: 'DELETE',
          headers: { Authorization: `Bearer ovs_admin_session_${'a'.repeat(43)}` },
        }),
      );
      expect(reload).toHaveBeenCalledOnce();
    },
  );

  it('does not discard a newer login while server revocation finishes', async () => {
    localStorage.setItem('ov_backend_url', 'http://configured-box:3900');
    const session = JSON.stringify({
      apiBase: 'http://configured-box:3900',
      token: `ovs_admin_session_${'a'.repeat(43)}`,
      expiresAt: Date.now() / 1000 + 3600,
    });
    localStorage.setItem(ADMIN_SESSION_STORAGE_KEY, session);
    let finish!: (response: Response) => void;
    vi.stubGlobal(
      'fetch',
      vi.fn(
        () =>
          new Promise<Response>((resolve) => {
            finish = resolve;
          }),
      ),
    );
    const pending = disableRemoteBackend(vi.fn());
    expect(localStorage.getItem(ADMIN_SESSION_STORAGE_KEY)).toBeNull();
    const newer = session.replace('configured-box', 'newer-box');
    localStorage.setItem(ADMIN_SESSION_STORAGE_KEY, newer);
    finish(new Response(null, { status: 204 }));
    await pending;
    expect(localStorage.getItem(ADMIN_SESSION_STORAGE_KEY)).toBe(newer);
  });

  it('still reloads when persistent storage is blocked', async () => {
    const blockedStorage = {
      getItem: vi.fn(() => {
        throw new DOMException('blocked', 'SecurityError');
      }),
      removeItem: vi.fn(() => {
        throw new DOMException('blocked', 'SecurityError');
      }),
    };
    vi.stubGlobal('localStorage', blockedStorage);
    const reload = vi.fn();

    await expect(disableRemoteBackend(reload)).resolves.toBeUndefined();

    expect(blockedStorage.getItem).toHaveBeenCalled();
    expect(blockedStorage.removeItem).toHaveBeenCalledTimes(3);
    expect(reload).toHaveBeenCalledOnce();
  });
});
