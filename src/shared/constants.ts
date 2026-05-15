export const DEFAULT_BASE_BRAND = 'Yandex Cloud';

export const SCALE_INDICES = [50, 100, 150, 200, 250, 300, 350, 400, 450, 500, 550, 600, 650, 700, 750, 800, 850, 900, 950, 1000] as const;
export type ScaleIndex = typeof SCALE_INDICES[number];

export const ALPHA_INDICES = [50, 100, 150, 200, 250, 300, 350, 400, 450, 500, 550] as const;
export const SOLID_INDICES = SCALE_INDICES;

export const COLLECTION_NAMES = {
  privateColors: 'Private Colors',
  appearance: 'Appearance',
  brand: 'Brand',
} as const;
