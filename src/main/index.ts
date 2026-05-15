import type { UiToMainMessage } from '../shared/messages';
import { inspectLibrary, InspectError } from './inspect';

figma.showUI(__html__, { width: 480, height: 640, title: 'Brand Manager' });

figma.ui.onmessage = (msg: UiToMainMessage) => {
  if (msg.type === 'close') {
    figma.closePlugin();
  }
};

try {
  const info = inspectLibrary();
  figma.ui.postMessage({ type: 'lib-info', info });
} catch (err) {
  if (err instanceof InspectError) {
    figma.ui.postMessage({
      type: 'lib-error',
      message: err.message,
      missingCollections: err.missingCollections,
    });
  } else {
    figma.ui.postMessage({
      type: 'lib-error',
      message: 'Неизвестная ошибка при чтении библиотеки.',
    });
  }
}
