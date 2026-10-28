import type { ChildProcess } from "node:child_process";
import { readFileSync, readdirSync } from "node:fs";

export function testProcessIsAlive(pid: number): boolean {
  if (process.platform === "linux") {
    try {
      const stat = readFileSync(`/proc/${pid}/stat`, "utf8");
      const state = stat.slice(stat.lastIndexOf(") ") + 2)[0];
      return state !== "Z" && state !== "X";
    } catch {
      return false;
    }
  }
  try {
    process.kill(pid, 0);
    return true;
  } catch {
    return false;
  }
}

export async function waitForTestCondition(check: () => boolean, timeoutMs: number): Promise<void> {
  const deadline = Date.now() + timeoutMs;
  while (!check()) {
    if (Date.now() >= deadline) throw new Error(`Condition not met within ${timeoutMs} ms`);
    await new Promise((resolve) => setTimeout(resolve, 20));
  }
}

export function testProcessDescendants(parentPid: number): number[] {
  const parents = new Map<number, number>();
  for (const name of readdirSync("/proc")) {
    if (!/^\d+$/.test(name)) continue;
    try {
      const stat = readFileSync(`/proc/${name}/stat`, "utf8");
      parents.set(Number(name), Number(stat.slice(stat.lastIndexOf(") ") + 2).split(" ")[1]));
    } catch {}
  }
  const owned = new Set([parentPid]);
  for (const pid of owned) {
    for (const [child, parent] of parents) if (parent === pid) owned.add(child);
  }
  return [...owned].filter((pid) => pid !== parentPid);
}

export async function stopTestProcesses(
  root: ChildProcess,
  ownedPids: readonly number[],
): Promise<void> {
  const rootExited = () => root.exitCode !== null || root.signalCode !== null;
  if (!rootExited()) {
    root.kill("SIGTERM");
    await waitForTestCondition(rootExited, 5_000).catch(() => undefined);
  }
  try {
    for (const pid of ownedPids) {
      if (testProcessIsAlive(pid)) process.kill(pid, "SIGKILL");
    }
    await waitForTestCondition(() => ownedPids.every((pid) => !testProcessIsAlive(pid)), 5_000);
  } finally {
    if (!rootExited()) {
      root.kill("SIGKILL");
      await waitForTestCondition(rootExited, 5_000);
    }
  }
}
