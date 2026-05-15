import type { UiToMainMessage } from '../shared/messages';
import { inspectLibrary, InspectError } from './inspect';

figma.showUI(__html__, { width: 480, height: 640, title: 'Brand Manager' });

figma.ui.onmessage = (msg: UiToMainMessage) => {
  if (msg.type === 'close') {
    figma.closePlugin();
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
