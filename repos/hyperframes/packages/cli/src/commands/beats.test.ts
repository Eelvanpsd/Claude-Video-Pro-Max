import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterAll, describe, expect, it, vi } from "vitest";
import { findFfBinary } from "@hyperframes/parsers/ff-binaries";
import { encodeWav } from "../audio/analysis/providers/shared.js";

const RATE = 22_050;
const root = mkdtempSync(join(tmpdir(), "hf-beats-"));
afterAll(() => rmSync(root, { recursive: true, force: true }));

/** A project whose music track is `seconds` of noise clicks at `bpm`, or silence when `bpm` is null. */
function project(name: string, bpm: number | null, seconds = 12): string {
  const dir = join(root, name);
  const samples = new Float32Array(seconds * RATE);
  let seed = 7;
  const noise = () => (seed = (seed * 1_103_515_245 + 12_345) % 2_147_483_648) / 2 ** 30 - 1;
  for (let t = 0.2; bpm && t < seconds - 0.1; t += 60 / bpm) {
    const start = Math.round(t * RATE);
    for (let i = 0; i < 0.05 * RATE; i++)
      samples[start + i]! += 0.6 * noise() * Math.exp(-i / RATE / 0.015);
  }
  mkdirSync(join(dir, "assets"), { recursive: true });
  writeFileSync(
    join(dir, "assets", "song.wav"),
    encodeWav({ sampleRate: RATE, channels: [samples] }),
  );
  writeFileSync(
    join(dir, "index.html"),
    `<div data-composition-id="main"><audio id="music" src="assets/song.wav"></audio></div>`,
  );
  return dir;
}

async function runBeats(dir: string): Promise<{ exitCode: number; out: string }> {
  const command = (await import("./beats.js")).default as unknown as {
    run: (context: { args: Record<string, unknown> }) => Promise<void>;
  };
  const lines: string[] = [];
  const capture = (...parts: unknown[]) => void lines.push(parts.map(String).join(" "));
  const log = vi.spyOn(console, "log").mockImplementation(capture);
  const error = vi.spyOn(console, "error").mockImplementation(capture);
  let exitCode = 0;
  try {
    await command.run({ args: { dir, json: true } });
  } catch (thrown) {
    exitCode = (thrown as { result?: { exitCode?: number } }).result?.exitCode ?? -1;
  } finally {
    log.mockRestore();
    error.mockRestore();
  }
  return { exitCode, out: lines.join("\n") };
}

const ffmpeg = findFfBinary("ffmpeg") && findFfBinary("ffprobe");

describe.skipIf(!ffmpeg)("hyperframes beats", () => {
  it("writes beats/<audio>.json in the beat-file format the Studio reads", async () => {
    const dir = project("steady", 120);
    const { exitCode, out } = await runBeats(dir);
    expect(exitCode).toBe(0);
    const file = JSON.parse(readFileSync(join(dir, "beats", "assets", "song.wav.json"), "utf8"));
    expect(Object.keys(file)).toEqual(["version", "audio", "beats"]);
    expect(file).toMatchObject({ version: 1, audio: "assets/song.wav" });
    for (const beat of file.beats) {
      expect(Object.keys(beat)).toEqual(["time", "strength"]);
      expect(beat.strength).toBeGreaterThanOrEqual(0);
      expect(beat.strength).toBeLessThanOrEqual(1);
    }
    const times: number[] = file.beats.map((b: { time: number }) => b.time);
    expect(times.length).toBeGreaterThan(18);
    expect(times.every((t) => Math.abs(((t - 0.2 + 0.25) % 0.5) - 0.25) <= 0.07)).toBe(true);
    const report = JSON.parse(out) as { ok: boolean; count: number; bpm: number };
    expect(report).toMatchObject({ ok: true, file: "beats/assets/song.wav.json" });
    expect(report.count).toBe(times.length);
    expect(Math.abs(report.bpm - 120)).toBeLessThanOrEqual(1);
  });

  it("writes nothing for a track with no steady beat", async () => {
    const dir = project("silent", null);
    const { exitCode, out } = await runBeats(dir);
    expect(exitCode).toBe(1);
    expect(out).toMatch(/No beats detected in assets\/song\.wav/);
    expect(existsSync(join(dir, "beats"))).toBe(false);
  });
});
