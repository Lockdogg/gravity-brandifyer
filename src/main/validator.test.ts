import { describe, it, expect } from 'vitest';
import { validateBrandName, validateModeLimit } from './validator';

const EXISTING = ['Yandex Cloud', 'Gravity', 'Orbita'];

describe('validateBrandName', () => {
  it('accepts valid names', () => {
    expect(validateBrandName('MyBrand', EXISTING).valid).toBe(true);
    expect(validateBrandName('My Brand', EXISTING).valid).toBe(true);
    expect(validateBrandName('My-Brand_2', EXISTING).valid).toBe(true);
    expect(validateBrandName('Ab', EXISTING).valid).toBe(true);
    expect(validateBrandName('A' + 'b'.repeat(31), EXISTING).valid).toBe(true);
  });

  it('rejects empty / whitespace-only', () => {
    expect(validateBrandName('', EXISTING).valid).toBe(false);
    expect(validateBrandName('   ', EXISTING).valid).toBe(false);
  });

  it('rejects names shorter than 2 chars', () => {
    expect(validateBrandName('A', EXISTING).valid).toBe(false);
  });

  it('rejects names longer than 32 chars', () => {
    expect(validateBrandName('A' + 'b'.repeat(32), EXISTING).valid).toBe(false);
  });

  it('rejects names starting with non-letter', () => {
    expect(validateBrandName('1Brand', EXISTING).valid).toBe(false);
    expect(validateBrandName('-Brand', EXISTING).valid).toBe(false);
  });

  it('rejects cyrillic and special chars', () => {
    expect(validateBrandName('Бренд', EXISTING).valid).toBe(false);
    expect(validateBrandName('My!Brand', EXISTING).valid).toBe(false);
  });

  it('rejects double spaces', () => {
    expect(validateBrandName('My  Brand', EXISTING).valid).toBe(false);
  });

  it('rejects duplicate names (case-sensitive)', () => {
    expect(validateBrandName('Gravity', EXISTING).valid).toBe(false);
    expect(validateBrandName('gravity', EXISTING).valid).toBe(true);
  });
});

describe('validateModeLimit', () => {
  it('passes when under the limit', () => {
    expect(validateModeLimit(0).valid).toBe(true);
    expect(validateModeLimit(39).valid).toBe(true);
  });

  it('fails at or above the limit', () => {
    expect(validateModeLimit(40).valid).toBe(false);
    expect(validateModeLimit(41).valid).toBe(false);
  });
});
