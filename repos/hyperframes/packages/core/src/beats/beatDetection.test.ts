import { describe, expect, it, vi } from "vitest";

import { signalProvider, type AudioSignal } from "../audioAnalysis";
import { STEADY_BEAT_CONFIDENCE, rhythm } from "../audioRhythm";
import { analyzeMusicFromBuffer, analyzeMusicFromSignal } from "./beatDetection";

const RATE = 22_050;

function random(seed = 5) {
  let state = seed;
  return () => {
    state = (state * 1_103_515_245 + 12_345) % 2_147_483_648;
    return (state / 2_147_483_648) * 2 - 1;
  };
}

const grid = (from: number, period: number, until: number) =>
  Array.from({ length: Math.floor((until - from) / period) + 1 }, (_, k) => from + k * period);

/** Add a decaying noise click at each time. */
function clicks(samples: Float32Array, times: number[], level: number, seed = 5): void {
  const noise = random(seed);
  for (const t of times) {
    const start = Math.round(t * RATE);
    for (let i = 0; i < 0.06 * RATE && start + i < samples.length; i++)
      samples[start + i]! += level * noise() * Math.exp(-i / RATE / 0.015);
  }
}

/** Add a loud low chord that starts at each time and rings for `length` seconds. */
function stabs(samples: Float32Array, times: number[], length: number): void {
  for (const t of times) {
    const start = Math.round(t * RATE);
    for (let i = 0; i < length * RATE && start + i < samples.length; i++) {
      const since = i / RATE;
      const chord = [110, 138.6, 164.8].reduce(
        (a, hz) => a + Math.sin(2 * Math.PI * hz * since),
        0,
      );
      samples[start + i]! += 0.3 * chord * Math.exp(-since / 0.25);
    }
  }
}

/** A chord that changes every four seconds, swelling in slowly each time: no pulse to follow. */
function pad(seconds: number): Float32Array {
  return Float32Array.from({ length: seconds * RATE }, (_, i) => {
    const t = i / RATE;
    const root = [110, 98, 123, 87][Math.floor(t / 4) % 4]!;
    const swell = Math.min(1, (t % 4) / 1.5);
    return (
      0.3 * swell * (Math.sin(2 * Math.PI * root * t) + 0.5 * Math.sin(3 * Math.PI * root * t))
    );
  });
}

const mono = (samples: Float32Array): AudioSignal => ({ sampleRate: RATE, channels: [samples] });

const nearBpm = (found: number | null, bpm: number) => Math.abs((found ?? 0) - bpm) <= 1;

/** Share of `truth` with a found time within 70 ms. */
function recall(found: number[], truth: number[]): number {
  const heard = (t: number) => found.some((f) => Math.abs(f - t) <= 0.07);
  return truth.filter(heard).length / truth.length;
}

describe("analyzeMusicFromSignal", () => {
  // Loud stabs every 2 beats once averaged a ~52 BPM energy-peak tempo with 96 into 74 BPM;
  // every 2.2 beats they phased a 96 BPM grid onto the off-beats.
  it.each([2, 2.2])("keeps a 96 BPM pulse under loud stabs every %s beats", async (stabEvery) => {
    const seconds = 30;
    const beats = grid(0.4, 60 / 96, seconds - 0.5);
    const samples = new Float32Array(seconds * RATE);
    clicks(samples, beats, 0.25);
    stabs(samples, grid(0.4, stabEvery * (60 / 96), seconds - 1), 0.9);
    const analysis = await analyzeMusicFromSignal(mono(samples));
    expect(nearBpm(analysis.bpm, 96)).toBe(true);
    expect(recall(analysis.beatTimes, beats.slice(2, -2))).toBeGreaterThan(0.95);
    expect(recall(beats, analysis.beatTimes)).toBeGreaterThan(0.95);
  });

  it.each([
    { bpm: 120, offset: 0.31 },
    { bpm: 90, offset: 0.12 },
    { bpm: 140, offset: 0.2 },
  ])("finds the tempo and the phase of a $bpm BPM grid", async ({ bpm, offset }) => {
    const seconds = 20;
    const beats = grid(offset, 60 / bpm, seconds - 0.3);
    const samples = new Float32Array(seconds * RATE);
    clicks(samples, beats, 0.6);
    const analysis = await analyzeMusicFromSignal(mono(samples));
    expect(nearBpm(analysis.bpm, bpm)).toBe(true);
    expect(analysis.bpmConfidence).toBe("high");
    expect(recall(analysis.beatTimes, beats.slice(1, -1))).toBeGreaterThan(0.95);
    expect(recall(beats, analysis.beatTimes)).toBe(1);
    expect(analysis.beatStrengths).toHaveLength(analysis.beatTimes.length);
    expect(analysis.peak).toBeGreaterThan(0);
  });

  it("reports no beats and no tempo for audio without a steady pulse", async () => {
    const noise = random(9);
    const hiss = Float32Array.from({ length: 12 * RATE }, () => 0.2 * noise());
    for (const samples of [new Float32Array(12 * RATE), hiss, pad(30)]) {
      const analysis = await analyzeMusicFromSignal(mono(samples));
      expect(analysis).toMatchObject({ beatTimes: [], bpm: null, bpmConfidence: "uncertain" });
    }
  });

  it("refuses an ambient pad in the tracker itself, so every caller of the signal tracker agrees", async () => {
    const ambient = mono(pad(30));
    const { beats, downbeats } = rhythm(ambient);
    expect(beats).toMatchObject({ times: [], reason: "no steady beat" });
    expect(beats.confidence).toBeLessThan(STEADY_BEAT_CONFIDENCE);
    expect(downbeats.times).toEqual([]);
    await expect(signalProvider.analyze("beats", ambient, {})).resolves.toMatchObject({
      times: [],
    });
  });

  it("waits on the caller's pause before each long stage", async () => {
    const samples = new Float32Array(8 * RATE);
    clicks(samples, grid(0.25, 0.5, 7.5), 0.6);
    const held: (() => void)[] = [];
    const pause = () => new Promise<void>((resolve) => held.push(resolve));
    let done = false;
    const analysis = analyzeMusicFromSignal(mono(samples), { pause }).then((result) => {
      done = true;
      return result;
    });
    for (let stage = 1; stage <= 3; stage++) {
      await vi.waitFor(() => expect(held).toHaveLength(stage));
      expect(done).toBe(false);
      held[stage - 1]!();
    }
    await expect(analysis).resolves.toMatchObject({ sampleRate: RATE });
  });
});

describe("analyzeMusicFromBuffer", () => {
  it("hears every channel, so a beat only on the right is found and has strength", async () => {
    const beats = grid(0.25, 0.5, 9.5);
    const right = new Float32Array(10 * RATE);
    clicks(right, beats, 0.6);
    const left = new Float32Array(right.length);
    const audio = {
      numberOfChannels: 2,
      getChannelData: (c: number) => (c === 0 ? left : right),
      sampleRate: RATE,
      duration: 10,
    } as unknown as AudioBuffer;
    const analysis = await analyzeMusicFromBuffer(audio);
    expect(nearBpm(analysis.bpm, 120)).toBe(true);
    expect(recall(analysis.beatTimes, beats.slice(1, -1))).toBeGreaterThan(0.95);
    expect(Math.min(...analysis.beatStrengths)).toBeGreaterThan(0.5);
  });
});
