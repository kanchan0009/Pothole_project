import { describe, expect, it } from 'vitest';
import { passwordRule } from '../validators';

describe('passwordRule', () => {
  it('accepts a password meeting every rule', () => {
    expect(passwordRule.safeParse('StrongPass@1').success).toBe(true);
  });

  it('rejects a password that is too short', () => {
    const result = passwordRule.safeParse('Ab1!a');
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues.some((i) => i.message.includes('At least 8'))).toBe(true);
    }
  });

  it('requires an uppercase letter', () => {
    expect(passwordRule.safeParse('abcdefgh1!').success).toBe(false);
  });

  it('requires a lowercase letter', () => {
    expect(passwordRule.safeParse('ABCDEFGH1!').success).toBe(false);
  });

  it('requires a number', () => {
    expect(passwordRule.safeParse('Abcdefgh!').success).toBe(false);
  });

  it('requires a special character', () => {
    expect(passwordRule.safeParse('Abcdefgh1').success).toBe(false);
  });
});
