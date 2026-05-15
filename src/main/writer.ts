import type { BrandScaleByTheme } from './themer-bridge';
import { generateFamilyScale } from './themer-bridge';
import { COLLECTION_NAMES, PRIVATE_COLORS_THEME, APPEARANCE_MODES } from '../shared/constants';
import type { ColorFamily } from '../shared/messages';
import ycBaseColors from './data/yc-base-colors.json';

type RgbaRecord = Record<string, { r: number; g: number; b: number; a: number }>;

async function getOrCreateCollection(name: string): Promise<VariableCollection> {
  const collections = await figma.variables.getLocalVariableCollectionsAsync();
  return collections.find(c => c.name === name)
    ?? figma.variables.createVariableCollection(name);
}

async function buildExistingMap(collectionId: string): Promise<Map<string, Variable>> {
  const all = await figma.variables.getLocalVariablesAsync('COLOR');
  return new Map(
    all.filter(v => v.variableCollectionId === collectionId).map(v => [v.name, v])
  );
}

function setColor(variable: Variable, modeId: string, rgba: { r: number; g: number; b: number; a: number }) {
  variable.setValueForMode(modeId, { r: rgba.r, g: rgba.g, b: rgba.b, a: rgba.a });
}

// Figma displays variables in forward creation order (first created = top).
// Desired visual order: themes Light→Dark→Dark-HC→Light-HC, families Orange→…→White,
// indices 1000 Solid→…→50 Solid then 500→…→50.
// So we write in exactly that order.

const THEME_WRITE_ORDER = ['Light', 'Dark', 'Dark-HC', 'Light-HC'];

function numericIndex(suffix: string): number {
  return parseInt(suffix.replace(' Solid', ''), 10);
}

function isSolid(suffix: string): boolean {
  return suffix.includes('Solid');
}

export async function writePrivateColorsFull(
  brandName: string,
  brandScale: BrandScaleByTheme,
  colorOverrides: Partial<Record<ColorFamily, string>> = {},
): Promise<number> {
  const collection = await getOrCreateCollection(COLLECTION_NAMES.privateColors);
  const modeId = collection.defaultModeId;
  const existing = await buildExistingMap(collection.id);

  let count = 0;

  // Pre-compute override values: familyName/theme/suffix → RGBA
  // keyed as "<BrandName>/<ThemeName>/<Family>/<Suffix>"
  const overrideValues = new Map<string, { r: number; g: number; b: number; a: number }>();
  for (const [family, hex] of Object.entries(colorOverrides) as [ColorFamily, string][]) {
    if (!hex) continue;
    const familyScale = generateFamilyScale(hex, family);
    for (const mode of APPEARANCE_MODES) {
      const themeName = PRIVATE_COLORS_THEME[mode];
      for (const [suffix, rgba] of Object.entries(familyScale[mode])) {
        overrideValues.set(`${brandName}/${themeName}/${family}/${suffix}`, rgba);
      }
    }
  }

  // 1. System colors — group dump entries by theme, then write in desired visual order.
  // Within each theme: families in reverse-dump order (Orange first), indices reversed (1000 Solid first).
  const sourceData = ycBaseColors as RgbaRecord;

  const themeGroups: Record<string, Array<[string, { r: number; g: number; b: number; a: number }]>> = {};
  for (const entry of Object.entries(sourceData)) {
    const theme = entry[0].split('/')[1] ?? '';
    if (!themeGroups[theme]) themeGroups[theme] = [];
    themeGroups[theme].push(entry);
  }

  for (const theme of THEME_WRITE_ORDER) {
    const entries = themeGroups[theme] ?? [];
    // Dump order = reverse of desired visual order → reverse the whole list.
    for (const [ycKey, rgba] of [...entries].reverse()) {
      const varName = ycKey.replace(/^Yandex Cloud\//, `${brandName}/`);
      const variable = existing.get(varName)
        ?? figma.variables.createVariable(varName, collection, 'COLOR');
      setColor(variable, modeId, overrideValues.get(varName) ?? rgba);
      count++;
    }
  }

  // 2. Brand scale — write in visual order: solids descending, then alphas descending.
  const BRAND_MODE_WRITE_ORDER = ['Light', 'Dark', 'Dark HC', 'Light HC'] as const;
  for (const mode of BRAND_MODE_WRITE_ORDER) {
    const themeName = PRIVATE_COLORS_THEME[mode];
    const themeScale = brandScale[mode];

    const sortedEntries = Object.entries(themeScale).sort(([a], [b]) => {
      if (isSolid(a) !== isSolid(b)) return isSolid(a) ? -1 : 1; // solids first
      return numericIndex(b) - numericIndex(a);                    // descending within group
    });

    for (const [suffix, rgba] of sortedEntries) {
      const varName = `${brandName}/${themeName}/Brand/${suffix}`;
      const variable = existing.get(varName)
        ?? figma.variables.createVariable(varName, collection, 'COLOR');
      setColor(variable, modeId, rgba);
      count++;
    }
  }

  return count;
}

export const writePrivateBrandScale = writePrivateColorsFull;
