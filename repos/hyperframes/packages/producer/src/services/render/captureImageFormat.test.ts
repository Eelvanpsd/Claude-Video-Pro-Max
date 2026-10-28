import { describe, expect, it } from "bun:test";
import { frameFileExtension } from "@hyperframes/engine";
import { resolveCaptureImageFormat, resolveCaptureJpegQuality } from "./captureImageFormat.js";

describe("resolveCaptureImageFormat", () => {
  it("captures JPEG for an ordinary opaque render", () => {
    expect(resolveCaptureImageFormat({ needsAlpha: false, motionBlur: undefined })).toBe("jpeg");
  });

  it("captures PNG when the output container keeps alpha", () => {
    expect(resolveCaptureImageFormat({ needsAlpha: true, motionBlur: undefined })).toBe("png");
  });

  it("captures PNG for motion blur even when the output needs no alpha", () => {
    // The sub-frame samples are averaged pixel by pixel, so they cannot be JPEG.
    expect(resolveCaptureImageFormat({ needsAlpha: false, motionBlur: {} })).toBe("png");
  });

  it("agrees with the name the capture writer gives a frame", () => {
    // The encoder's input pattern is built from this extension, so a disagreement here is
    // a render that captures frames and then finds none.
    for (const needsAlpha of [false, true]) {
      for (const motionBlur of [undefined, {}]) {
        const format = resolveCaptureImageFormat({ needsAlpha, motionBlur });
        expect(frameFileExtension(format)).toBe(format === "png" ? "png" : "jpg");
      }
    }
  });
});

describe("resolveCaptureJpegQuality", () => {
  it("captures standard and high renders at quality 100 so graded colour survives", () => {
    expect(resolveCaptureJpegQuality("standard")).toBe(100);
    expect(resolveCaptureJpegQuality("high")).toBe(100);
  });

  it("keeps draft renders on the smaller, faster frames", () => {
    expect(resolveCaptureJpegQuality("draft")).toBe(80);
  });
});
