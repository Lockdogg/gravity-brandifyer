import type { AppearanceMode, LibInfo, RGB } from '../shared/types';
import {
  APPEARANCE_MODES,
  COLLECTION_NAMES,
  FALLBACK_BACKGROUNDS,
} from '../shared/constants';

export class InspectError extends Error {
  constructor(message: string, public readonly missingCollections?: string[]) {
    super(message);
    this.name = 'InspectError';
  }
}

export type InspectResult =
  | { phase: 'private-colors' }
  | { phase: 'main-lib'; info: LibInfo };

const CONTRASTING_MODE: Record<AppearanceMode, AppearanceMode> = {
  Light: 'Dark',
  Dark: 'Light',
  'Light HC': 'Dark HC',
  'Dark HC': 'Light HC',
};

async function resolveColor(variable: Variable, modeId: string, depth = 0): Promise<RGB | null> {
  if (depth > 4) return null;

  const value =
    variable.valuesByMode[modeId] ??
    variable.valuesByMode[Object.keys(variable.valuesByMode)[0] ?? ''];

  if (!value) return null;

  if (typeof value === 'object' && 'type' in value && value.type === 'VARIABLE_ALIAS') {
    const target = await figma.variables.getVariableByIdAsync(value.id);
    if (!target) return null;
    const targetModeId =
      modeId in target.valuesByMode
        ? modeId
        : (Object.keys(target.valuesByMode)[0] ?? '');
    return resolveColor(target, targetModeId, depth + 1);
  }

  if (typeof value === 'object' && 'r' in value) {
    const c = value as RGBA;
    return { r: c.r, g: c.g, b: c.b };
  }

  return null;
}

async function buildMainLibInfo(
  app: VariableCollection,
  br: VariableCollection
): Promise<LibInfo> {
  const existingBrands  = br.modes.map(m => m.name);
  const brandModeCount  = br.modes.length;

  const appearanceModeMap = new Map(app.modes.map(m => [m.name, m.modeId]));

  const allColorVars = await figma.variables.getLocalVariablesAsync('COLOR');
  const bgVar = allColorVars.find(
    v =>
      v.variableCollectionId === app.id &&
      v.name.endsWith('/Branding/Base Background')
  ) ?? null;

  const themeBackgrounds = {} as LibInfo['themeBackgrounds'];

  for (const mode of APPEARANCE_MODES) {
    const modeId            = appearanceModeMap.get(mode);
    const contrastingModeId = appearanceModeMap.get(CONTRASTING_MODE[mode]);

    const primary =
      bgVar && modeId
        ? (await resolveColor(bgVar, modeId) ?? FALLBACK_BACKGROUNDS[mode].primary)
        : FALLBACK_BACKGROUNDS[mode].primary;

    const contrasting =
      bgVar && contrastingModeId
        ? (await resolveColor(bgVar, contrastingModeId) ?? FALLBACK_BACKGROUNDS[mode].contrasting)
        : FALLBACK_BACKGROUNDS[mode].contrasting;

    themeBackgrounds[mode] = { primary, contrasting };
  }

  return {
    existingBrands,
    brandModeCount,
    themeBackgrounds,
    privateColorsLocal: false,
    collectionIds: {
      privateColors: null,
      appearance:    app.id,
      brand:         br.id,
    },
    appearanceModes: app.modes,
  };
}

export async function inspectLibrary(): Promise<InspectResult> {
  const collections = await figma.variables.getLocalVariableCollectionsAsync();

  const appearanceColl = collections.find(c => c.name === COLLECTION_NAMES.appearance);
  const brandColl      = collections.find(c => c.name === COLLECTION_NAMES.brand);

  const hasAppearance = Boolean(appearanceColl);
  const hasBrand      = Boolean(brandColl);

  // Phase 1: Private Colors file — no Appearance, no Brand
  if (!hasAppearance && !hasBrand) {
    return { phase: 'private-colors' };
  }

  // Error: only one of the two main lib collections is present
  if (!hasAppearance || !hasBrand) {
    const missing: string[] = [];
    if (!hasAppearance) missing.push(COLLECTION_NAMES.appearance);
    if (!hasBrand)      missing.push(COLLECTION_NAMES.brand);
    throw new InspectError(`Не найдены коллекции: ${missing.join(', ')}`, missing);
  }

  // Phase 2: Main lib file
  const info = await buildMainLibInfo(appearanceColl!, brandColl!);
  return { phase: 'main-lib', info };
}
