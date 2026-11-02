import { createServer } from 'node:net';

/** Check bind permissions without leaving a listener behind. */
function probePort(port: number): Promise<void> {
  return new Promise((resolve, reject) => {
    const server = createServer();
    server.once('error', reject);
    server.listen({ host: '127.0.0.1', port, exclusive: true }, () => {
      server.close((error) => {
        if (error) reject(error);
        else resolve();
      });
    });
  });
}

/** Reserved Windows ports can deny bind even though no process is listening.
 * Preserve ordinary port-conflict/attachment handling; only bypass denied ports.
 * This is a preflight, not a reservation: uvicorn still handles bind-time races.
 */
export async function availableBackendPort(
  preferred: number,
  isBackend: (port: number) => Promise<boolean> = async () => false,
): Promise<number> {
  // Deterministic candidates let additional Electron instances discover the
  // same backend. Keep occupied VoiceStudio candidates for attachment/handoff,
  // but skip unrelated listeners on fallback ports.
  let denied: unknown;
  for (let offset = 0; offset <= 16; offset++) {
    const port = preferred + offset * 1000;
    if (port > 65535) break;
    try {
      await probePort(port);
      return port;
    } catch (error) {
      const code = (error as NodeJS.ErrnoException).code;
      if (code === 'EADDRINUSE') {
        if (offset === 0 || (await isBackend(port))) return port;
        denied = error;
        continue;
      }
      if (code !== 'EACCES') throw error;
      denied = error;
    }
  }
  throw denied;
}
