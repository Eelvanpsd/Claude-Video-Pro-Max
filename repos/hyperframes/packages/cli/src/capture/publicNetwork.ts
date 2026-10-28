import { lookup } from "node:dns/promises";
import { isIP } from "node:net";
import { request as httpRequest, type IncomingMessage, type ClientRequest } from "node:http";
import { request as httpsRequest } from "node:https";

function ipv4Number(address: string): number {
  return address.split(".").reduce((value, octet) => value * 256 + Number(octet), 0);
}

// Conservatively exclude special-use networks, including all of 192.0/16.
const NON_PUBLIC_IPV4: ReadonlyArray<readonly [string, number]> = [
  ["0.0.0.0", 8],
  ["10.0.0.0", 8],
  ["100.64.0.0", 10],
  ["127.0.0.0", 8],
  ["169.254.0.0", 16],
  ["172.16.0.0", 12],
  ["192.0.0.0", 16],
  ["192.88.99.0", 24],
  ["192.168.0.0", 16],
  ["198.18.0.0", 15],
  ["198.51.100.0", 24],
  ["203.0.113.0", 24],
  ["224.0.0.0", 3],
];
const NON_PUBLIC_RANGES = NON_PUBLIC_IPV4.map(([network, prefix]) => ({
  start: ipv4Number(network),
  end: ipv4Number(network) + 2 ** (32 - prefix),
}));

/** Conservative IPv4-only policy: special-use addresses fail closed. */
export function isPublicIPv4(address: string): boolean {
  if (isIP(address) !== 4) return false;
  const value = ipv4Number(address);
  return !NON_PUBLIC_RANGES.some(({ start, end }) => value >= start && value < end);
}

/** Validate every A answer, then return a numeric peer that callers must dial directly. */
export async function resolvePublicAddress(hostname: string): Promise<string> {
  const host = hostname.toLowerCase().replace(/\.$/, "");
  if (isIP(host) === 4) {
    if (!isPublicIPv4(host)) throw new Error("Capture requires a public IPv4 address");
    return host;
  }
  if (
    !host.includes(".") ||
    !/^[a-z0-9.-]+$/.test(host) ||
    /(?:^|\.)(?:localhost|local|internal|home|lan|test|invalid|example)$/.test(host) ||
    host.split(".").some((label) => !label || label.startsWith("-") || label.endsWith("-"))
  ) {
    throw new Error("Capture requires a public hostname");
  }
  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    const answers = await Promise.race([
      lookup(host, { all: true, family: 4, verbatim: true }),
      new Promise<never>((_resolve, reject) => {
        timer = setTimeout(() => reject(new Error("Capture DNS timed out")), 10_000);
        timer.unref();
      }),
    ]);
    if (
      !answers[0] ||
      answers.some((answer) => answer.family !== 4 || !isPublicIPv4(answer.address))
    ) {
      throw new Error("Capture DNS returned a non-public address");
    }
    const first = answers[0];
    if (!first) throw new Error("Capture DNS returned no address");
    return first.address;
  } finally {
    clearTimeout(timer);
  }
}

/** Pinned asset transport; redirects are returned for caller validation. */
export async function publicRequest(url: string | URL, init: RequestInit = {}): Promise<Response> {
  const target = new URL(url);
  if (!["http:", "https:"].includes(target.protocol) || target.username || target.password) {
    throw new Error("Capture requires an HTTP(S) URL without credentials");
  }
  const method = (init.method ?? "GET").toUpperCase();
  if (!["GET", "HEAD"].includes(method) || init.body != null) {
    throw new Error("Capture asset requests support only GET and HEAD without a body");
  }
  // Video callers budget the entire body transfer; a default must not shorten it.
  const signal = init.signal ?? AbortSignal.timeout(30_000);
  signal.throwIfAborted();
  const address = await new Promise<string>((resolve, reject) => {
    const onAbort = () => reject(signal.reason);
    signal.addEventListener("abort", onAbort, { once: true });
    resolvePublicAddress(target.hostname)
      .then(resolve, reject)
      .finally(() => signal.removeEventListener("abort", onAbort));
  });
  signal.throwIfAborted();
  const headers = new Headers(init.headers);
  for (const name of [
    "connection",
    "proxy-authorization",
    "proxy-connection",
    "transfer-encoding",
    "upgrade",
    "content-length",
  ])
    headers.delete(name);
  headers.set("host", target.host);
  headers.set("accept-encoding", "identity");
  return new Promise<Response>((resolve, reject) => {
    const request = target.protocol === "https:" ? httpsRequest : httpRequest;
    const req = request(
      {
        protocol: target.protocol,
        hostname: address,
        port: target.port || undefined,
        path: `${target.pathname}${target.search}`,
        method,
        headers: Object.fromEntries(headers),
        agent: false,
        servername: target.hostname,
        rejectUnauthorized: true,
        signal,
      },
      (incoming) => {
        try {
          resolve(assetResponse(incoming, req, method));
        } catch (error) {
          incoming.destroy();
          reject(error);
        }
      },
    );
    req.once("error", reject);
    req.end();
  });
}

function responseHeaders(incoming: IncomingMessage): Headers {
  const headers = new Headers();
  for (const [name, value] of Object.entries(incoming.headers)) {
    if (value === undefined) continue;
    for (const item of Array.isArray(value) ? value : [value]) headers.append(name, item);
  }
  return headers;
}

function assetResponse(incoming: IncomingMessage, req: ClientRequest, method: string): Response {
  // Even discarded/null bodies can emit errors during socket teardown.
  incoming.on("error", () => {});
  const headers = responseHeaders(incoming);
  const encoding = headers.get("content-encoding")?.toLowerCase();
  if (encoding && encoding !== "identity") {
    throw new Error("Capture server ignored identity content encoding");
  }
  const status = incoming.statusCode ?? 502;
  if (method === "HEAD" || [204, 205, 304].includes(status)) {
    incoming.resume();
    return new Response(null, { status, headers });
  }
  return new Response(responseBody(incoming, req), { status, headers });
}

function responseBody(incoming: IncomingMessage, req: ClientRequest): ReadableStream<Uint8Array> {
  let finished = false;
  return new ReadableStream<Uint8Array>({
    start(controller) {
      incoming.on("data", (chunk: Buffer) => {
        if (finished) return;
        controller.enqueue(chunk);
        incoming.pause();
      });
      incoming.once("end", () => {
        if (finished) return;
        finished = true;
        controller.close();
      });
      const fail = (error: Error) => {
        if (finished) return;
        finished = true;
        controller.error(error);
      };
      incoming.once("error", fail);
      incoming.once("aborted", () => fail(new Error("Capture response aborted")));
      incoming.pause();
    },
    pull() {
      incoming.resume();
    },
    cancel() {
      finished = true;
      incoming.destroy();
      req.destroy();
    },
  });
}
