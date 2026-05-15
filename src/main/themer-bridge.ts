import { generatePrivateColors } from '@gravity-ui/uikit-themer';
import type { AppearanceMode, RGBA, ThemeBackgroundPair } from '../shared/types';
import { APPEARANCE_MODES, FALLBACK_BACKGROUNDS } from '../shared/constants';

// key = variable name suffix: "50", "100 Solid", "550 Solid", …
export type BrandScale = Record<string, RGBA>;
export type BrandScaleByTheme = Record<AppearanceMode, BrandScale>;

function rgbToHex(r: number, g: number, b: number): string {
  return '#' + [r, g, b]
    .map(v => Math.round(v * 255).toString(16).padStart(2, '0'))
    .join('');
}

// Parse "rgb(r g b)" or "rgb(r g b / a)" → RGBA (components 0..1)
function parseCssColor(css: string): RGBA {
  const m = css.match(/rgb\((\d+)\s+(\d+)\s+(\d+)(?:\s*\/\s*([\d.]+))?\)/);
  if (!m) throw new Error(`Cannot parse color: ${css}`);
  return {
    r: parseInt(m[1]) / 255,
    g: parseInt(m[2]) / 255,
    b: parseInt(m[3]) / 255,
    a: m[4] !== undefined ? parseFloat(m[4]) : 1,
  };
}

// Map themer output key → Figma variable name suffix (null = skip)
function themerKeyToSuffix(key: string): string | null {
  if (key === '550') return null; // pure brand color at full opacity — covered by "550 Solid"
  if (key.endsWith('-solid')) return key.slice(0, -'-solid'.length) + ' Solid';
  return key; // alpha variant: "50", "100", …, "500"
}

function generateForMode(
  brandHex: string,
  mode: AppearanceMode,
  backgrounds: Record<AppearanceMode, ThemeBackgroundPair>,
): BrandScale {
  const bg = backgrounds[mode];
  const isLight = mode === 'Light' || mode === 'Light HC';

  // themer always wants the lighter color in lightBg, darker in darkBg
  const lightHex = isLight
    ? rgbToHex(bg.primary.r, bg.primary.g, bg.primary.b)
    : rgbToHex(bg.contrasting.r, bg.contrasting.g, bg.contrasting.b);
  const darkHex = isLight
    ? rgbToHex(bg.contrasting.r, bg.contrasting.g, bg.contrasting.b)
    : rgbToHex(bg.primary.r, bg.primary.g, bg.primary.b);

  const raw = generatePrivateColors({
    theme: isLight ? 'light' : 'dark',
    colorToken: 'brand',
    colorValue: brandHex,
    lightBg: lightHex,
    darkBg: darkHex,
  }) as Record<string, string>;

  const scale: BrandScale = {};
  for (const [key, css] of Object.entries(raw)) {
    const suffix = themerKeyToSuffix(key);
    if (suffix !== null) scale[suffix] = parseCssColor(css);
  }
  return scale;
}

export function generateBrandScale(
  brandHex: string,
  backgrounds: Record<AppearanceMode, ThemeBackgroundPair> = FALLBACK_BACKGROUNDS,
): BrandScaleByTheme {
  const result = {} as BrandScaleByTheme;
  for (const mode of APPEARANCE_MODES) {
    result[mode] = generateForMode(brandHex, mode, backgrounds);
  }
  return result;
}
