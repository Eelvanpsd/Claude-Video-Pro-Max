import type { RenderJob } from "@hyperframes/producer";
import { audioFailureDiagnostics } from "@hyperframes/engine";

/** Versioned, content-free failure line for Desktop's piped CLI, separate from human error output. */
export function renderMachineDiagnostic(values: readonly unknown[]): void {
  if (process.stdout.isTTY || process.env.HYPERFRAMES_STDOUT_IS_TTY === "1") return;
  const failures = audioFailureDiagnostics(values);
  if (failures.length === 0) return;
  process.stdout.write(
    `@hf-diagnostic ${JSON.stringify({ version: 1, operation: "render", audioFailures: failures })}\n`,
  );
}

export function renderFailureDiagnostic(
  job: RenderJob | undefined,
  error: unknown,
  quiet: boolean,
): void {
  if (quiet) return;
  const interruptedFailures =
    error !== null &&
    typeof error === "object" &&
    "audioFailures" in error &&
    Array.isArray(error.audioFailures)
      ? error.audioFailures
      : [];
  renderMachineDiagnostic([
    ...interruptedFailures,
    ...(job?.warnings.flatMap((warning) => warning.details?.audioFailures ?? []) ?? []),
  ]);
}
