import type { MainToUiMessage, UiToMainMessage } from '../shared/messages';
import type { LibInfo, AppearanceMode, RGB } from '../shared/types';
import iconCheck from '@gravity-ui/icons/svgs/circle-check.svg';
import iconError from '@gravity-ui/icons/svgs/circle-xmark.svg';
import iconWarning from '@gravity-ui/icons/svgs/triangle-exclamation.svg';
import iconInfo from '@gravity-ui/icons/svgs/circle-info.svg';

function send(msg: UiToMainMessage) {
  parent.postMessage({ pluginMessage: msg }, '*');
}

function rgbToHex(c: RGB): string {
  const r = Math.round(c.r * 255);
  const g = Math.round(c.g * 255);
  const b = Math.round(c.b * 255);
  return '#' + [r, g, b].map(n => n.toString(16).padStart(2, '0')).join('');
}

type AlertKind = 'success' | 'error' | 'warning' | 'info';

const ALERT_ICONS: Record<AlertKind, string> = {
  success: iconCheck,
  error:   iconError,
  warning: iconWarning,
  info:    iconInfo,
};

const ALERT_TITLES: Record<AlertKind, string> = {
  success: 'Готово',
  error:   'Ошибка',
  warning: 'Внимание',
  info:    'Информация',
};

function showAlert(container: Element, kind: AlertKind, desc: string, title?: string) {
  container.innerHTML = `
    <div class="alert alert-${kind}">
      <span class="alert-icon">${ALERT_ICONS[kind]}</span>
      <div class="alert-body">
        <div class="alert-title">${title ?? ALERT_TITLES[kind]}</div>
        <div class="alert-desc">${desc}</div>
      </div>
    </div>
  `;
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
      <p>Введите имя бренда и акцентный цвет.</p>
      <p class="hint">После генерации опубликуйте файл как библиотеку и подключите к основной либе.</p>
    </section>
    <section>
      <div style="margin-bottom:12px">
        <label style="display:block;font-size:11px;color:#888;margin-bottom:4px">Имя бренда</label>
        <input id="brandName" type="text" placeholder="My Brand"
          style="width:100%;padding:6px 8px;border:1px solid #ddd;border-radius:6px;font-size:13px" />
      </div>
      <div style="margin-bottom:12px">
        <label style="display:block;font-size:11px;color:#888;margin-bottom:4px">Brand-цвет</label>
        <div style="display:flex;gap:8px;align-items:center">
          <input id="brandColorPicker" type="color" value="#005FF9"
            style="width:36px;height:30px;padding:2px;border:1px solid #ddd;border-radius:4px;cursor:pointer" />
          <input id="brandColorHex" type="text" value="#005FF9" maxlength="7"
            style="width:90px;padding:6px 8px;border:1px solid #ddd;border-radius:6px;font-size:13px;font-family:monospace" />
        </div>
      </div>
      <button id="generateBtn" style="background:#1a1a1a;color:#fff;margin-top:0">Сгенерировать Private Colors</button>
      <div id="generateStatus"></div>
    </section>
    ${closeBtn()}
  `;
  bindClose();

  const picker = document.getElementById('brandColorPicker') as HTMLInputElement;
  const hex = document.getElementById('brandColorHex') as HTMLInputElement;

  picker.addEventListener('input', () => { hex.value = picker.value; });
  hex.addEventListener('input', () => {
    if (/^#[0-9a-fA-F]{6}$/.test(hex.value)) picker.value = hex.value;
  });

  document.getElementById('generateBtn')!.addEventListener('click', () => {
    const name = (document.getElementById('brandName') as HTMLInputElement).value.trim();
    const color = hex.value.trim();
    const status = document.getElementById('generateStatus')!;

    if (!name) { showAlert(status, 'warning', 'Введите имя бренда.'); return; }
    if (!/^#[0-9a-fA-F]{6}$/.test(color)) { showAlert(status, 'warning', 'Некорректный hex-цвет.'); return; }

    status.innerHTML = '<p class="note" style="margin-top:8px;color:#999">Генерация…</p>';
    (document.getElementById('generateBtn') as HTMLButtonElement).disabled = true;
    send({ type: 'generate-private-colors', brandName: name, brandHex: color });
  });
}

function handleGenerateDone(varCount: number) {
  const status = document.getElementById('generateStatus');
  const btn = document.getElementById('generateBtn') as HTMLButtonElement | null;
  if (status) showAlert(status, 'success', `Создано ${varCount} переменных.`);
  if (btn) btn.disabled = false;
}

function handleGenerateError(message: string) {
  const status = document.getElementById('generateStatus');
  const btn = document.getElementById('generateBtn') as HTMLButtonElement | null;
  if (status) showAlert(status, 'error', message);
  if (btn) btn.disabled = false;
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
  } else if (msg.type === 'generate-done') {
    handleGenerateDone(msg.varCount);
  } else if (msg.type === 'generate-error') {
    handleGenerateError(msg.message);
  }
};
