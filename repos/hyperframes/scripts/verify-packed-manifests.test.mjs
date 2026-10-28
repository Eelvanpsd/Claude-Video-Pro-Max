import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { describe, it } from "node:test";
import {
  CONSUMER_TSCONFIG,
  countTypeErrorsByPackage,
  listPackedExportContracts,
  listPackageSizeIssues,
  listPackedJavaScriptImportIssues,
  packageExportSpecifier,
  renderBrowserConsumer,
  renderTypeConsumer,
  verifyCliLicense,
} from "./verify-packed-manifests.mjs";

const TSC = join(import.meta.dirname, "..", "node_modules", "typescript", "bin", "tsc");

describe("packed manifest verifier", () => {
  it("passes a package inside its size budget", () => {
    const budget = { packed: 1000, unpacked: 4000 };
    assert.deepEqual(listPackageSizeIssues("pkg", { packed: 950, unpacked: 3900 }, budget), []);
  });

  it("fails a package over its size budget", () => {
    const issues = listPackageSizeIssues(
      "pkg",
      { packed: 1001, unpacked: 3900 },
      { packed: 1000, unpacked: 4000 },
    );
    assert.equal(issues.length, 1);
    assert.match(issues[0], /pkg packed size 1001 bytes is over its budget of 1000/);
  });

  it("makes a budget follow a package down once it shrinks", () => {
    const issues = listPackageSizeIssues(
      "pkg",
      { packed: 500, unpacked: 3900 },
      { packed: 1000, unpacked: 4000 },
    );
    assert.equal(issues.length, 1);
    assert.match(issues[0], /lower it to 525/);
  });

  it("fails a malformed budget instead of skipping the metric", () => {
    const sizes = { packed: 100, unpacked: 400 };
    for (const budget of [{}, { paked: 100, unpacked: 400 }, { packed: "NaN", unpacked: 400 }]) {
      assert.match(listPackageSizeIssues("pkg", sizes, budget).join("\n"), /invalid packed budget/);
    }
  });

  it("asks for a budget for a new published package", () => {
    assert.match(
      listPackageSizeIssues("pkg", { packed: 100, unpacked: 400 }, undefined)[0],
      /"pkg": \{ "packed": 105, "unpacked": 420 \}/,
    );
  });

  it("requires the CLI package and tarball to declare Apache-2.0", () => {
    assert.throws(
      () => verifyCliLicense("packages/cli", {}, {}),
      /packages\/cli must declare license Apache-2\.0/,
    );
    assert.throws(
      () => verifyCliLicense("packages/cli", { license: "Apache-2.0" }, { license: "UNLICENSED" }),
      /packages\/cli packed manifest must preserve license Apache-2\.0/,
    );
    assert.doesNotThrow(() =>
      verifyCliLicense("packages/cli", { license: "Apache-2.0" }, { license: "Apache-2.0" }),
    );
  });

  it("keeps every browser package live even when it declares sideEffects false", () => {
    const consumer = renderBrowserConsumer(["@hyperframes/parsers", "@hyperframes/lint/browser"]);

    assert.match(consumer, /import \* as packedBrowserModule0 from "@hyperframes\/parsers";/);
    assert.match(consumer, /import \* as packedBrowserModule1 from "@hyperframes\/lint\/browser";/);
    assert.match(consumer, /packedBrowserModules\.map\(\(module\) => Object\.keys\(module\)\)/);
    assert.doesNotMatch(consumer, /import "@hyperframes\/parsers"/);
  });

  it("derives consumer specifiers from the packed export map", () => {
    assert.equal(packageExportSpecifier("@hyperframes/sdk", "."), "@hyperframes/sdk");
    assert.equal(
      packageExportSpecifier("@hyperframes/sdk", "./adapters/fs"),
      "@hyperframes/sdk/adapters/fs",
    );
    assert.deepEqual(
      listPackedExportContracts([
        {
          packedPackage: {
            name: "@hyperframes/example",
            exports: {
              ".": { import: "./dist/index.js", types: "./dist/index.d.ts" },
              "./runtime": "./dist/runtime.js",
            },
          },
        },
      ]),
      [
        {
          specifier: "@hyperframes/example",
          typechecked: true,
          environments: ["browser", "node"],
        },
        {
          specifier: "@hyperframes/example/runtime",
          typechecked: false,
          environments: ["browser", "node"],
        },
      ],
    );
  });

  it("uses descriptor environments to separate Node and browser promises", () => {
    assert.deepEqual(
      listPackedExportContracts([
        {
          packedPackage: {
            name: "@hyperframes/example",
            exports: { ".": { import: "./dist/index.js", types: "./dist/index.d.ts" } },
          },
          descriptor: {
            subpaths: {
              ".": { environments: ["browser"] },
            },
          },
        },
      ]),
      [
        {
          specifier: "@hyperframes/example",
          typechecked: true,
          environments: ["browser"],
        },
      ],
    );
  });

  function withPackedFiles(files, packedFiles, callback) {
    const dir = mkdtempSync(join(tmpdir(), "hyperframes-pack-test-"));
    try {
      const packageDir = join(dir, "package");
      mkdirSync(packageDir, { recursive: true });
      for (const [file, source] of Object.entries(files)) {
        mkdirSync(dirname(join(packageDir, file)), { recursive: true });
        writeFileSync(join(packageDir, file), source, "utf8");
      }

      const tarball = join(dir, "package.tgz");
      execFileSync("tar", ["-czf", tarball, "-C", dir, "package"]);
      callback(tarball, new Set(packedFiles));
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  }

  it("passes explicit relative JavaScript imports whose target is packed", () => {
    withPackedFiles(
      {
        "dist/index.js": 'import { runtime } from "./generated/runtime-inline.js";\n',
        "dist/generated/runtime-inline.js": "export const runtime = 'ok';\n",
      },
      ["dist/index.js", "dist/generated/runtime-inline.js"],
      (tarball, packedFiles) => {
        assert.deepEqual(listPackedJavaScriptImportIssues(tarball, packedFiles), []);
      },
    );
  });

  it("reports explicit relative JavaScript imports whose target is missing from the tarball", () => {
    withPackedFiles(
      {
        "dist/index.js": 'import { runtime } from "./generated/runtime-inline.js";\n',
      },
      ["dist/index.js"],
      (tarball, packedFiles) => {
        assert.deepEqual(listPackedJavaScriptImportIssues(tarball, packedFiles), [
          "dist/index.js:1 imports missing ./generated/runtime-inline.js",
        ]);
      },
    );
  });

  it("checks export-from, dynamic import, require, and mjs/cjs files", () => {
    withPackedFiles(
      {
        "dist/index.js": 'export * from "./generated/exports.js";\n',
        "dist/dynamic.mjs": 'await import("./generated/dynamic.js");\n',
        "dist/require.cjs": 'require("./generated/require.js");\n',
      },
      ["dist/index.js", "dist/dynamic.mjs", "dist/require.cjs"],
      (tarball, packedFiles) => {
        assert.deepEqual(listPackedJavaScriptImportIssues(tarball, packedFiles), [
          "dist/index.js:1 imports missing ./generated/exports.js",
          "dist/dynamic.mjs:1 imports missing ./generated/dynamic.js",
          "dist/require.cjs:1 imports missing ./generated/require.js",
        ]);
      },
    );
  });

  it("reports extensionless relative imports", () => {
    withPackedFiles(
      {
        "dist/index.js": 'export {\n  runtime\n} from "./generated/runtime-inline";\n',
      },
      ["dist/index.js"],
      (tarball, packedFiles) => {
        assert.deepEqual(listPackedJavaScriptImportIssues(tarball, packedFiles), [
          "dist/index.js:1 imports ./generated/runtime-inline",
        ]);
      },
    );
  });

  it("reports side-effect imports whose target is missing from the tarball", () => {
    withPackedFiles(
      {
        "index.js": 'import "./missing.js";\n',
      },
      ["index.js"],
      (tarball, packedFiles) => {
        assert.deepEqual(listPackedJavaScriptImportIssues(tarball, packedFiles), [
          "index.js:1 imports missing ./missing.js",
        ]);
      },
    );
  });

  it("names each typed export so tsc must resolve and check its declarations", () => {
    assert.equal(
      renderTypeConsumer(["@hyperframes/core", "@hyperframes/core/lint"]),
      'import type * as packedTypes0 from "@hyperframes/core";\n' +
        'import type * as packedTypes1 from "@hyperframes/core/lint";\n' +
        "export {};\n",
    );
  });

  it("attributes consumer type errors to the installed package that owns them", () => {
    const output = [
      "node_modules/@hyperframes/core/dist/adapters/gsap.d.ts(1,35): error TS2835: Relative import paths need explicit file extensions.",
      "node_modules/@hyperframes/core/dist/index.d.ts(2,15): error TS2307: Cannot find module './core.types'.",
      "node_modules/hyperframes/dist/cli.d.ts(1,1): error TS2307: Cannot find module './x'.",
      "consumer.ts(1,30): error TS2307: Cannot find module '@hyperframes/missing'.",
      "  Did you mean './types.js'?",
    ].join("\n");
    assert.deepEqual(countTypeErrorsByPackage(output), {
      "@hyperframes/core": 2,
      hyperframes: 1,
      "consumer.ts": 1,
    });
  });

  function typecheckConsumerOf(declaration) {
    const dir = mkdtempSync(join(tmpdir(), "hyperframes-nodenext-test-"));
    try {
      const pkgDir = join(dir, "node_modules", "@hyperframes", "example");
      mkdirSync(join(pkgDir, "dist"), { recursive: true });
      writeFileSync(
        join(pkgDir, "package.json"),
        JSON.stringify({
          name: "@hyperframes/example",
          type: "module",
          exports: { ".": { types: "./dist/index.d.ts", import: "./dist/index.js" } },
        }),
      );
      writeFileSync(join(pkgDir, "dist", "index.d.ts"), declaration);
      writeFileSync(join(pkgDir, "dist", "types.d.ts"), "export type Example = string;\n");
      writeFileSync(join(dir, "consumer.ts"), renderTypeConsumer(["@hyperframes/example"]));
      // The fixture has no @types/node to load; everything else matches the packed gate.
      const compilerOptions = { ...CONSUMER_TSCONFIG.compilerOptions, types: [] };
      writeFileSync(
        join(dir, "tsconfig.json"),
        JSON.stringify({ ...CONSUMER_TSCONFIG, compilerOptions }),
      );
      execFileSync(process.execPath, [TSC], { cwd: dir, encoding: "utf8", stdio: "pipe" });
      return "";
    } catch (error) {
      return String(error.stdout);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  }

  it("fails a NodeNext consumer on an extensionless import inside a published declaration", () => {
    assert.equal(CONSUMER_TSCONFIG.compilerOptions.skipLibCheck, false);
    assert.match(
      typecheckConsumerOf('export type { Example } from "./types";\n'),
      /node_modules\/@hyperframes\/example\/dist\/index\.d\.ts\(1,\d+\): error TS283[45]/,
    );
    assert.equal(typecheckConsumerOf('export type { Example } from "./types.js";\n'), "");
  });
});
