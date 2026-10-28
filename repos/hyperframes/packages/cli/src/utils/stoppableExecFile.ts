import { execFileSync, spawn, type StdioOptions } from "node:child_process";
import type { Readable } from "node:stream";
import * as util from "node:util";
import { terminateProcessTree } from "./processTree.js";

export interface StoppableExecFileOptions {
  stdio: StdioOptions;
  timeout: number;
  cwd?: string;
  env?: NodeJS.ProcessEnv;
  /** Per output stream, as in execFileSync, whose default this keeps. */
  maxBuffer?: number;
  /** Aborting it ends the child and every process it started, then rejects with the reason. */
  signal: AbortSignal | undefined;
}

function syscallError(code: string, file: string, args: string[]): NodeJS.ErrnoException {
  // Bun has no getSystemErrorMap, and the CLI's own tests run it under Bun.
  const known = util.getSystemErrorMap?.() ?? new Map();
  const errno = [...known].find(([, [name]]) => name === code)?.[0];
  return Object.assign(new Error(`spawnSync ${file} ${code}`), {
    errno,
    code,
    syscall: `spawnSync ${file}`,
    path: file,
    spawnargs: args,
  });
}

/**
 * execFileSync, stoppable: given a signal, the child runs off the event loop so the signal can end
 * it, and a failure throws the error execFileSync throws. Without one it is execFileSync, which the
 * CLI keeps, so its spinner draws exactly the frames it always has.
 */
export async function stoppableExecFile(
  file: string,
  args: string[],
  options: StoppableExecFileOptions,
): Promise<void> {
  const { signal, ...syncOptions } = options;
  if (!signal) {
    execFileSync(file, args, syncOptions);
    return;
  }
  signal.throwIfAborted();
  const maxBuffer = options.maxBuffer ?? 1024 * 1024;
  await new Promise<void>((resolve, reject) => {
    const child = spawn(file, args, { cwd: options.cwd, env: options.env, stdio: options.stdio });
    let failure: "ETIMEDOUT" | "ENOBUFS" | undefined;
    const stopWith = (code: "ETIMEDOUT" | "ENOBUFS") => {
      failure ??= code;
      child.kill("SIGTERM");
    };
    const collect = (stream: Readable | null) => {
      if (!stream) return null;
      const chunks: Buffer[] = [];
      let size = 0;
      stream.on("data", (chunk: Buffer) => {
        chunks.push(chunk);
        size += chunk.length;
        if (size > maxBuffer) stopWith("ENOBUFS");
      });
      return chunks;
    };
    const stdout = collect(child.stdout);
    const stderr = collect(child.stderr);
    child.stdin?.end();
    const timer = setTimeout(() => stopWith("ETIMEDOUT"), options.timeout);
    let stopping: Promise<unknown> | undefined;
    const onAbort = () => {
      if (child.pid === undefined) return;
      stopping ??= terminateProcessTree(child.pid, { child }).catch(() => undefined);
    };
    signal.addEventListener("abort", onAbort, { once: true });
    const settle = () => {
      clearTimeout(timer);
      signal.removeEventListener("abort", onAbort);
    };

    child.on("error", (err: NodeJS.ErrnoException) => {
      // A child that started still ends with "close"; wait for it, so a stop means it is gone.
      if (child.pid !== undefined) return;
      settle();
      const spawnError = syscallError(err.code ?? "UNKNOWN", file, args);
      const result = { status: null, signal: null, output: null, pid: 0 };
      reject(Object.assign(spawnError, { error: spawnError }, result));
    });
    child.on("close", (status, exitSignal) => {
      settle();
      if (signal.aborted) {
        void Promise.resolve(stopping).then(() => reject(signal.reason));
        return;
      }
      const out = stdout && Buffer.concat(stdout);
      const errText = stderr && Buffer.concat(stderr);
      const result = {
        status,
        signal: exitSignal,
        output: [null, out, errText],
        pid: child.pid,
        stdout: out,
        stderr: errText,
      };
      if (failure) {
        const err = syscallError(failure, file, args);
        return reject(Object.assign(err, { error: err }, result));
      }
      if (status === 0) return resolve();
      const command = `Command failed: ${[file, ...args].join(" ")}`;
      const message = errText?.length ? `${command}\n${errText.toString()}` : command;
      reject(Object.assign(new Error(message), result));
    });
  });
}
