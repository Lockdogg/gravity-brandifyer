import type { UiToMainMessage } from '../shared/messages';
import { inspectLibrary, InspectError } from './inspect';
import { generateBrandScale } from './themer-bridge';
import { writePrivateColorsFull, writeMultiBrandPack } from './writer';
import { writeAppearanceGroup, writeBrandMode } from './writer-phase2';
import { generateBrandCss, generatePhase2Css } from './css-export';
import { readExistingBrandCss, readExistingBrandingCss } from './reader';
import { COLLECTION_NAMES } from '../shared/constants';

// Theme-level names that appear as top-level prefix in some libraries (DataLens)
const PC_THEME_NAMES = new Set(['Light', 'Dark', 'Light-HC', 'Dark-HC', 'Light HC', 'Dark HC']);
// Color scale value names: "50", "550 Solid", "100 Alpha", etc.
const SCALE_RE = /^\d+(\s+(Solid|Alpha))?$/i;

function detectPcBrands(
  entries: Array<{ vars: LibraryVariable[]; collectionKey: string }>,
  fallbackName: string,
): Array<{ display: string; prefix: string; collectionKey: string }> {
  const seen = new Set<string>();
  const regularBrands: Array<{ display: string; prefix: string; collectionKey: string }> = [];
  const serviceBrands: Array<{ display: string; prefix: string; collectionKey: string }> = [];

  for (const { vars, collectionKey } of entries) {
    const names = vars.map(v => v.name);
    const level1 = [...new Set(names.map(n => n.split('/')[0] ?? '').filter(Boolean))];

    // Expand [X] Service groups → sub-brands at level-2
    const serviceGroups = level1.filter(p => /\bService\b/i.test(p));
    for (const sg of serviceGroups) {
      const subBrands = [...new Set(
        names
          .filter(n => n.startsWith(sg + '/'))
          .map(n => n.split('/')[1] ?? '')
          .filter(s => s && !PC_THEME_NAMES.has(s) && !SCALE_RE.test(s)),
      )];
      for (const sub of subBrands) {
        const prefix = `${sg}/${sub}`;
        if (!seen.has(prefix)) { seen.add(prefix); serviceBrands.push({ display: sub, prefix, collectionKey }); }
      }
    }

    // Regular brand prefixes
    for (const p of level1) {
      if (PC_THEME_NAMES.has(p) || SCALE_RE.test(p) || /\bSemantic\b/i.test(p) || /\bService\b/i.test(p)) continue;
      if (!seen.has(p)) { seen.add(p); regularBrands.push({ display: p, prefix: p, collectionKey }); }
    }
  }

  const result = [...regularBrands, ...serviceBrands];

  // Fallback for libraries where vars have no brand prefix (e.g. DataLens: Light/Blue/550…)
  if (result.length === 0) {
    const key = entries[0]?.collectionKey ?? '';
    return [{ display: fallbackName || 'Unknown', prefix: '', collectionKey: key }];
  }

  return result;
}

figma.showUI(__html__, { width: 480, height: 640, title: 'Gravity Brandifyer' });

figma.ui.onmessage = (msg: UiToMainMessage) => {
  if (msg.type === 'ui-ready') {
    (async () => {
      try {
        const result = await inspectLibrary();
        if (result.phase === 'private-colors') {
          const existingBrands = await readExistingBrandCss();
          figma.ui.postMessage({ type: 'phase-private-colors', existingBrands });
        } else {
          const collections = await figma.variables.getLocalVariableCollectionsAsync();
          const appearanceColl = collections.find(c => c.name === COLLECTION_NAMES.appearance)!;
          const existingBrandsCss = await readExistingBrandingCss(appearanceColl);
          figma.ui.postMessage({ type: 'phase-main-lib', info: result.info, existingBrandsCss });
        }
      } catch (err) {
        if (err instanceof InspectError) {
          figma.ui.postMessage({
            type: 'lib-error',
            message: err.message,
            missingCollections: err.missingCollections,
          });
        } else {
          const msg = err instanceof Error ? err.message : String(err);
          console.error('[Gravity Brandifyer] inspect error:', err);
          figma.ui.postMessage({ type: 'lib-error', message: `Ошибка: ${msg}` });
        }
      }
    })();
  } else if (msg.type === 'close') {
    figma.closePlugin();
  } else if (msg.type === 'request-lib-brands') {
    const { libKey } = msg;
    (async () => {
      try {
        const libCollections = await figma.teamLibrary.getAvailableLibraryVariableCollectionsAsync();
        const anchor = libCollections.find(c => c.key === libKey);
        const collectionName = anchor?.name ?? '';

        // Query ALL collections from the same library file (same libraryName) in parallel.
        // This works around Figma's per-collection variable limit: if a file has N brands
        // each stored as a separate published collection, all brands appear in the selector.
        const siblings = libCollections.filter(c => c.libraryName === anchor?.libraryName);
        const fetched = await Promise.all(
          siblings.map(async c => ({
            collectionKey: c.key,
            vars: await figma.teamLibrary.getVariablesInLibraryCollectionAsync(c.key),
          }))
        );

        const brands = detectPcBrands(fetched, collectionName);
        figma.ui.postMessage({ type: 'lib-brands', libKey, brands, collectionName });
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        console.error('[Gravity Brandifyer] request-lib-brands error:', message);
        figma.ui.postMessage({ type: 'lib-brands', libKey, brands: [], collectionName: '' });
      }
    })();
  } else if (msg.type === 'generate-phase2') {
    const { brandName, baseBrandName, pcLibKey, pcBrandName } = msg;
    (async () => {
      try {
        const collections = await figma.variables.getLocalVariableCollectionsAsync();
        const appearanceColl = collections.find(c => c.name === COLLECTION_NAMES.appearance);
        const brandColl = collections.find(c => c.name === COLLECTION_NAMES.brand);

        if (!appearanceColl || !brandColl) {
          figma.ui.postMessage({ type: 'phase2-error', message: 'Коллекции Appearance или Brand не найдены' });
          return;
        }

        // Fail fast if brand mode already exists — before writing anything
        if (brandColl.modes.some(m => m.name === brandName)) {
          figma.ui.postMessage({ type: 'phase2-error', message: `Бренд «${brandName}» уже существует` });
          return;
        }

        const onAppProgress = (c: number, t: number) =>
          figma.ui.postMessage({ type: 'phase2-progress', current: t > 0 ? Math.round((c / t) * 75) : 0, total: 100 });
        const onBrandProgress = (c: number, t: number) =>
          figma.ui.postMessage({ type: 'phase2-progress', current: 75 + (t > 0 ? Math.round((c / t) * 25) : 0), total: 100 });

        const { count: appCount, brandingEntries, brandScale } = await writeAppearanceGroup(brandName, baseBrandName, appearanceColl, pcLibKey, pcBrandName, onAppProgress);
        const brandCount = await writeBrandMode(brandName, baseBrandName, brandColl, appearanceColl, onBrandProgress);

        const phase2Css = generatePhase2Css(brandName, brandingEntries, appearanceColl.modes, !!brandScale);
        const cssContent = brandScale
          ? generateBrandCss(brandName, brandScale).trimEnd() + '\n\n' + phase2Css
          : phase2Css;
        figma.ui.postMessage({ type: 'phase2-done', brandName, varCount: appCount + brandCount, cssContent });
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        figma.ui.postMessage({ type: 'phase2-error', message });
      }
    })();
  } else if (msg.type === 'generate-multibrand') {
    const { groupName, brands, colorOverrides } = msg;
    (async () => {
      try {
        const { count, brandScales } = await writeMultiBrandPack(groupName, brands, colorOverrides);
        const cssEntries = brandScales.map(({ name, scale }) => ({
          brandName: name,
          cssContent: generateBrandCss(name, scale),
        }));
        figma.ui.postMessage({ type: 'multibrand-done', varCount: count, cssEntries });
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        figma.ui.postMessage({ type: 'multibrand-error', message: `Не удалось создать переменные: ${message}` });
      }
    })();
  } else if (msg.type === 'generate-private-colors') {
    const { brandName, brandHex, colorOverrides } = msg;
    (async () => {
      try {
        const scale = generateBrandScale(brandHex);
        const count = await writePrivateColorsFull(brandName, scale, colorOverrides);
        const cssContent = generateBrandCss(brandName, scale, colorOverrides);
        figma.ui.postMessage({ type: 'generate-done', varCount: count, cssContent, brandName });
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        figma.ui.postMessage({ type: 'generate-error', message: `Не удалось создать переменные: ${message}` });
      }
    })();
  }
};
