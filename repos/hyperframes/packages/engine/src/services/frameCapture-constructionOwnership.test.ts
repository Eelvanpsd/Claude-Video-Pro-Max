// @vitest-environment node
import { afterEach, describe, expect, it, vi } from "vitest";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { CDPSession, type Browser, type Page, type PuppeteerNode } from "puppeteer-core";
import {
  _resetBrowserPoolForTests,
  _setPuppeteerForTests,
  drainBrowserPool,
} from "./browserManager.js";
import { createCaptureSession } from "./frameCapture.js";

describe("createCaptureSession construction ownership", () => {
  afterEach(async () => {
    await drainBrowserPool();
    _resetBrowserPoolForTests();
    _setPuppeteerForTests(undefined);
  });

  it.each([
    { stage: "network setup", blocked: "none" },
    { stage: "bootstrap", blocked: "none" },
    { stage: "bootstrap", blocked: "page" },
    { stage: "bootstrap", blocked: "browser" },
  ])(
    "releases the exact lease after $stage failure with $blocked close blocked",
    async ({ stage, blocked }) => {
      if (blocked !== "none") vi.useFakeTimers();
      const outputDir = mkdtempSync(join(tmpdir(), "hf-session-owner-"));
      const send = vi.fn().mockResolvedValue(undefined);
      if (stage === "network setup") send.mockRejectedValue(new Error("network setup failed"));
      const closeResult = (resource: string) =>
        blocked === resource ? new Promise<void>(() => {}) : Promise.resolve();
      const page = {
        mainFrame: () => ({ client: Object.setPrototypeOf({ send }, CDPSession.prototype) }),
        evaluateOnNewDocument: vi.fn().mockRejectedValue(new Error("bootstrap failed")),
        close: vi.fn(() => closeResult("page")),
      } as unknown as Page;
      const browser = {
        connected: true,
        newPage: vi.fn().mockResolvedValue(page),
        version: vi.fn().mockResolvedValue("HeadlessChrome/150.0.0.0"),
        close: vi.fn(() => closeResult("browser")),
        disconnect: vi.fn(),
        process: () => null,
      } as unknown as Browser;
      _setPuppeteerForTests({
        launch: vi.fn().mockResolvedValue(browser),
      } as unknown as PuppeteerNode);

      try {
        const creating = expect(
          createCaptureSession(
            "http://127.0.0.1:3000",
            outputDir,
            {
              width: 320,
              height: 180,
              fps: { num: 30, den: 1 },
              format: "jpeg",
              requiresWebGpu: false,
            },
            null,
            {
              browserGpuMode: "software",
              enableBrowserPool: true,
              forceScreenshot: true,
            },
          ),
        ).rejects.toThrow(`${stage} failed`);
        if (blocked !== "none") await vi.runAllTimersAsync();
        await creating;

        expect(send).toHaveBeenCalledWith("Network.enable", {
          maxTotalBufferSize: 32 * 1024 * 1024,
          maxResourceBufferSize: 16 * 1024 * 1024,
        });
        if (stage === "network setup") {
          expect(page.evaluateOnNewDocument).not.toHaveBeenCalled();
        } else {
          expect(send.mock.invocationCallOrder[0]).toBeLessThan(
            vi.mocked(page.evaluateOnNewDocument).mock.invocationCallOrder[0] ?? 0,
          );
        }
        expect(page.close).toHaveBeenCalledTimes(1);
        if (blocked !== "page") expect(browser.close).toHaveBeenCalledTimes(1);
        if (blocked !== "none") expect(browser.disconnect).toHaveBeenCalledTimes(1);
      } finally {
        vi.useRealTimers();
        rmSync(outputDir, { recursive: true, force: true });
      }
    },
  );
});
