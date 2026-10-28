import assert from "node:assert/strict";
import test from "node:test";

import { assertWindowsLockerSecret, windowsLockerPasswordLimit } from "../src/windows.js";

test("Windows locker rejects OAuth-sized secrets before PasswordVault", () => {
  assertWindowsLockerSecret("x".repeat(windowsLockerPasswordLimit), "hypihub.oauth");
  assert.throws(
    () => assertWindowsLockerSecret("x".repeat(windowsLockerPasswordLimit + 1), "hypihub.oauth"),
    /513-character secret for hypihub\.oauth.*PasswordVault limit is 512.*credential-store-local.*backend file/u,
  );
});
