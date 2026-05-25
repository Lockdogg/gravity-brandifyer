import { COLLECTION_NAMES, PC_THEMES } from '../shared/constants';
import type { AppearanceMode, BrandingEntry } from '../shared/types';
import type { BrandScaleByTheme } from './themer-bridge';

export type ProgressCallback = (current: number, total: number) => void;

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

  const target = localVarMap.get(value.id) ?? await figma.variables.getVariableByIdAsync(value.id).catch(() => null);
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
    if (extVar) return extVar;
  }
  // Prefix-less fallback (e.g. DataLens: vars named Light/Blue/550 with no brand prefix)
  if (actualPcPrefix === '') {
    const bare = suffix.startsWith('/') ? suffix.slice(1) : suffix;
    extVar = externalVarMap.get(bare);
    if (extVar) return extVar;
    if (hasTheme) {
      extVar = externalVarMap.get(strippedParts.join('/'));
    }
  }
  return extVar;
}

function detectAppearanceBase(vars: Variable[], collectionId: string, hint: string): string {
  const prefixes = [...new Set(
    vars.filter(v => v.variableCollectionId === collectionId).map(v => v.name.split('/')[0] ?? '').filter(Boolean),
  )];
  return prefixes.includes(hint) ? hint : (prefixes[0] ?? hint);
}

const PC_THEME_TO_MODE: Record<string, AppearanceMode> = {
  Light: 'Light',
  Dark: 'Dark',
  'Light-HC': 'Light HC',
  'Dark-HC': 'Dark HC',
};

export async function writeAppearanceGroup(
  brandName: string,
  baseBrandHint: string,
  appearanceColl: VariableCollection,
  pcLibKey: string,
  pcBrandName: string,
  onProgress: ProgressCallback,
): Promise<{ count: number; brandingEntries: BrandingEntry[]; brandScale: BrandScaleByTheme | null }> {
  try {
    return await _writeAppearanceGroup(brandName, baseBrandHint, appearanceColl, pcLibKey, pcBrandName, onProgress);
  } catch (err) {
    throw new Error(`WAG: ${err instanceof Error ? err.message : String(err)}`);
  }
}

async function _writeAppearanceGroup(
  brandName: string,
  baseBrandHint: string,
  appearanceColl: VariableCollection,
  pcLibKey: string,
  pcBrandName: string,
  onProgress: ProgressCallback,
): Promise<{ count: number; brandingEntries: BrandingEntry[]; brandScale: BrandScaleByTheme | null }> {
  let allColorVars: Variable[];
  try {
    allColorVars = await figma.variables.getLocalVariablesAsync('COLOR');
  } catch (err) {
    throw new Error(`getLocalVars: ${err instanceof Error ? err.message : String(err)}`);
  }
  const localVarMap = new Map<string, Variable>(allColorVars.map(v => [v.id, v]));

  const base = detectAppearanceBase(allColorVars, appearanceColl.id, baseBrandHint);
  const collectionIdOrder = new Map<string, number>(appearanceColl.variableIds.map((id, i) => [id, i]));
  const baseBrandVars = allColorVars
    .filter(v => v.variableCollectionId === appearanceColl.id && v.name.startsWith(base + '/'))
    .sort((a, b) => (collectionIdOrder.get(a.id) ?? 0) - (collectionIdOrder.get(b.id) ?? 0));

  if (baseBrandVars.length === 0) throw new Error('Не найдены бренды в коллекции Appearance');

  let externalLibVars: LibraryVariable[];
  try {
    externalLibVars = await figma.teamLibrary.getVariablesInLibraryCollectionAsync(pcLibKey);
  } catch (err) {
    throw new Error(`getVariablesInLibraryCollection(${pcLibKey}): ${err instanceof Error ? err.message : String(err)}`);
  }
  if (externalLibVars.length === 0) throw new Error('Выбранная библиотека не содержит переменных');

  const externalVarMap = new Map<string, LibraryVariable>(externalLibVars.map(v => [v.name, v]));
  const actualPcPrefix = pcBrandName;


  const existingNewVars = new Map<string, Variable>(
    allColorVars
      .filter(v => v.variableCollectionId === appearanceColl.id && v.name.startsWith(brandName + '/'))
      .map(v => [v.name, v]),
  );

  const modeIds = appearanceColl.modes.map(m => m.modeId);
  const resolveCache = new Map<string, string | null>();
  const importCache = new Map<string, Variable>();

  // Skip re-importing vars already in the file from a previous run (key === library key)
  const allVarsByKey = new Map<string, Variable>(allColorVars.map(v => [v.key, v]));
  for (const libVar of externalLibVars) {
    const local = allVarsByKey.get(libVar.key);
    if (local) importCache.set(libVar.key, local);
  }

  let baseBrandFamily: string | null = null;
  try {
    baseBrandFamily = await detectBrandFamily(baseBrandVars, base, modeIds[0] ?? '', resolveCache, localVarMap);
  } catch (err) {
    throw new Error(`detectBrandFamily: ${err instanceof Error ? err.message : String(err)}`);
  }

  // Pre-fetch alias targets for non-Branding vars that are NOT in localVarMap (external PC library).
  // Done in parallel before the main loop to avoid serial awaits.
  const externalAliasIds = new Set<string>();
  for (const v of baseBrandVars) {
    if (v.name.includes('/Branding/')) continue;
    for (const modeId of modeIds) {
      const val = v.valuesByMode[modeId] ?? v.valuesByMode[Object.keys(v.valuesByMode)[0] ?? ''];
      if (val && typeof val === 'object' && 'type' in val && val.type === 'VARIABLE_ALIAS') {
        const id = (val as VariableAlias).id;
        if (!localVarMap.has(id)) externalAliasIds.add(id);
      }
    }
  }
  const idList = [...externalAliasIds];
  const fetchedExternal = await Promise.all(idList.map(id => figma.variables.getVariableByIdAsync(id).catch(() => null)));
  const externalAliasMap = new Map<string, Variable>();
  fetchedExternal.forEach((v, i) => { if (v) externalAliasMap.set(idList[i]!, v); });

  // Phase 1 — resolve what needs to be imported.
  //
  // Branding/*: full async chain via resolveToPrivateColors → lookupExtVar → neededKeys.
  // Non-Branding: ONE level only.
  //   • Alias target in Appearance collection → intra-Appearance remap; no import. modeResults = null.
  //   • Alias target is a PC var (local or external, not Appearance) → import its remapped equivalent.
  //     modeResults stores the base brand's PC name so Phase 3b can call lookupExtVar.
  //   • Raw RGBA → no import. modeResults = null.
  type Resolved = { baseVar: Variable; newName: string; modeResults: Map<string, string | null> };
  const resolved: Resolved[] = [];
  const neededKeys = new Set<string>();

  // Pre-queue all visible Brand/* scale vars for import (used to build Phase 1 CSS block)
  if (actualPcPrefix !== '') {
    const prefix = actualPcPrefix + '/';
    for (const [name, libVar] of externalVarMap) {
      if (!name.startsWith(prefix)) continue;
      const parts = name.split('/');
      const brandIdx = parts.indexOf('Brand');
      if (brandIdx < 1) continue;
      if (!PC_THEMES.has(parts[brandIdx - 1] ?? '')) continue;
      neededKeys.add(libVar.key);
    }
  }

  for (let i = 0; i < baseBrandVars.length; i++) {
    const baseVar = baseBrandVars[i]!;
    const newName = brandName + baseVar.name.slice(base.length);
    const modeResults = new Map<string, string | null>();
    const isBranding = baseVar.name.includes('/Branding/');
    const brandFamilyForVar = isBranding ? baseBrandFamily : null;

    for (const modeId of modeIds) {
      if (isBranding) {
        const pcName = await resolveToPrivateColors(baseVar, modeId, base, resolveCache, localVarMap);
        modeResults.set(modeId, pcName);
        if (pcName) {
          const extVar = lookupExtVar(externalVarMap, actualPcPrefix, pcName, base, brandFamilyForVar);
          if (extVar) neededKeys.add(extVar.key);
        }
      } else {
        const value =
          baseVar.valuesByMode[modeId] ??
          baseVar.valuesByMode[Object.keys(baseVar.valuesByMode)[0] ?? ''];
        if (value && typeof value === 'object' && 'type' in value && value.type === 'VARIABLE_ALIAS') {
          const aliasId = (value as VariableAlias).id;
          const targetVar = localVarMap.get(aliasId) ?? externalAliasMap.get(aliasId);
          if (targetVar
            && targetVar.variableCollectionId !== appearanceColl.id
            && isPrivateColorsName(targetVar.name, base)) {
            // Direct alias to a PC var (local or external) → queue its remapped counterpart for import
            const extVar = lookupExtVar(externalVarMap, actualPcPrefix, targetVar.name, base, null);
            if (extVar) {
              neededKeys.add(extVar.key);
              modeResults.set(modeId, targetVar.name);
            } else {
              modeResults.set(modeId, null);
            }
          } else {
            // Appearance alias (intra-remap in Phase 3b) or unknown → no import needed
            modeResults.set(modeId, null);
          }
        } else {
          modeResults.set(modeId, null);
        }
      }
    }

    resolved.push({ baseVar, newName, modeResults });
    onProgress(i + 1, baseBrandVars.length);
  }

  // Phase 2 — import in batches of 25; keys already in importCache are skipped
  const IMPORT_BATCH = 25;
  const keyList = [...neededKeys].filter(k => !importCache.has(k));
  const totalSteps = baseBrandVars.length + keyList.length + resolved.length;

  for (let i = 0; i < keyList.length; i += IMPORT_BATCH) {
    const batch = keyList.slice(i, i + IMPORT_BATCH);
    const results = await Promise.all(
      batch.map(k =>
        figma.variables.importVariableByKeyAsync(k).catch(err => {
          throw new Error(`importVariableByKeyAsync(${k}): ${err instanceof Error ? err.message : String(err)}`);
        }),
      ),
    );
    results.forEach((v, j) => importCache.set(batch[j]!, v));
    onProgress(baseBrandVars.length + Math.min(i + IMPORT_BATCH, keyList.length), totalSteps);
  }

  // Phase 3a — create all vars first so intra-collection aliases can reference them regardless of order
  for (const { newName } of resolved) {
    if (!existingNewVars.has(newName)) {
      let v: Variable;
      try {
        v = figma.variables.createVariable(newName, appearanceColl, 'COLOR');
      } catch (err) {
        throw new Error(`createVariable(«${newName}»): ${err instanceof Error ? err.message : String(err)}`);
      }
      existingNewVars.set(newName, v);
    }
  }

  // Phase 3b — set alias values
  const setAlias = (v: Variable, modeId: string, id: string, context: string) => {
    if (!id) throw new Error(`Пустой ID алиаса у ${context}`);
    v.setValueForMode(modeId, { type: 'VARIABLE_ALIAS', id });
  };

  for (let i = 0; i < resolved.length; i++) {
    const { baseVar, newName, modeResults } = resolved[i]!;
    const newVar = existingNewVars.get(newName)!;
    const isBranding = baseVar.name.includes('/Branding/');
    const brandFamilyForVar = isBranding ? baseBrandFamily : null;

    for (const modeId of modeIds) {
      try {
        const pcName = modeResults.get(modeId);

        if (pcName) {
          // Branding (full-chain PC) or non-Branding direct PC alias → set to imported var
          const extVar = lookupExtVar(externalVarMap, actualPcPrefix, pcName, base, brandFamilyForVar);
          const imported = extVar ? importCache.get(extVar.key) : undefined;
          if (imported) {
            setAlias(newVar, modeId, imported.id, newName);
            continue;
          }
        }

        const rawValue =
          baseVar.valuesByMode[modeId] ??
          baseVar.valuesByMode[Object.keys(baseVar.valuesByMode)[0] ?? ''];

        // Non-Branding: if direct alias target is an Appearance var → remap to new brand namespace
        if (!isBranding && rawValue && typeof rawValue === 'object' && 'type' in rawValue && rawValue.type === 'VARIABLE_ALIAS') {
          const targetVar = localVarMap.get((rawValue as VariableAlias).id);
          if (targetVar && targetVar.variableCollectionId === appearanceColl.id) {
            const remappedName = brandName + targetVar.name.slice(base.length);
            const remappedVar = existingNewVars.get(remappedName);
            if (remappedVar) {
              setAlias(newVar, modeId, remappedVar.id, newName);
              continue;
            }
          }
        }

        // Fallback: copy the base var's raw value (e.g. RGBA for Base Background).
        // Skip VARIABLE_ALIAS values whose target ID is not a known local variable —
        // stale or external IDs cause Figma to throw "cannot convert to object".
        const fallback = rawValue ?? { r: 0, g: 0, b: 0, a: 1 };
        if (fallback && typeof fallback === 'object' && 'type' in fallback && (fallback as VariableAlias).type === 'VARIABLE_ALIAS') {
          const aliasId = (fallback as VariableAlias).id;
          if (!localVarMap.has(aliasId)) continue;
        }
        newVar.setValueForMode(modeId, fallback as VariableValue);
      } catch (_err) {
        // skip — don't block the whole generation over one variable
      }
    }

    onProgress(baseBrandVars.length + keyList.length + i + 1, totalSteps);
  }

  const brandingEntries: BrandingEntry[] = resolved
    .filter(r => r.baseVar.name.includes('/Branding/'))
    .map(r => ({
      suffix: r.newName.slice(r.newName.indexOf('/Branding/') + '/Branding/'.length),
      perMode: r.modeResults,
    }));

  // Build Phase 1 brand scale from imported Brand/* vars (RGBA from resolvedValuesByMode)
  const brandScaleData: BrandScaleByTheme = { Light: {}, Dark: {}, 'Light HC': {}, 'Dark HC': {} };
  let hasBrandScale = false;
  try { if (actualPcPrefix !== '') {
    const prefix = actualPcPrefix + '/';
    for (const importedVar of importCache.values()) {
      if (!importedVar.name.startsWith(prefix)) continue;
      const parts = importedVar.name.split('/');
      const brandIdx = parts.indexOf('Brand');
      if (brandIdx < 1) continue;
      const mode = PC_THEME_TO_MODE[parts[brandIdx - 1] ?? ''];
      if (!mode) continue;
      const suffix = parts.slice(brandIdx + 1).join('/');
      if (!suffix) continue;
      // resolvedValuesByMode may be empty for external-linked vars; fallback to valuesByMode (raw color)
      const resolved = Object.values(importedVar.resolvedValuesByMode)[0];
      const raw = Object.values(importedVar.valuesByMode)[0];
      const rgba =
        (resolved?.type === 'COLOR' ? resolved.resolvedValue as { r: number; g: number; b: number; a: number } : null) ??
        (raw && typeof raw === 'object' && 'r' in raw ? raw as { r: number; g: number; b: number; a: number } : null);
      if (!rgba) continue;
      brandScaleData[mode][suffix] = rgba;
      hasBrandScale = true;
    }
  } } catch (_err) { /* skip brandScale extraction errors */ }

  return { count: resolved.length, brandingEntries, brandScale: hasBrandScale ? brandScaleData : null };
}

export async function writeBrandMode(
  brandName: string,
  baseBrandModeName: string,
  brandColl: VariableCollection,
  appearanceColl: VariableCollection,
  onProgress: ProgressCallback,
): Promise<number> {
  try {
    return await _writeBrandMode(brandName, baseBrandModeName, brandColl, appearanceColl, onProgress);
  } catch (err) {
    throw new Error(`WBM: ${err instanceof Error ? err.message : String(err)}`);
  }
}

async function _writeBrandMode(
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

  let newModeId: string;
  try {
    newModeId = brandColl.addMode(brandName);
  } catch (err) {
    throw new Error(`addMode(«${brandName}»): ${err instanceof Error ? err.message : String(err)}`);
  }

  let allColorVars: Variable[];
  try {
    allColorVars = await figma.variables.getLocalVariablesAsync('COLOR');
  } catch (err) {
    throw new Error(`writeBrandMode getLocalVars: ${err instanceof Error ? err.message : String(err)}`);
  }
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
      let baseTarget: Variable | null;
      try {
        baseTarget = localVarMap.get(baseValue.id) ?? await figma.variables.getVariableByIdAsync(baseValue.id);
      } catch (err) {
        throw new Error(`getVariableByIdAsync(${baseValue.id}) for brand var «${brandVar.name}»: ${err instanceof Error ? err.message : String(err)}`);
      }
      if (baseTarget) {
        const firstSlash = baseTarget.name.indexOf('/');
        if (firstSlash !== -1) {
          const newTargetName = brandName + baseTarget.name.slice(firstSlash);
          const newAppearanceVar = appearanceVarMap.get(newTargetName);
          if (newAppearanceVar) {
            try {
              brandVar.setValueForMode(newModeId, { type: 'VARIABLE_ALIAS', id: newAppearanceVar.id });
              count++;
            } catch (err) {
              throw new Error(`setValueForMode Brand«${brandVar.name}»→Appearance«${newTargetName}»(id:${newAppearanceVar.id}): ${err instanceof Error ? err.message : String(err)}`);
            }
          }
        }
      }
    }

    onProgress(i + 1, brandColorVars.length);
  }

  return count;
}
