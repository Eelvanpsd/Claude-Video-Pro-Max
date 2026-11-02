# Store publishing handover plan

## Goal

Publish the Electron application through Microsoft Store, Snap Store and Mac
App Store without changing the direct-download product or reviving Tauri.

The shared foundation is complete on `feat/store-publishing-foundation` at
commit `903d9aa9`. Platform work must start from that commit or from `main`
after this branch is reviewed and merged.

## Work order and ownership

1. Windows: `feat/microsoft-store`
2. Linux: `feat/snap-store`
3. macOS: `feat/mac-app-store`

Windows establishes the first store listing using the existing NSIS package.
Linux follows with a confined package. macOS runs last because its sandbox and
bundled-only executable policy require the largest packaging changes.

Assign one worker to each platform branch. Workers may prepare independently
after the foundation is merged, but publish in the order above so shared
listing, support and release lessons are incorporated before the next store.

## Shared contract

Every worker must preserve:

- Electron as the only desktop and UI shell.
- `com.voicestudio.desktop`, `VoiceStudio` and the legal publisher from
  `store/metadata.json` unless the store forces a documented identifier.
- The privacy disclosures in `store/privacy.json`.
- The capability and updater policy in `config/distributions.mjs`.
- Local-first behavior and explicit user action for runtime/model downloads.
- Existing direct installers, data paths and update feeds.
- Root `package.json` as the version source; no version bump without owner
  approval.
- No submission, listing publication or credential changes without owner
  approval.

If a store requirement changes identity, privacy, permissions, bundled
components or user-visible behavior, update the shared foundation first and
have all workers rebase on that decision.

## Entry gate for every worker

1. Confirm the foundation branch is merged or use commit `903d9aa9` as the
   common base.
2. Read `AGENTS.md`, `CLAUDE.md`, `docs/STORE-PUBLISHING.md` and
   `docs/RELEASING.md`.
3. Check the open PR queue before implementing a related community fix.
4. Run:

   ```bash
   node scripts/validate_store_foundation.mjs --distribution=<target>
   bun run --cwd electron typecheck
   ```

5. Record any validator failure as a blocking task. Do not bypass the policy.
6. Verify current store rules against official documentation before submission;
   requirements may change after this handover.

## Windows worker — Microsoft Store

Target: `microsoft-store`

Scope:

1. Confirm Partner Center supports the existing signed NSIS EXE submission and
   reserve the product identity with the owner.
2. Add a Microsoft Store packaging/submission workflow that sets
   `VOICESTUDIO_DISTRIBUTION=microsoft-store` without affecting direct builds.
3. Keep VoiceStudio's in-app updater enabled for this EXE distribution on the
   dedicated `electron-microsoft-store-stable-*` feed; never publish Store
   packages through the direct-download `electron-stable-*` feed. Store builds
   select the newest GitHub release containing their dedicated feed, so a newer
   direct-only release cannot hide the last published Store update.
4. Validate silent install/uninstall behavior, upgrade from the previous direct
   release, clean install, first-run setup and application launch.
5. Produce required icon and screenshot derivatives from `store/assets.json`;
   do not fork listing copy outside the canonical metadata.
6. Complete permission, generative-AI, voice-cloning, age-rating and privacy
   declarations with owner approval.
7. Generate the artifact provenance manifest and record Authenticode
   verification evidence.
8. Submit privately, resolve certification findings on the branch, then request
   owner approval for production publication.

Exit criteria:

- Partner Center certification passes.
- Signed installer identity matches the listing publisher.
- Clean install and upgrade tests pass on supported Windows architectures.
- Direct GitHub installation and updating remain unchanged.
- Production listing is published and independently install-verified.

## Linux worker — Snap Store

Target: `snap-store`

Scope:

1. Register the Snap name with the owner and document the selected confinement
   level and interfaces.
2. Add Snap packaging without replacing AppImage or Debian packaging.
3. Set `VOICESTUDIO_DISTRIBUTION=snap-store`; the Snap Store owns application
   updates, so the in-app updater must remain unavailable.
4. Map writable data, cache, models, runtime and project paths into allowed Snap
   locations while preserving user-selected file access.
5. Validate microphone, audio playback, GPU discovery, file import/export,
   managed runtime installation, model installation and offline relaunch under
   confinement.
6. Resolve required interfaces through least privilege and document any manual
   review request.
7. Generate the artifact provenance manifest and record Snap assertion/revision
   evidence.
8. Release through an internal or candidate channel, verify refresh/rollback,
   then request owner approval to promote to stable.

Exit criteria:

- Strict confinement or an explicitly approved exception passes review.
- Core user-visible workflows match direct Linux behavior.
- Store refreshes replace the app without enabling the in-app updater.
- AppImage and Debian packages remain unchanged.
- Stable channel is published and independently install-verified.

## macOS worker — Mac App Store

Target: `mac-app-store`

Scope:

1. Resolve the open compliance ledger before packaging: exact `uv` provenance,
   locked Python/wheel redistribution and all bundled executable licenses.
2. Replace runtime executable downloads with an approved bundled runtime or
   redesign the affected capability. Do not relax `bundled-only` policy.
3. Add MAS packaging, sandbox entitlements and inherited helper entitlements
   without altering Developer ID direct builds.
4. Implement security-scoped user-selected file access and validate persistence
   only where the user expects it.
5. Set `VOICESTUDIO_DISTRIBUTION=mac-app-store`; the App Store owns updates, so
   the in-app updater must remain unavailable.
6. Validate microphone, accessibility, file import/export, audio/video tools,
   child processes, model use and offline relaunch in a signed sandbox build.
7. Produce App Store assets and privacy declarations from canonical inputs.
8. Generate the artifact provenance manifest and record Apple Distribution
   signature, provisioning and receipt evidence.
9. Distribute through TestFlight, resolve App Review findings on the branch,
   then request owner approval for production publication.

Exit criteria:

- `node scripts/validate_store_foundation.mjs --distribution=mac-app-store`
  passes without exceptions.
- The MAS sandbox build passes all maintained user-visible workflows or has an
  owner-approved, documented scope reduction applied consistently.
- Developer ID direct builds remain notarized and unchanged.
- App Review passes and the production listing is independently install-tested.

## Shared verification and review gate

Before each platform PR is eligible to merge:

1. Add fail-before/pass-after tests for new packaging behavior.
2. Run targeted tests, then the full Electron CI gate on a supported CI runner.
3. Generate and inspect `store-artifact-manifest-<platform>-<arch>.json`.
4. Confirm the package embeds the expected distribution and update owner.
5. Update store instructions and `docs/RELEASING.md` in the same PR.
6. Merge current `main`, read all CodeRabbit/Greptile findings and resolve every
   Critical/P1 finding.
7. Require `Tests (backend + frontend)` green and a MERGEABLE PR.
8. After merge, watch `main` CI to green before starting another publication.

## Owner inputs

The workers can build and validate without these inputs, but cannot complete
publication until the owner provides or approves:

- Microsoft Partner Center, Snapcraft and App Store Connect access.
- Product-name reservations and publisher/seller identity.
- Legal agreements, payment and tax setup.
- Windows and Apple signing/provisioning credentials through repository
  secrets—never chat or committed files.
- Store questionnaires, age ratings, territories, pricing and availability.
- Any version bump, submission action, staged rollout and final publish action.

## Status reporting

Each worker should leave a short platform runbook containing:

- branch and final commit;
- package/revision identifiers;
- commands and CI runs used for validation;
- signing and provenance evidence locations;
- store submission status and reviewer findings;
- remaining owner action;
- rollback or delisting procedure.

Use the lifecycle consistently:

`built -> validated -> submitted -> approved -> scheduled -> published -> verified`
