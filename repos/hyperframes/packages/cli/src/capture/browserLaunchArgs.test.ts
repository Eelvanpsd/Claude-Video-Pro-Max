import { describe, expect, it } from "vitest";
import { captureBrowserArgs } from "./browserLaunchArgs.js";

describe("capture browser sandbox", () => {
  it.each(["darwin", "win32"] as const)("keeps Chromium's sandbox on %s", (platform) => {
    expect(captureBrowserArgs(false, 800, 600, platform)).not.toContain("--no-sandbox");
  });

  it("retains the Linux container workaround", () => {
    expect(captureBrowserArgs(false, 800, 600, "linux")).toContain("--no-sandbox");
  });
});
