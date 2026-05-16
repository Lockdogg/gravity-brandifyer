import { COLLECTION_NAMES } from '../shared/constants';

export type ProgressCallback = (current: number, total: number) => void;

const PC_THEMES = new Set(['Light', 'Dark', 'Light-HC', 'Dark-HC']);

function isPrivateColorsName(name: string, brandPrefix: string): boolean {
  const parts = name.split('/');
  return parts[0] === brandPrefix && PC_THEMES.has(parts[1] ?? '');
}

async function resolveToPrivateColors(
  variable: Variable,
  modeId: string,
  brandPrefix: string,
  cache: Map<string, string | null>,
  localVarMap: Map<string, Variable>,
  depth = 0,
): Promise<string | null> {
  const cacheKey = `${variable.id}:${modeId}`;
  if (cache.has(cacheKey)) return cache.get(cacheKey) ?? null;
  if (depth > 8) return null;

  if (isPrivateColorsName(variable.name, brandPrefix)) {
    cache.set(cacheKey, variable.name);
    return variable.name;
  }

  const value =
    variable.valuesByMode[modeId] ??
    variable.valuesByMode[Object.keys(variable.valuesByMode)[0] ?? ''];

  if (!value || typeof value !== 'object' || !('type' in value) || value.type !== 'VARIABLE_ALIAS') {
    cache.set(cacheKey, null);
    return null;
  }

  const target = localVarMap.get(value.id) ?? await figma.variables.getVariableByIdAsync(value.id);
  if (!target) { cache.set(cacheKey, null); return null; }

  const targetModeId =
    modeId in target.valuesByMode ? modeId : (Object.keys(target.valuesByMode)[0] ?? '');

  const result = await resolveToPrivateColors(target, targetModeId, brandPrefix, cache, localVarMap, depth + 1);
  cache.set(cacheKey, result);
  return result;
}

// Detect which color family the base brand uses for its brand color (e.g. "Blue" for YC).
// We follow the chain of the canonical `<base>/Branding/Base Brand` var.
async function detectBrandFamily(
  baseBrandVars: Variable[],
  base: string,
  modeId: string,
  resolveCache: Map<string, string | null>,
  localVarMap: Map<string, Variable>,
): Promise<string | null> {
  const anchor = baseBrandVars.find(v => v.name === `${base}/Branding/Base Brand`);
  if (!anchor) return null;
  const pcName = await resolveToPrivateColors(anchor, modeId, base, resolveCache, localVarMap);
  if (!pcName) return null;
  const parts = pcName.slice(base.length).split('/').filter(Boolean);
  const familyIdx = PC_THEMES.has(parts[0] ?? '') ? 1 : 0;
  return parts[familyIdx] ?? null; // e.g. "Blue"
}

// baseBrandFamily: if non-null AND terminal family matches it → try Brand/ first (Phase-1 scale).
// This ensures Branding/Base Brand → Brand/550 Solid, but Branding/Text Link Visited → Purple stays.
function lookupExtVar(
  externalVarMap: Map<string, LibraryVariable>,
  actualPcPrefix: string,
  pcName: string,
  base: string,
  baseBrandFamily: string | null,
): LibraryVariable | undefined {
  const suffix = pcName.slice(base.length); // e.g. "/Light/Blue/550 Solid"
  const parts = suffix.split('/').filter(Boolean);
  const hasTheme = PC_THEMES.has(parts[0] ?? '');
  const strippedParts = hasTheme ? parts.slice(1) : parts;
  const terminalFamily = strippedParts[0] ?? '';

  // If terminal family is the base brand's chromatic family → Brand/ takes priority
  if (baseBrandFamily && terminalFamily === baseBrandFamily && strippedParts.length >= 2) {
    const token = strippedParts.slice(1).join('/');
    if (hasTheme) {
      const v = externalVarMap.get(`${actualPcPrefix}/${parts[0]}/Brand/${token}`);
      if (v) return v;
    }
    const v = externalVarMap.get(`${actualPcPrefix}/Brand/${token}`);
    if (v) return v;
  }

  // Normal: exact match (old-style: theme in name)
  let extVar = externalVarMap.get(actualPcPrefix + suffix);
  if (extVar) return extVar;
  // Theme-stripped fallback (new-style: theme in Figma mode)
  if (hasTheme) {
    extVar = externalVarMap.get(`${actualPcPrefix}/${strippedParts.join('/')}`);
  }
  return extVar;
}

function detectAppearanceBase(vars: Variable[], collectionId: string, hint: string): string {
  const prefixes = [...new Set(
    vars.filter(v => v.variableCollectionId === collectionId).map(v => v.name.split('/')[0] ?? '').filter(Boolean),
  )];
  return prefixes.includes(hint) ? hint : (prefixes[0] ?? hint);
}

export async function writeAppearanceGroup(
  brandName: string,
  baseBrandHint: string,
  appearanceColl: VariableCollection,
  onProgress: ProgressCallback,
): Promise<number> {
  const allColorVars = await figma.variables.getLocalVariablesAsync('COLOR');
  const localVarMap = new Map<string, Variable>(allColorVars.map(v => [v.id, v]));

  const base = detectAppearanceBase(allColorVars, appearanceColl.id, baseBrandHint);
  const baseBrandVars = allColorVars.filter(
    v => v.variableCollectionId === appearanceColl.id && v.name.startsWith(base + '/'),
  );

  if (baseBrandVars.length === 0) throw new Error('Не найдены бренды в коллекции Appearance');

  const libCollections = await figma.teamLibrary.getAvailableLibraryVariableCollectionsAsync();
  let externalLibVars: LibraryVariable[] = [];
  let foundLib = false;

  for (const col of libCollections) {
    if (col.name !== COLLECTION_NAMES.privateColors) continue;
    const vars = await figma.teamLibrary.getVariablesInLibraryCollectionAsync(col.key);
    if (vars.some(v => v.name.split('/')[0]?.toLowerCase() === brandName.toLowerCase())) {
      externalLibVars = vars;
      foundLib = true;
      break;
    }
  }

  if (!foundLib) throw new Error(`Подключите библиотеку приватных цветов «${brandName}»`);

  const externalVarMap = new Map<string, LibraryVariable>(externalLibVars.map(v => [v.name, v]));
  const actualPcPrefix =
    [...externalVarMap.keys()].map(n => n.split('/')[0] ?? '')
      .find(p => p.toLowerCase() === brandName.toLowerCase()) ?? brandName;

  const existingNewVars = new Map<string, Variable>(
    allColorVars
      .filter(v => v.variableCollectionId === appearanceColl.id && v.name.startsWith(brandName + '/'))
      .map(v => [v.name, v]),
  );

  const modeIds = appearanceColl.modes.map(m => m.modeId);
  const resolveCache = new Map<string, string | null>();
  const importCache = new Map<string, Variable>();

  // Detect which color family the base brand uses for brand colors (e.g. "Blue").
  // Used to remap Branding/* vars to the Phase-1 "Brand" family instead.
  const baseBrandFamily = await detectBrandFamily(baseBrandVars, base, modeIds[0] ?? '', resolveCache, localVarMap);

  // Phase 1 — resolve alias chains (reports first half of progress)
  type Resolved = { baseVar: Variable; newName: string; modeResults: Map<string, string | null> };
  const resolved: Resolved[] = [];
  const neededKeys = new Set<string>();

  for (let i = 0; i < baseBrandVars.length; i++) {
    const baseVar = baseBrandVars[i]!;
    const newName = brandName + baseVar.name.slice(base.length);
    const modeResults = new Map<string, string | null>();
    const brandFamilyForVar = baseVar.name.includes('/Branding/') ? baseBrandFamily : null;

    for (const modeId of modeIds) {
      const pcName = await resolveToPrivateColors(baseVar, modeId, base, resolveCache, localVarMap);
      modeResults.set(modeId, pcName);
      if (pcName) {
        const extVar = lookupExtVar(externalVarMap, actualPcPrefix, pcName, base, brandFamilyForVar);
        if (extVar) neededKeys.add(extVar.key);
      }
    }

    resolved.push({ baseVar, newName, modeResults });
    onProgress(i + 1, baseBrandVars.length * 2 + neededKeys.size);
  }

  const totalSteps = baseBrandVars.length + neededKeys.size + resolved.length;

  // Phase 2 — import external vars sequentially
  const keyList = [...neededKeys];
  for (let i = 0; i < keyList.length; i++) {
    const key = keyList[i]!;
    const imported = await figma.variables.importVariableByKeyAsync(key);
    importCache.set(key, imported);
    onProgress(baseBrandVars.length + i + 1, totalSteps);
  }

  // Phase 3 — create/update vars and set aliases
  for (let i = 0; i < resolved.length; i++) {
    const { baseVar, newName, modeResults } = resolved[i]!;

    let newVar = existingNewVars.get(newName);
    if (!newVar) {
      newVar = figma.variables.createVariable(newName, appearanceColl, 'COLOR');
      existingNewVars.set(newName, newVar);
    }

    const brandFamilyForVar = baseVar.name.includes('/Branding/') ? baseBrandFamily : null;
    for (const modeId of modeIds) {
      const pcName = modeResults.get(modeId);
      if (pcName) {
        const extVar = lookupExtVar(externalVarMap, actualPcPrefix, pcName, base, brandFamilyForVar);
        const imported = extVar ? importCache.get(extVar.key) : undefined;
        if (imported) {
          newVar.setValueForMode(modeId, { type: 'VARIABLE_ALIAS', id: imported.id });
          continue;
        }
      }
      newVar.setValueForMode(modeId, { type: 'VARIABLE_ALIAS', id: baseVar.id });
    }

    onProgress(baseBrandVars.length + keyList.length + i + 1, totalSteps);
  }

  return resolved.length;
}

export async function writeBrandMode(
  brandName: string,
  baseBrandModeName: string,
  brandColl: VariableCollection,
  appearanceColl: VariableCollection,
  onProgress: ProgressCallback,
): Promise<number> {
  if (brandColl.modes.some(m => m.name === brandName))
    throw new Error(`Бренд «${brandName}» уже существует в коллекции Brand`);

  const baseModeId = brandColl.modes.find(m => m.name === baseBrandModeName)?.modeId;
  if (!baseModeId)
    throw new Error(`Базовый бренд «${baseBrandModeName}» не найден в коллекции Brand`);

  const newModeId = brandColl.addMode(brandName);

  const allColorVars = await figma.variables.getLocalVariablesAsync('COLOR');
  const localVarMap = new Map<string, Variable>(allColorVars.map(v => [v.id, v]));
  const brandColorVars = allColorVars.filter(v => v.variableCollectionId === brandColl.id);

  const appearanceVarMap = new Map<string, Variable>(
    allColorVars
      .filter(v => v.variableCollectionId === appearanceColl.id && v.name.startsWith(brandName + '/'))
      .map(v => [v.name, v]),
  );

  let count = 0;
  for (let i = 0; i < brandColorVars.length; i++) {
    const brandVar = brandColorVars[i]!;
    const baseValue = brandVar.valuesByMode[baseModeId];

    if (baseValue && typeof baseValue === 'object' && 'type' in baseValue && baseValue.type === 'VARIABLE_ALIAS') {
      const baseTarget = localVarMap.get(baseValue.id) ?? await figma.variables.getVariableByIdAsync(baseValue.id);
      if (baseTarget) {
        const firstSlash = baseTarget.name.indexOf('/');
        if (firstSlash !== -1) {
          const newTargetName = brandName + baseTarget.name.slice(firstSlash);
          const newAppearanceVar = appearanceVarMap.get(newTargetName);
          if (newAppearanceVar) {
            brandVar.setValueForMode(newModeId, { type: 'VARIABLE_ALIAS', id: newAppearanceVar.id });
            count++;
          }
        }
      }
    }

    onProgress(i + 1, brandColorVars.length);
  }

  return count;
}
