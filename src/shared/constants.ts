import type { AppearanceMode, RGB, ThemeBackgroundPair } from './types';


export const DEFAULT_BASE_BRAND = 'Yandex Cloud';

export const SCALE_INDICES = [50, 100, 150, 200, 250, 300, 350, 400, 450, 500, 550, 600, 650, 700, 750, 800, 850, 900, 950, 1000] as const;
export type ScaleIndex = typeof SCALE_INDICES[number];

// Alpha: 50..500 only (confirmed from Private Colors dump — 550 exists as Solid only)
export const ALPHA_INDICES = [50, 100, 150, 200, 250, 300, 350, 400, 450, 500] as const;
export const SOLID_INDICES = SCALE_INDICES;

// Theme name as it appears in Private Colors variable names (e.g. "Light-HC", not "Light HC")
export const PRIVATE_COLORS_THEME: Record<AppearanceMode, string> = {
  'Light':    'Light',
  'Dark':     'Dark',
  'Light HC': 'Light-HC',
  'Dark HC':  'Dark-HC',
};

// Theme segments as they appear in Private Colors variable names (e.g. "Light-HC")
export const PC_THEMES = new Set(['Light', 'Dark', 'Light-HC', 'Dark-HC']);

export const COLLECTION_NAMES = {
  privateColors: 'Private Colors',
  appearance: 'Appearance',
  brand: 'Brand',
} as const;

export const APPEARANCE_MODES: AppearanceMode[] = ['Light', 'Dark', 'Light HC', 'Dark HC'];

export const BRAND_MODE_LIMIT = 40;

function hex(h: string): RGB {
  const v = parseInt(h.slice(1), 16);
  return {
    r: ((v >> 16) & 0xff) / 255,
    g: ((v >> 8) & 0xff) / 255,
    b: (v & 0xff) / 255,
  };
}

// Fallback backgrounds used when the lib variable can't be resolved.
// Source of truth: read from Yandex Cloud/Branding/Base Background at runtime.
export const FALLBACK_BACKGROUNDS: Record<AppearanceMode, ThemeBackgroundPair> = {
  Light:       { primary: hex('#FFFFFF'), contrasting: hex('#2D2C33') },
  Dark:        { primary: hex('#2D2C33'), contrasting: hex('#FFFFFF') },
  'Light HC':  { primary: hex('#FFFFFF'), contrasting: hex('#222326') },
  'Dark HC':   { primary: hex('#222326'), contrasting: hex('#FFFFFF') },
};
