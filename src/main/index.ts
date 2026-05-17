import type { UiToMainMessage } from '../shared/messages';
import { inspectLibrary, InspectError } from './inspect';
import { generateBrandScale } from './themer-bridge';
import { writePrivateColorsFull, writeMultiBrandPack } from './writer';
import { writeAppearanceGroup, writeBrandMode } from './writer-phase2';
import { generateBrandCss, generatePhase2Css } from './css-export';
import { readExistingBrandCss, readExistingBrandingCss } from './reader';
import { COLLECTION_NAMES } from '../shared/constants';

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
  } else if (msg.type === 'generate-phase2') {
    const { brandName, baseBrandName, pcLibKey } = msg;
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

        const { count: appCount, brandingEntries } = await writeAppearanceGroup(brandName, baseBrandName, appearanceColl, pcLibKey, onAppProgress);
        const brandCount = await writeBrandMode(brandName, baseBrandName, brandColl, appearanceColl, onBrandProgress);

        const cssContent = generatePhase2Css(brandName, brandingEntries, appearanceColl.modes);
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
