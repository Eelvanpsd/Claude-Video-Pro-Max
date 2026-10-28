import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import * as manager from "./manager.js";
import { transcribe } from "./transcribe.js";

describe("whisper transcribe with a signal", () => {
  let dir: string;
  let input: string;
  beforeEach(() => {
    dir = mkdtempSync(join(tmpdir(), "hf-whisper-signal-"));
    input = join(dir, "narration.wav");
    writeFileSync(input, "not-real-audio");
    vi.spyOn(manager, "ensureWhisper").mockResolvedValue({
      executablePath: "/no/whisper-cli",
      source: "system",
    });
    vi.spyOn(manager, "ensureModel").mockRejectedValue(new Error("no model in this test"));
  });
  afterEach(() => {
    vi.restoreAllMocks();
    rmSync(dir, { recursive: true, force: true });
  });

  it("does no setup when the signal is already aborted", async () => {
    const reason = new Error("stopped before it began");

    await expect(transcribe(input, dir, { signal: AbortSignal.abort(reason) })).rejects.toBe(
      reason,
    );

    expect(manager.ensureWhisper).not.toHaveBeenCalled();
    expect(manager.ensureModel).not.toHaveBeenCalled();
  });

  it("hands the model download the signal and stops before audio prep when it aborts", async () => {
    const controller = new AbortController();
    const reason = new Error("stopped during the download");
    vi.mocked(manager.ensureModel).mockImplementation(async (_model, options) => {
      expect(options?.signal).toBe(controller.signal);
      controller.abort(reason);
      return join(dir, "ggml-small.en.bin");
    });

    // Audio prep would fail on this fake WAV with its own error; the abort must win first.
    await expect(transcribe(input, dir, { signal: controller.signal })).rejects.toBe(reason);
    expect(manager.ensureModel).toHaveBeenCalledOnce();
    expect(manager.ensureWhisper).toHaveBeenCalledWith(
      expect.objectContaining({ signal: controller.signal }),
    );
  });
});
