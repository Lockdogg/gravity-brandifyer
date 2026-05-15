import type { MainToUiMessage, UiToMainMessage } from '../shared/messages';
import type { LibInfo, AppearanceMode, RGB } from '../shared/types';

function send(msg: UiToMainMessage) {
  parent.postMessage({ pluginMessage: msg }, '*');
}

function rgbToHex(c: RGB): string {
  const r = Math.round(c.r * 255);
  const g = Math.round(c.g * 255);
  const b = Math.round(c.b * 255);
  return '#' + [r, g, b].map(n => n.toString(16).padStart(2, '0')).join('');
}

function closeBtn(): string {
  return '<button id="closeBtn">Закрыть</button>';
}

function bindClose() {
  document.getElementById('closeBtn')?.addEventListener('click', () => send({ type: 'close' }));
}

function showError(message: string, missing?: string[]) {
  document.getElementById('app')!.innerHTML = `
    <div class="error-screen">
      <div class="error-icon">⚠</div>
      <h2>Плагин не может запуститься</h2>
      <p>${message}</p>
      ${missing ? `<p class="missing">Не найдены: <strong>${missing.join(', ')}</strong></p>` : ''}
      <p class="hint">Убедитесь, что плагин запущен в файле библиотеки YC Gravity UI с коллекциями Appearance и Brand.</p>
      ${closeBtn()}
    </div>
  `;
  bindClose();
}

function showPhasePrivateColors() {
  document.getElementById('app')!.innerHTML = `
    <h1>Brand Manager</h1>
    <section>
      <h2>Фаза 1 — Приватные цвета</h2>
      <p>Этот файл будет содержать приватные цвета нового бренда.</p>
      <p class="hint">После генерации опубликуйте файл как библиотеку и подключите к основной либе.</p>
    </section>
    <p class="wip">⚙ Генерация приватных цветов — в разработке (Milestone 2)</p>
    ${closeBtn()}
  `;
  bindClose();
}

function showPhaseMainLib(info: LibInfo) {
  const MODES: AppearanceMode[] = ['Light', 'Dark', 'Light HC', 'Dark HC'];

  const brandsHtml = info.existingBrands.length > 0
    ? info.existingBrands.map(b => `<li>${b}</li>`).join('')
    : '<li class="empty">Нет брендов</li>';

  const bgRows = MODES.map(mode => {
    const bg             = info.themeBackgrounds[mode];
    const primaryHex     = rgbToHex(bg.primary);
    const contrastingHex = rgbToHex(bg.contrasting);
    return `
      <tr>
        <td>${mode}</td>
        <td><span class="swatch" style="background:${primaryHex}"></span> ${primaryHex}</td>
        <td><span class="swatch" style="background:${contrastingHex}"></span> ${contrastingHex}</td>
      </tr>
    `;
  }).join('');

  document.getElementById('app')!.innerHTML = `
    <h1>Brand Manager</h1>
    <section>
      <h2>Фаза 2 — Основная либа</h2>
      <p>Коллекции Appearance и Brand найдены. Можно добавлять новый бренд.</p>
    </section>
    <section>
      <h2>Существующие бренды (${info.brandModeCount})</h2>
      <ul class="brand-list">${brandsHtml}</ul>
    </section>
    <section>
      <h2>Фоны по темам</h2>
      <table>
        <thead><tr><th>Тема</th><th>Primary</th><th>Contrasting</th></tr></thead>
        <tbody>${bgRows}</tbody>
      </table>
    </section>
    <p class="wip">⚙ Визард добавления бренда — в разработке (Milestone 5)</p>
    ${closeBtn()}
  `;
  bindClose();
}

window.onmessage = (event: MessageEvent) => {
  const msg = event.data.pluginMessage as MainToUiMessage;
  if (msg.type === 'phase-private-colors') {
    showPhasePrivateColors();
  } else if (msg.type === 'phase-main-lib') {
    showPhaseMainLib(msg.info);
  } else if (msg.type === 'lib-error') {
    showError(msg.message, msg.missingCollections);
  }
};
