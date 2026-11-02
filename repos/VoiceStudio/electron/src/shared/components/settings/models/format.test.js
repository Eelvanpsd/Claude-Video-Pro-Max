import { describe, expect, it } from 'vitest';
import { fmtGb } from './format';

describe('fmtGb', () => {
  it('uses MB below 1 GB and GB above, like fmtBytes', () => {
    expect(fmtGb(0.025)).toBe('25.6 MB');
    expect(fmtGb(0.104)).toBe('106.5 MB');
    expect(fmtGb(2.4)).toBe('2.40 GB');
    expect(fmtGb(undefined)).toBe('—');
  });
});
