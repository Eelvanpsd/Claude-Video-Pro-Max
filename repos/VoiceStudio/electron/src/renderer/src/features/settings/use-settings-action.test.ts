import { act, cleanup, renderHook } from '@testing-library/react';
import { afterEach, expect, it } from 'vitest';
import { useSettingsAction } from './use-settings-action';

afterEach(cleanup);
const fail = async () => {
  throw new Error('save failed');
};

it('clears the captured failure when no newer save has failed', async () => {
  const { result } = renderHook(useSettingsAction);
  await act(() => result.current.run(fail));
  expect(result.current.error).toBe(true);
  act(() => result.current.clearError());
  expect(result.current.error).toBe(false);
});

it('does not let an earlier Retry clear a later failed save', async () => {
  const { result } = renderHook(useSettingsAction);
  await act(() => result.current.run(fail));
  const finishEarlierRetry = result.current.clearError;
  await act(() => result.current.run(fail));
  act(finishEarlierRetry);
  expect(result.current.error).toBe(true);
});

it('does not clear a failure from a save already pending when Retry began', async () => {
  const { result } = renderHook(useSettingsAction);
  let rejectSave!: (error: Error) => void;
  let pending!: Promise<void>;
  act(() => {
    pending = result.current.run(
      () =>
        new Promise<void>((_, reject) => {
          rejectSave = reject;
        }),
    );
  });
  const finishRetry = result.current.clearError;
  await act(async () => {
    rejectSave(new Error('save failed'));
    await pending;
  });
  act(finishRetry);
  expect(result.current.error).toBe(true);
});
