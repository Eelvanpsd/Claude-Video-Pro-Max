import { execFileSync } from "node:child_process";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import {
  createServer,
  type IncomingMessage,
  type RequestOptions,
  type ServerResponse,
} from "node:http";
import { createServer as createHttpsServer, type RequestOptions as HttpsOptions } from "node:https";
import { createServer as createTcpServer, type Socket } from "node:net";
import { tmpdir } from "node:os";
import { join } from "node:path";
import type { TLSSocket } from "node:tls";
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

const transport = vi.hoisted(() => ({
  lookup: vi.fn(),
  dials: [] as HttpsOptions[],
  certificate: "",
  trustCertificate: true,
}));

vi.mock("node:dns/promises", () => ({ lookup: transport.lookup }));

// Only the already-checked numeric peer is mapped to an isolated loopback server.
// The real Node HTTP/TLS transport, headers and certificate checks remain active.
vi.mock("node:http", async (importOriginal) => {
  const original = await importOriginal<typeof import("node:http")>();
  return {
    ...original,
    request(options: RequestOptions, callback: (response: IncomingMessage) => void) {
      if (options.hostname !== "93.184.216.34") throw new Error("Unexpected fixture peer");
      transport.dials.push(options);
      return original.request({ ...options, hostname: "127.0.0.1" }, callback);
    },
  };
});

vi.mock("node:https", async (importOriginal) => {
  const original = await importOriginal<typeof import("node:https")>();
  return {
    ...original,
    request(options: HttpsOptions, callback: (response: IncomingMessage) => void) {
      if (options.hostname !== "93.184.216.34") throw new Error("Unexpected fixture peer");
      transport.dials.push(options);
      return original.request(
        {
          ...options,
          hostname: "127.0.0.1",
          ca: transport.trustCertificate ? transport.certificate : undefined,
        },
        callback,
      );
    },
  };
});

import { publicRequest } from "./publicNetwork.js";

type RequestReceipt = {
  host: string | undefined;
  path: string | undefined;
  servername: string | undefined;
};
const receipts: RequestReceipt[] = [];
const sockets = new Set<Socket>();
const streams = new Set<ServerResponse>();
let fixtureDirectory: string;
let httpPort: number;
let httpsPort: number;
let malformedPort: number;

function handleRequest(request: IncomingMessage, response: ServerResponse) {
  const servername = (request.socket as TLSSocket).servername;
  receipts.push({
    host: request.headers.host,
    path: request.url,
    servername: typeof servername === "string" ? servername : undefined,
  });
  if (request.url === "/slow-transfer") {
    streams.add(response);
    response.writeHead(200, { "content-type": "video/mp4", "content-length": 35 * 1024 * 1024 });
    response.flushHeaders();
    let remaining = 35;
    const interval = setInterval(() => {
      response.write(Buffer.alloc(1024 * 1024));
      if (--remaining === 0) response.end();
    }, 1000);
    response.once("close", () => {
      clearInterval(interval);
      streams.delete(response);
    });
    return;
  }
  if (request.url === "/stream") {
    streams.add(response);
    response.writeHead(200, { "content-type": "application/octet-stream" });
    response.write("first chunk");
    const interval = setInterval(() => response.write("next chunk"), 10);
    response.once("close", () => {
      clearInterval(interval);
      streams.delete(response);
    });
    return;
  }
  response.end("fixture response");
}

const httpServer = createServer(handleRequest);
const httpsServer = createHttpsServer({}, handleRequest);
const malformedServer = createTcpServer((socket) => socket.end("not a TLS handshake\r\n"));
const servers = [httpServer, httpsServer, malformedServer];

async function listen(server: (typeof servers)[number]): Promise<number> {
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
  const address = server.address();
  if (!address || typeof address === "string") throw new Error("Missing fixture port");
  return address.port;
}

async function waitForStreamClose() {
  const deadline = Date.now() + 2000;
  while (streams.size && Date.now() < deadline) {
    await new Promise((resolve) => setTimeout(resolve, 10));
  }
  expect(streams.size).toBe(0);
}

describe("publicRequest controlled socket integration", () => {
  beforeAll(async () => {
    fixtureDirectory = await mkdtemp(join(tmpdir(), "capture-public-network-"));
    const key = join(fixtureDirectory, "key.pem");
    const certificate = join(fixtureDirectory, "certificate.pem");
    execFileSync(
      "openssl",
      [
        "req",
        "-x509",
        "-newkey",
        "rsa:2048",
        "-nodes",
        "-keyout",
        key,
        "-out",
        certificate,
        "-days",
        "1",
        "-subj",
        "/CN=assets.capture-fixture.com",
        "-addext",
        "subjectAltName=DNS:assets.capture-fixture.com",
      ],
      { stdio: "pipe" },
    );
    transport.certificate = await readFile(certificate, "utf8");
    httpsServer.setSecureContext({ key: await readFile(key), cert: transport.certificate });
    httpsServer.on("tlsClientError", () => {});
    for (const server of servers) {
      server.on("connection", (socket) => {
        sockets.add(socket);
        socket.once("close", () => sockets.delete(socket));
      });
    }
    [httpPort, httpsPort, malformedPort] = await Promise.all([
      listen(httpServer),
      listen(httpsServer),
      listen(malformedServer),
    ]);
  });

  beforeEach(() => {
    receipts.length = 0;
    transport.dials.length = 0;
    transport.trustCertificate = true;
    transport.lookup.mockReset();
    transport.lookup.mockResolvedValue([{ address: "127.0.0.1", family: 4 }]);
    transport.lookup.mockResolvedValueOnce([{ address: "93.184.216.34", family: 4 }]);
  });

  afterAll(async () => {
    for (const socket of sockets) socket.destroy();
    await Promise.all(
      servers.map(
        (server) =>
          new Promise<void>((resolve, reject) => {
            server.close((error) => (error ? reject(error) : resolve()));
          }),
      ),
    );
    await rm(fixtureDirectory, { recursive: true, force: true });
  });

  it("pins the checked address without a second DNS lookup and preserves HTTP Host/path", async () => {
    const response = await publicRequest(`http://assets.capture-fixture.com:${httpPort}/asset?q=1`);
    expect(await response.text()).toBe("fixture response");
    expect(transport.lookup).toHaveBeenCalledTimes(1);
    expect(transport.lookup).toHaveBeenCalledWith("assets.capture-fixture.com", {
      all: true,
      family: 4,
      verbatim: true,
    });
    expect(transport.dials).toHaveLength(1);
    expect(transport.dials[0]?.hostname).toBe("93.184.216.34");
    expect(receipts).toEqual([
      {
        host: `assets.capture-fixture.com:${httpPort}`,
        path: "/asset?q=1",
        servername: undefined,
      },
    ]);
  });

  it("preserves HTTPS Host and SNI while verifying the trusted fixture certificate", async () => {
    const response = await publicRequest(`https://assets.capture-fixture.com:${httpsPort}/secure`);
    expect(await response.text()).toBe("fixture response");
    expect(transport.dials[0]).toMatchObject({
      hostname: "93.184.216.34",
      servername: "assets.capture-fixture.com",
      rejectUnauthorized: true,
    });
    expect(receipts).toEqual([
      {
        host: `assets.capture-fixture.com:${httpsPort}`,
        path: "/secure",
        servername: "assets.capture-fixture.com",
      },
    ]);
  });

  it("rejects an untrusted certificate before any HTTP request reaches the target", async () => {
    transport.trustCertificate = false;
    await expect(
      publicRequest(`https://assets.capture-fixture.com:${httpsPort}/secure`),
    ).rejects.toThrow(/self.signed|certificate/i);
    expect(transport.dials[0]?.rejectUnauthorized).toBe(true);
    expect(receipts).toHaveLength(0);
  });

  it("rejects a trusted certificate with the wrong hostname", async () => {
    await expect(
      publicRequest(`https://other.capture-fixture.com:${httpsPort}/secure`),
    ).rejects.toThrow(/hostname|altnames|certificate/i);
    expect(transport.dials[0]).toMatchObject({
      servername: "other.capture-fixture.com",
      rejectUnauthorized: true,
    });
    expect(receipts).toHaveLength(0);
  });

  it("rejects a malformed TLS handshake", async () => {
    await expect(
      publicRequest(`https://assets.capture-fixture.com:${malformedPort}/secure`),
    ).rejects.toThrow(/ssl|tls|version|record/i);
    expect(receipts).toHaveLength(0);
  });

  it("rejects private DNS answers before dialing or reaching a target", async () => {
    transport.lookup.mockReset().mockResolvedValue([{ address: "127.0.0.1", family: 4 }]);
    await expect(
      publicRequest(`http://assets.capture-fixture.com:${httpPort}/asset`),
    ).rejects.toThrow(/non-public/);
    expect(transport.dials).toHaveLength(0);
    expect(receipts).toHaveLength(0);
  });

  it("cancels a real streaming response without uncaught teardown errors", async () => {
    const response = await publicRequest(`http://assets.capture-fixture.com:${httpPort}/stream`);
    const reader = response.body?.getReader();
    if (!reader) throw new Error("Missing fixture stream");
    expect((await reader.read()).value?.byteLength).toBeGreaterThan(0);
    await reader.cancel();
    await waitForStreamClose();
    expect(receipts).toHaveLength(1);
  });

  it("finishes a 35-second HTTPS body within the caller's 120-second deadline", async () => {
    const response = await publicRequest(
      `https://assets.capture-fixture.com:${httpsPort}/slow-transfer`,
      { signal: AbortSignal.timeout(120_000) },
    );
    expect((await response.arrayBuffer()).byteLength).toBe(35 * 1024 * 1024);
    await waitForStreamClose();
  }, 60_000);

  it.each([true, false])(
    "uses the caller deadline when supplied, otherwise the default (%s)",
    async (explicitDeadline) => {
      const deadline = new AbortController();
      const caller = new AbortController();
      const timeout = vi.spyOn(AbortSignal, "timeout").mockReturnValue(deadline.signal);
      let reader: ReadableStreamDefaultReader<Uint8Array> | undefined;
      try {
        const response = await publicRequest(
          `https://assets.capture-fixture.com:${httpsPort}/stream`,
          explicitDeadline ? { signal: caller.signal } : {},
        );
        reader = response.body!.getReader();
        await reader.read();
        // Advance only the transport's default deadline; real TLS/body I/O stays active.
        deadline.abort(new Error("default deadline reached"));
        if (explicitDeadline) {
          expect((await reader.read()).value?.byteLength).toBeGreaterThan(0);
          caller.abort();
          await expect(reader.read()).rejects.toThrow();
        } else {
          await expect(reader.read()).rejects.toThrow();
        }
      } finally {
        timeout.mockRestore();
        await reader?.cancel().catch(() => {});
        await waitForStreamClose();
      }
    },
  );

  it("propagates caller abort after HTTPS response headers and closes the socket", async () => {
    const controller = new AbortController();
    const response = await publicRequest(`https://assets.capture-fixture.com:${httpsPort}/stream`, {
      signal: controller.signal,
    });
    const reader = response.body?.getReader();
    if (!reader) throw new Error("Missing fixture stream");
    await reader.read();
    controller.abort();
    await expect(reader.read()).rejects.toThrow();
    await waitForStreamClose();
  });
});
