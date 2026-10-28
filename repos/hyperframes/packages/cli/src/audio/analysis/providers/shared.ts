import { execFile } from "node:child_process";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { promisify } from "node:util";
import type { AudioSignal, Availability, Downbeats } from "@hyperframes/core/audio-analysis";
import { medianInterval } from "@hyperframes/core/audio-analysis";

export const runFile = promisify(execFile);

export const unavailable = (reason: string): Availability => ({ ok: false, reason });
export const AVAILABLE: Availability = { ok: true };

/** 16-bit PCM WAV of the signal, channels interleaved. */
export function encodeWav(signal: AudioSignal): Buffer {
  const channels = signal.channels.length;
  const frames = signal.channels[0]?.length ?? 0;
  const data = frames * channels * 2;
  const wav = Buffer.alloc(44 + data);
  wav.write("RIFF", 0);
  wav.writeUInt32LE(36 + data, 4);
  wav.write("WAVEfmt ", 8);
  wav.writeUInt32LE(16, 16);
  wav.writeUInt16LE(1, 20);
  wav.writeUInt16LE(channels, 22);
  wav.writeUInt32LE(signal.sampleRate, 24);
  wav.writeUInt32LE(signal.sampleRate * channels * 2, 28);
  wav.writeUInt16LE(channels * 2, 32);
  wav.writeUInt16LE(16, 34);
  wav.write("data", 36);
  wav.writeUInt32LE(data, 40);
  let offset = 44;
  for (let i = 0; i < frames; i++)
    for (const channel of signal.channels) {
      const sample = Math.max(-1, Math.min(1, channel[i]!));
      wav.writeInt16LE(Math.round(sample * 32767), offset);
      offset += 2;
    }
  return wav;
}

/** Runs `use` with the signal written to a WAV file that is removed afterwards. */
export async function withWavFile<T>(
  signal: AudioSignal,
  use: (path: string) => Promise<T>,
): Promise<T> {
  const dir = await mkdtemp(join(tmpdir(), "hf-audio-"));
  try {
    const path = join(dir, "audio.wav");
    await writeFile(path, encodeWav(signal));
    return await use(path);
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
}

/** One answer per signal, shared by every capability a provider computes together. */
export function perSignal<T>(compute: (signal: AudioSignal) => Promise<T>) {
  const answers = new WeakMap<AudioSignal, Promise<T>>();
  return (signal: AudioSignal): Promise<T> => {
    let answer = answers.get(signal);
    if (!answer) answers.set(signal, (answer = compute(signal)));
    return answer;
  };
}

/** Downbeats from a model's beat and downbeat times; the meter is the median count of beats per bar. */
export function downbeatsWithMeter(beats: number[], downbeats: number[]): Downbeats {
  const bar = medianInterval(downbeats);
  const beat = medianInterval(beats);
  const meter = bar && beat ? Math.round(bar / beat) : null;
  return { times: downbeats, meter: meter && meter > 0 ? meter : null };
}

const round = (t: number) => Math.round(t * 1000) / 1000;
export const rounded = (times: readonly number[]) => times.map(round);
