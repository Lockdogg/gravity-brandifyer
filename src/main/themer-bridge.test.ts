import { describe, it, expect } from 'vitest';
import { generateBrandScale } from './themer-bridge';
import type { RGBA } from '../shared/types';

const BRAND_HEX = '#005FF9'; // YC brand blue — reference values match themer output

function approx(actual: RGBA, r: number, g: number, b: number, a = 1) {
  const tol = 1 / 255;
  expect(actual.r).toBeCloseTo(r / 255, 5);
  expect(actual.g).toBeCloseTo(g / 255, 5);
  expect(actual.b).toBeCloseTo(b / 255, 5);
  expect(actual.a).toBeCloseTo(a, 5);
}

describe('generateBrandScale', () => {
  const scale = generateBrandScale(BRAND_HEX);

  it('produces 30 entries per theme', () => {
    for (const mode of ['Light', 'Dark', 'Light HC', 'Dark HC'] as const) {
      expect(Object.keys(scale[mode])).toHaveLength(30);
    }
  });

  it('has no "550" alpha key (only "550 Solid")', () => {
    for (const mode of ['Light', 'Dark', 'Light HC', 'Dark HC'] as const) {
      expect(scale[mode]['550']).toBeUndefined();
      expect(scale[mode]['550 Solid']).toBeDefined();
    }
  });

  it('alpha variants have correct opacity, all themes identical', () => {
    for (const mode of ['Light', 'Dark', 'Light HC', 'Dark HC'] as const) {
      approx(scale[mode]['50'],  0, 95, 249, 0.1);
      approx(scale[mode]['500'], 0, 95, 249, 0.9);
    }
  });

  it('550 Solid = pure brand color in all themes', () => {
    for (const mode of ['Light', 'Dark', 'Light HC', 'Dark HC'] as const) {
      approx(scale[mode]['550 Solid'], 0, 95, 249);
    }
  });

  it('Light: low solids blend toward white bg', () => {
    approx(scale['Light']['50 Solid'], 230, 239, 254); // near-white tint
  });

  it('Light: high solids blend toward dark contrasting bg', () => {
    approx(scale['Light']['1000 Solid'], 38, 52, 81);
  });

  it('Dark: low solids blend toward dark bg', () => {
    approx(scale['Dark']['50 Solid'], 41, 49, 71); // near-dark tint
  });

  it('Dark: high solids blend toward white contrasting bg', () => {
    approx(scale['Dark']['1000 Solid'], 217, 231, 254);
  });

  it('Light HC: uses HC contrasting bg (#222326), darker than standard Dark', () => {
    approx(scale['Light HC']['1000 Solid'], 29, 44, 70); // darker than Light 1000-solid
  });

  it('Dark HC: low solids blend toward HC dark bg (#222326)', () => {
    approx(scale['Dark HC']['50 Solid'], 31, 41, 59);
  });

  it('Dark HC: high solids same direction as regular Dark', () => {
    approx(scale['Dark HC']['1000 Solid'], 217, 231, 254);
  });
});
