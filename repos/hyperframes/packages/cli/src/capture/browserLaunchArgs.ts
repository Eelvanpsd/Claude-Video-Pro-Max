export function captureBrowserArgs(
  disableWebgl: boolean,
  viewportWidth: number,
  viewportHeight: number,
  platform: NodeJS.Platform = process.platform,
): string[] {
  const needsLinuxSandboxException = platform === "linux";
  return [
    ...(needsLinuxSandboxException ? ["--no-sandbox"] : []),
    "--disable-dev-shm-usage",
    ...(disableWebgl
      ? ["--disable-gpu"]
      : ["--enable-webgl", "--ignore-gpu-blocklist", "--use-gl=angle", "--use-angle=swiftshader"]),
    "--disable-blink-features=AutomationControlled",
    "--disable-background-timer-throttling",
    "--disable-renderer-backgrounding",
    `--window-size=${viewportWidth},${viewportHeight}`,
  ];
}
