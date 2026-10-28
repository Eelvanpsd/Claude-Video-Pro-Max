import { createServer } from "node:http";
import { connect, type AddressInfo, type Socket } from "node:net";
import { expect, it } from "vitest";
import { closeServer } from "../src/pageServer";

it("closes while a client holds a connection it never sent a request on, as Chrome's preconnects do", async () => {
  const server = createServer((_req, res) => res.end("ok"));
  await new Promise<void>((done) => server.listen(0, "127.0.0.1", done));
  const { port } = server.address() as AddressInfo;
  const preconnect: Socket = await new Promise((done) => {
    const socket = connect(port, "127.0.0.1", () => done(socket));
  });
  // Node's close() leaves a connection with no request yet open: it is not idle, so close() alone waits on it.
  const outcome = await Promise.race([
    closeServer(server).then(() => "closed"),
    new Promise((done) => setTimeout(() => done("still open"), 2000)),
  ]);
  preconnect.destroy();
  expect(outcome).toBe("closed");
});
