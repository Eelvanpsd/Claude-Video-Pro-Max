import { afterEach, expect, it, vi } from "vitest";
import { CheckDeadline, CheckDeadlineError } from "./checkDeadline.js";

afterEach(() => vi.useRealTimers());

function rejectOnAbort(signal: AbortSignal): Promise<never> {
  return new Promise((_, reject) => {
    signal.addEventListener("abort", () => reject(signal.reason), {
      once: true,
    });
  });
}

it("readiness and later sampling spend one 120-second budget", async () => {
  vi.useFakeTimers();
  const deadline = new CheckDeadline();
  deadline.start();
  try {
    await deadline.run(async () => "ready");
    await vi.advanceTimersByTimeAsync(90_000);
    const sample = deadline.run(() => rejectOnAbort(deadline.signal));
    const failed = expect(sample).rejects.toBeInstanceOf(CheckDeadlineError);
    await vi.advanceTimersByTimeAsync(30_000);
    await failed;
    expect(deadline.signal.aborted).toBe(true);
  } finally {
    await deadline.close();
  }
});

it("an expired check does not start its crop browser", async () => {
  vi.useFakeTimers();
  const deadline = new CheckDeadline();
  deadline.start();
  try {
    const audit = deadline.run(() => rejectOnAbort(deadline.signal));
    const failed = expect(audit).rejects.toBeInstanceOf(CheckDeadlineError);
    await vi.advanceTimersByTimeAsync(120_000);
    await failed;
    const crop = vi.fn(async () => []);
    await expect(deadline.run(crop)).rejects.toBeInstanceOf(CheckDeadlineError);
    expect(crop).not.toHaveBeenCalled();
  } finally {
    await deadline.close();
  }
});

it("cleanup is bounded even when a losing operation ignores cancellation", async () => {
  vi.useFakeTimers();
  const deadline = new CheckDeadline();
  deadline.start();
  const audit = deadline.run(() => new Promise(() => {}));
  const failed = expect(audit).rejects.toBeInstanceOf(CheckDeadlineError);
  await vi.advanceTimersByTimeAsync(120_000);
  await failed;
  const closing = expect(deadline.close()).rejects.toThrow("draining check cleanup");
  await vi.advanceTimersByTimeAsync(1_000);
  await closing;
}, 2_000);

it("browser provisioning does not spend the check budget, which starts once when ready", async () => {
  vi.useFakeTimers();
  const deadline = new CheckDeadline();
  let complete!: () => void;
  const work = new Promise<void>((resolve) => {
    complete = resolve;
  });
  const outcome = deadline.run(() => work).catch((error: unknown) => error);
  try {
    await vi.advanceTimersByTimeAsync(150_000);
    expect(deadline.signal.aborted).toBe(false);
    deadline.start();
    await vi.advanceTimersByTimeAsync(90_000);
    deadline.start();
    await vi.advanceTimersByTimeAsync(29_999);
    expect(deadline.signal.aborted).toBe(false);
    await vi.advanceTimersByTimeAsync(1);
    expect(deadline.signal.aborted).toBe(true);
    expect(await outcome).toBeInstanceOf(CheckDeadlineError);
  } finally {
    complete();
    await outcome;
    await deadline.close();
  }
});

it("closing before browser readiness prevents a later clock from starting", async () => {
  vi.useFakeTimers();
  const deadline = new CheckDeadline();
  await deadline.close();
  deadline.start();
  await vi.advanceTimersByTimeAsync(150_000);
  expect(vi.getTimerCount()).toBe(0);
  expect(deadline.signal.aborted).toBe(false);
});
