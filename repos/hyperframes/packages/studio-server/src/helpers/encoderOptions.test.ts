import { describe, expect, it } from "vitest";
import { parseEncoderOptions } from "./encoderOptions";

describe("parseEncoderOptions", () => {
  it("returns no overrides for an empty request", () => {
    expect(parseEncoderOptions({}, "mp4")).toEqual({ ok: true, options: {} });
  });

  it("accepts a bitrate for mp4 and webm and ignores rate control for mov", () => {
    expect(parseEncoderOptions({ videoBitrate: "10M" }, "mp4")).toEqual({
      ok: true,
      options: { videoBitrate: "10M" },
    });
    expect(parseEncoderOptions({ videoBitrate: "2500k" }, "webm").ok).toBe(true);
    expect(parseEncoderOptions({ videoBitrate: "10M", crf: 12 }, "mov")).toEqual({
      ok: true,
      options: {},
    });
  });

  it("rejects crf and videoBitrate together", () => {
    expect(parseEncoderOptions({ crf: 12, videoBitrate: "10M" }, "mp4")).toEqual({
      ok: false,
      error: "use either crf or videoBitrate, not both",
    });
  });

  it.each(["", "10 M", "-5M", "10M; rm", 10])("rejects bitrate %j", (videoBitrate) => {
    expect(parseEncoderOptions({ videoBitrate }, "mp4").ok).toBe(false);
  });

  it("passes frame format and HDR mode through for every format", () => {
    expect(parseEncoderOptions({ videoFrameFormat: "png", hdrMode: "force-sdr" }, "mov")).toEqual({
      ok: true,
      options: { videoFrameFormat: "png", hdrMode: "force-sdr" },
    });
  });

  it("rejects an unknown frame format or HDR mode", () => {
    expect(parseEncoderOptions({ videoFrameFormat: "webp" }, "mp4").ok).toBe(false);
    expect(parseEncoderOptions({ hdrMode: "on" }, "mp4").ok).toBe(false);
  });
});
