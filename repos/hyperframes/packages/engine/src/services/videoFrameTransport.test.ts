import { EventEmitter } from "node:events";
import { describe, expect, it, vi } from "vitest";
import { type Page } from "puppeteer-core";
import { withVideoFrameSources, type VideoFrameUpdate } from "./videoFrameTransport.js";

const update = { videoId: "clip", dataUri: "data:image/png;base64,AAAA" };

function fixture() {
  const events = new EventEmitter();
  const send = vi.fn(async (_method: string, _params: unknown) => ({}));
  const detach = vi.fn(async () => {});
  const close = new EventEmitter();
  const createCDPSession = vi.fn(async () => ({ on: events.on.bind(events), send, detach }));
  // The transport only needs these Page methods; no browser protocol is simulated elsewhere.
  const page = {
    url: () => "http://localhost:4000/index.html",
    createCDPSession,
    once: close.once.bind(close),
  } as unknown as Page;
  const request = async (url: string) => {
    events.emit("Fetch.requestPaused", { requestId: "request", request: { url } });
    await new Promise<void>((resolve) => setImmediate(resolve));
    return send.mock.calls.findLast(([method]) => method === "Fetch.fulfillRequest")?.[1];
  };
  return { page, send, detach, createCDPSession, close, request };
}

describe("video frame transport ownership", () => {
  it.each(["/frames/0001.png", "data:frame-test", "data:image/png,not-base64"])(
    "does not intercept an unsupported source %s",
    async (dataUri) => {
      const f = fixture();
      const updates = [{ videoId: "clip", dataUri }];
      expect(await withVideoFrameSources(f.page, updates, async (resolved) => resolved)).toBe(
        updates,
      );
      expect(f.createCDPSession).not.toHaveBeenCalled();
    },
  );

  it("releases success, failure and skipped batches without retaining response bytes", async () => {
    const f = fixture();
    for (const failure of [false, true]) {
      let url = "";
      const result = withVideoFrameSources(f.page, [update], async (resolved) => {
        url = resolved[0]?.dataUri ?? "";
        expect(await f.request(url)).toMatchObject({ responseCode: 200, body: "AAAA" });
        if (failure) throw new Error("decode failed");
        return ["clip"];
      });
      if (failure) await expect(result).rejects.toThrow("decode failed");
      else await expect(result).resolves.toEqual(["clip"]);
      expect(await f.request(url)).toMatchObject({ responseCode: 404, body: "" });
    }
    let skipped = "";
    await withVideoFrameSources(f.page, [update], async (resolved) => {
      skipped = resolved[0]?.dataUri ?? "";
      return [];
    });
    expect(await f.request(skipped)).toMatchObject({ responseCode: 404, body: "" });
    expect(f.createCDPSession).toHaveBeenCalledTimes(1);
  });

  it("keeps overlapping batches isolated and initializes the page only once", async () => {
    const f = fixture();
    let finish: () => void = () => {};
    const hold = new Promise<void>((resolve) => {
      finish = resolve;
    });
    let first: VideoFrameUpdate[] = [];
    const pending = withVideoFrameSources(f.page, [update], async (resolved) => {
      first = resolved;
      await hold;
    });
    await withVideoFrameSources(f.page, [update], async (resolved) => {
      expect(resolved[0]?.dataUri).not.toBe(first[0]?.dataUri);
      expect(await f.request(resolved[0]?.dataUri ?? "")).toMatchObject({ responseCode: 200 });
    });
    expect(await f.request(first[0]?.dataUri ?? "")).toMatchObject({ responseCode: 200 });
    finish();
    await pending;
    expect(await f.request(first[0]?.dataUri ?? "")).toMatchObject({ responseCode: 404 });
    expect(f.createCDPSession).toHaveBeenCalledTimes(1);
  });

  it("unblocks a failed protocol response and surfaces its cause", async () => {
    const f = fixture();
    const error = new Error("protocol response failed");
    f.send.mockImplementation(async (method) => {
      if (method === "Fetch.fulfillRequest") throw error;
      return {};
    });
    await expect(
      withVideoFrameSources(f.page, [update], async (resolved) => {
        await f.request(resolved[0]?.dataUri ?? "");
        throw new Error("image decode failed");
      }),
    ).rejects.toBe(error);
    expect(f.send).toHaveBeenCalledWith("Fetch.failRequest", {
      requestId: "request",
      errorReason: "Failed",
    });
  });

  it("detaches failed initialization and permits a retry", async () => {
    const f = fixture();
    f.send.mockRejectedValueOnce(new Error("cannot intercept"));
    await expect(withVideoFrameSources(f.page, [update], async () => {})).rejects.toThrow(
      "cannot intercept",
    );
    expect(f.detach).toHaveBeenCalledTimes(1);
    await withVideoFrameSources(f.page, [update], async () => {});
    expect(f.createCDPSession).toHaveBeenCalledTimes(2);
  });
});
