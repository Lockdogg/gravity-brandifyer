import type { UiToMainMessage } from '../shared/messages';
import { inspectLibrary, InspectError } from './inspect';
import { generateBrandScale } from './themer-bridge';
import { writePrivateColorsFull } from './writer';

figma.showUI(__html__, { width: 480, height: 640, title: 'Brand Manager' });

figma.ui.onmessage = (msg: UiToMainMessage) => {
  if (msg.type === 'close') {
    figma.closePlugin();
  } else if (msg.type === 'generate-private-colors') {
    const { brandName, brandHex, colorOverrides } = msg;
    (async () => {
      try {
        const scale = generateBrandScale(brandHex);
        const count = await writePrivateColorsFull(brandName, scale, colorOverrides);
        figma.ui.postMessage({ type: 'generate-done', varCount: count });
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        figma.ui.postMessage({ type: 'generate-error', message: `Не удалось создать переменные: ${message}` });
      }
    })();
  }
};

(async () => {
  try {
    const result = await inspectLibrary();
    if (result.phase === 'private-colors') {
      figma.ui.postMessage({ type: 'phase-private-colors' });
    } else {
      figma.ui.postMessage({ type: 'phase-main-lib', info: result.info });
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
      console.error('[Brand Manager] inspect error:', err);
      figma.ui.postMessage({ type: 'lib-error', message: `Ошибка: ${msg}` });
    }
  }
})();
