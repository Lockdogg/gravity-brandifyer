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


// ─── Color utilities ───────────────────────────────────────────────────────

function hsvToRgbArr(h: number, s: number, v: number): [number, number, number] {
  const hi = Math.floor(h / 60) % 6;
  const f  = h / 60 - Math.floor(h / 60);
  const p = v*(1-s), q = v*(1-f*s), t = v*(1-(1-f)*s);
  const rows = [[v,t,p],[q,v,p],[p,v,t],[p,q,v],[t,p,v],[v,p,q]];
  const m = rows[hi]!;
  return [Math.round(m[0]!*255), Math.round(m[1]!*255), Math.round(m[2]!*255)];
}

function rgbToHsvArr(r: number, g: number, b: number): [number, number, number] {
  r /= 255; g /= 255; b /= 255;
  const max = Math.max(r,g,b), min = Math.min(r,g,b), d = max - min;
  let h = 0;
  if (d) {
    if (max===r) h = (g-b)/d + (g<b?6:0);
    else if (max===g) h = (b-r)/d + 2;
    else h = (r-g)/d + 4;
    h *= 60;
  }
  return [h, max===0 ? 0 : d/max, max];
}

function parseHexColor(hex: string): [number, number, number] | null {
  const m = /^#?([0-9a-fA-F]{6})$/.exec(hex);
  if (!m) return null;
  const s = m[1]!;
  return [parseInt(s.slice(0,2),16), parseInt(s.slice(2,4),16), parseInt(s.slice(4,6),16)];
}

function toHexColor(r: number, g: number, b: number): string {
  return '#' + [r,g,b].map(v => Math.round(Math.max(0,Math.min(255,v))).toString(16).padStart(2,'0')).join('');
}

function hsvToHslArr(h: number, s: number, v: number): [number, number, number] {
  const l = v*(1-s/2);
  return [h, (l===0||l===1) ? 0 : (v-l)/Math.min(l,1-l), l];
}

function hslToHsvArr(h: number, sl: number, l: number): [number, number, number] {
  const v = l + sl*Math.min(l,1-l);
  return [h, v===0 ? 0 : 2*(1-l/v), v];
}

// ─── Custom Color Picker ────────────────────────────────────────────────────

type CpMode = 'HEX' | 'RGB' | 'HSL' | 'HSB';

class ColorPicker {
  private popup!: HTMLElement;
  private gradWrap!: HTMLElement;
  private gradCanvas!: HTMLCanvasElement;
  private gradThumb!: HTMLElement;
  private hueWrap!: HTMLElement;
  private hueCanvas!: HTMLCanvasElement;
  private hueThumb!: HTMLElement;
  private modeBtn!: HTMLElement;
  private modeDrop!: HTMLElement;
  private valuesEl!: HTMLElement;

  private h = 210; private s = 1; private v = 1;
  private mode: CpMode = 'HEX';
  private handlers: ((hex: string) => void)[] = [];
  private isOpen = false;

  constructor() {
    this.buildDom();
    this.bind();
  }

  private buildDom() {
    this.popup = document.createElement('div');
    this.popup.className = 'cp-popup';
    this.popup.innerHTML = `
      <div class="cp-grad-wrap"><canvas class="cp-grad-canvas"></canvas><div class="cp-grad-thumb"></div></div>
      <div class="cp-sliders">
        <div class="cp-row-wrap cp-hue-wrap"><canvas class="cp-hue-canvas"></canvas><div class="cp-hue-thumb"></div></div>
      </div>
      <div class="cp-bottom">
        <div class="cp-mode-wrap">
          <button class="cp-mode-btn">HEX <span class="cp-caret">▾</span></button>
          <div class="cp-mode-drop">
            <div class="cp-mode-opt" data-m="HEX">Hex</div>
            <div class="cp-mode-opt" data-m="RGB">RGB</div>
            <div class="cp-mode-opt" data-m="HSL">HSL</div>
            <div class="cp-mode-opt" data-m="HSB">HSB</div>
          </div>
        </div>
        <div class="cp-values"></div>
      </div>
    `;
    document.body.appendChild(this.popup);
    this.gradWrap   = this.popup.querySelector('.cp-grad-wrap')!;
    this.gradCanvas = this.popup.querySelector('.cp-grad-canvas')!;
    this.gradThumb  = this.popup.querySelector('.cp-grad-thumb')!;
    this.hueWrap    = this.popup.querySelector('.cp-hue-wrap')!;
    this.hueCanvas  = this.popup.querySelector('.cp-hue-canvas')!;
    this.hueThumb   = this.popup.querySelector('.cp-hue-thumb')!;
    this.modeBtn    = this.popup.querySelector('.cp-mode-btn')!;
    this.modeDrop   = this.popup.querySelector('.cp-mode-drop')!;
    this.valuesEl   = this.popup.querySelector('.cp-values')!;
  }

  private bind() {
    this.drag(this.gradWrap, (x, y) => { this.s = x; this.v = 1-y; this.render(true); });
    this.drag(this.hueWrap,  (x)    => { this.h = x*360; this.render(true); });

    this.modeBtn.addEventListener('mousedown', (e) => {
      e.stopPropagation();
      this.modeDrop.classList.toggle('cp-open');
    });
    this.modeDrop.querySelectorAll<HTMLElement>('.cp-mode-opt').forEach(o => {
      o.addEventListener('mousedown', (e) => {
        e.stopPropagation();
        this.mode = o.dataset['m'] as CpMode;
        this.modeBtn.innerHTML = `${this.mode} <span class="cp-caret">▾</span>`;
        this.modeDrop.classList.remove('cp-open');
        this.renderValues(false);
      });
    });
    document.addEventListener('mousedown', (e) => {
      if (this.isOpen && !this.popup.contains(e.target as Node)) this.hide();
    });
  }

  private drag(el: HTMLElement, cb: (x: number, y: number) => void) {
    const pos = (e: MouseEvent) => {
      const r = el.getBoundingClientRect();
      return { x: Math.max(0,Math.min(1,(e.clientX-r.left)/r.width)), y: Math.max(0,Math.min(1,(e.clientY-r.top)/r.height)) };
    };
    el.addEventListener('mousedown', (e) => {
      e.preventDefault(); e.stopPropagation();
      const p = pos(e); cb(p.x, p.y);
      const mm = (e: MouseEvent) => { const p = pos(e); cb(p.x, p.y); };
      const mu = () => { document.removeEventListener('mousemove', mm); document.removeEventListener('mouseup', mu); };
      document.addEventListener('mousemove', mm);
      document.addEventListener('mouseup', mu);
    });
  }

  private drawGrad() {
    const c = this.gradCanvas;
    c.width = c.offsetWidth||240; c.height = c.offsetHeight||180;
    const ctx = c.getContext('2d')!;
    const [r,g,b] = hsvToRgbArr(this.h,1,1);
    ctx.fillStyle = `rgb(${r},${g},${b})`; ctx.fillRect(0,0,c.width,c.height);
    const wg = ctx.createLinearGradient(0,0,c.width,0);
    wg.addColorStop(0,'#fff'); wg.addColorStop(1,'rgba(255,255,255,0)');
    ctx.fillStyle = wg; ctx.fillRect(0,0,c.width,c.height);
    const bg = ctx.createLinearGradient(0,0,0,c.height);
    bg.addColorStop(0,'rgba(0,0,0,0)'); bg.addColorStop(1,'#000');
    ctx.fillStyle = bg; ctx.fillRect(0,0,c.width,c.height);
  }

  private drawHue() {
    const c = this.hueCanvas;
    c.width = c.offsetWidth||220; c.height = c.offsetHeight||10;
    const ctx = c.getContext('2d')!;
    const g = ctx.createLinearGradient(0,0,c.width,0);
    [0,60,120,180,240,300,360].forEach(h => { const [r,gr,b] = hsvToRgbArr(h,1,1); g.addColorStop(h/360,`rgb(${r},${gr},${b})`); });
    ctx.fillStyle = g; ctx.fillRect(0,0,c.width,c.height);
  }

  private render(emit: boolean) {
    this.drawGrad();
    this.gradThumb.style.left = `${this.s*100}%`;
    this.gradThumb.style.top  = `${(1-this.v)*100}%`;
    this.hueThumb.style.left  = `${this.h/360*100}%`;
    this.renderValues(emit);
  }

  private renderValues(emit: boolean) {
    const [r,g,b] = hsvToRgbArr(this.h,this.s,this.v);
    const hex = toHexColor(r,g,b);

    const inp = (attrs: string) =>
      `<input class="cp-val${attrs.includes('data-t') ? ' cp-val-hex' : ''}" type="text" ${attrs} />`;

    if (this.mode === 'HEX') {
      this.valuesEl.innerHTML = inp(`data-t="hex" value="${hex.slice(1).toUpperCase()}" maxlength="6" spellcheck="false"`);
      this.valuesEl.querySelector<HTMLInputElement>('[data-t=hex]')!.addEventListener('input', (e) => {
        const rgb = parseHexColor((e.target as HTMLInputElement).value);
        if (rgb) { [this.h,this.s,this.v] = rgbToHsvArr(...rgb); this.render(true); }
      });
    } else if (this.mode === 'RGB') {
      this.valuesEl.innerHTML =
        inp(`data-c="r" value="${r}" maxlength="3"`) +
        inp(`data-c="g" value="${g}" maxlength="3"`) +
        inp(`data-c="b" value="${b}" maxlength="3"`);
      const rgbUpdate = () => {
        const get = (c: string) => Math.max(0,Math.min(255, parseInt((this.valuesEl.querySelector(`[data-c=${c}]`) as HTMLInputElement).value)||0));
        [this.h,this.s,this.v] = rgbToHsvArr(get('r'),get('g'),get('b')); this.render(true);
      };
      this.valuesEl.querySelectorAll<HTMLInputElement>('.cp-val').forEach(i => i.addEventListener('change', rgbUpdate));
      this.addNumericArrows({ r: [0,255], g: [0,255], b: [0,255] }, () => {
        const get = (c: string) => Math.max(0,Math.min(255, parseInt((this.valuesEl.querySelector(`[data-c=${c}]`) as HTMLInputElement).value)||0));
        [this.h,this.s,this.v] = rgbToHsvArr(get('r'),get('g'),get('b')); this.renderCanvas();
      });
    } else if (this.mode === 'HSL') {
      const [hh,hs,hl] = hsvToHslArr(this.h,this.s,this.v);
      this.valuesEl.innerHTML =
        inp(`data-c="h" value="${Math.round(hh)}" maxlength="3"`) +
        inp(`data-c="s" value="${Math.round(hs*100)}" maxlength="3"`) +
        inp(`data-c="l" value="${Math.round(hl*100)}" maxlength="3"`);
      const hslGet = (c: string) => parseInt((this.valuesEl.querySelector(`[data-c=${c}]`) as HTMLInputElement).value)||0;
      const hslUpdate = () => {
        [this.h,this.s,this.v] = hslToHsvArr(Math.max(0,Math.min(360,hslGet('h'))), Math.max(0,Math.min(100,hslGet('s')))/100, Math.max(0,Math.min(100,hslGet('l')))/100);
        this.render(true);
      };
      this.valuesEl.querySelectorAll<HTMLInputElement>('.cp-val').forEach(i => i.addEventListener('change', hslUpdate));
      this.addNumericArrows({ h: [0,360], s: [0,100], l: [0,100] }, () => {
        [this.h,this.s,this.v] = hslToHsvArr(Math.max(0,Math.min(360,hslGet('h'))), Math.max(0,Math.min(100,hslGet('s')))/100, Math.max(0,Math.min(100,hslGet('l')))/100);
        this.renderCanvas();
      });
    } else {
      this.valuesEl.innerHTML =
        inp(`data-c="h" value="${Math.round(this.h)}" maxlength="3"`) +
        inp(`data-c="s" value="${Math.round(this.s*100)}" maxlength="3"`) +
        inp(`data-c="b" value="${Math.round(this.v*100)}" maxlength="3"`);
      const hsbGet = (c: string) => parseInt((this.valuesEl.querySelector(`[data-c=${c}]`) as HTMLInputElement).value)||0;
      const hsbApply = () => {
        this.h = Math.max(0,Math.min(360,hsbGet('h')));
        this.s = Math.max(0,Math.min(100,hsbGet('s')))/100;
        this.v = Math.max(0,Math.min(100,hsbGet('b')))/100;
      };
      this.valuesEl.querySelectorAll<HTMLInputElement>('.cp-val').forEach(i => i.addEventListener('change', () => { hsbApply(); this.render(true); }));
      this.addNumericArrows({ h: [0,360], s: [0,100], b: [0,100] }, () => { hsbApply(); this.renderCanvas(); });
    }
    if (emit) this.handlers.forEach(fn => fn(hex));
  }

  setColor(hex: string, silent = false) {
    const rgb = parseHexColor(hex);
    if (!rgb) return;
    [this.h,this.s,this.v] = rgbToHsvArr(...rgb);
    if (this.isOpen) this.render(!silent);
  }

  show(anchor: HTMLElement) {
    this.isOpen = true;
    this.popup.style.display = 'flex';
    const r = anchor.getBoundingClientRect();
    const pw = 252, ph = 290;
    let top = r.bottom + 6, left = r.left;
    if (top + ph > window.innerHeight - 8) top = r.top - ph - 6;
    if (left + pw > window.innerWidth - 8) left = window.innerWidth - pw - 8;
    this.popup.style.top  = Math.max(8,top) + 'px';
    this.popup.style.left = Math.max(8,left) + 'px';
    this.drawHue();
    this.render(false);
  }

  private renderCanvas() {
    this.drawGrad();
    this.gradThumb.style.left = `${this.s*100}%`;
    this.gradThumb.style.top  = `${(1-this.v)*100}%`;
    this.hueThumb.style.left  = `${this.h/360*100}%`;
    const [r,g,b] = hsvToRgbArr(this.h,this.s,this.v);
    this.handlers.forEach(fn => fn(toHexColor(r,g,b)));
  }

  private addNumericArrows(ranges: Record<string, [number, number]>, onStep: () => void) {
    this.valuesEl.querySelectorAll<HTMLInputElement>('.cp-val').forEach(i => {
      const [mn, mx] = ranges[i.dataset['c'] ?? ''] ?? [0, 100];
      i.addEventListener('keydown', (e) => {
        if (e.key !== 'ArrowUp' && e.key !== 'ArrowDown') return;
        e.preventDefault();
        const step = (e.metaKey || e.ctrlKey) ? 10 : 1;
        const dir = e.key === 'ArrowUp' ? 1 : -1;
        i.value = String(Math.max(mn, Math.min(mx, (parseInt(i.value)||0) + dir * step)));
        onStep();
      });
    });
  }

  hide() { this.isOpen = false; this.popup.style.display = 'none'; }
  toggle(anchor: HTMLElement) { this.isOpen ? this.hide() : this.show(anchor); }
  onChange(fn: (hex: string) => void) { this.handlers.push(fn); }
  destroy() { this.popup.remove(); this.handlers = []; }
}

// ─── Color picker wiring ────────────────────────────────────────────────────

const _colorPickers: ColorPicker[] = [];

function destroyPickrInstances() {
  _colorPickers.forEach(p => { try { p.destroy(); } catch {} });
  _colorPickers.length = 0;
}

function createColorPicker(triggerEl: HTMLElement, initialHex: string, hexInput: HTMLInputElement) {
  const picker = new ColorPicker();
  picker.setColor(initialHex, true);
  _colorPickers.push(picker);

  const swatch = document.createElement('button');
  swatch.className = 'color-swatch';
  swatch.style.background = initialHex;
  triggerEl.appendChild(swatch);

  picker.onChange((hex) => { hexInput.value = hex; swatch.style.background = hex; });
  hexInput.addEventListener('input', () => {
    if (/^#[0-9a-fA-F]{6}$/.test(hexInput.value)) {
      picker.setColor(hexInput.value, true);
      swatch.style.background = hexInput.value;
    }
  });
  swatch.addEventListener('click', (e) => { e.stopPropagation(); picker.toggle(swatch); });
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
        <div class="family-color-trigger"></div>
        <input type="text" class="family-color-hex" value="${def}" maxlength="7"
          style="width:76px;padding:4px 6px;border:1px solid #ddd;border-radius:6px;font-size:12px;font-family:monospace" />
      </div>
    </div>
  `;
}

function showPhasePrivateColors() {
  destroyPickrInstances();
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
          <div id="brandColorTrigger"></div>
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

  // Color pickers for family rows
  document.querySelectorAll<HTMLElement>('.family-row').forEach(row => {
    const triggerEl = row.querySelector<HTMLElement>('.family-color-trigger')!;
    const hexEl = row.querySelector<HTMLInputElement>('.family-color-hex')!;
    createColorPicker(triggerEl, hexEl.value, hexEl);
  });

  // Brand color picker
  const brandTrigger = document.getElementById('brandColorTrigger') as HTMLElement;
  const hex = document.getElementById('brandColorHex') as HTMLInputElement;
  createColorPicker(brandTrigger, hex.value, hex);

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

function downloadCss(content: string, filename: string) {
  const a = document.createElement('a');
  a.href = 'data:text/css;charset=utf-8,' + encodeURIComponent(content);
  a.download = filename;
  a.click();
}

function handleGenerateDone(varCount: number, cssContent: string) {
  const status = document.getElementById('generateStatus');
  const btn = document.getElementById('generateBtn') as HTMLButtonElement | null;
  if (btn) btn.disabled = false;
  showToast('success', `Создано ${varCount} переменных.`);

  if (status) {
    const downloadBtn = document.createElement('button');
    downloadBtn.textContent = 'Скачать CSS';
    downloadBtn.style.cssText = 'margin-top:10px;background:#f0f0f0;color:#1a1a1a;width:100%';
    downloadBtn.addEventListener('click', () => {
      const brandName = (document.getElementById('brandName') as HTMLInputElement)?.value.trim() || 'brand';
      downloadCss(cssContent, `${brandName}-theme.css`);
    });
    status.innerHTML = '';
    status.appendChild(downloadBtn);
  }
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
    handleGenerateDone(msg.varCount, msg.cssContent);
  } else if (msg.type === 'generate-error') {
    handleGenerateError(msg.message);
  }
};
