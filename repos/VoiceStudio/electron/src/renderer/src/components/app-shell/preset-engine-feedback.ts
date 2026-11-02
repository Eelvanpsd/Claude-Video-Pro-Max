import type { PerformanceFamily, PerformanceProfileState } from '@/hooks/use-performance-profile';

export function presetEngineFeedback<
  T extends {
    family: string;
    detail: string;
    title?: string | null;
    runtime?: string | null;
    problem?: string | null;
    state: string;
  },
>(
  row: T,
  applied: PerformanceProfileState | null,
  refreshing: boolean,
  saving: boolean,
  applicable: string[],
) {
  if (saving && applicable.includes(row.family)) return { ...row, state: 'common.saving' };
  const selection = applied?.selections?.[row.family as PerformanceFamily];
  if (!refreshing || !selection || !applicable.includes(row.family)) return row;
  return {
    ...row,
    title: selection.label || selection.model || selection.engine,
    detail: selection.model || selection.engine,
    runtime: undefined,
    problem: undefined,
    state: 'network.switching',
  };
}
