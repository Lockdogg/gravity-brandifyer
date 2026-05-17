import type { AppearanceMode, BrandingEntry } from '../shared/types';
import type { BrandScaleByTheme } from './themer-bridge';
import { COLLECTION_NAMES } from '../shared/constants';
import { generateBrandCss, generatePhase2Css } from './css-export';

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
    // Pattern A (regular):  "<brandName>/<themePath>/Brand/<suffix>"
    // Pattern B (service):  "[Group] Service/<brandName>/<themePath>/Brand/<suffix>"
    const parts = v.name.split('/');
    const brandSegIdx = parts.indexOf('Brand');
    if (brandSegIdx < 2) continue; // need at least brandName + theme before Brand

    const brandName = parts[brandSegIdx - 2]!;
    const themePath = parts[brandSegIdx - 1]!;
    const suffix    = parts.slice(brandSegIdx + 1).join('/');

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

export async function readExistingBrandingCss(appearanceColl: VariableCollection): Promise<BrandCssEntry[]> {
  const allVars = await figma.variables.getLocalVariablesAsync('COLOR');
  const localVarMap = new Map<string, Variable>(allVars.map(v => [v.id, v]));

  const brandingVars = allVars.filter(
    v => v.variableCollectionId === appearanceColl.id && v.name.includes('/Branding/'),
  );
  if (brandingVars.length === 0) return [];

  // Collect alias target IDs that are not in localVarMap (external library vars)
  const externalIds = new Set<string>();
  for (const v of brandingVars) {
    for (const { modeId } of appearanceColl.modes) {
      const raw = v.valuesByMode[modeId] ?? v.valuesByMode[Object.keys(v.valuesByMode)[0] ?? ''];
      if (raw && typeof raw === 'object' && 'type' in raw && raw.type === 'VARIABLE_ALIAS') {
        const id = (raw as VariableAlias).id;
        if (!localVarMap.has(id)) externalIds.add(id);
      }
    }
  }

  // Fetch external vars in parallel
  const externalMap = new Map<string, Variable>();
  await Promise.all([...externalIds].map(id =>
    figma.variables.getVariableByIdAsync(id).then(v => { if (v) externalMap.set(id, v); }),
  ));

  const getVar = (id: string) => localVarMap.get(id) ?? externalMap.get(id);

  const byBrand = new Map<string, Variable[]>();
  for (const v of brandingVars) {
    const brand = v.name.split('/')[0]!;
    if (!byBrand.has(brand)) byBrand.set(brand, []);
    byBrand.get(brand)!.push(v);
  }

  const results: BrandCssEntry[] = [];

  for (const [brandName, vars] of byBrand) {
    const brandingEntries: BrandingEntry[] = [];

    for (const v of vars) {
      const suffix = v.name.slice(v.name.indexOf('/Branding/') + '/Branding/'.length);
      const perMode = new Map<string, string | null>();

      for (const { modeId } of appearanceColl.modes) {
        const raw = v.valuesByMode[modeId] ?? v.valuesByMode[Object.keys(v.valuesByMode)[0] ?? ''];
        if (!raw || typeof raw !== 'object' || !('type' in raw) || raw.type !== 'VARIABLE_ALIAS') {
          perMode.set(modeId, null);
          continue;
        }

        let target = getVar((raw as VariableAlias).id);
        // Follow aliases, skipping intermediate Appearance vars
        for (let d = 0; d < 4 && target?.variableCollectionId === appearanceColl.id; d++) {
          const next = target.valuesByMode[modeId] ?? target.valuesByMode[Object.keys(target.valuesByMode)[0] ?? ''];
          if (!next || typeof next !== 'object' || !('type' in next) || next.type !== 'VARIABLE_ALIAS') break;
          target = getVar((next as VariableAlias).id);
        }

        perMode.set(modeId, target?.variableCollectionId !== appearanceColl.id ? (target?.name ?? null) : null);
      }

      brandingEntries.push({ suffix, perMode });
    }

    const cssContent = generatePhase2Css(brandName, brandingEntries, appearanceColl.modes);
    if (cssContent.includes('--g-color-')) results.push({ brandName, cssContent });
  }

  return results;
}
