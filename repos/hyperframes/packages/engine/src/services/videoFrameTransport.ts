import { randomUUID } from "node:crypto";
import { type CDPSession, type Page } from "puppeteer-core";

export interface VideoFrameUpdate {
  videoId: string;
  dataUri: string;
  crossOrigin?: "anonymous";
  sourceLabel?: string;
}

interface FrameResponse {
  body: string;
  contentType: string;
  error?: unknown;
}

interface FrameTransport {
  prefix: string;
  nextId: number;
  responses: Map<string, FrameResponse>;
}

const base64ImagePrefix = /^data:(image\/[\w.+-]+);base64,/;
const transports = new WeakMap<Page, Promise<FrameTransport>>();

async function createTransport(page: Page): Promise<FrameTransport> {
  const pageUrl = new URL(page.url());
  const origin = /^https?:$/.test(pageUrl.protocol)
    ? pageUrl.origin
    : "https://hyperframes-render.invalid";
  const prefix = `${origin}/__hyperframes_video_frames__/${randomUUID()}/`;
  const responses = new Map<string, FrameResponse>();
  const client = await page.createCDPSession();
  client.on("Fetch.requestPaused", (event) => {
    const frame = responses.get(event.request.url);
    void fulfillFrame(client, event.requestId, frame);
  });
  try {
    await client.send("Fetch.enable", {
      patterns: [{ urlPattern: `${prefix}*`, requestStage: "Request" }],
    });
  } catch (error) {
    await client.detach().catch(() => {});
    throw error;
  }
  page.once("close", () => responses.clear());
  return { prefix, nextId: 0, responses };
}

async function fulfillFrame(
  client: CDPSession,
  requestId: string,
  frame: FrameResponse | undefined,
): Promise<void> {
  try {
    await client.send("Fetch.fulfillRequest", {
      requestId,
      responseCode: frame ? 200 : 404,
      responseHeaders: [
        { name: "Content-Type", value: frame?.contentType ?? "text/plain" },
        { name: "Cache-Control", value: "no-store" },
        { name: "Access-Control-Allow-Origin", value: "*" },
      ],
      body: frame?.body ?? "",
    });
  } catch (error) {
    if (frame) frame.error = error;
    // A failed protocol response must unblock img.decode, including on page closure.
    await client.send("Fetch.failRequest", { requestId, errorReason: "Failed" }).catch(() => {});
  }
}

/**
 * Inline image URLs outlive the Node LRU in Chrome's resource cache. Deliver
 * their bytes as no-store responses over CDP instead: the page sees short URLs,
 * and frame requests never wait for the source videos' HTTP connections.
 */
export async function withVideoFrameSources<T>(
  page: Page,
  updates: VideoFrameUpdate[],
  inject: (resolved: VideoFrameUpdate[]) => Promise<T>,
): Promise<T> {
  if (!updates.some((update) => base64ImagePrefix.test(update.dataUri))) return inject(updates);
  let pending = transports.get(page);
  if (!pending) {
    pending = createTransport(page);
    transports.set(page, pending);
  }
  let transport: FrameTransport;
  try {
    transport = await pending;
  } catch (error) {
    transports.delete(page);
    throw error;
  }
  const registered: Array<{ url: string; frame: FrameResponse }> = [];
  try {
    const resolved = updates.map((update) => {
      const match = base64ImagePrefix.exec(update.dataUri);
      if (!match) return update;
      const frame = {
        contentType: match[1] ?? "image/png",
        body: update.dataUri.slice(match[0].length),
      };
      const url = `${transport.prefix}${transport.nextId++}`;
      transport.responses.set(url, frame);
      registered.push({ url, frame });
      return {
        ...update,
        dataUri: url,
        crossOrigin: "anonymous" as const,
        sourceLabel: "inline frame",
      };
    });
    return await inject(resolved);
  } catch (error) {
    throw registered.find(({ frame }) => frame.error !== undefined)?.frame.error ?? error;
  } finally {
    for (const { url } of registered) transport.responses.delete(url);
  }
}
