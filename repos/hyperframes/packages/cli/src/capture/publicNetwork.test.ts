import { beforeEach, describe, expect, it, vi } from "vitest";
import { EventEmitter } from "node:events";
import { PassThrough } from "node:stream";
const mocks = vi.hoisted(() => ({ lookup: vi.fn(), request: vi.fn() }));
vi.mock("node:dns/promises", () => ({ lookup: mocks.lookup }));
vi.mock("node:http", () => ({ request: mocks.request }));
vi.mock("node:https", () => ({ request: mocks.request }));
import { isPublicIPv4, publicRequest, resolvePublicAddress } from "./publicNetwork.js";

beforeEach(() => vi.resetAllMocks());
describe("public address policy", () => {
  it.each([
    "127.0.0.1",
    "10.0.0.1",
    "172.16.0.1",
    "192.168.0.1",
    "169.254.169.254",
    "100.64.0.1",
    "0.1.2.3",
    "192.0.0.9",
    "192.0.2.1",
    "198.18.0.1",
    "198.51.100.1",
    "203.0.113.1",
    "224.0.0.1",
    "240.0.0.1",
    "::1",
    "::ffff:8.8.8.8",
    "8.8.8.999",
  ])("rejects %s", (ip) => expect(isPublicIPv4(ip)).toBe(false));
  it("accepts public literals without DNS", async () => {
    await expect(resolvePublicAddress("8.8.8.8")).resolves.toBe("8.8.8.8");
    expect(mocks.lookup).not.toHaveBeenCalled();
  });
  it.each([
    "localhost",
    "localhost.",
    "foo.localhost",
    "router.local",
    "metadata.google.internal",
    "[::1]",
  ])("blocks alias/literal %s before DNS", async (host) => {
    await expect(resolvePublicAddress(host)).rejects.toThrow();
    expect(mocks.lookup).not.toHaveBeenCalled();
  });
  it("rejects mixed DNS before opening a socket", async () => {
    mocks.lookup.mockResolvedValue([
      { address: "8.8.8.8", family: 4 },
      { address: "127.0.0.1", family: 4 },
    ]);
    await expect(publicRequest("http://example.com/")).rejects.toThrow();
    expect(mocks.request).not.toHaveBeenCalled();
  });
  it.each([{ answers: [] }, { answers: [{ address: "8.8.8.8", family: 6 }] }])(
    "rejects empty or malformed DNS",
    async ({ answers }) => {
      mocks.lookup.mockResolvedValue(answers);
      await expect(resolvePublicAddress("example.com")).rejects.toThrow();
    },
  );
  it("propagates DNS errors", async () => {
    mocks.lookup.mockRejectedValue(new Error("DNS failed"));
    await expect(resolvePublicAddress("example.com")).rejects.toThrow("DNS failed");
  });
});

function fakeRequest() {
  const req = Object.assign(new EventEmitter(), {
    end: vi.fn(),
    destroy: vi.fn(),
    setTimeout: vi.fn(),
  });
  mocks.request.mockImplementation((_options, callback) => {
    req.end.mockImplementation(() => {
      const incoming = Object.assign(new PassThrough(), {
        statusCode: 302,
        statusMessage: "Found",
        headers: { location: "http://127.0.0.1/" },
      });
      callback(incoming);
      incoming.end("redirect");
    });
    return req;
  });
  return req;
}
describe("pinned request", () => {
  it("dials the checked numeric IP only, preserving TLS identity and manual redirects", async () => {
    mocks.lookup
      .mockResolvedValueOnce([{ address: "8.8.8.8", family: 4 }])
      .mockResolvedValue([{ address: "127.0.0.1", family: 4 }]);
    fakeRequest();
    const response = await publicRequest("https://example.com:8443/path?q=1", {
      headers: { host: "evil.test", "accept-encoding": "gzip" },
    });
    expect(mocks.lookup).toHaveBeenCalledTimes(1);
    expect(mocks.request).toHaveBeenCalledTimes(1);
    expect(mocks.request.mock.calls[0]?.[0]).toMatchObject({
      hostname: "8.8.8.8",
      servername: "example.com",
      rejectUnauthorized: true,
      port: "8443",
      path: "/path?q=1",
      agent: false,
      headers: { host: "example.com:8443", "accept-encoding": "identity" },
    });
    expect(response.status).toBe(302);
    expect(await response.text()).toBe("redirect");
  });
  it.each(["file:///tmp/a", "http://user:secret@example.com"])(
    "rejects unsafe URL %s",
    async (url) => {
      await expect(publicRequest(url)).rejects.toThrow();
      expect(mocks.request).not.toHaveBeenCalled();
    },
  );
  it("does not dial after abort during DNS", async () => {
    const controller = new AbortController();
    mocks.lookup.mockImplementation(async () => {
      controller.abort();
      return [{ address: "8.8.8.8", family: 4 }];
    });
    await expect(
      publicRequest("https://example.com", { signal: controller.signal }),
    ).rejects.toThrow();
    expect(mocks.request).not.toHaveBeenCalled();
  });
});

describe("transport lifecycle", () => {
  it("bounds stalled DNS without dialing", async () => {
    vi.useFakeTimers();
    try {
      mocks.lookup.mockImplementation(() => new Promise(() => {}));
      const result = expect(publicRequest("https://example.com")).rejects.toThrow("DNS timed out");
      await vi.advanceTimersByTimeAsync(10_000);
      await result;
      expect(mocks.request).not.toHaveBeenCalled();
    } finally {
      vi.useRealTimers();
    }
  });
  it("cancels the upstream stream and socket when the body is cancelled", async () => {
    mocks.lookup.mockResolvedValue([{ address: "8.8.8.8", family: 4 }]);
    const incoming = Object.assign(new PassThrough(), { statusCode: 200, headers: {} });
    const req = Object.assign(new EventEmitter(), { end: vi.fn(), destroy: vi.fn() });
    mocks.request.mockImplementation((_options, callback) => {
      req.end.mockImplementation(() => callback(incoming));
      return req;
    });
    const response = await publicRequest("https://example.com");
    await response.body?.cancel();
    expect(incoming.destroyed).toBe(true);
    expect(req.destroy).toHaveBeenCalled();
    // Socket teardown may race already queued terminal/data notifications.
    expect(() => {
      incoming.emit("aborted");
      incoming.emit("error", new Error("late socket error"));
      incoming.emit("data", Buffer.from("late bytes"));
      incoming.emit("end");
    }).not.toThrow();
  });
  it("fails unsupported compressed responses instead of returning corrupted asset bytes", async () => {
    mocks.lookup.mockResolvedValue([{ address: "8.8.8.8", family: 4 }]);
    const incoming = Object.assign(new PassThrough(), {
      statusCode: 200,
      headers: { "content-encoding": "gzip" },
    });
    const req = Object.assign(new EventEmitter(), { end: vi.fn(), destroy: vi.fn() });
    mocks.request.mockImplementation((_options, callback) => {
      req.end.mockImplementation(() => callback(incoming));
      return req;
    });
    await expect(publicRequest("https://example.com")).rejects.toThrow("content encoding");
    expect(incoming.destroyed).toBe(true);
  });
});
