import { describe, it, expect } from 'vitest';
import { formatMoney } from './format';

describe('formatMoney', () => {
  it('formats USD correctly', () => {
    expect(formatMoney(2137, 'USD')).toBe('$21.37');
  });

  it('formats JOD correctly with 3 decimal places', () => {
    // 2137 minor units in JOD = 2.137 JOD
    // Note: JS Intl outputs "JOD 2.137" or similar
    const result = formatMoney(2137, 'JOD');
    expect(result).toContain('2.137');
  });

  it('formats zero correctly', () => {
    expect(formatMoney(0, 'USD')).toBe('$0.00');
  });

  it('formats negative amounts correctly', () => {
    // e.g. -$21.37
    const result = formatMoney(-2137, 'USD');
    expect(result).toContain('21.37');
    expect(result).toContain('-');
  });

  it('handles very large BigInt safely', () => {
    const bigVal = 9007199254740992n;
    const result = formatMoney(bigVal, 'USD');
    expect(result).toBeTruthy();
  });

  it('handles large strings safely', () => {
    const bigValStr = '9007199254740992';
    const result = formatMoney(bigValStr, 'USD');
    expect(result).toBeTruthy();
  });

  it('throws on unsupported currency', () => {
    expect(() => formatMoney(100, 'XXX')).toThrow('Unsupported currency: XXX');
  });
});
