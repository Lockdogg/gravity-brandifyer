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

const CONTRASTING_MODE: Record<AppearanceMode, AppearanceMode> = {
  Light: 'Dark',
  Dark: 'Light',
  'Light HC': 'Dark HC',
  'Dark HC': 'Light HC',
};

// Follow alias chain to resolve a COLOR variable to an RGB value.
// Falls back to the first available mode in the target variable when modeId is missing.
function resolveColor(variable: Variable, modeId: string, depth = 0): RGB | null {
  if (depth > 4) return null;

  const value =
    variable.valuesByMode[modeId] ??
    variable.valuesByMode[Object.keys(variable.valuesByMode)[0] ?? ''];

  if (!value) return null;

  if (typeof value === 'object' && 'type' in value && value.type === 'VARIABLE_ALIAS') {
    const target = figma.variables.getVariableById(value.id);
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

export function inspectLibrary(): LibInfo {
  const collections = figma.variables.getLocalVariableCollections();

  const privateColorsColl = collections.find(c => c.name === COLLECTION_NAMES.privateColors);
  const appearanceColl    = collections.find(c => c.name === COLLECTION_NAMES.appearance);
  const brandColl         = collections.find(c => c.name === COLLECTION_NAMES.brand);

  const missing: string[] = [];
  if (!privateColorsColl) missing.push(COLLECTION_NAMES.privateColors);
  if (!appearanceColl)    missing.push(COLLECTION_NAMES.appearance);
  if (!brandColl)         missing.push(COLLECTION_NAMES.brand);

  if (missing.length > 0) {
    throw new InspectError(`Не найдены коллекции: ${missing.join(', ')}`, missing);
  }

  const pc  = privateColorsColl!;
  const app = appearanceColl!;
  const br  = brandColl!;

  const existingBrands      = br.modes.map(m => m.name);
  const brandModeCount      = br.modes.length;
  const privateColorsHasModes = pc.modes.length > 1;

  const appearanceModeMap = new Map(app.modes.map(m => [m.name, m.modeId]));

  // Look for any "<Brand>/Branding/Base Background" variable in Appearance.
  const bgVar =
    figma.variables
      .getLocalVariables('COLOR')
      .find(
        v =>
          v.variableCollectionId === app.id &&
          v.name.endsWith('/Branding/Base Background')
      ) ?? null;

  const themeBackgrounds = {} as LibInfo['themeBackgrounds'];

  for (const mode of APPEARANCE_MODES) {
    const modeId           = appearanceModeMap.get(mode);
    const contrastingModeId = appearanceModeMap.get(CONTRASTING_MODE[mode]);

    const primary =
      bgVar && modeId
        ? (resolveColor(bgVar, modeId) ?? FALLBACK_BACKGROUNDS[mode].primary)
        : FALLBACK_BACKGROUNDS[mode].primary;

    const contrasting =
      bgVar && contrastingModeId
        ? (resolveColor(bgVar, contrastingModeId) ?? FALLBACK_BACKGROUNDS[mode].contrasting)
        : FALLBACK_BACKGROUNDS[mode].contrasting;

    themeBackgrounds[mode] = { primary, contrasting };
  }

  return {
    existingBrands,
    brandModeCount,
    themeBackgrounds,
    privateColorsHasModes,
    collectionIds: {
      privateColors: pc.id,
      appearance:    app.id,
      brand:         br.id,
    },
    appearanceModes: app.modes,
  };
}
