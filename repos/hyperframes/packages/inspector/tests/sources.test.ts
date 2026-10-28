import { describe, it, expect } from "vitest";
import { mkdirSync, mkdtempSync, writeFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { Sources, mergeSnippets, fingerprint } from "../src/sources";
import { PREVIEW_IGNORED_DIRS } from "../../core/src/projectFolders";
import {
  bundleToSingleHtml,
  type BundleScriptProvenance,
} from "../../core/src/compiler/htmlBundler";

describe("source records", () => {
  it("ignores the generated folders Studio's preview signature ignores", () => {
    const dir = mkdtempSync(join(tmpdir(), "inspect-source-"));
    try {
      writeFileSync(join(dir, "index.html"), "<div></div>");
      const before = fingerprint(dir);
      for (const folder of PREVIEW_IGNORED_DIRS) {
        mkdirSync(join(dir, folder));
        writeFileSync(join(dir, folder, "peaks.json"), "[1,2,3]");
      }
      expect(fingerprint(dir)).toBe(before);
      writeFileSync(join(dir, "data.json"), "{}");
      expect(fingerprint(dir)).not.toBe(before);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it("keeps original multiline blocks and deduplicates targets without reformatting", () => {
    const dir = mkdtempSync(join(tmpdir(), "inspect-source-"));
    try {
      const text = 'const target = "#title";\nconst config = {\n  x: 100,\n  duration: 1\n};\n';
      writeFileSync(join(dir, "scene.js"), text);
      const source = new Sources(dir);
      const a = source.slice("scene.js", 24, text.length, "animation creation", 0)!;
      const b = source.slice("scene.js", 24, text.length, "animation creation", 1)!;
      const result = mergeSnippets([a, b], source);
      expect(result).toHaveLength(1);
      expect(result[0].targets).toEqual([0, 1]);
      expect(text.includes(result[0].code)).toBe(true);
      const before = fingerprint(dir);
      writeFileSync(join(dir, "scene.js"), text.replace("100", "150"));
      expect(fingerprint(dir)).not.toBe(before);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });
  it("extracts raw-text elements with HTML-valid whitespace before the closing bracket", () => {
    const dir = mkdtempSync(join(tmpdir(), "inspect-raw-text-"));
    try {
      writeFileSync(
        join(dir, "index.html"),
        "<script>const marker = 1;</script \n><style>.marker { color: red; }</style\t>",
      );
      const source = new Sources(dir);
      expect(source.chunks.map((chunk) => chunk.text)).toContain("const marker = 1;");
      expect(source.cssRules.some((rule) => rule.selector === ".marker")).toBe(true);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });
  it("opt-in compiler mapping keeps default HTML unchanged and concurrent maps isolated", async () => {
    const dirs = [0, 1].map(() => mkdtempSync(join(tmpdir(), "inspect-map-")));
    try {
      dirs.forEach((dir, i) =>
        writeFileSync(
          join(dir, "index.html"),
          `<!doctype html><html><head></head><body><div data-composition-id="root" data-start="0" data-duration="10" data-width="1920" data-height="1080"></div><script>const marker${i}=1; window.__timelines={};</script></body></html>`,
        ),
      );
      const outputs = await Promise.all(
        dirs.map(async (dir) => {
          const maps: BundleScriptProvenance[] = [];
          const plain = await bundleToSingleHtml(dir);
          const mapped = await bundleToSingleHtml(dir, { scriptProvenance: (p) => maps.push(p) });
          return { plain, mapped, maps };
        }),
      );
      outputs.forEach((output, i) => {
        expect(output.mapped.replace(/\n\/\/# sourceURL=hf-inspect-[a-f0-9]+\.js/g, "")).toBe(
          output.plain,
        );
        expect(output.plain).not.toContain("hf-inspect-");
        expect(output.maps.some((map) => map.input.includes(`marker${i}`))).toBe(true);
        expect(output.maps.some((map) => map.input.includes(`marker${1 - i}`))).toBe(false);
      });
    } finally {
      dirs.forEach((dir) => rmSync(dir, { recursive: true, force: true }));
    }
  });
  it("finds an element's tag before its served data-hf-id reaches the source", () => {
    const dir = mkdtempSync(join(tmpdir(), "inspect-source-"));
    try {
      writeFileSync(
        join(dir, "scene.html"),
        '<div data-composition-id="s"><span id="t" class="w">A</span><i class="dot"></i><i class="dot"></i></div>',
      );
      const source = new Sources(dir);
      const served = {
        ref: "r",
        tag: "span",
        id: "t",
        hfId: "hf-ab12",
        classes: ["w"],
        composition: "s",
      };
      expect(source.markup(served, 0)?.code).toContain('<span id="t" class="w">');
      const twin = { ...served, tag: "i", id: "", classes: ["dot"] };
      expect(source.markup(twin, 0)).toBeNull();
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });
});
