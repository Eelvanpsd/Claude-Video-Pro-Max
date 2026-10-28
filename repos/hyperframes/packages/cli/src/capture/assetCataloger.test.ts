import { afterEach, describe, expect, it, vi } from "vitest";
import { publicRequest } from "./publicNetwork.js";

vi.mock("./publicNetwork.js", () => ({ publicRequest: vi.fn() }));
afterEach(() => vi.mocked(publicRequest).mockReset());
import { annotateGifAssetMetadata, type CatalogedAsset } from "./assetCataloger.js";

function u16(value: number): number[] {
  return [value & 0xff, (value >> 8) & 0xff];
}

function ascii(value: string): number[] {
  return Array.from(value).map((char) => char.charCodeAt(0));
}

function frame(delayCentiseconds: number): number[] {
  return [
    0x21,
    0xf9,
    0x04,
    0x00,
    ...u16(delayCentiseconds),
    0x00,
    0x00,
    0x2c,
    0x00,
    0x00,
    0x00,
    0x00,
    0x01,
    0x00,
    0x01,
    0x00,
    0x00,
    0x02,
    0x02,
    0x4c,
    0x01,
    0x00,
  ];
}

function gif(frames: number[], loopCount?: number): Uint8Array {
  const loop =
    loopCount === undefined
      ? []
      : [0x21, 0xff, 0x0b, ...ascii("NETSCAPE2.0"), 0x03, 0x01, ...u16(loopCount), 0x00];
  return Uint8Array.from([
    ...ascii("GIF89a"),
    ...u16(1),
    ...u16(1),
    0x00,
    0x00,
    0x00,
    ...loop,
    ...frames,
    0x3b,
  ]);
}

describe("annotateGifAssetMetadata", () => {
  it("adds frame, duration, and loop notes for animated GIF assets", async () => {
    const assets: CatalogedAsset[] = [
      {
        url: "https://cdn.example.com/reaction.gif?v=1",
        type: "Image",
        contexts: ["img[src]"],
        notes: "reaction",
      },
      {
        url: "https://cdn.example.com/logo.png",
        type: "Image",
        contexts: ["img[src]"],
      },
    ];
    const readUrls: string[] = [];

    const annotated = await annotateGifAssetMetadata(assets, async (url) => {
      readUrls.push(url);
      return gif([...frame(5), ...frame(15)], 0);
    });

    expect(readUrls).toEqual(["https://cdn.example.com/reaction.gif?v=1"]);
    expect(annotated[0]?.notes).toBe("reaction; animated GIF: 2 frames, 0.200s, loops forever");
    expect(annotated[1]?.notes).toBeUndefined();
  });

  it("marks single-frame GIF assets without changing non-GIF assets", async () => {
    const assets: CatalogedAsset[] = [
      {
        url: "https://cdn.example.com/still.gif",
        type: "Image",
        contexts: ["img[src]"],
      },
      {
        url: "https://cdn.example.com/hero.webp",
        type: "Image",
        contexts: ["img[src]"],
        notes: "hero",
      },
    ];

    const annotated = await annotateGifAssetMetadata(assets, async () => gif(frame(10)));

    expect(annotated[0]?.notes).toBe("single-frame GIF");
    expect(annotated[1]?.notes).toBe("hero");
  });
});

it("uses safe redirects for GIF metadata and never follows a private redirect", async () => {
  const assets: CatalogedAsset[] = [
    { url: "https://cdn.example/animated.gif", type: "Image", contexts: ["img[src]"] },
    { url: "https://cdn.example/private.gif", type: "Image", contexts: ["img[src]"] },
  ];
  const canceled = vi.fn();
  vi.mocked(publicRequest).mockImplementation(async (url) => {
    if (String(url).endsWith("animated.gif"))
      return new Response(null, {
        status: 302,
        headers: { location: "https://images.example/final.gif" },
      });
    if (String(url).endsWith("private.gif"))
      return new Response(new ReadableStream({ cancel: canceled }), {
        status: 302,
        headers: { location: "http://127.0.0.1/private.gif" },
      });
    if (String(url) === "https://images.example/final.gif")
      return new Response(new Uint8Array(gif([...frame(5), ...frame(15)], 0)));
    throw new Error(`Unexpected request: ${url}`);
  });
  const annotated = await annotateGifAssetMetadata(assets);
  expect(annotated[0]?.notes).toBe("animated GIF: 2 frames, 0.200s, loops forever");
  expect(annotated[1]?.notes).toBeUndefined();
  expect(
    vi
      .mocked(publicRequest)
      .mock.calls.map(([url]) => String(url))
      .sort(),
  ).toEqual([
    "https://cdn.example/animated.gif",
    "https://cdn.example/private.gif",
    "https://images.example/final.gif",
  ]);
  expect(canceled).toHaveBeenCalledOnce();
});
