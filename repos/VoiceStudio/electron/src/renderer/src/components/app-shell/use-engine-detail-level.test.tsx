import { act, renderHook } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { useEngineDetailLevel } from './use-engine-detail-level';

beforeEach(() => localStorage.clear());
afterEach(() => vi.restoreAllMocks());

describe('engine detail preference', () => {
  it('starts simple and remembers an explicit view without changing engine settings', () => {
    const first = renderHook(useEngineDetailLevel);
    expect(first.result.current.level).toBe('simple');
    act(() => first.result.current.chooseLevel('details'));
    first.unmount();
    const restored = renderHook(useEngineDetailLevel);
    expect(restored.result.current.level).toBe('details');
    act(() => restored.result.current.chooseLevel('simple'));
    expect(localStorage.getItem('voicestudio.engine-detail-level')).toBe('simple');
  });

  it('falls back for invalid preferences and keeps working without storage', () => {
    localStorage.setItem('voicestudio.engine-detail-level', 'invalid');
    expect(renderHook(useEngineDetailLevel).result.current.level).toBe('simple');
    vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
      throw new Error('blocked');
    });
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new Error('blocked');
    });
    const view = renderHook(useEngineDetailLevel);
    act(() => view.result.current.chooseLevel('models'));
    expect(view.result.current.level).toBe('models');
  });
});
