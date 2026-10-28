import { runCommand } from "citty";
import {
  existsSync,
  linkSync,
  lstatSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  readdirSync,
  rmSync,
  symlinkSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const capture = vi.hoisted(() => ({
  evaluate: vi.fn(),
  screenshot: vi.fn(async () => Buffer.from("captured PNG")),
  closeBrowser: vi.fn(async () => undefined),
  closeServer: vi.fn(async () => undefined),
  seek: vi.fn(async () => undefined),
}));

vi.mock("../capture/captureCompositionFrame.js", async (importOriginal) => ({
  ...(await importOriginal<typeof import("../capture/captureCompositionFrame.js")>()),
  openSettledCompositionPage: vi.fn(async () => ({
    browser: { close: capture.closeBrowser },
    page: { evaluate: capture.evaluate, screenshot: capture.screenshot },
    renderReadyTimedOut: false,
  })),
  seekCompositionTimeline: capture.seek,
}));

vi.mock("../utils/staticProjectServer.js", () => ({
  serveStaticProjectHtml: vi.fn(async () => ({
    url: "http://127.0.0.1:1",
    close: capture.closeServer,
  })),
}));

vi.mock("@hyperframes/engine", () => ({
  injectVideoFramesBatch: vi.fn(async () => []),
  syncVideoFrameVisibility: vi.fn(async () => undefined),
  extractMediaMetadata: vi.fn(),
}));

import snapshotCommand from "./snapshot.js";
import { historyDeps } from "../utils/historyOwner.js";
import { openProjectHistory } from "@hyperframes/studio-server/history";

/** The page's answers for one run: asset check, duration, ready, then two per frame. */
function primePage(frames: number) {
  capture.evaluate
    .mockReset()
    .mockResolvedValueOnce({ loaded: [], errored: [], unused: [] })
    .mockResolvedValueOnce(2)
    .mockResolvedValueOnce(true);
  for (let i = 0; i < frames; i++) {
    capture.evaluate.mockResolvedValueOnce([]).mockResolvedValueOnce(undefined);
  }
}

const PROJECT_HTML =
  '<html><body><div id="root" data-composition-id="main" data-width="640" data-height="360" data-start="0" data-duration="2">Visible</div><script>window.__timelines = { main: { duration() { return 2; }, seek() {} } };</script></body></html>';

describe("snapshot contact sheet failures", () => {
  let project: string;

  beforeEach(() => {
    vi.resetModules();
    vi.clearAllMocks();
    project = mkdtempSync(join(tmpdir(), "hf-snapshot-contact-sheet-"));
    writeFileSync(join(project, "index.html"), PROJECT_HTML);
    primePage(2);
    vi.spyOn(console, "log").mockImplementation(() => undefined);
    vi.spyOn(console, "warn").mockImplementation(() => undefined);
    vi.spyOn(console, "error").mockImplementation(() => undefined);
  });

  afterEach(() => {
    vi.doUnmock("../capture/contactSheet.js");
    vi.doUnmock("sharp");
    vi.restoreAllMocks();
    rmSync(project, { recursive: true, force: true });
  });

  it.each(["import", "generation"])(
    "warns and preserves every captured frame when contact sheet %s fails",
    async (failure) => {
      const message =
        failure === "import"
          ? 'Could not load the "sharp" module: libvips-cpp-8.18.7.dll was blocked'
          : "Unable to decode image for contact sheet";
      const generate = vi.fn(async () => {
        throw new Error(message);
      });
      if (failure === "import") {
        vi.doMock("sharp", () => ({
          get default() {
            throw new Error(message);
          },
        }));
      } else {
        vi.doMock("../capture/contactSheet.js", () => ({ createSnapshotContactSheet: generate }));
      }

      await expect(
        runCommand(snapshotCommand, {
          rawArgs: [
            project,
            ...["--at", "0.5,1", "--no-end", "--describe", "false"],
            ...["--output", join(project, "snapshots")],
          ],
        }),
      ).resolves.toBeDefined();

      expect(console.error).not.toHaveBeenCalled();
      for (const [index, time] of ["0.5", "1"].entries()) {
        const frame = join(project, "snapshots", `frame-0${index}-at-${time}s.png`);
        expect(readFileSync(frame)).toEqual(Buffer.from("captured PNG"));
      }
      expect(capture.screenshot).toHaveBeenCalledTimes(2);
      expect(capture.closeBrowser).toHaveBeenCalledOnce();
      expect(capture.closeServer).toHaveBeenCalledOnce();
      if (failure === "generation") expect(generate).toHaveBeenCalledOnce();
      expect(console.warn).toHaveBeenCalledWith(expect.stringContaining("Contact sheet skipped:"));
      expect(console.warn).toHaveBeenCalledWith(expect.stringContaining(message));
      expect(console.warn).toHaveBeenCalledWith(
        expect.stringContaining("Individual snapshot PNGs are still available"),
      );
    },
  );

  it("reports a generated contact sheet without a warning", async () => {
    const sheet = join(project, "snapshots", "contact-sheet.jpg");
    const generate = vi.fn(async () => [sheet]);
    vi.doMock("../capture/contactSheet.js", () => ({ createSnapshotContactSheet: generate }));

    await runCommand(snapshotCommand, {
      rawArgs: [
        project,
        ...["--at", "0.5,1", "--no-end", "--describe", "false"],
        ...["--output", join(project, "snapshots")],
      ],
    });

    expect(generate).toHaveBeenCalledWith(join(project, "snapshots"), sheet);
    expect(console.log).toHaveBeenCalledWith(expect.stringContaining("contact-sheet.jpg"));
    expect(console.warn).not.toHaveBeenCalled();
    expect(console.error).not.toHaveBeenCalled();
  });

  it("keeps and records the captured frames when another process holds history", async () => {
    const args = {
      rawArgs: [
        project,
        ...["--at", "0.5,1", "--no-end", "--describe", "false"],
        ...["--output", join(project, "snapshots")],
      ],
    };
    await runCommand(snapshotCommand, args);
    const statePath = join(project, ".hyperframes", "video-state.json");
    const recorded = JSON.parse(readFileSync(statePath, "utf8"));
    expect(recorded.snapshots.unversioned.length).toBeGreaterThan(0);

    const previousWait = historyDeps.ownerWaitMs;
    historyDeps.ownerWaitMs = 0;
    const held = await openProjectHistory({
      projectDir: project,
      historyRoot: historyDeps.historyRoot,
      ownerWaitMs: 0,
    });
    capture.screenshot.mockImplementation(async () => Buffer.from("replaced PNG"));
    primePage(2);
    try {
      await runCommand(snapshotCommand, args);
      for (const [index, time] of ["0.5", "1"].entries()) {
        const frame = join(project, "snapshots", `frame-0${index}-at-${time}s.png`);
        expect(readFileSync(frame)).toEqual(Buffer.from("replaced PNG"));
      }
      const after = JSON.parse(readFileSync(statePath, "utf8"));
      expect(after.snapshots.unversioned.map((record: { image: string }) => record.image)).toEqual(
        ["0.5", "1"].map((time, index) =>
          join(project, "snapshots", `frame-0${index}-at-${time}s.png`),
        ),
      );
      expect(console.error).not.toHaveBeenCalled();
      expect(console.warn).not.toHaveBeenCalledWith(expect.stringContaining("not recorded"));
    } finally {
      historyDeps.ownerWaitMs = previousWait;
      await held.close();
    }
  });
});

describe("snapshot --keep", () => {
  let project: string;
  let stills: string;

  beforeEach(() => {
    project = mkdtempSync(join(tmpdir(), "hf-snapshot-keep-"));
    stills = join(project, "boards", "stills");
    writeFileSync(join(project, "index.html"), PROJECT_HTML);
    vi.spyOn(console, "log").mockImplementation(() => undefined);
    vi.spyOn(console, "warn").mockImplementation(() => undefined);
  });

  afterEach(() => {
    vi.restoreAllMocks();
    rmSync(project, { recursive: true, force: true });
  });

  async function snapshot(at: string, bytes: string) {
    capture.screenshot.mockImplementation(async () => Buffer.from(bytes));
    primePage(at.split(",").length);
    await runCommand(snapshotCommand, {
      rawArgs: [project, "--keep", "--at", at, "--no-end", "--describe", "false", "-o", stills],
    });
  }

  it("redoes one moment and keeps every other still", async () => {
    await snapshot("0,0.5,1.5", "first PNG");
    await snapshot("0.5", "redo PNG");

    expect(readdirSync(stills).sort()).toEqual(["at-0.5s.png", "at-0s.png", "at-1.5s.png"]);
    expect(readFileSync(join(stills, "at-0s.png"), "utf8")).toBe("first PNG");
    expect(readFileSync(join(stills, "at-0.5s.png"), "utf8")).toBe("redo PNG");
    expect(readFileSync(join(stills, "at-1.5s.png"), "utf8")).toBe("first PNG");
    expect(existsSync(join(stills, "contact-sheet.jpg"))).toBe(false);
  });

  it("refuses two times that would share a still, before touching the folder", async () => {
    await snapshot("1.5", "first PNG");
    capture.screenshot.mockClear();

    await expect(snapshot("1.5,1.5004", "second PNG")).rejects.toThrow(
      "--keep would name both 1.5 and 1.5004 at-1.5s.png",
    );
    expect(capture.screenshot).not.toHaveBeenCalled();
    expect(readFileSync(join(stills, "at-1.5s.png"), "utf8")).toBe("first PNG");
  });

  it("replaces a linked still without writing through the link", async () => {
    mkdirSync(stills, { recursive: true });
    const hardVictim = join(project, "hard-victim.png");
    writeFileSync(hardVictim, "hard victim");
    linkSync(hardVictim, join(stills, "at-0.5s.png"));
    const softVictim = join(project, "soft-victim.png");
    writeFileSync(softVictim, "soft victim");
    if (process.platform !== "win32") symlinkSync(softVictim, join(stills, "at-1.5s.png"));

    await snapshot("0.5,1.5", "new PNG");

    expect(readFileSync(hardVictim, "utf8")).toBe("hard victim");
    expect(readFileSync(softVictim, "utf8")).toBe("soft victim");
    for (const still of ["at-0.5s.png", "at-1.5s.png"]) {
      expect(lstatSync(join(stills, still)).isFile()).toBe(true);
      expect(readFileSync(join(stills, still), "utf8")).toBe("new PNG");
    }
  });
});
