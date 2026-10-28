import { mkdtempSync, openSync, closeSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import type { ElementStackingInfo } from "@hyperframes/engine";
import { blitHdrVideoLayer, selectDomLayerShowIds } from "./hdrCompositor.js";

function makeEl(id: string, overrides?: Partial<ElementStackingInfo>): ElementStackingInfo {
  return {
    id,
    zIndex: 0,
    x: 0,
    y: 0,
    width: 1920,
    height: 1080,
    layoutWidth: 1920,
    layoutHeight: 1080,
    opacity: 1,
    visible: true,
    renderFrameVisible: false,
    isHdr: false,
    transform: "none",
    borderRadius: [0, 0, 0, 0],
    objectFit: "fill",
    objectPosition: "50% 50%",
    clipRect: null,
    ...overrides,
  };
}

describe("selectDomLayerShowIds", () => {
  it("does not re-show hidden DOM elements while preserving visible injected video frames", () => {
    expect(
      selectDomLayerShowIds(
        ["visible-overlay", "hidden-later-scene", "hidden-sdr-video"],
        [
          makeEl("visible-overlay"),
          makeEl("hidden-later-scene", { visible: false }),
          makeEl("hidden-sdr-video", {
            visible: false,
            renderFrameVisible: true,
          }),
        ],
      ),
    ).toEqual(["visible-overlay", "hidden-sdr-video"]);
  });

  it("does not re-show opacity-zero scene members or their injected frames", () => {
    expect(
      selectDomLayerShowIds(
        ["active-overlay", "inactive-scene-video", "inactive-scene-label"],
        [
          makeEl("active-overlay"),
          makeEl("inactive-scene-video", {
            opacity: 0,
            visible: false,
            renderFrameVisible: true,
          }),
          makeEl("inactive-scene-label", {
            opacity: 0,
            visible: true,
          }),
        ],
      ),
    ).toEqual(["active-overlay"]);
  });
});

describe("blitHdrVideoLayer", () => {
  it.each([
    { lead: undefined, mediaStart: 0, painted: true },
    { lead: 7, mediaStart: 0, painted: false },
    { lead: 7, mediaStart: 6.5, painted: true },
  ])(
    "paints at 1 s of a clip from $mediaStart s whose stream starts $lead s in: $painted",
    ({ lead, mediaStart, painted }) => {
      const dir = mkdtempSync(join(tmpdir(), "hf-hdr-lead-"));
      const rawPath = join(dir, "frames.rgb48le");
      const frameSize = 2 * 2 * 6;
      writeFileSync(rawPath, Buffer.alloc(frameSize * 2, 0x80));
      const fd = openSync(rawPath, "r");
      try {
        const canvas = Buffer.alloc(frameSize);
        const el = makeEl("v", {
          width: 2,
          height: 2,
          layoutWidth: 2,
          layoutHeight: 2,
          isHdr: true,
        });
        const source = {
          dir,
          rawPath,
          fd,
          width: 2,
          height: 2,
          frameSize,
          frameCount: 2,
          scratch: Buffer.alloc(frameSize),
          mediaStart,
          videoStreamLeadSeconds: lead,
        };
        blitHdrVideoLayer(canvas, el, 1, 1, new Map([["v", source]]), new Map([["v", 0]]), 2, 2);
        expect(canvas.some((byte) => byte !== 0)).toBe(painted);
      } finally {
        closeSync(fd);
        rmSync(dir, { recursive: true, force: true });
      }
    },
  );
});
