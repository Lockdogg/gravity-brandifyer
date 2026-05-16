import { createRoot } from 'react-dom/client';
import { useState, useEffect, useRef, useCallback } from 'react';
import { ColorPicker } from './components/ColorPicker';
import { Button } from './components/ui/button';
import { Input } from './components/ui/input';
import { Label } from './components/ui/label';
import { Checkbox } from './components/ui/checkbox';
import { Alert, AlertTitle, AlertDescription } from './components/ui/alert';
import { cn } from './lib/utils';
import type { MainToUiMessage, UiToMainMessage, ColorFamily, BrandCssEntry } from '../shared/messages';
import type { LibInfo } from '../shared/types';
import iconPalette from '@gravity-ui/icons/svgs/palette.svg';
import iconDownload from '@gravity-ui/icons/svgs/arrow-down-to-line.svg';
import iconFileCode from '@gravity-ui/icons/svgs/file-code.svg';
import iconQuestion from '@gravity-ui/icons/svgs/circle-question.svg';

function SvgIcon({ svg, className }: { svg: string; className?: string }) {
  return (
    <span
      className={cn('inline-flex items-center shrink-0 [&_svg]:w-4 [&_svg]:h-4', className)}
      dangerouslySetInnerHTML={{ __html: svg }}
    />
  );
}

// ─── Messaging ────────────────────────────────────────────────────────────────

function send(msg: UiToMainMessage) {
  parent.postMessage({ pluginMessage: msg }, '*');
}

// ─── Types ────────────────────────────────────────────────────────────────────

type Phase =
  | { tag: 'loading' }
  | { tag: 'error'; message: string; missingCollections?: string[] }
  | { tag: 'private-colors'; existingBrands: BrandCssEntry[] }
  | { tag: 'main-lib'; info: LibInfo };

type GenStatus =
  | null
  | 'generating'
  | { type: 'success'; varCount: number; brandName: string; cssContent: string }
  | { type: 'error'; message: string };

// ─── Tooltip ──────────────────────────────────────────────────────────────────

function Tooltip({ text, children }: { text: string; children: React.ReactNode }) {
  const [visible, setVisible] = useState(false);
  return (
    <span className="relative inline-flex items-center" onMouseEnter={() => setVisible(true)} onMouseLeave={() => setVisible(false)}>
      {children}
      {visible && (
        <span className="absolute bottom-full left-1/2 -translate-x-1/2 mb-1.5 z-50 w-52 rounded-md bg-foreground text-background text-xs px-2.5 py-1.5 leading-snug shadow-md pointer-events-none whitespace-normal text-center">
          {text}
          <span className="absolute top-full left-1/2 -translate-x-1/2 border-4 border-transparent border-t-foreground" />
        </span>
      )}
    </span>
  );
}

const COLOR_FAMILIES: ColorFamily[] = ['Blue', 'Green', 'Yellow', 'Red', 'Purple', 'Orange'];
const DEFAULT_OVERRIDES: Record<ColorFamily, string> = {
  Blue: '#005FF9', Green: '#34C759', Yellow: '#FF9500',
  Red: '#FF3B30', Purple: '#AF52DE', Orange: '#FF6B35',
};

// ─── Color Field ──────────────────────────────────────────────────────────────

const PICKER_W = 276; // 252px picker + 2*12px padding

function ColorField({
  value,
  onChange,
  label,
}: {
  value: string;
  onChange: (hex: string) => void;
  label?: string;
}) {
  const [open, setOpen] = useState(false);
  const [popoverStyle, setPopoverStyle] = useState<React.CSSProperties>({});
  const [hexInput, setHexInput] = useState(value.replace('#', ''));
  const popoverRef = useRef<HTMLDivElement>(null);
  const swatchRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    setHexInput(value.replace('#', ''));
  }, [value]);

  useEffect(() => {
    if (!open || !swatchRef.current) return;

    const r = swatchRef.current.getBoundingClientRect();
    let top = r.bottom + 6;
    let left = r.left;
    const ph = 290;
    if (top + ph > window.innerHeight - 8) top = r.top - ph - 6;
    if (left + PICKER_W > window.innerWidth - 8) left = window.innerWidth - PICKER_W - 8;
    setPopoverStyle({ position: 'fixed', top: Math.max(8, top), left: Math.max(8, left), zIndex: 9999 });

    const handler = (e: MouseEvent) => {
      if (
        popoverRef.current && !popoverRef.current.contains(e.target as Node) &&
        swatchRef.current && !swatchRef.current.contains(e.target as Node)
      ) {
        setOpen(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [open]);

  const handleHexInput = (e: React.ChangeEvent<HTMLInputElement>) => {
    const raw = e.target.value.replace(/[^0-9a-fA-F]/g, '').slice(0, 6);
    setHexInput(raw);
    if (raw.length === 6) onChange('#' + raw);
  };

  return (
    <div className="flex items-center gap-2">
      {label && <Label className="text-xs text-muted-foreground w-24 shrink-0">{label}</Label>}
      <div className="flex items-center gap-2 flex-1">
        <button
          ref={swatchRef}
          type="button"
          onClick={() => setOpen(v => !v)}
          className="w-7 h-7 rounded-md border border-input shrink-0 transition-shadow hover:shadow-md focus:outline-none focus:ring-1 focus:ring-ring"
          style={{ backgroundColor: value }}
          aria-label="Открыть палитру"
        />
        <Input
          value={hexInput}
          onChange={handleHexInput}
          placeholder="005FF9"
          className="font-mono text-xs w-24 shrink-0"
          maxLength={6}
        />
        {open && (
          <div
            ref={popoverRef}
            style={popoverStyle}
            className="rounded-lg shadow-lg border border-border bg-popover p-3"
          >
            <ColorPicker value={value} onChange={onChange} />
          </div>
        )}
      </div>
    </div>
  );
}

// ─── CSS Download Section ─────────────────────────────────────────────────────

function downloadCss(brandName: string, cssContent: string) {
  const a = document.createElement('a');
  a.href = 'data:text/css;charset=utf-8,' + encodeURIComponent(cssContent);
  a.download = `${brandName.toLowerCase().replace(/\s+/g, '-')}-brand.css`;
  a.click();
}

function downloadAll(brands: BrandCssEntry[]) {
  const combined = brands.map(b => `/* ${b.brandName} */\n${b.cssContent}`).join('\n\n');
  const a = document.createElement('a');
  a.href = 'data:text/css;charset=utf-8,' + encodeURIComponent(combined);
  a.download = 'all-brands.css';
  a.click();
}

function CssDownloadSection({
  brands,
  newEntry,
  className,
}: {
  brands: BrandCssEntry[];
  newEntry: { brandName: string; cssContent: string } | null;
  className?: string;
}) {
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  const allBrands: BrandCssEntry[] = newEntry
    ? [newEntry, ...brands.filter(b => b.brandName !== newEntry.brandName)]
    : brands;

  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [open]);

  if (allBrands.length === 0) return null;

  if (allBrands.length === 1) {
    const brand = allBrands[0]!;
    return (
      <Button variant="secondary" className={cn('w-full gap-2', className)} onClick={() => downloadCss(brand.brandName, brand.cssContent)}>
        <SvgIcon svg={iconDownload} /> Скачать CSS
      </Button>
    );
  }

  return (
    <div ref={containerRef} className={cn('relative', className)}>
      {open && (
        <div className="absolute bottom-full left-0 right-0 mb-1 rounded-lg border border-border bg-popover shadow-lg overflow-hidden z-50">
          {allBrands.map(brand => (
            <button
              key={brand.brandName}
              type="button"
              onClick={() => { downloadCss(brand.brandName, brand.cssContent); setOpen(false); }}
              className="w-full flex items-center gap-2 px-3 py-2 text-sm text-left hover:bg-accent border-b border-border last:border-0 transition-colors"
            >
              <SvgIcon svg={iconFileCode} className="text-muted-foreground [&_svg]:w-3.5 [&_svg]:h-3.5" />
              <span className="flex-1 truncate">{brand.brandName}</span>
            </button>
          ))}
          <button
            type="button"
            onClick={() => { downloadAll(allBrands); setOpen(false); }}
            className="w-full flex items-center gap-2 px-3 py-2 text-sm font-medium text-left hover:bg-accent border-t border-border transition-colors"
          >
            Скачать все
          </button>
        </div>
      )}
      <Button variant="secondary" className="w-full gap-2" onClick={() => setOpen(v => !v)}>
        <SvgIcon svg={iconDownload} /> Скачать CSS
      </Button>
    </div>
  );
}

// ─── Expert Section ───────────────────────────────────────────────────────────

function ExpertSection({
  overrides,
  enabled,
  onToggle,
  onColorChange,
  brandColor,
  onBrandColorChange,
}: {
  overrides: Partial<Record<ColorFamily, string>>;
  enabled: Set<ColorFamily>;
  onToggle: (f: ColorFamily, on: boolean) => void;
  onColorChange: (f: ColorFamily, hex: string) => void;
  brandColor: string;
  onBrandColorChange: (hex: string) => void;
}) {
  const allEnabled = COLOR_FAMILIES.every(f => enabled.has(f));

  return (
    <div className="space-y-1">
      {/* Brand color row — always on, checkbox locked */}
      <div className="flex items-center justify-between h-9 border-b border-border">
        <label className="flex items-center gap-2 select-none">
          <Checkbox checked readOnly className="pointer-events-none opacity-60" />
          <span className="text-sm font-medium">Бренд</span>
        </label>
        <ColorField value={brandColor} onChange={onBrandColorChange} />
      </div>
      {COLOR_FAMILIES.map(family => {
        const isOn = enabled.has(family);
        const color = overrides[family] ?? DEFAULT_OVERRIDES[family];
        return (
          <div key={family} className="flex items-center justify-between h-9 border-b border-border/50 last:border-0">
            <label className="flex items-center gap-2 cursor-pointer select-none">
              <Checkbox
                checked={isOn}
                onCheckedChange={checked => onToggle(family, checked)}
              />
              <span className="text-sm">{family}</span>
            </label>
            {isOn && (
              <ColorField
                value={color}
                onChange={hex => onColorChange(family, hex)}
              />
            )}
          </div>
        );
      })}
    </div>
  );
}

// ─── Private Colors Phase ─────────────────────────────────────────────────────

type ToastState = {
  variant: 'success' | 'destructive';
  title: string;
  description: string;
  hiding: boolean;
} | null;

function PrivateColorsPhase({ existingBrands }: { existingBrands: BrandCssEntry[] }) {
  const [mode, setMode] = useState<'simple' | 'expert'>('simple');
  const [brandName, setBrandName] = useState('');
  const [brandColor, setBrandColor] = useState('#005FF9');
  const [enabledFamilies, setEnabledFamilies] = useState<Set<ColorFamily>>(new Set(COLOR_FAMILIES));
  const [colorOverrides, setColorOverrides] = useState<Partial<Record<ColorFamily, string>>>({});
  const [status, setStatus] = useState<GenStatus>(null);
  const [newCssEntry, setNewCssEntry] = useState<{ brandName: string; cssContent: string } | null>(null);
  const [toast, setToast] = useState<ToastState>(null);
  const toastTimers = useRef<ReturnType<typeof setTimeout>[]>([]);

  const showToast = useCallback((variant: 'success' | 'destructive', title: string, description: string) => {
    toastTimers.current.forEach(clearTimeout);
    setToast({ variant, title, description, hiding: false });
    toastTimers.current = [
      setTimeout(() => setToast(t => t ? { ...t, hiding: true } : null), 4000),
      setTimeout(() => setToast(null), 4300),
    ];
  }, []);

  useEffect(() => {
    const handler = (event: MessageEvent) => {
      const msg = event.data?.pluginMessage as MainToUiMessage | undefined;
      if (!msg) return;
      if (msg.type === 'generate-done') {
        setStatus({ type: 'success', varCount: msg.varCount, brandName: msg.brandName, cssContent: msg.cssContent });
        setNewCssEntry({ brandName: msg.brandName, cssContent: msg.cssContent });
        showToast('success', 'Коллекция приватных цветов создана.', `«${msg.brandName}»: ${msg.varCount} переменных всего.`);
      } else if (msg.type === 'generate-error') {
        setStatus({ type: 'error', message: msg.message });
        showToast('destructive', 'Ошибка', msg.message);
      }
    };
    window.addEventListener('message', handler);
    return () => window.removeEventListener('message', handler);
  }, [showToast]);

  const handleGenerate = useCallback(() => {
    const name = brandName.trim();
    if (!name) return;
    setStatus('generating');
    const overrides = mode === 'expert' && enabledFamilies.size > 0
      ? Object.fromEntries([...enabledFamilies].map(f => [f, colorOverrides[f] ?? DEFAULT_OVERRIDES[f]]))
      : undefined;
    send({
      type: 'generate-private-colors',
      brandName: name,
      brandHex: brandColor,
      ...(overrides ? { colorOverrides: overrides as Partial<Record<ColorFamily, string>> } : {}),
    });
  }, [brandName, brandColor, mode, enabledFamilies, colorOverrides]);

  const toggleFamily = (f: ColorFamily, on: boolean) => {
    setEnabledFamilies(prev => {
      const next = new Set(prev);
      if (on) next.add(f); else next.delete(f);
      return next;
    });
  };

  return (
    <div className="relative flex flex-col h-full">
      {/* Scrollable content */}
      <div className="flex-1 overflow-y-auto p-5 space-y-4">
        <div className="flex items-center justify-between">
          <h1 className="text-base font-semibold">Приватные цвета</h1>
          <div className="flex rounded-lg border border-input bg-muted p-0.5 gap-0.5">
            {(['simple', 'expert'] as const).map(m => (
              <button
                key={m}
                type="button"
                onClick={() => setMode(m)}
                className={cn(
                  'px-3 py-1 rounded-md text-xs font-medium transition-all',
                  mode === m
                    ? 'bg-background text-foreground shadow-sm'
                    : 'text-muted-foreground hover:text-foreground'
                )}
              >
                {m === 'simple' ? 'Простой' : 'Эксперт'}
              </button>
            ))}
          </div>
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="brand-name" className="text-xs">Название бренда</Label>
          <Input
            id="brand-name"
            autoFocus
            value={brandName}
            onChange={e => setBrandName(e.target.value)}
            placeholder="MyBrand"
          />
        </div>

        {mode === 'simple' && (
          <div className="space-y-1.5">
            <Label className="text-xs flex items-center gap-1">
              Основной цвет бренда
              <Tooltip text="Будет использован, как 550й цвет в палитре оттенков.">
                <SvgIcon svg={iconQuestion} className="text-muted-foreground cursor-default" />
              </Tooltip>
            </Label>
            <ColorField value={brandColor} onChange={setBrandColor} />
          </div>
        )}

        {mode === 'expert' && (
          <ExpertSection
            overrides={colorOverrides}
            enabled={enabledFamilies}
            onToggle={toggleFamily}
            onColorChange={(f, hex) => setColorOverrides(prev => ({ ...prev, [f]: hex }))}
            brandColor={brandColor}
            onBrandColorChange={setBrandColor}
          />
        )}

      </div>

      {/* Toast */}
      {toast && (
        <div
          className={cn('absolute left-4 right-4 bottom-20 z-50 pointer-events-none', toast.hiding ? 'toast-leave' : 'toast-enter')}
          onClick={() => setToast(null)}
          style={{ pointerEvents: 'all' }}
        >
          <Alert variant={toast.variant}>
            <AlertTitle>{toast.title}</AlertTitle>
            <AlertDescription>{toast.description}</AlertDescription>
          </Alert>
        </div>
      )}

      {/* Sticky footer */}
      {(() => {
        const allBrands = newCssEntry
          ? [newCssEntry, ...existingBrands.filter(b => b.brandName !== newCssEntry.brandName)]
          : existingBrands;
        const hasCss = allBrands.length > 0;
        return (
          <div className={cn('shrink-0 border-t border-border bg-background px-5 py-3', hasCss ? 'flex gap-2' : '')}>
            <Button
              className={cn('gap-2', hasCss ? 'flex-1' : 'w-full')}
              disabled={!brandName.trim() || status === 'generating'}
              onClick={handleGenerate}
            >
              <SvgIcon svg={iconPalette} />
              {status === 'generating' ? 'Генерируем…' : 'Сгенерировать'}
            </Button>
            {hasCss && <CssDownloadSection brands={existingBrands} newEntry={newCssEntry} className="flex-1" />}
          </div>
        );
      })()}
    </div>
  );
}

// ─── Main Lib Phase ───────────────────────────────────────────────────────────

type Phase2Status = 'idle' | 'generating' | { type: 'done'; brandName: string; varCount: number } | { type: 'error'; message: string };

const FUN_MESSAGES = [
  'Раскрашиваем пиксели...',
  'Уговариваем токены стать алиасами...',
  'Тащим цвета из внешней библиотеки...',
  'Объясняем Appearance, кто тут новый...',
  'Прокладываем путь от Brand к Appearance...',
  'Финальный штрих — почти готово...',
];

function MainLibPhase({ info }: { info: LibInfo }) {
  const [brandName, setBrandName] = useState('');
  const [status, setStatus] = useState<Phase2Status>('idle');
  const [progress, setProgress] = useState(0);
  const [msgIdx, setMsgIdx] = useState(0);
  const baseBrand = info.existingBrands[0] ?? 'Yandex Cloud';
  const [toast, setToast] = useState<ToastState>(null);
  const toastTimers = useRef<ReturnType<typeof setTimeout>[]>([]);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const showToast = useCallback((variant: 'success' | 'destructive', title: string, description: string) => {
    toastTimers.current.forEach(clearTimeout);
    setToast({ variant, title, description, hiding: false });
    toastTimers.current = [
      setTimeout(() => setToast(t => t ? { ...t, hiding: true } : null), 4000),
      setTimeout(() => setToast(null), 4300),
    ];
  }, []);

  const isGenerating = status === 'generating';

  useEffect(() => {
    if (isGenerating) {
      setMsgIdx(0);
      intervalRef.current = setInterval(() => {
        setMsgIdx(i => (i + 1) % FUN_MESSAGES.length);
      }, 2200);
    } else {
      if (intervalRef.current) { clearInterval(intervalRef.current); intervalRef.current = null; }
    }
    return () => { if (intervalRef.current) clearInterval(intervalRef.current); };
  }, [isGenerating]);

  useEffect(() => {
    const handler = (event: MessageEvent) => {
      const msg = event.data?.pluginMessage as MainToUiMessage | undefined;
      if (!msg) return;
      if (msg.type === 'phase2-progress') {
        setProgress(msg.total > 0 ? Math.round((msg.current / msg.total) * 100) : 0);
      } else if (msg.type === 'phase2-done') {
        setStatus({ type: 'done', brandName: msg.brandName, varCount: msg.varCount });
        setProgress(100);
        showToast('success', `Бренд «${msg.brandName}» добавлен.`, `${msg.varCount} переменных обновлено.`);
      } else if (msg.type === 'phase2-error') {
        setStatus({ type: 'error', message: msg.message });
        showToast('destructive', 'Ошибка', msg.message);
      }
    };
    window.addEventListener('message', handler);
    return () => window.removeEventListener('message', handler);
  }, [showToast]);

  const handleGenerate = useCallback(() => {
    const name = brandName.trim();
    if (!name) return;
    setStatus('generating');
    setProgress(0);
    send({ type: 'generate-phase2', brandName: name, baseBrandName: baseBrand });
  }, [brandName, baseBrand]);

  const { connectedPrivateColorLibs: libs } = info;

  return (
    <div className="relative flex flex-col h-full">
      <div className="flex-1 overflow-y-auto p-5 space-y-4">
        <h1 className="text-base font-semibold">Основная библиотека</h1>

        {isGenerating ? (
          <div className="flex flex-col justify-center py-8 gap-4">
            <div className="space-y-2">
              <div className="h-2 w-full rounded-full bg-muted overflow-hidden">
                <div
                  className="h-full bg-primary rounded-full transition-all duration-300 ease-out"
                  style={{ width: `${progress}%` }}
                />
              </div>
              <div className="flex justify-between text-xs text-muted-foreground">
                <span className="italic">{FUN_MESSAGES[msgIdx]}</span>
                <span>{progress}%</span>
              </div>
            </div>
          </div>
        ) : (
          <>
            <div className="space-y-1.5">
              <Label htmlFor="p2-brand-name" className="text-xs">Название нового бренда</Label>
              <Input
                id="p2-brand-name"
                autoFocus
                value={brandName}
                onChange={e => setBrandName(e.target.value)}
                placeholder="MyBrand"
                onKeyDown={e => { if (e.key === 'Enter' && brandName.trim()) handleGenerate(); }}
              />
            </div>

            <div className="space-y-1">
              <p className="text-xs text-muted-foreground">Подключённые библиотеки приватных цветов:</p>
              {libs.length === 0 ? (
                <p className="text-xs text-destructive">Нет подключённых библиотек</p>
              ) : libs.map(name => (
                <div key={name} className="flex items-center gap-1.5 text-xs">
                  <span className="text-green-600 font-medium">✓</span>
                  <span>{name}</span>
                </div>
              ))}
            </div>
          </>
        )}
      </div>

      {toast && (
        <div
          className={cn('absolute left-4 right-4 bottom-20 z-50', toast.hiding ? 'toast-leave' : 'toast-enter')}
          style={{ pointerEvents: 'all' }}
          onClick={() => setToast(null)}
        >
          <Alert variant={toast.variant}>
            <AlertTitle>{toast.title}</AlertTitle>
            <AlertDescription>{toast.description}</AlertDescription>
          </Alert>
        </div>
      )}

      <div className="shrink-0 border-t border-border bg-background px-5 py-3">
        <Button
          className="w-full gap-2"
          disabled={!brandName.trim() || isGenerating}
          onClick={handleGenerate}
        >
          <SvgIcon svg={iconPalette} />
          {isGenerating ? 'Генерируем…' : 'Сгенерировать'}
        </Button>
      </div>
    </div>
  );
}

// ─── Error Screen ─────────────────────────────────────────────────────────────

function ErrorScreen({ message, missingCollections }: { message: string; missingCollections?: string[] }) {
  return (
    <div className="p-5 space-y-3">
      <Alert variant="destructive">
        <AlertTitle>Ошибка</AlertTitle>
        <AlertDescription>{message}</AlertDescription>
      </Alert>
      {missingCollections && missingCollections.length > 0 && (
        <div className="text-xs text-muted-foreground">
          <p className="mb-1">Отсутствуют коллекции:</p>
          <ul className="space-y-0.5">
            {missingCollections.map(c => (
              <li key={c} className="font-mono bg-muted px-2 py-0.5 rounded">{c}</li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}

// ─── App Root ─────────────────────────────────────────────────────────────────

function App() {
  const [phase, setPhase] = useState<Phase>({ tag: 'loading' });

  useEffect(() => {
    send({ type: 'ui-ready' });
  }, []);

  useEffect(() => {
    const handler = (event: MessageEvent) => {
      const msg = event.data?.pluginMessage as MainToUiMessage | undefined;
      if (!msg) return;
      if (msg.type === 'phase-private-colors') {
        setPhase({ tag: 'private-colors', existingBrands: msg.existingBrands });
      } else if (msg.type === 'phase-main-lib') {
        setPhase({ tag: 'main-lib', info: msg.info });
      } else if (msg.type === 'lib-error') {
        setPhase({
          tag: 'error',
          message: msg.message,
          ...(msg.missingCollections !== undefined ? { missingCollections: msg.missingCollections } : {}),
        });
      }
    };
    window.addEventListener('message', handler);
    return () => window.removeEventListener('message', handler);
  }, []);

  if (phase.tag === 'loading') {
    return (
      <div className="flex items-center justify-center h-20 text-sm text-muted-foreground">
        Загружается…
      </div>
    );
  }

  if (phase.tag === 'error') {
    return (
      <ErrorScreen
        message={phase.message}
        {...(phase.missingCollections !== undefined ? { missingCollections: phase.missingCollections } : {})}
      />
    );
  }

  if (phase.tag === 'private-colors') {
    return <PrivateColorsPhase existingBrands={phase.existingBrands} />;
  }

  return <MainLibPhase info={phase.info} />;
}

// ─── Mount ────────────────────────────────────────────────────────────────────

const root = document.getElementById('root');
if (root) createRoot(root).render(<App />);
