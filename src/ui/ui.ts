import type { MainToUiMessage, UiToMainMessage } from '../shared/messages';

function send(msg: UiToMainMessage) {
  parent.postMessage({ pluginMessage: msg }, '*');
}

document.getElementById('closeBtn')!.addEventListener('click', () => {
  send({ type: 'close' });
});

window.onmessage = (event: MessageEvent) => {
  const msg = event.data.pluginMessage as MainToUiMessage;
  if (msg.type === 'ready') {
    const status = document.getElementById('status')!;
    status.textContent = `Привет! В либе ${msg.libInfo.brandCount} брендов.`;
  }
};
