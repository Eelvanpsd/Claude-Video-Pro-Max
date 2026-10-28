import { randomUUID } from "node:crypto";
import { linkSync, mkdirSync, readFileSync, renameSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";

export class HistoryBusyError extends Error {
  constructor(
    readonly pid: number,
    readonly url?: string,
  ) {
    super(`This project's history is open in another process (pid ${pid}).`);
    this.name = "HistoryBusyError";
  }
}

function alive(pid: number): boolean {
  if (!Number.isInteger(pid) || pid <= 0) return false;
  try {
    process.kill(pid, 0);
    return true;
  } catch (error) {
    return (error as NodeJS.ErrnoException).code === "EPERM";
  }
}

/** The pid in `file`; null when there is no file, NaN when it holds no pid (so it reads as dead). */
function ownerOf(file: string): number | null {
  try {
    const text = readFileSync(file, "utf-8");
    return /^\d+$/.test(text) ? Number(text) : Number.NaN;
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") return null;
    throw error;
  }
}

/** Takes `file` if nobody holds it: written aside and linked in, so a reader never sees it without its pid. */
function claim(file: string): boolean {
  const draft = `${file}-${process.pid}-${randomUUID()}.tmp`;
  writeFileSync(draft, String(process.pid));
  try {
    linkSync(draft, file);
    return true;
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== "EEXIST") throw error;
    return false;
  } finally {
    rmSync(draft, { force: true });
  }
}

/** Removes `file` only while it names this process, so a release never takes a later owner's lock. */
function releaseOwn(file: string): void {
  if (ownerOf(file) === process.pid) rmSync(file, { force: true });
}

/**
 * Removes a dead owner's lock under an evict lock, re-reading the owner, so a live owner's lock survives. False when
 * another evictor holds it. ponytail: a crashed evictor's lock is cleared unguarded; racing that can give two owners.
 */
function evictDeadOwner(file: string): boolean {
  const evictor = `${file}.evict`;
  if (!claim(evictor)) {
    const holder = ownerOf(evictor);
    if (holder !== null && !alive(holder)) rmSync(evictor, { force: true });
    return false;
  }
  try {
    const pid = ownerOf(file);
    if (pid !== null && !alive(pid)) rmSync(file, { force: true });
    return true;
  } finally {
    releaseOwn(evictor);
  }
}

/** The owner's url sits beside owner.pid, so readers of owner.pid from older versions see no change. */
function advertise(urlFile: string, url: string | undefined): void {
  if (!url) return rmSync(urlFile, { force: true });
  const draft = `${urlFile}-${process.pid}-${randomUUID()}.tmp`;
  writeFileSync(draft, JSON.stringify({ pid: process.pid, url }));
  renameSync(draft, urlFile);
}

/** The url `pid` advertised, only while `pid` is alive and still holds `file`. */
function servedBy(file: string, urlFile: string, pid: number): string | undefined {
  try {
    const said = JSON.parse(readFileSync(urlFile, "utf-8")) as { pid?: unknown; url?: unknown };
    const live = said.pid === pid && alive(pid) && ownerOf(file) === pid;
    return live && typeof said.url === "string" ? said.url : undefined;
  } catch {
    return undefined;
  }
}

/**
 * One process at a time keeps a project's history open (a second opener would fork the log). Waits up to `waitMs`
 * for the owner to close, takes over a dead owner's lock. `url` is where this process serves the history's routes.
 */
export async function takeHistoryOwnership(
  home: string,
  waitMs: number,
  url?: string,
): Promise<() => void> {
  const file = join(home, "owner.pid");
  const urlFile = join(home, "owner-url.json");
  const deadline = Date.now() + waitMs;
  mkdirSync(home, { recursive: true });
  for (;;) {
    if (claim(file)) {
      advertise(urlFile, url);
      let held = true;
      return () => {
        if (held && servedBy(file, urlFile, process.pid)) rmSync(urlFile, { force: true });
        if (held) releaseOwn(file);
        held = false;
      };
    }
    const pid = ownerOf(file);
    if (pid === null) continue;
    if (!alive(pid) && evictDeadOwner(file)) continue;
    if (Date.now() >= deadline) throw new HistoryBusyError(pid, servedBy(file, urlFile, pid));
    await new Promise((settle) => setTimeout(settle, 50));
  }
}
