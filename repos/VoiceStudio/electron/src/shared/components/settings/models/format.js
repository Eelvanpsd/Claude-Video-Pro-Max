/** Pure, closure-free formatting helpers for the model store. */

export function fmtBytes(n) {
  if (n == null || n < 0) return '—';
  if (n === 0) return '0 B';
  if (n >= 1024 ** 3) return `${(n / 1024 ** 3).toFixed(2)} GB`;
  if (n >= 1024 ** 2) return `${(n / 1024 ** 2).toFixed(1)} MB`;
  return `${Math.round(n / 1024)} KB`;
}

/**
 * A catalogue model size given in GB, shown in one unit system with
 * {@link fmtBytes}: MB below 1 GB ("25.6 MB"), GB above ("2.40 GB").
 */
export function fmtGb(gb) {
  if (gb == null || !Number.isFinite(gb) || gb < 0) return '—';
  return fmtBytes(Math.round(gb * 1024 ** 3));
}

/** Deterministic muted HSL color from an org/user name in a repo_id. */
export function orgColor(repoId) {
  const org = (repoId || '').split('/')[0];
  let h = 0;
  for (let i = 0; i < org.length; i++) h = (h * 31 + org.charCodeAt(i)) & 0xffff;
  return `hsl(${h % 360}, 35%, 28%)`;
}
