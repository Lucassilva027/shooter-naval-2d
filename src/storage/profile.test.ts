import { describe, expect, it } from 'vitest';
import { validateNickname } from './profile';

describe('validateNickname', () => {
  it('trims and collapses whitespace', () => {
    expect(validateNickname('  Anne   Bonny ')).toEqual({ ok: true, value: 'Anne Bonny' });
  });

  it('enforces the length limits after trimming', () => {
    expect(validateNickname('  ab  ').ok).toBe(false);
    expect(validateNickname('abc').ok).toBe(true);
    expect(validateNickname('a'.repeat(16)).ok).toBe(true);
    expect(validateNickname('a'.repeat(17)).ok).toBe(false);
  });

  it('accepts letters from any language, digits, "-" and "_"', () => {
    expect(validateNickname('João_Grão-2').ok).toBe(true);
  });

  it('rejects markup and symbols', () => {
    expect(validateNickname('<b>pirate</b>').ok).toBe(false);
    expect(validateNickname('pirate!').ok).toBe(false);
  });
});
