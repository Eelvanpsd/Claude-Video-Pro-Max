import { afterEach, describe, expect, it, vi } from "vitest";
import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { runInNewContext } from "node:vm";
import { Window } from "happy-dom";
import type { Page } from "puppeteer-core";
import { downloadAndRewriteFonts } from "./assetDownloader.js";
import { extractHtml } from "./htmlExtractor.js";
import { publicRequest } from "./publicNetwork.js";

vi.mock("./publicNetwork.js", () => ({ publicRequest: vi.fn() }));

const FONT = readFileSync(
  new URL("../../../../docs/public/catalog/assets/a634cb9e7783af7e.woff2", import.meta.url),
);

function fakePage(window: Window): Page {
  const evaluate = async (script: unknown, ...args: unknown[]) => {
    const expression = typeof script === "function" ? `(${script.toString()})(...args)` : script;
    if (typeof expression !== "string") throw new Error("Expected a page expression");
    return runInNewContext(expression, {
      args,
      window,
      document: window.document,
      location: window.location,
      URL,
    });
  };
  const addStyleTag = async ({ content }: { content: string }) => {
    const style = window.document.createElement("style");
    style.textContent = content;
    window.document.head.append(style);
  };
  return { evaluate, addStyleTag, url: () => window.location.href } as unknown as Page;
}

afterEach(() => {
  vi.mocked(publicRequest).mockReset();
});

describe("extractHtml", () => {
  it("keeps a font the page declares in its own <style> with a relative url", async () => {
    const window = new Window({ url: "https://brand.example/pricing/" });
    window.document.head.innerHTML =
      '<style>@font-face{font-family:"Display";src:url("/fonts/Display-Medium.woff2") format("woff2")}' +
      ".glow{filter:url(#glow)}</style>";
    const dir = mkdtempSync(join(tmpdir(), "hf-inline-font-"));
    try {
      const extracted = await extractHtml(fakePage(window), { settleTime: 0 });
      expect(extracted.headHtml).toContain("url(#glow)");

      const fetched: string[] = [];
      vi.mocked(publicRequest).mockImplementation(async (url) => {
        fetched.push(String(url));
        return new Response(new Uint8Array(FONT));
      });
      const fonts = await downloadAndRewriteFonts(extracted.headHtml, dir);
      expect(fetched).toEqual(["https://brand.example/fonts/Display-Medium.woff2"]);
      expect(fonts.css).toContain("assets/fonts/Display-Medium.woff2");
      expect(readFileSync(join(dir, "assets/fonts/Display-Medium.woff2"))).toEqual(FONT);
    } finally {
      rmSync(dir, { recursive: true, force: true });
      await window.happyDOM.close();
    }
  });
});

it("fetches Node stylesheets through validated redirects and refuses metadata redirects", async () => {
  const window = new Window({ url: "https://brand.example/" });
  window.document.head.innerHTML =
    '<link rel="stylesheet" href="https://cdn.example/start.css">' +
    '<link rel="stylesheet" href="https://cdn.example/private.css">';
  const canceled = vi.fn();
  vi.mocked(publicRequest).mockImplementation(async (url) => {
    if (String(url).endsWith("start.css"))
      return new Response(null, {
        status: 302,
        headers: { location: "https://styles.example/final.css" },
      });
    if (String(url).endsWith("private.css"))
      return new Response(new ReadableStream({ cancel: canceled }), {
        status: 302,
        headers: { location: "http://169.254.169.254/metadata" },
      });
    if (String(url) === "https://styles.example/final.css")
      return new Response("body{color:purple}");
    throw new Error(`Unexpected request: ${url}`);
  });
  try {
    const html = await extractHtml(fakePage(window), { settleTime: 0 });
    expect(html.headHtml).toContain("body{color:purple}");
    expect(window.document.querySelector('link[href$="start.css"]')).toBeNull();
    expect(window.document.querySelector('link[href$="private.css"]')).not.toBeNull();
    expect(vi.mocked(publicRequest).mock.calls.map(([url]) => String(url))).toEqual([
      "https://cdn.example/start.css",
      "https://styles.example/final.css",
      "https://cdn.example/private.css",
    ]);
    expect(canceled).toHaveBeenCalledOnce();
  } finally {
    await window.happyDOM.close();
  }
});
