import { BRAND_MODE_LIMIT } from '../shared/constants';

export interface ValidationResult {
  valid: boolean;
  error?: string;
}

// Rules from SPEC 2.2:
// - 2..32 chars
// - Only latin letters, digits, space, hyphen, underscore
// - First char must be a letter
// - No consecutive spaces
const BRAND_NAME_RE = /^[A-Za-z][A-Za-z0-9 \-_]{1,31}$/;

export function validateBrandName(
  name: string,
  existingBrands: string[]
): ValidationResult {
  if (!name || name.trim().length === 0) {
    return { valid: false, error: 'Название не может быть пустым.' };
  }

  if (!BRAND_NAME_RE.test(name)) {
    if (name.length < 2) {
      return { valid: false, error: 'Минимальная длина — 2 символа.' };
    }
    if (name.length > 32) {
      return { valid: false, error: 'Максимальная длина — 32 символа.' };
    }
    if (!/^[A-Za-z]/.test(name)) {
      return { valid: false, error: 'Название должно начинаться с буквы (A–Z).' };
    }
    return {
      valid: false,
      error: 'Допустимы только латинские буквы, цифры, пробел, тире и подчёркивание.',
    };
  }

  if (/  /.test(name)) {
    return { valid: false, error: 'Нельзя использовать два пробела подряд.' };
  }

  if (existingBrands.includes(name)) {
    return {
      valid: false,
      error: `Бренд «${name}» уже существует. Выберите другое название.`,
    };
  }

  return { valid: true };
}

export function validateModeLimit(currentModeCount: number): ValidationResult {
  if (currentModeCount >= BRAND_MODE_LIMIT) {
    return {
      valid: false,
      error: `Достигнут лимит брендов (${BRAND_MODE_LIMIT}). Обратитесь к команде DS.`,
    };
  }
  return { valid: true };
}
