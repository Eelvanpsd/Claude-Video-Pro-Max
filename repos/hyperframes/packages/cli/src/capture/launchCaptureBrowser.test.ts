import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { beforeEach, describe, expect, it, vi } from "vitest";
const mocks = vi.hoisted(() => ({
  proxyClose: vi.fn(),
  browserClose: vi.fn(),
  once: vi.fn(),
  launch: vi.fn(),
}));
vi.mock("./captureProxy.js", () => ({
  startCaptureProxy: async () => ({ url: "http://127.0.0.1:4567", close: mocks.proxyClose }),
}));
vi.mock("../browser/launch.js", () => ({
  launchManagedBrowser: mocks.launch,
  closeManagedBrowser: mocks.browserClose,
  registerBrowserSessionCleanup: () => () => {},
}));
vi.mock("puppeteer-core", () => ({ default: {} }));
import { launchCaptureBrowser } from "./launchCaptureBrowser.js";
const options = {
  executablePath: "/chrome",
  protocolTimeout: 1000,
  disableWebgl: false,
  width: 800,
  height: 600,
};
beforeEach(() => {
  vi.resetAllMocks();
  mocks.proxyClose.mockResolvedValue(undefined);
  mocks.browserClose.mockResolvedValue(undefined);
  mocks.launch.mockResolvedValue({ close: mocks.browserClose, once: mocks.once });
});
describe("capture browser transport lifecycle", () => {
  it("forces proxy for loopback and disables direct UDP routes", async () => {
    const session = await launchCaptureBrowser(options);
    expect(mocks.launch.mock.calls[0]?.[1].args).toEqual(
      expect.arrayContaining([
        "--proxy-server=http://127.0.0.1:4567",
        "--proxy-bypass-list=<-loopback>",
        "--disable-quic",
        "--force-webrtc-ip-handling-policy=disable_non_proxied_udp",
      ]),
    );
    const profile = mocks.launch.mock.calls[0]?.[1].userDataDir;
    expect(JSON.parse(readFileSync(join(profile, "Default", "Preferences"), "utf8"))).toEqual({
      webrtc: { ip_handling_policy: "disable_non_proxied_udp" },
    });
    await session.close();
    expect(existsSync(profile)).toBe(false);
    expect(mocks.proxyClose.mock.invocationCallOrder[0] ?? 0).toBeLessThan(
      mocks.browserClose.mock.invocationCallOrder[0] ?? 0,
    );
  });
  it("closes proxy when launch fails", async () => {
    mocks.launch.mockRejectedValue(new Error("launch failed"));
    await expect(launchCaptureBrowser(options)).rejects.toThrow("launch failed");
    expect(mocks.proxyClose).toHaveBeenCalledOnce();
  });
  it("closes proxy before a failing browser shutdown", async () => {
    const session = await launchCaptureBrowser(options);
    mocks.browserClose.mockRejectedValue(new Error("close failed"));
    await expect(session.close()).rejects.toThrow("close failed");
    expect(mocks.proxyClose).toHaveBeenCalledOnce();
  });
  it("closes proxy on unexpected browser disconnect", async () => {
    const session = await launchCaptureBrowser(options);
    const [event, callback] = mocks.once.mock.calls[0] ?? [];
    expect(event).toBe("disconnected");
    callback();
    expect(mocks.proxyClose).toHaveBeenCalledOnce();
    await session.close();
  });
});
