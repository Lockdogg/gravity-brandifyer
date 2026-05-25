import { createRoot } from 'react-dom/client';
import { useState, useEffect, useLayoutEffect, useRef, useCallback, useMemo } from 'react';
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
import iconPlus from '@gravity-ui/icons/svgs/plus.svg';
import iconTrash from '@gravity-ui/icons/svgs/trash-bin.svg';
import iconChevronDown from '@gravity-ui/icons/svgs/chevron-down.svg';

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
  | { tag: 'main-lib'; info: LibInfo; existingBrandsCss: BrandCssEntry[] };

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
        <span className="absolute bottom-full left-0 mb-1.5 z-50 w-52 rounded-md bg-foreground text-background text-xs px-2.5 py-1.5 leading-snug shadow-md pointer-events-none whitespace-normal">
          {text}
          <span className="absolute top-full left-3 -translate-x-1/2 border-4 border-transparent border-t-foreground" />
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
  const [popoverStyle, setPopoverStyle] = useState<React.CSSProperties>({
    position: 'fixed', top: -9999, left: -9999, zIndex: 9999,
  });
  const [hexInput, setHexInput] = useState(value.replace('#', ''));
  const popoverRef = useRef<HTMLDivElement>(null);
  const swatchRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    setHexInput(value.replace('#', ''));
  }, [value]);

  useLayoutEffect(() => {
    if (!open || !swatchRef.current) return;

    const r = swatchRef.current.getBoundingClientRect();
    let top = r.bottom + 6;
    let left = r.left;
    const ph = 290;
    if (top + ph > window.innerHeight - 8) top = r.top - ph - 6;
    if (left + PICKER_W > window.innerWidth - 8) left = window.innerWidth - PICKER_W - 8;
    setPopoverStyle({ position: 'fixed', top: Math.max(8, top), left: Math.max(8, left), zIndex: 9999 });
  }, [open]);

  useEffect(() => {
    if (!open) return;
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
          className="w-9 h-9 rounded-md border border-input shrink-0 transition-shadow hover:shadow-md focus:outline-none focus:ring-1 focus:ring-ring"
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
        <SvgIcon svg={iconChevronDown} className={cn('ml-auto transition-transform duration-150', open && 'rotate-180')} />
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
  showBrand = true,
}: {
  overrides: Partial<Record<ColorFamily, string>>;
  enabled: Set<ColorFamily>;
  onToggle: (f: ColorFamily, on: boolean) => void;
  onColorChange: (f: ColorFamily, hex: string) => void;
  brandColor: string;
  onBrandColorChange: (hex: string) => void;
  showBrand?: boolean;
}) {
  const allEnabled = COLOR_FAMILIES.every(f => enabled.has(f));

  return (
    <div className="space-y-1">
      {/* Brand color row — only shown in mono-brand expert mode */}
      {showBrand && (
        <div className="flex items-center gap-2 h-9 border-b border-border">
          <label className="flex items-center gap-2 flex-1 select-none">
            <Checkbox checked readOnly className="pointer-events-none opacity-60" />
            <span className="text-sm font-medium">Бренд</span>
          </label>
          <ColorField value={brandColor} onChange={onBrandColorChange} />
          <span className="w-9 shrink-0" />
        </div>
      )}
      {COLOR_FAMILIES.map(family => {
        const isOn = enabled.has(family);
        const color = overrides[family] ?? DEFAULT_OVERRIDES[family];
        return (
          <div key={family} className="flex items-center gap-2 h-9 border-b border-border/50 last:border-0">
            <label className="flex items-center gap-2 flex-1 cursor-pointer select-none">
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
            <span className="w-9 shrink-0" />
          </div>
        );
      })}
    </div>
  );
}

// ─── Multi-Brand Section ──────────────────────────────────────────────────────

type MultiBrandEntry = { id: number; name: string; hex: string };

let _nextId = 1;
const nextId = () => _nextId++;

function MultiBrandSection({
  groupName,
  onGroupNameChange,
  entries,
  onEntriesChange,
  showGroupName = true,
}: {
  groupName: string;
  onGroupNameChange: (v: string) => void;
  entries: MultiBrandEntry[];
  onEntriesChange: (v: MultiBrandEntry[]) => void;
  showGroupName?: boolean;
}) {
  const setName = (id: number, name: string) =>
    onEntriesChange(entries.map(e => e.id === id ? { ...e, name } : e));
  const setHex = (id: number, hex: string) =>
    onEntriesChange(entries.map(e => e.id === id ? { ...e, hex } : e));
  const remove = (id: number) =>
    onEntriesChange(entries.filter(e => e.id !== id));
  const add = () =>
    onEntriesChange([...entries, { id: nextId(), name: '', hex: '#005FF9' }]);

  return (
    <div className="space-y-4">
      {showGroupName && (
        <div className="space-y-1.5">
          <Label className="text-xs">Название группы</Label>
          <Input
            value={groupName}
            onChange={e => onGroupNameChange(e.target.value)}
            placeholder="Infra"
          />
          {groupName && (
            <p className="text-xs text-muted-foreground">
              Системные цвета: [{groupName}] Semantic/…
            </p>
          )}
        </div>
      )}

      <div className="space-y-1.5">
        <Label className="text-xs flex items-center gap-1">
          Бренды
          <Tooltip text="Каждый бренд получит свою шкалу Brand/ (50–1000) под своим именем в коллекции.">
            <SvgIcon svg={iconQuestion} className="text-muted-foreground cursor-default" />
          </Tooltip>
        </Label>
        <div className="space-y-2">
          {entries.map((entry) => (
            <div key={entry.id} className="flex items-center gap-2">
              <Input
                value={entry.name}
                onChange={e => setName(entry.id, e.target.value)}
                placeholder="MyBrand"
                className="flex-1 min-w-0"
              />
              <ColorField value={entry.hex} onChange={hex => setHex(entry.id, hex)} />
              <button
                type="button"
                onClick={() => remove(entry.id)}
                aria-label="Удалить бренд"
                className={cn(
                  'shrink-0 w-9 h-9 rounded-md flex items-center justify-center transition-colors focus:outline-none focus-visible:ring-1 focus-visible:ring-ring',
                  entries.length > 1
                    ? 'text-muted-foreground hover:text-destructive hover:bg-destructive/10'
                    : 'invisible pointer-events-none',
                )}
              >
                <SvgIcon svg={iconTrash} className="[&_svg]:w-3.5 [&_svg]:h-3.5" />
              </button>
            </div>
          ))}
        </div>
        <button
          type="button"
          onClick={add}
          className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors"
        >
          <SvgIcon svg={iconPlus} className="[&_svg]:w-3 [&_svg]:h-3" />
          Добавить бренд
        </button>
      </div>
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
  const [expertSub, setExpertSub] = useState<'mono' | 'multi'>('mono');
  // Mono state
  const [brandName, setBrandName] = useState('');
  const [brandColor, setBrandColor] = useState('#005FF9');
  // Shared expert overrides (used by both mono and multi)
  const [enabledFamilies, setEnabledFamilies] = useState<Set<ColorFamily>>(new Set(COLOR_FAMILIES));
  const [colorOverrides, setColorOverrides] = useState<Partial<Record<ColorFamily, string>>>({});
  // Multi state
  const [mbGroupName, setMbGroupName] = useState('');
  const [mbEntries, setMbEntries] = useState<MultiBrandEntry[]>(() => [
    { id: nextId(), name: 'Arcanum', hex: '#A96BFF' },
    { id: nextId(), name: 'Deploy',  hex: '#3051A6' },
    { id: nextId(), name: 'IDM',     hex: '#FF5D5D' },
    { id: nextId(), name: 'ABC',     hex: '#FDD72A' },
    { id: nextId(), name: 'IDP',     hex: '#FAC1FF' },
    { id: nextId(), name: 'CMDB',    hex: '#B2F76F' },
    { id: nextId(), name: 'NOC',     hex: '#15B381' },
    { id: nextId(), name: 'Nirvana', hex: '#3B7F97' },
  ]);
  const [mbNewEntries, setMbNewEntries] = useState<BrandCssEntry[]>([]);

  const [status, setStatus] = useState<GenStatus>(null);
  const [newCssEntry, setNewCssEntry] = useState<{ brandName: string; cssContent: string } | null>(null);
  const [toast, setToast] = useState<ToastState>(null);
  const toastTimers = useRef<ReturnType<typeof setTimeout>[]>([]);

  const [errors, setErrors] = useState<Set<string>>(new Set());
  const brandNameRef = useRef<HTMLInputElement>(null);
  const groupNameRef = useRef<HTMLInputElement>(null);

  const clearError = (key: string) =>
    setErrors(prev => { const n = new Set(prev); n.delete(key); return n; });

  const isMulti = mode === 'expert' && expertSub === 'multi';

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
        setBrandName('');
        showToast('success', 'Коллекция приватных цветов создана.', `«${msg.brandName}»: ${msg.varCount} переменных всего.`);
      } else if (msg.type === 'generate-error') {
        setStatus({ type: 'error', message: msg.message });
        showToast('destructive', 'Ошибка', msg.message);
      } else if (msg.type === 'multibrand-done') {
        setStatus(null);
        setMbNewEntries(msg.cssEntries);
        const names = msg.cssEntries.map(e => e.brandName).join(', ');
        showToast('success', 'Мультибренд создан.', `${msg.varCount} переменных: ${names}.`);
      } else if (msg.type === 'multibrand-error') {
        setStatus({ type: 'error', message: msg.message });
        showToast('destructive', 'Ошибка', msg.message);
      }
    };
    window.addEventListener('message', handler);
    return () => window.removeEventListener('message', handler);
  }, [showToast]);

  const getActiveOverrides = () => enabledFamilies.size > 0
    ? Object.fromEntries([...enabledFamilies].map(f => [f, colorOverrides[f] ?? DEFAULT_OVERRIDES[f]])) as Partial<Record<ColorFamily, string>>
    : undefined;

  const handleGenerate = useCallback(() => {
    if (isMulti) {
      const gn = mbGroupName.trim();
      if (!gn) {
        setErrors(new Set(['groupName']));
        groupNameRef.current?.focus();
        return;
      }
      const validBrands = mbEntries.filter(e => e.name.trim());
      if (!validBrands.length) return;
      setErrors(new Set());
      setStatus('generating');
      const overrides = getActiveOverrides();
      send({
        type: 'generate-multibrand',
        groupName: gn,
        brands: validBrands.map(e => ({ name: e.name.trim(), hex: e.hex })),
        ...(overrides ? { colorOverrides: overrides } : {}),
      });
      return;
    }
    const name = brandName.trim();
    if (!name) {
      setErrors(new Set(['brandName']));
      brandNameRef.current?.focus();
      return;
    }
    setErrors(new Set());
    setStatus('generating');
    const overrides = mode === 'expert' ? getActiveOverrides() : undefined;
    send({
      type: 'generate-private-colors',
      brandName: name,
      brandHex: brandColor,
      ...(overrides ? { colorOverrides: overrides } : {}),
    });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [brandName, brandColor, mode, expertSub, enabledFamilies, colorOverrides, mbGroupName, mbEntries]);

  const toggleFamily = (f: ColorFamily, on: boolean) => {
    setEnabledFamilies(prev => {
      const next = new Set(prev);
      if (on) next.add(f); else next.delete(f);
      return next;
    });
  };

  const isGenerating = status === 'generating';

  return (
    <div className="relative flex flex-col h-full">
      <div className="flex-1 overflow-y-auto p-5 space-y-4">
        <h1 className="text-base font-semibold">Приватные цвета</h1>

        <div className="flex items-center gap-2">
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
          {mode === 'expert' && (
            <>
              <span className="text-muted-foreground text-xs select-none">:</span>
              <div className="flex rounded-lg border border-input bg-muted p-0.5 gap-0.5">
                {(['mono', 'multi'] as const).map(s => (
                  <button
                    key={s}
                    type="button"
                    onClick={() => setExpertSub(s)}
                    className={cn(
                      'px-3 py-1 rounded-md text-xs font-medium transition-all',
                      expertSub === s
                        ? 'bg-background text-foreground shadow-sm'
                        : 'text-muted-foreground hover:text-foreground'
                    )}
                  >
                    {s === 'mono' ? 'Монобренд' : 'Мультибренд'}
                  </button>
                ))}
              </div>
            </>
          )}
        </div>

        {/* Brand name — simple or expert mono */}
        {!isMulti && (
          <div className="space-y-1.5">
            <Label htmlFor="brand-name" className="text-xs">Название бренда</Label>
            <Input
              ref={brandNameRef}
              id="brand-name"
              autoFocus
              value={brandName}
              onChange={e => { setBrandName(e.target.value); clearError('brandName'); }}
              placeholder="MyBrand"
              className={cn(errors.has('brandName') && 'border-destructive focus-visible:ring-destructive')}
            />
            {errors.has('brandName') && (
              <p className="text-xs text-destructive">Для генерации нужно заполнить название</p>
            )}
          </div>
        )}

        {/* Simple: just brand color */}
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

        {/* Multi: group name comes before the expert table */}
        {isMulti && (
          <div className="space-y-1.5">
            <Label className="text-xs flex items-center gap-1">
              Название группы
              <Tooltip text="Системные цвета попадут в «[Группа] Semantic/», бренды — в «[Группа] Service/».">
                <SvgIcon svg={iconQuestion} className="text-muted-foreground cursor-default" />
              </Tooltip>
            </Label>
            <Input
              ref={groupNameRef}
              value={mbGroupName}
              onChange={e => { setMbGroupName(e.target.value); clearError('groupName'); }}
              placeholder="Infra"
              className={cn(errors.has('groupName') && 'border-destructive focus-visible:ring-destructive')}
            />
            {errors.has('groupName') && (
              <p className="text-xs text-destructive">Для генерации нужно заполнить название группы</p>
            )}
            {!errors.has('groupName') && mbGroupName && (
              <p className="text-xs text-muted-foreground">
                Системные цвета: [{mbGroupName}] Semantic/…
              </p>
            )}
          </div>
        )}

        {/* Expert: family overrides (Brand row only in mono) */}
        {mode === 'expert' && (
          <div className="space-y-2">
            <Label className="text-xs flex items-center gap-1">
              Базовые цвета
              <Tooltip text="Палитры нейтральных оттенков (синий, зелёный…). Если не менять — берутся из Yandex Cloud.">
                <SvgIcon svg={iconQuestion} className="text-muted-foreground cursor-default" />
              </Tooltip>
            </Label>
            <ExpertSection
              overrides={colorOverrides}
              enabled={enabledFamilies}
              onToggle={toggleFamily}
              onColorChange={(f, hex) => setColorOverrides(prev => ({ ...prev, [f]: hex }))}
              brandColor={brandColor}
              onBrandColorChange={setBrandColor}
              showBrand={expertSub === 'mono'}
            />
          </div>
        )}

        {/* Multi: brand list (group name already rendered above) */}
        {isMulti && (
          <MultiBrandSection
            groupName={mbGroupName}
            onGroupNameChange={setMbGroupName}
            entries={mbEntries}
            onEntriesChange={setMbEntries}
            showGroupName={false}
          />
        )}
      </div>

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
        const mergedExisting = isMulti
          ? [...mbNewEntries, ...existingBrands.filter(b => !mbNewEntries.some(e => e.brandName === b.brandName))]
          : existingBrands;
        const singleNew = !isMulti ? newCssEntry : null;
        const hasCss = mergedExisting.length > 0 || singleNew !== null;
        return (
          <div className={cn('shrink-0 border-t border-border bg-background px-5 py-3', hasCss ? 'flex gap-2' : '')}>
            <Button
              className={cn('gap-2', hasCss ? 'flex-1' : 'w-full')}
              disabled={isGenerating}
              onClick={handleGenerate}
            >
              <SvgIcon svg={iconPalette} />
              {isGenerating ? 'Генерируем…' : 'Сгенерировать'}
            </Button>
            {hasCss && (
              <CssDownloadSection brands={mergedExisting} newEntry={singleNew} className="flex-1" />
            )}
          </div>
        );
      })()}
    </div>
  );
}

// ─── Main Lib Phase ───────────────────────────────────────────────────────────

type Phase2Status = 'idle' | 'generating' | { type: 'done'; brandName: string; varCount: number; cssContent: string } | { type: 'error'; message: string };

const FUN_MESSAGES = [
  'Раскрашиваем пиксели...',
  'Уговариваем токены стать алиасами...',
  'Тащим цвета из внешней библиотеки...',
  'Объясняем Appearance, кто тут новый...',
  'Прокладываем путь от Brand к Appearance...',
  'Финальный штрих — почти готово...',
];

function MainLibPhase({ info, existingBrandsCss }: { info: LibInfo; existingBrandsCss: BrandCssEntry[] }) {
  const { connectedLibs } = info;
  const [activeTab, setActiveTab] = useState<'generate' | 'download'>('generate');
  const [brandName, setBrandName] = useState('');
  const [pcLibKey, setPcLibKey] = useState(connectedLibs[0]?.key ?? '');
  const [pcBrands, setPcBrands] = useState<Array<{ display: string; prefix: string; collectionKey: string }> | 'loading'>('loading');
  const [pcBrandName, setPcBrandName] = useState('');
  const [pcBrandCustom, setPcBrandCustom] = useState(false);
  const [status, setStatus] = useState<Phase2Status>('idle');
  const [progress, setProgress] = useState(0);
  const [msgIdx, setMsgIdx] = useState(0);
  const baseBrand = info.existingBrands[0] ?? 'Yandex Cloud';
  const [toast, setToast] = useState<ToastState>(null);
  const toastTimers = useRef<ReturnType<typeof setTimeout>[]>([]);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const lastAutoFill = useRef('');

  const showToast = useCallback((variant: 'success' | 'destructive', title: string, description: string) => {
    toastTimers.current.forEach(clearTimeout);
    setToast({ variant, title, description, hiding: false });
    toastTimers.current = [
      setTimeout(() => setToast(t => t ? { ...t, hiding: true } : null), 4000),
      setTimeout(() => setToast(null), 4300),
    ];
  }, []);

  const isGenerating = status === 'generating';

  // Merge newly generated brand with existing list (new brand goes first, deduped)
  const allBrands = useMemo<BrandCssEntry[]>(() => {
    const newEntry = typeof status === 'object' && status.type === 'done'
      ? { brandName: status.brandName, cssContent: status.cssContent }
      : null;
    if (!newEntry) return existingBrandsCss;
    return [newEntry, ...existingBrandsCss.filter(b => b.brandName !== newEntry.brandName)];
  }, [existingBrandsCss, status]);

  useEffect(() => {
    if (!pcLibKey) return;
    setPcBrands('loading');
    setPcBrandCustom(false);
    send({ type: 'request-lib-brands', libKey: pcLibKey });
  }, [pcLibKey]);

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
      if (msg.type === 'lib-brands') {
        if (msg.libKey === pcLibKey) {
          setPcBrands(msg.brands);
          const first = msg.brands[0];
          if (first) {
            setPcBrandName(first.prefix);
            setPcLibKey(first.collectionKey);
            setBrandName(prev => {
              if (prev === '' || prev === lastAutoFill.current) {
                lastAutoFill.current = first.display;
                return first.display;
              }
              return prev;
            });
          }
        }
      } else if (msg.type === 'phase2-progress') {
        setProgress(msg.total > 0 ? Math.round((msg.current / msg.total) * 100) : 0);
      } else if (msg.type === 'phase2-done') {
        setStatus({ type: 'done', brandName: msg.brandName, varCount: msg.varCount, cssContent: msg.cssContent });
        setBrandName('');
        setProgress(100);
        showToast('success', `Бренд «${msg.brandName}» добавлен.`, `${msg.varCount} переменных обновлено.`);
        setActiveTab('download');
      } else if (msg.type === 'phase2-error') {
        setStatus({ type: 'error', message: msg.message });
        showToast('destructive', 'Ошибка', msg.message);
      }
    };
    window.addEventListener('message', handler);
    return () => window.removeEventListener('message', handler);
  }, [showToast, pcLibKey]);

  const handleGenerate = useCallback(() => {
    const name = brandName.trim();
    if (!name || !pcBrandName) return;
    setStatus('generating');
    setProgress(0);
    send({ type: 'generate-phase2', brandName: name, baseBrandName: baseBrand, pcLibKey, pcBrandName });
  }, [brandName, baseBrand, pcLibKey, pcBrandName]);

  const nameExists = info.existingBrands.includes(brandName.trim());

  const libLabel = (lib: typeof connectedLibs[number]) => {
    const sameName = connectedLibs.filter(l => l.libraryName === lib.libraryName);
    return sameName.length > 1 ? `${lib.libraryName} — ${lib.collectionName}` : lib.libraryName;
  };

  return (
    <div className="relative flex flex-col h-full">

      {/* Header + segment control */}
      <div className="shrink-0 px-5 pt-4 pb-3 border-b border-border space-y-3">
        <h1 className="text-base font-semibold">Основная библиотека</h1>
        <div className="flex rounded-md border border-border overflow-hidden text-sm">
          {(['generate', 'download'] as const).map((tab, i) => (
            <button
              key={tab}
              type="button"
              onClick={() => setActiveTab(tab)}
              className={cn(
                'flex-1 py-1.5 transition-colors',
                i === 0 ? '' : 'border-l border-border',
                activeTab === tab
                  ? 'bg-primary text-primary-foreground font-medium'
                  : 'text-muted-foreground hover:text-foreground hover:bg-muted/50',
              )}
            >
              {tab === 'generate' ? 'Генерация' : 'Скачать CSS'}
              {tab === 'download' && allBrands.length > 0 && (
                <span className={cn(
                  'ml-1.5 text-xs px-1.5 py-0.5 rounded-full',
                  activeTab === 'download' ? 'bg-primary-foreground/20' : 'bg-muted',
                )}>
                  {allBrands.length}
                </span>
              )}
            </button>
          ))}
        </div>
      </div>

      {/* Tab: Генерация */}
      {activeTab === 'generate' && (
        <>
          <div className="flex-1 overflow-y-auto p-5 space-y-4">
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
                    onChange={e => { lastAutoFill.current = ''; setBrandName(e.target.value); }}
                    placeholder="MyBrand"
                    onKeyDown={e => { if (e.key === 'Enter' && brandName.trim() && pcLibKey && !nameExists) handleGenerate(); }}
                  />
                  {nameExists && (
                    <p className="text-xs text-destructive">Бренд «{brandName.trim()}» уже существует</p>
                  )}
                </div>

                <div className="space-y-1.5">
                  <Label htmlFor="p2-pc-lib" className="text-xs">Библиотека приватных цветов</Label>
                  {connectedLibs.length === 0 ? (
                    <p className="text-xs text-destructive">Нет подключённых библиотек — подключите библиотеку приватных цветов</p>
                  ) : (
                    <select
                      id="p2-pc-lib"
                      value={pcLibKey}
                      onChange={e => setPcLibKey(e.target.value)}
                      className="w-full h-9 rounded-md border border-input bg-background px-3 text-sm focus:outline-none focus:ring-1 focus:ring-ring"
                    >
                      {connectedLibs.map(lib => (
                        <option key={lib.key} value={lib.key}>{libLabel(lib)}</option>
                      ))}
                    </select>
                  )}
                </div>

                {pcLibKey && (
                  <div className="space-y-1.5">
                    <Label htmlFor="p2-pc-brand" className="text-xs">Бренд в библиотеке</Label>
                    {pcBrands === 'loading' ? (
                      <div className="h-9 rounded-md border border-input bg-muted animate-pulse" />
                    ) : pcBrands.length > 0 && !pcBrandCustom ? (
                      <select
                        id="p2-pc-brand"
                        value={pcBrandName}
                        onChange={e => {
                          const val = e.target.value;
                          if (val === '__custom__') {
                            setPcBrandCustom(true);
                            setPcBrandName('');
                            lastAutoFill.current = '';
                            return;
                          }
                          const brands = pcBrands as Array<{ display: string; prefix: string; collectionKey: string }>;
                          const brand = brands.find(b => b.prefix === val);
                          setPcBrandName(val);
                          if (brand?.collectionKey) setPcLibKey(brand.collectionKey);
                          setBrandName(prev => {
                            if (brand && (prev === '' || prev === lastAutoFill.current)) {
                              lastAutoFill.current = brand.display;
                              return brand.display;
                            }
                            return prev;
                          });
                        }}
                        className="w-full h-9 rounded-md border border-input bg-background px-3 text-sm focus:outline-none focus:ring-1 focus:ring-ring"
                      >
                        {(pcBrands as Array<{ display: string; prefix: string; collectionKey: string }>).map(b => (
                          <option key={`${b.collectionKey}:${b.prefix}`} value={b.prefix}>{b.display}</option>
                        ))}
                        <option disabled>──────────</option>
                        <option value="__custom__">Ввести другой…</option>
                      </select>
                    ) : (
                      <>
                        <div className="flex gap-2">
                          <Input
                            id="p2-pc-brand"
                            value={pcBrandName}
                            onChange={e => setPcBrandName(e.target.value)}
                            placeholder="MyBrand"
                            autoFocus={pcBrandCustom}
                            className="flex-1"
                          />
                          {pcBrands !== 'loading' && (pcBrands as Array<unknown>).length > 0 && (
                            <button
                              type="button"
                              onClick={() => {
                                setPcBrandCustom(false);
                                const first = (pcBrands as Array<{ display: string; prefix: string; collectionKey: string }>)[0]!;
                                setPcBrandName(first.prefix);
                                setPcLibKey(first.collectionKey);
                              }}
                              className="text-xs text-muted-foreground hover:text-foreground transition-colors whitespace-nowrap"
                            >
                              ← К списку
                            </button>
                          )}
                        </div>
                        <p className="text-xs text-muted-foreground">
                          Точный префикс переменных: <span className="font-mono">MyBrand</span>/Light/Brand/…
                        </p>
                      </>
                    )}
                  </div>
                )}
              </>
            )}
          </div>

          <div className="shrink-0 border-t border-border bg-background px-5 py-3">
            <Button
              className="w-full gap-2"
              disabled={!brandName.trim() || !pcLibKey || !pcBrandName.trim() || pcBrands === 'loading' || isGenerating || nameExists}
              onClick={handleGenerate}
            >
              <SvgIcon svg={iconPalette} />
              {isGenerating ? 'Генерируем…' : 'Сгенерировать'}
            </Button>
          </div>
        </>
      )}

      {/* Tab: Скачать CSS */}
      {activeTab === 'download' && (
        <>
          <div className="flex-1 overflow-y-auto">
            {allBrands.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-full gap-2 text-center px-8">
                <p className="text-sm text-muted-foreground">Нет сгенерированных брендов</p>
                <button
                  type="button"
                  className="text-xs text-primary hover:underline"
                  onClick={() => setActiveTab('generate')}
                >
                  Перейти к генерации →
                </button>
              </div>
            ) : (
              <div className="divide-y divide-border">
                {allBrands.map(brand => (
                  <div key={brand.brandName} className="flex items-center gap-3 px-5 py-3 hover:bg-muted/40 transition-colors">
                    <SvgIcon svg={iconFileCode} className="shrink-0 text-muted-foreground" />
                    <span className="flex-1 text-sm">{brand.brandName}</span>
                    <button
                      type="button"
                      onClick={() => downloadCss(brand.brandName, brand.cssContent)}
                      className="shrink-0 text-muted-foreground hover:text-foreground transition-colors p-1 -mr-1"
                      title="Скачать CSS"
                    >
                      <SvgIcon svg={iconDownload} />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>

          {allBrands.length > 0 && (
            <div className="shrink-0 border-t border-border bg-background px-5 py-3">
              <Button
                variant="secondary"
                className="w-full gap-2"
                onClick={() => downloadAll(allBrands)}
              >
                <SvgIcon svg={iconDownload} />
                Скачать все
              </Button>
            </div>
          )}
        </>
      )}

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
        setPhase({ tag: 'main-lib', info: msg.info, existingBrandsCss: msg.existingBrandsCss });
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

  return <MainLibPhase info={phase.info} existingBrandsCss={phase.existingBrandsCss} />;
}

// ─── Mount ────────────────────────────────────────────────────────────────────

const root = document.getElementById('root');
if (root) createRoot(root).render(<App />);
