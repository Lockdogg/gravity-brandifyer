import type { MainToUiMessage, UiToMainMessage, ColorFamily } from '../shared/messages';
import type { LibInfo, AppearanceMode, RGB } from '../shared/types';
import iconCheck from '@gravity-ui/icons/svgs/circle-check.svg';
import iconError from '@gravity-ui/icons/svgs/circle-xmark.svg';
import iconWarning from '@gravity-ui/icons/svgs/triangle-exclamation.svg';
import iconInfo from '@gravity-ui/icons/svgs/circle-info.svg';
import iconHelp from '@gravity-ui/icons/svgs/circle-question.svg';

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

function showToast(kind: AlertKind, desc: string, title?: string, durationMs = 3000) {
  const container = document.getElementById('toast-container')!;
  const toast = document.createElement('div');
  toast.className = `toast alert alert-${kind}`;
  toast.innerHTML = `
    <span class="alert-icon">${ALERT_ICONS[kind]}</span>
    <div class="alert-body">
      <div class="alert-title">${title ?? ALERT_TITLES[kind]}</div>
      <div class="alert-desc">${desc}</div>
    </div>
  `;
  container.appendChild(toast);

  const dismiss = () => {
    toast.classList.add('toast-hiding');
    setTimeout(() => toast.remove(), 300);
  };
  toast.addEventListener('click', dismiss);
  setTimeout(dismiss, durationMs);
}


function showError(message: string, missing?: string[]) {
  document.getElementById('app')!.innerHTML = `
    <div class="error-screen">
      <div class="error-icon">⚠</div>
      <h2>Плагин не может запуститься</h2>
      <p>${message}</p>
      ${missing ? `<p class="missing">Не найдены: <strong>${missing.join(', ')}</strong></p>` : ''}
      <p class="hint">Убедитесь, что плагин запущен в файле библиотеки YC Gravity UI с коллекциями Appearance и Brand.</p>
  
    </div>
  `;

}

const FAMILY_DEFAULTS: Record<ColorFamily, string> = {
  Blue:   '#5282ff',
  Green:  '#3bc935',
  Yellow: '#ffdb4d',
  Red:    '#ff0400',
  Purple: '#8f52cc',
  Orange: '#ff7700',
};

const COLOR_FAMILIES = Object.keys(FAMILY_DEFAULTS) as ColorFamily[];

function familyRowHtml(family: ColorFamily): string {
  const def = FAMILY_DEFAULTS[family];
  return `
    <div class="family-row" data-family="${family}">
      <label class="family-toggle">
        <input type="checkbox" class="family-check" data-family="${family}" />
        <span>${family}</span>
      </label>
      <div class="family-picker">
        <input type="color" class="family-color-picker" value="${def}"
          style="width:28px;height:24px;padding:1px;border:1px solid #ddd;border-radius:4px;cursor:pointer" />
        <input type="text" class="family-color-hex" value="${def}" maxlength="7"
          style="width:76px;padding:4px 6px;border:1px solid #ddd;border-radius:6px;font-size:12px;font-family:monospace" />
      </div>
    </div>
  `;
}

function showPhasePrivateColors() {
  document.getElementById('app')!.innerHTML = `

    <div style="display:flex;justify-content:center;margin-bottom:20px">
      <div class="seg-control">
        <button id="modeSimple" class="seg-btn seg-active">Простой</button>
        <button id="modeExpert" class="seg-btn">Эксперт</button>
      </div>
    </div>
    <section>
      <div style="display:flex;align-items:center;gap:6px;margin-bottom:0">
        <h2 style="margin-bottom:0">Фаза 1 — Приватные цвета</h2>
        <button id="helpToggle" title="Помощь"
          style="background:none;border:none;padding:0;margin:0;cursor:pointer;color:#aaa;display:flex;align-items:center;margin-top:0;width:16px;height:16px">
          ${iconHelp}
        </button>
      </div>
      <div id="helpText" style="display:none;margin-top:8px">
        <p style="margin-bottom:4px">Введите имя бренда и акцентный цвет.</p>
        <p class="hint">После генерации опубликуйте файл как библиотеку и подключите к основной либе.</p>
      </div>
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
    </section>
    <section id="expertSection" style="display:none;border-top:1px solid #f0f0f0;padding-top:16px;margin-top:0">
      <h2>Цветовые семейства</h2>
      <p class="hint" style="margin-bottom:10px">По умолчанию — YC-значения. Включи чтобы задать свой цвет.</p>
      <label class="family-select-all">
        <input type="checkbox" id="selectAllFamilies" />
        Выбрать все
      </label>
      ${COLOR_FAMILIES.map(familyRowHtml).join('')}
    </section>
    <section>
      <button id="generateBtn" style="background:#1a1a1a;color:#fff;margin-top:0">Сгенерировать Private Colors</button>
      <div id="generateStatus"></div>
    </section>

  `;


  // Help toggle
  const helpToggle = document.getElementById('helpToggle')!;
  const helpText = document.getElementById('helpText')!;
  helpToggle.addEventListener('click', () => {
    const visible = helpText.style.display !== 'none';
    helpText.style.display = visible ? 'none' : 'block';
    (helpToggle as HTMLButtonElement).style.color = visible ? '#aaa' : '#555';
  });

  // Mode toggle
  const modeSimple = document.getElementById('modeSimple')!;
  const modeExpert = document.getElementById('modeExpert')!;
  const expertSection = document.getElementById('expertSection')!;

  modeSimple.addEventListener('click', () => {
    modeSimple.classList.add('seg-active');
    modeExpert.classList.remove('seg-active');
    expertSection.style.display = 'none';
  });
  modeExpert.addEventListener('click', () => {
    modeExpert.classList.add('seg-active');
    modeSimple.classList.remove('seg-active');
    expertSection.style.display = 'block';
  });

  // Family row toggles
  const selectAll = document.getElementById('selectAllFamilies') as HTMLInputElement;
  const familyChecks = Array.from(document.querySelectorAll<HTMLInputElement>('.family-check'));

  function updateSelectAllState() {
    const checkedCount = familyChecks.filter(c => c.checked).length;
    selectAll.checked = checkedCount === familyChecks.length;
    selectAll.indeterminate = checkedCount > 0 && checkedCount < familyChecks.length;
  }

  function setFamilyPicker(cb: HTMLInputElement) {
    const pickerEl = cb.closest('.family-row')!.querySelector<HTMLElement>('.family-picker')!;
    pickerEl.classList.toggle('visible', cb.checked);
  }

  familyChecks.forEach(cb => {
    cb.addEventListener('change', () => {
      setFamilyPicker(cb);
      updateSelectAllState();
    });
  });

  selectAll.addEventListener('change', () => {
    familyChecks.forEach(cb => {
      cb.checked = selectAll.checked;
      setFamilyPicker(cb);
    });
    selectAll.indeterminate = false;
  });

  // Sync color pickers within each family row
  document.querySelectorAll<HTMLElement>('.family-row').forEach(row => {
    const pickerEl = row.querySelector<HTMLInputElement>('.family-color-picker')!;
    const hexEl = row.querySelector<HTMLInputElement>('.family-color-hex')!;
    pickerEl.addEventListener('input', () => { hexEl.value = pickerEl.value; });
    hexEl.addEventListener('input', () => {
      if (/^#[0-9a-fA-F]{6}$/.test(hexEl.value)) pickerEl.value = hexEl.value;
    });
  });

  // Brand color sync
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

    // Collect expert overrides
    const colorOverrides: Partial<Record<ColorFamily, string>> = {};
    document.querySelectorAll<HTMLInputElement>('.family-check:checked').forEach(cb => {
      const family = cb.dataset['family'] as ColorFamily;
      const row = cb.closest('.family-row')!;
      const hexVal = row.querySelector<HTMLInputElement>('.family-color-hex')!.value.trim();
      if (/^#[0-9a-fA-F]{6}$/.test(hexVal)) colorOverrides[family] = hexVal;
    });

    status.innerHTML = '<p class="note" style="margin-top:8px;color:#999">Генерация…</p>';
    (document.getElementById('generateBtn') as HTMLButtonElement).disabled = true;
    send({ type: 'generate-private-colors', brandName: name, brandHex: color, colorOverrides });
  });
}

function handleGenerateDone(varCount: number) {
  const status = document.getElementById('generateStatus');
  const btn = document.getElementById('generateBtn') as HTMLButtonElement | null;
  if (status) status.innerHTML = '';
  showToast('success', `Создано ${varCount} переменных.`);
  if (btn) btn.disabled = false;
}

function handleGenerateError(message: string) {
  const status = document.getElementById('generateStatus');
  const btn = document.getElementById('generateBtn') as HTMLButtonElement | null;
  if (status) status.innerHTML = '';
  showToast('error', message, undefined, 5000);
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

  `;

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
