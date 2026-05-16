import type { AppearanceMode } from '../shared/types';
import type { BrandScaleByTheme } from './themer-bridge';
import { COLLECTION_NAMES } from '../shared/constants';
import { generateBrandCss } from './css-export';

export type BrandCssEntry = { brandName: string; cssContent: string };

const THEME_FROM_PATH: Partial<Record<string, AppearanceMode>> = {
  'Light':    'Light',
  'Dark':     'Dark',
  'Light-HC': 'Light HC',
  'Dark-HC':  'Dark HC',
};

export async function readExistingBrandCss(): Promise<BrandCssEntry[]> {
  const collections = await figma.variables.getLocalVariableCollectionsAsync();
  const collection = collections.find(c => c.name === COLLECTION_NAMES.privateColors);
  if (!collection) return [];

  const allVars = await figma.variables.getLocalVariablesAsync('COLOR');
  const brandVars = allVars.filter(
    v => v.variableCollectionId === collection.id && v.name.includes('/Brand/')
  );
  if (brandVars.length === 0) return [];

  const modeId = collection.defaultModeId;
  const brandScales = new Map<string, BrandScaleByTheme>();

  for (const v of brandVars) {
    // Pattern: "<brandName>/<themePath>/Brand/<suffix>"
    const parts = v.name.split('/');
    if (parts.length < 4 || parts[2] !== 'Brand') continue;

    const brandName = parts[0]!;
    const themePath = parts[1]!;
    const suffix    = parts.slice(3).join('/');

    const mode = THEME_FROM_PATH[themePath];
    if (!mode) continue;

    const raw = v.valuesByMode[modeId];
    if (!raw || typeof raw !== 'object' || !('r' in raw)) continue;
    const rgba = raw as { r: number; g: number; b: number; a: number };

    if (!brandScales.has(brandName)) {
      brandScales.set(brandName, { Light: {}, Dark: {}, 'Light HC': {}, 'Dark HC': {} } as BrandScaleByTheme);
    }
    brandScales.get(brandName)![mode][suffix] = rgba;
  }

  return Array.from(brandScales.entries()).map(([brandName, scale]) => ({
    brandName,
    cssContent: generateBrandCss(brandName, scale),
  }));
}
