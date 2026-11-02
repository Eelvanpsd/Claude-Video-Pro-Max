// @vitest-environment node
import { expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({ handle: vi.fn(), fetch: vi.fn() }));
vi.mock('electron', () => ({
  protocol: { handle: mocks.handle },
  net: { fetch: mocks.fetch },
}));
import { APP_ORIGIN, installAppProtocol } from './protocol';

it('replaces caller origin with main-owned desktop identity on packaged API requests', async () => {
  mocks.fetch.mockResolvedValue(new Response('accepted'));
  installAppProtocol(() => 'http://127.0.0.1:3900', '/unused', () => ({
    'X-VoiceStudio-Desktop-Origin': APP_ORIGIN,
    Authorization: 'Bearer scoped-session',
  }));
  const handler = mocks.handle.mock.calls[0][1];
  const response = await handler(new Request(`${APP_ORIGIN}/api/dub/ingest-url`, {
    method: 'POST',
    headers: { Origin: 'https://untrusted.example', Authorization: 'Bearer renderer-secret',
      'X-VoiceStudio-Desktop-Origin': 'app://forged' },
    body: '{}',
  }));
  expect(await response.text()).toBe('accepted');
  const [url, options] = mocks.fetch.mock.calls[0];
  expect(url).toBe('http://127.0.0.1:3900/dub/ingest-url');
  expect(options.headers.get('origin')).toBeNull();
  expect(options.headers.get('x-voicestudio-desktop-origin')).toBe(APP_ORIGIN);
  expect(options.headers.get('authorization')).toBe('Bearer scoped-session');
});
