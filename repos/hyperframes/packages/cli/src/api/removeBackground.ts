import { resolve } from "node:path";
import { DEVICES, isDevice, type Device } from "../background-removal/manager.js";
import {
  QUALITIES,
  isQuality,
  render,
  type ProgressEvent,
  type Quality,
  type RenderResult,
} from "../background-removal/pipeline.js";

export type RemoveBackgroundDevice = Device;
export type RemoveBackgroundQuality = Quality;
export type RemoveBackgroundProgress = ProgressEvent;
export type RemoveBackgroundResult = RenderResult;

export interface RemoveBackgroundOptions {
  /** Video (.mp4/.mov/.webm/.mkv/.avi) or image (.jpg/.png/.webp). */
  input: string;
  /** Format from the extension: .webm (VP9 alpha), .mov (ProRes 4444) or .png (image input only). */
  output: string;
  /** Inverse-alpha background plate, .webm or .mov, video input only. Hole-cut, not inpainted. */
  backgroundOutput?: string;
  /** Default "auto". */
  device?: RemoveBackgroundDevice;
  /** Encoder preset for .webm output. Default "balanced". */
  quality?: RemoveBackgroundQuality;
  onProgress?: (event: RemoveBackgroundProgress) => void;
}

export type RemoveBackgroundErrorCode = "invalid_option" | "failed";

export class RemoveBackgroundError extends Error {
  readonly code: RemoveBackgroundErrorCode;

  constructor(code: RemoveBackgroundErrorCode, message: string, options: { cause?: unknown } = {}) {
    super(message, options.cause === undefined ? undefined : { cause: options.cause });
    this.name = "RemoveBackgroundError";
    this.code = code;
  }
}

export async function removeBackground(
  options: RemoveBackgroundOptions,
): Promise<RemoveBackgroundResult> {
  // Typed callers cannot get these wrong; plain JavaScript callers can.
  const { device, quality } = options;
  if (device !== undefined && !isDevice(device)) {
    const valid = DEVICES.join(", ");
    throw new RemoveBackgroundError("invalid_option", `Invalid device '${device}'. Use: ${valid}.`);
  }
  if (quality !== undefined && !isQuality(quality)) {
    const valid = QUALITIES.join(", ");
    throw new RemoveBackgroundError(
      "invalid_option",
      `Invalid quality '${quality}'. Use: ${valid}.`,
    );
  }

  try {
    return await render({
      inputPath: resolve(options.input),
      outputPath: resolve(options.output),
      backgroundOutputPath: options.backgroundOutput
        ? resolve(options.backgroundOutput)
        : undefined,
      device,
      quality,
      onProgress: options.onProgress,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    throw new RemoveBackgroundError("failed", message, { cause: err });
  }
}
