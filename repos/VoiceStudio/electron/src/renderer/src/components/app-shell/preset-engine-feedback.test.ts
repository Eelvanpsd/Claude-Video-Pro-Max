import { expect, it } from 'vitest';
import { presetEngineFeedback } from './preset-engine-feedback';
import type { PerformanceProfileState } from '@/hooks/use-performance-profile';

const row = {
  family: 'asr',
  title: 'Whisper',
  detail: 'small',
  runtime: 'cuda',
  problem: 'Old error',
  state: 'engineRuntime.ready',
};
const applied = {
  selections: { asr: { engine: 'faster-whisper', model: 'large-v3', label: 'Whisper large-v3' } },
} as PerformanceProfileState;

it('shows saving without claiming the model has already changed', () => {
  expect(presetEngineFeedback(row, null, false, true, ['asr'])).toEqual({
    ...row,
    state: 'common.saving',
  });
});
it('shows the confirmed model while clearing stale readiness and runtime during refresh', () => {
  expect(presetEngineFeedback(row, applied, true, false, ['asr'])).toEqual({
    ...row,
    title: 'Whisper large-v3',
    detail: 'large-v3',
    runtime: undefined,
    problem: undefined,
    state: 'network.switching',
  });
});
it('uses observed runtime after refresh and leaves unaffected engines alone', () => {
  expect(presetEngineFeedback(row, applied, false, false, ['asr'])).toBe(row);
  expect(presetEngineFeedback(row, applied, true, false, ['tts'])).toBe(row);
  expect(presetEngineFeedback(row, null, true, false, ['asr'])).toBe(row);
});
