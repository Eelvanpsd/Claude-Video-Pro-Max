import type { Server } from "node:http";

export function closeServer(server: Server): Promise<void> {
  const closed = new Promise<void>((done) => server.close(() => done()));
  server.closeAllConnections();
  server.removeAllListeners("request");
  return closed;
}
