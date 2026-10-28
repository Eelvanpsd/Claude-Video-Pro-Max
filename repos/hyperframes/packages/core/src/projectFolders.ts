/** Folders whose writes never reload Studio's preview, so nothing that judges a preview stale may count them. */
export const PREVIEW_IGNORED_DIRS: ReadonlySet<string> = new Set([
  ".cache",
  ".git",
  ".hyperframes",
  ".next",
  ".thumbnails",
  ".transcode-cache",
  ".vite",
  ".waveform-cache",
  "build",
  "coverage",
  "dist",
  "node_modules",
  "outputs",
  "renders",
]);
