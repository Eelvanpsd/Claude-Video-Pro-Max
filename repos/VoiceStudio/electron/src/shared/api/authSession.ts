/**
 * Browser-side boundary for the remote administrator credential.
 *
 * The configured master key is accepted only as an input to `exchangeApiKey`.
 * It is never written to storage and never placed in a WebSocket URL. Browser
 * clients retain only a backend-bound, short-lived session in localStorage so
 * it survives reloads and new tabs; its server-enforced expiry remains bounded.
 * same-origin clients use an HttpOnly cookie that JavaScript cannot read.
 */

export const LEGACY_API_KEY_STORAGE_KEY = 'ov_api_key';
export const ADMIN_SESSION_STORAGE_KEY = 'ov_admin_session';
const ADMIN_SESSION_EPOCH_STORAGE_KEY = 'ov_admin_session_epoch';
export const CSRF_HEADER_NAME = 'X-VoiceStudio-CSRF';

const ADMIN_SESSION_RE = /^ovs_admin_session_[A-Za-z0-9_-]{43}$/;
const WS_TICKET_RE = /^ovs_ws_ticket_[A-Za-z0-9_-]{43}$/;
const MAX_AUTH_RESPONSE_BYTES = 16 * 1024;
const MAX_SESSION_LIFETIME_SECONDS = 9 * 60 * 60;
const MAX_TICKET_LIFETIME_SECONDS = 60;

type StorageLike = Pick<Storage, 'getItem' | 'setItem' | 'removeItem'>;

type AuthWindow = {
  location?: { origin?: string };
  dispatchEvent?: (event: Event) => boolean;
  __TAURI__?: unknown;
  __TAURI_INTERNALS__?: unknown;
};

type CommonOptions = {
  apiBase: string;
  fetchImpl?: typeof fetch;
  storage?: StorageLike | null;
  windowLike?: AuthWindow;
  now?: () => number;
  timeoutMs?: number;
};

export type StoredAdminSession = {
  token: string;
  expiresAt: number;
  apiBase: string;
};

export class AuthSessionError extends Error {
  status?: number;

  constructor(status?: number) {
    super('Remote administrator authentication failed.');
    this.name = 'AuthSessionError';
    this.status = status;
  }
}

function defaultWindow(): AuthWindow | undefined {
  return typeof window === 'undefined' ? undefined : window;
}

function defaultAdminSessionStorage(): StorageLike | null {
  try {
    return typeof localStorage === 'undefined' ? null : localStorage;
  } catch {
    return null;
  }
}

function defaultLocalStorage(): StorageLike | null {
  try {
    return typeof localStorage === 'undefined' ? null : localStorage;
  } catch {
    return null;
  }
}

function normalizedApiBase(raw: string): string {
  const candidate = raw.trim();
  let url: URL;
  try {
    url = new URL(candidate);
  } catch {
    throw new AuthSessionError();
  }
  if (
    (url.protocol !== 'http:' && url.protocol !== 'https:') ||
    url.username ||
    url.password ||
    url.search ||
    url.hash
  ) {
    throw new AuthSessionError();
  }
  return url.toString().replace(/\/+$/, '');
}

export function isSameOriginApi(
  apiBase: string,
  windowLike: AuthWindow | undefined = defaultWindow(),
): boolean {
  try {
    const apiOrigin = new URL(normalizedApiBase(apiBase)).origin;
    const pageOrigin = windowLike?.location?.origin;
    return Boolean(pageOrigin && pageOrigin !== 'null' && apiOrigin === pageOrigin);
  } catch {
    return false;
  }
}

function removeLegacyMaster(storage: StorageLike | null = defaultLocalStorage()): void {
  try {
    storage?.removeItem(LEGACY_API_KEY_STORAGE_KEY);
  } catch {
    // A blocked storage API is already equivalent to the key not persisting.
  }
}

export function clearAdminSession({
  storage = defaultAdminSessionStorage(),
}: { storage?: StorageLike | null } = {}): void {
  try {
    storage?.removeItem(ADMIN_SESSION_STORAGE_KEY);
    advanceAdminSessionEpoch(storage);
  } catch {
    // Best effort; callers still stop using the in-memory value immediately.
  }
}

function removeAdminSessionRecord(storage: StorageLike | null): void {
  try {
    storage?.removeItem(ADMIN_SESSION_STORAGE_KEY);
  } catch {
    // Best-effort cleanup does not represent a user-requested invalidation.
  }
}

function storedAdminSessionEpoch(storage: StorageLike | null): string {
  try {
    return storage?.getItem(ADMIN_SESSION_EPOCH_STORAGE_KEY) ?? '';
  } catch {
    return '';
  }
}

function advanceAdminSessionEpoch(storage: StorageLike | null): void {
  try {
    if (!storage) return;
    const current = Number(storage.getItem(ADMIN_SESSION_EPOCH_STORAGE_KEY));
    storage.setItem(
      ADMIN_SESSION_EPOCH_STORAGE_KEY,
      String(Number.isSafeInteger(current) && current >= 0 ? current + 1 : 1),
    );
  } catch {
    // Best effort when persistent storage is unavailable.
  }
}

function clearAdminSessionIfMatches(
  expected: Pick<StoredAdminSession, 'token' | 'apiBase'>,
  storage: StorageLike | null,
): boolean {
  try {
    const raw = storage?.getItem(ADMIN_SESSION_STORAGE_KEY);
    if (!raw) return false;
    const current = JSON.parse(raw) as Partial<StoredAdminSession>;
    if (current.token !== expected.token || current.apiBase !== expected.apiBase) return false;
    storage?.removeItem(ADMIN_SESSION_STORAGE_KEY);
    advanceAdminSessionEpoch(storage);
    return true;
  } catch {
    return false;
  }
}

function storedAdminSessionRaw(storage: StorageLike | null): string | null {
  try {
    return storage?.getItem(ADMIN_SESSION_STORAGE_KEY) ?? null;
  } catch {
    return null;
  }
}

function clearAdminSessionRawIfMatches(
  expectedRaw: string | null,
  storage: StorageLike | null,
): void {
  try {
    if (expectedRaw !== null && storage?.getItem(ADMIN_SESSION_STORAGE_KEY) === expectedRaw) {
      storage.removeItem(ADMIN_SESSION_STORAGE_KEY);
    }
    advanceAdminSessionEpoch(storage);
  } catch {
    // Best effort; a concurrent or inaccessible session must not be removed.
  }
}

function storeAdminSessionIfUnchanged(
  expectedRaw: string | null,
  record: StoredAdminSession,
  storage: StorageLike | null,
  nowMs: number,
  expectedEpoch: string,
): boolean {
  try {
    if (!storage) return false;
    if (storedAdminSessionEpoch(storage) !== expectedEpoch) return false;
    const currentRaw = storage.getItem(ADMIN_SESSION_STORAGE_KEY);
    const expiredSnapshotWasCleaned =
      currentRaw === null && storedAdminSessionExpired(expectedRaw, nowMs);
    if (currentRaw !== expectedRaw && !expiredSnapshotWasCleaned) return false;
    storage.setItem(ADMIN_SESSION_STORAGE_KEY, JSON.stringify(record));
    advanceAdminSessionEpoch(storage);
    return true;
  } catch {
    return false;
  }
}

function storedAdminSessionExpired(raw: string | null, nowMs: number): boolean {
  if (!raw || raw.length > 4096) return false;
  try {
    const parsed = JSON.parse(raw) as Partial<StoredAdminSession>;
    return (
      ADMIN_SESSION_RE.test(String(parsed.token ?? '')) &&
      typeof parsed.expiresAt === 'number' &&
      Number.isFinite(parsed.expiresAt) &&
      parsed.expiresAt <= nowMs / 1000
    );
  } catch {
    return false;
  }
}

export function getAdminSession(
  apiBase: string,
  {
    storage = defaultAdminSessionStorage(),
    now = Date.now,
  }: { storage?: StorageLike | null; now?: () => number } = {},
): StoredAdminSession | null {
  let normalized: string;
  try {
    normalized = normalizedApiBase(apiBase);
  } catch {
    return null;
  }

  let raw: string | null = null;
  try {
    raw = storage?.getItem(ADMIN_SESSION_STORAGE_KEY) ?? null;
  } catch {
    return null;
  }
  if (!raw || raw.length > 4096) {
    if (raw) removeAdminSessionRecord(storage);
    return null;
  }

  try {
    const parsed = JSON.parse(raw) as Partial<StoredAdminSession>;
    const nowSeconds = now() / 1000;
    if (
      !ADMIN_SESSION_RE.test(String(parsed.token ?? '')) ||
      typeof parsed.expiresAt !== 'number' ||
      !Number.isFinite(parsed.expiresAt) ||
      parsed.expiresAt <= nowSeconds ||
      parsed.expiresAt > nowSeconds + MAX_SESSION_LIFETIME_SECONDS
    ) {
      removeAdminSessionRecord(storage);
      return null;
    }
    // localStorage is shared by tabs. A tab still connected to backend A must
    // not delete backend B's valid session after B authenticates in another tab.
    if (parsed.apiBase !== normalized) return null;
    return {
      token: parsed.token as string,
      expiresAt: parsed.expiresAt,
      apiBase: normalized,
    };
  } catch {
    removeAdminSessionRecord(storage);
    return null;
  }
}

async function readBoundedText(response: Response): Promise<string> {
  const advertisedBytes = Number(response.headers?.get?.('content-length'));
  if (Number.isFinite(advertisedBytes) && advertisedBytes > MAX_AUTH_RESPONSE_BYTES) {
    throw new AuthSessionError(response.status);
  }

  const reader = response.body?.getReader();
  if (!reader) return '';
  const decoder = new TextDecoder();
  const parts: string[] = [];
  let bytes = 0;
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      bytes += value.byteLength;
      if (bytes > MAX_AUTH_RESPONSE_BYTES) {
        await reader.cancel();
        throw new AuthSessionError(response.status);
      }
      parts.push(decoder.decode(value, { stream: true }));
    }
    parts.push(decoder.decode());
    return parts.join('');
  } finally {
    reader.releaseLock();
  }
}

async function readBoundedObject(response: Response): Promise<Record<string, unknown>> {
  const text = await readBoundedText(response);
  try {
    const value = JSON.parse(text);
    if (!value || typeof value !== 'object' || Array.isArray(value)) throw new TypeError();
    return value as Record<string, unknown>;
  } catch (error) {
    if (error instanceof AuthSessionError) throw error;
    throw new AuthSessionError(response.status);
  }
}

function plausibleExpiry(
  value: unknown,
  nowMs: number,
  maxLifetimeSeconds: number,
): value is number {
  if (typeof value !== 'number' || !Number.isFinite(value)) return false;
  const nowSeconds = nowMs / 1000;
  return value > nowSeconds && value <= nowSeconds + maxLifetimeSeconds;
}

function responseExpiry(
  payload: Record<string, unknown>,
  nowMs: number,
  maxLifetimeSeconds: number,
): number | null {
  const relative = payload.expires_in;
  if (relative !== undefined) {
    if (
      typeof relative !== 'number' ||
      !Number.isFinite(relative) ||
      relative <= 0 ||
      relative > maxLifetimeSeconds
    ) {
      return null;
    }
    return nowMs / 1000 + relative;
  }
  return plausibleExpiry(payload.expires_at, nowMs, maxLifetimeSeconds) ? payload.expires_at : null;
}

function dispatchAuthRequired(windowLike: AuthWindow | undefined): void {
  try {
    windowLike?.dispatchEvent?.(
      new CustomEvent('ov:auth-required', { detail: { mode: 'apikey' } }),
    );
  } catch {
    // Non-browser callers can still handle the typed error.
  }
}

export async function exchangeApiKey(
  apiKey: string,
  {
    apiBase,
    fetchImpl = fetch,
    storage = defaultAdminSessionStorage(),
    windowLike = defaultWindow(),
    now = Date.now,
    legacyStorage = defaultLocalStorage(),
    timeoutMs = 10_000,
  }: CommonOptions & { legacyStorage?: StorageLike | null },
): Promise<{ transport: 'cookie' } | { transport: 'bearer'; expiresAt: number }> {
  const master = apiKey.trim();
  if (!master || master.length > 8192) throw new AuthSessionError();
  const base = normalizedApiBase(apiBase);
  const transport = isSameOriginApi(base, windowLike) ? 'cookie' : 'bearer';
  const sessionAtStart = storedAdminSessionRaw(storage);
  const sessionEpochAtStart = storedAdminSessionEpoch(storage);

  let response: Response;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), Math.max(1, Math.min(timeoutMs, 60_000)));
  try {
    response = await fetchImpl(`${base}/api/auth/session`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${master}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ transport }),
      credentials: 'include',
      cache: 'no-store',
      redirect: 'error',
      referrerPolicy: 'no-referrer',
      signal: controller.signal,
    });
  } catch {
    throw new AuthSessionError();
  } finally {
    clearTimeout(timer);
  }

  if (transport === 'cookie') {
    if (response.status !== 204) throw new AuthSessionError(response.status);
    clearAdminSessionRawIfMatches(sessionAtStart, storage);
    removeLegacyMaster(legacyStorage);
    return { transport };
  }
  if (response.status !== 201) throw new AuthSessionError(response.status);

  const payload = await readBoundedObject(response);
  const token = payload.token;
  const expiresAt = responseExpiry(payload, now(), MAX_SESSION_LIFETIME_SECONDS);
  if (typeof token !== 'string' || !ADMIN_SESSION_RE.test(token) || expiresAt === null) {
    throw new AuthSessionError(response.status);
  }

  const record: StoredAdminSession = { token, expiresAt, apiBase: base };
  if (!storeAdminSessionIfUnchanged(sessionAtStart, record, storage, now(), sessionEpochAtStart)) {
    throw new AuthSessionError();
  }
  removeLegacyMaster(legacyStorage);
  return { transport, expiresAt };
}

/** Revoke an unsaved connection-test session against its own validated base. */
export async function revokeStoredAdminSession(
  options: Omit<CommonOptions, 'apiBase'> = {},
): Promise<boolean> {
  const storage = options.storage === undefined ? defaultAdminSessionStorage() : options.storage;
  try {
    const raw = storage?.getItem(ADMIN_SESSION_STORAGE_KEY);
    if (!raw || raw.length > 4096) return false;
    const parsed = JSON.parse(raw) as Partial<StoredAdminSession>;
    if (typeof parsed.apiBase !== 'string') return false;
    const session = getAdminSession(parsed.apiBase, { storage, now: options.now });
    if (!session) return false;
    return await revokeAdminSession(session.apiBase, { ...options, storage });
  } catch {
    return false;
  }
}

/** Best-effort server revocation used when switching away from a backend.
 * Local state is cleared before the network await, so a hung or unreachable
 * backend cannot prolong the browser's ability to use the session. */
export async function revokeAdminSession(
  apiBase: string,
  {
    fetchImpl = fetch,
    storage = defaultAdminSessionStorage(),
    windowLike = defaultWindow(),
    now = Date.now,
    timeoutMs = 1500,
  }: Omit<CommonOptions, 'apiBase'> = {},
): Promise<boolean> {
  let base: string;
  try {
    base = normalizedApiBase(apiBase);
  } catch {
    return false;
  }
  const session = getAdminSession(base, { storage, now });
  const sameOrigin = isSameOriginApi(base, windowLike);
  advanceAdminSessionEpoch(storage);
  if (session) clearAdminSessionIfMatches(session, storage);
  // Cross-origin cookie auth cannot work (the cookie is SameSite=Strict), and
  // without a bearer token there is nothing meaningful to revoke remotely.
  if (!session && !sameOrigin) return true;

  const headers: Record<string, string> = {};
  if (session) headers.Authorization = `Bearer ${session.token}`;
  if (sameOrigin) headers[CSRF_HEADER_NAME] = '1';
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), Math.max(1, Math.min(timeoutMs, 10_000)));
  try {
    const response = await fetchImpl(`${base}/api/auth/session`, {
      method: 'DELETE',
      headers,
      credentials: 'include',
      cache: 'no-store',
      redirect: 'error',
      referrerPolicy: 'no-referrer',
      signal: controller.signal,
    });
    return response.status === 204;
  } catch {
    return false;
  } finally {
    clearTimeout(timer);
  }
}

// Mirrors the backend ticket allowlist (`_ALLOWED_WS_PATHS` in
// backend/services/admin_sessions.py). A path listed here but not there mints
// a 422, and the consumer fails silently — keep the two in lockstep.
const ALLOWED_WS_PATHS = new Set(['/ws/events', '/ws/transcribe', '/ws/tts']);
const LOGICAL_WS_ORIGIN = 'http://omnivoice.invalid';

function websocketTarget(path: string, apiBase: string): { url: URL; logicalPath: string } {
  const base = normalizedApiBase(apiBase);
  const baseUrl = new URL(base);
  let logical: URL;
  try {
    if (!path.startsWith('/') || path.startsWith('//')) throw new TypeError();
    logical = new URL(path, `${LOGICAL_WS_ORIGIN}/`);
  } catch {
    throw new AuthSessionError();
  }
  if (logical.origin !== LOGICAL_WS_ORIGIN || !ALLOWED_WS_PATHS.has(logical.pathname)) {
    throw new AuthSessionError();
  }

  // Resolve relative to `${base}/`, not the origin root. Reverse proxies may
  // publish the backend under a path prefix (for example `/studio`). The
  // server still receives the logical route after the proxy strips its prefix,
  // so ticket binding uses `logical.pathname` below.
  const url = new URL(path.slice(1), `${base}/`);
  if (url.origin !== baseUrl.origin) throw new AuthSessionError();
  url.username = '';
  url.password = '';
  url.hash = '';
  url.searchParams.delete('api_key');
  url.searchParams.delete('ws_ticket');
  url.protocol = url.protocol === 'https:' ? 'wss:' : 'ws:';
  return { url, logicalPath: logical.pathname };
}

export async function requestWebSocketTicket(
  path: string,
  {
    apiBase,
    fetchImpl = fetch,
    storage = defaultAdminSessionStorage(),
    windowLike = defaultWindow(),
    now = Date.now,
    timeoutMs = 5000,
  }: CommonOptions,
): Promise<string> {
  const base = normalizedApiBase(apiBase);
  const { logicalPath } = websocketTarget(path, base);
  const session = getAdminSession(base, { storage, now });
  if (!session) throw new AuthSessionError(401);
  // Deliberately no plaintext (`ws:`) refusal: the documented remote-GPU setup
  // is plain HTTP over a Tailscale/WireGuard tailnet (docs/remote-gpu.md), and
  // the bearer session that mints this ticket already crossed that same
  // transport. A one-use, 30 s, path-bound ticket adds no exposure the session
  // lacks; refusing it would only cut /ws/events and /ws/transcribe off for
  // every remote-backend user.

  let response: Response;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), Math.max(1, Math.min(timeoutMs, 30_000)));
  try {
    response = await fetchImpl(`${base}/api/auth/ws-ticket`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${session.token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ path: logicalPath }),
      credentials: 'include',
      cache: 'no-store',
      redirect: 'error',
      referrerPolicy: 'no-referrer',
      signal: controller.signal,
    });
  } catch {
    throw new AuthSessionError();
  } finally {
    clearTimeout(timer);
  }

  if (response.status !== 201) {
    if (response.status === 401 || response.status === 403) {
      // A late rejection belongs to the exact token sent above. Another tab
      // may already have exchanged a replacement session in shared storage.
      if (clearAdminSessionIfMatches(session, storage)) dispatchAuthRequired(windowLike);
    }
    throw new AuthSessionError(response.status);
  }
  const payload = await readBoundedObject(response);
  const expiresAt = responseExpiry(payload, now(), MAX_TICKET_LIFETIME_SECONDS);
  if (
    typeof payload.ticket !== 'string' ||
    !WS_TICKET_RE.test(payload.ticket) ||
    expiresAt === null
  ) {
    throw new AuthSessionError(response.status);
  }
  return payload.ticket;
}

export async function authenticatedWsUrl(path: string, options: CommonOptions): Promise<string> {
  const { url } = websocketTarget(path, options.apiBase);
  const session = getAdminSession(options.apiBase, {
    storage: options.storage,
    now: options.now,
  });
  if (!session) return url.toString();

  const ticket = await requestWebSocketTicket(path, options);
  url.searchParams.set('ws_ticket', ticket);
  return url.toString();
}
