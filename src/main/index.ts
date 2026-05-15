import type { UiToMainMessage } from '../shared/messages';

figma.showUI(__html__, { width: 480, height: 600, title: 'Brand Manager' });

console.log('[Brand Manager] Plugin started');

figma.ui.onmessage = (msg: UiToMainMessage) => {
  if (msg.type === 'close') {
    figma.closePlugin();
  }
};

figma.ui.postMessage({ type: 'ready', libInfo: { brandCount: 0 } });
