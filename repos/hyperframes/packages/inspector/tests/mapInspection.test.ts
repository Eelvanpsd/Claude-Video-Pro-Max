import { describe, it, expect } from "vitest";
import { mkdtempSync, writeFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { mapInspection } from "../src/mapInspection";
import { Sources } from "../src/sources";
import type { ElementRef, RuntimeResponse, Snippet } from "../src/types";

const element = (n: number): ElementRef => ({
  ref: `hfi:g:${n}`,
  tag: "i",
  id: "",
  hfId: null,
  classes: ["w-dot"],
  composition: "s03-weeks",
});

function project(css: string) {
  const dir = mkdtempSync(join(tmpdir(), "inspect-map-"));
  writeFileSync(
    join(dir, "index.html"),
    `<html><head><style>\n${css}\n</style></head><body></body></html>`,
  );
  return dir;
}

function inspect(dir: string, candidates: number, request: Parameters<typeof mapInspection>[1]) {
  const sources = new Sources(dir);
  const raw: RuntimeResponse = {
    results: [
      {
        target: { selector: ".w-dot" },
        status: "found",
        candidates: Array.from({ length: candidates }, (_, n) => element(n)),
        animations: [],
        elements: [],
        css: sources.cssRules.map((rule) => rule.id),
        truncated: false,
      },
    ],
    recorded: 0,
    recordLimitReached: false,
    hooked: true,
  };
  return mapInspection(raw, request, {
    sources,
    map: () => [],
    catalog: new Map<string, Snippet>(),
    generation: "g",
    sourceVersion: "v",
    reused: false,
    start: performance.now(),
  });
}

describe("components report budget", () => {
  it("never answers a page that fits no snippet with a continuation to that same page", () => {
    const big = `.big{${"color:red;".repeat(300)}}`;
    const dir = project(big);
    try {
      const page = inspect(dir, 1, { targets: [{ selector: ".w-dot" }], maxBytes: 2048 });
      expect(page.snippets).toHaveLength(0);
      expect(page.nextOffset).toBeNull();
      expect(page.omitted).toHaveLength(1);
      expect(page.omitted[0].bytes).toBeGreaterThan(2048);
      const fetched = inspect(dir, 1, {
        targets: [],
        snippets: page.omitted.map((o) => o.id),
        maxBytes: 12000,
      });
      expect(fetched.snippets.map((s) => s.code.trim())).toEqual([big]);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it("returns every candidate the budget holds instead of five", () => {
    const dir = project(".w-dot{color:red}");
    try {
      const report = inspect(dir, 25, { targets: [{ selector: ".w-dot" }] });
      expect(report.results[0].candidates).toHaveLength(25);
      expect(report.results[0].candidatesOmitted).toBe(0);
      expect(report.snippets).toHaveLength(1);
      const tight = inspect(dir, 25, { targets: [{ selector: ".w-dot" }], maxBytes: 4096 });
      expect(Buffer.byteLength(JSON.stringify(tight))).toBeLessThanOrEqual(4096);
      expect(tight.results[0].candidates.length).toBeGreaterThanOrEqual(5);
      expect(tight.results[0].candidates.length + tight.results[0].candidatesOmitted).toBe(25);
      expect(tight.snippets).toHaveLength(1);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it("continues past a snippet that does not fit so later snippets stay reachable", () => {
    const big = `.big{${"color:red;".repeat(300)}}`;
    const small = Array.from({ length: 20 }, (_, n) => `.s${n}{color:red}`);
    const dir = project([big, ...small].join("\n\n"));
    try {
      const first = inspect(dir, 1, { targets: [{ selector: ".w-dot" }], maxBytes: 2048 });
      expect(first.snippets).toHaveLength(0);
      expect(first.nextOffset).toBe(1);
      expect(first.omitted[0]?.bytes).toBeGreaterThan(2048);
      const seen = new Set<string>();
      let offset: number | null = first.nextOffset;
      for (let guard = 0; offset !== null && guard < 25; guard++) {
        const page = inspect(dir, 1, {
          targets: [{ selector: ".w-dot" }],
          maxBytes: 2048,
          offset,
        });
        for (const snippet of page.snippets) seen.add(snippet.code.trim());
        expect(page.nextOffset === null || page.nextOffset > offset).toBe(true);
        offset = page.nextOffset;
      }
      expect(offset).toBeNull();
      expect([...seen].sort()).toEqual([...small].sort());
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });
});
