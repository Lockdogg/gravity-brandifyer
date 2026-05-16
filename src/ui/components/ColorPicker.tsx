import { useRef, useEffect, useState, useCallback } from 'react';

// ─── Color math ───────────────────────────────────────────────────────────────

function hsvToRgb(h: number, s: number, v: number): [number, number, number] {
  const hi = Math.floor(h / 60) % 6;
  const f = h / 60 - Math.floor(h / 60);
  const p = v * (1 - s), q = v * (1 - f * s), t = v * (1 - (1 - f) * s);
  const rows: [number, number, number][] = [[v,t,p],[q,v,p],[p,v,t],[p,q,v],[t,p,v],[v,p,q]];
  const [r, g, b] = rows[hi]!;
  return [Math.round(r * 255), Math.round(g * 255), Math.round(b * 255)];
}

function rgbToHsv(r: number, g: number, b: number): [number, number, number] {
  r /= 255; g /= 255; b /= 255;
  const max = Math.max(r, g, b), min = Math.min(r, g, b), d = max - min;
  let h = 0;
  if (d) {
    if (max === r) h = (g - b) / d + (g < b ? 6 : 0);
    else if (max === g) h = (b - r) / d + 2;
    else h = (r - g) / d + 4;
    h *= 60;
  }
  return [h, max === 0 ? 0 : d / max, max];
}

function hsvToHsl(h: number, s: number, v: number): [number, number, number] {
  const l = v * (1 - s / 2);
  return [h, (l === 0 || l === 1) ? 0 : (v - l) / Math.min(l, 1 - l), l];
}

function hslToHsv(h: number, sl: number, l: number): [number, number, number] {
  const v = l + sl * Math.min(l, 1 - l);
  return [h, v === 0 ? 0 : 2 * (1 - l / v), v];
}

function hexToRgb(hex: string): [number, number, number] | null {
  const m = /^#?([0-9a-fA-F]{6})$/.exec(hex);
  if (!m) return null;
  const s = m[1]!;
  return [parseInt(s.slice(0, 2), 16), parseInt(s.slice(2, 4), 16), parseInt(s.slice(4, 6), 16)];
}

function toHex(r: number, g: number, b: number): string {
  return '#' + [r, g, b].map(v => Math.round(Math.max(0, Math.min(255, v))).toString(16).padStart(2, '0')).join('');
}

// ─── Canvas ───────────────────────────────────────────────────────────────────

function drawGrad(canvas: HTMLCanvasElement, hue: number) {
  canvas.width = canvas.offsetWidth || 228;
  canvas.height = canvas.offsetHeight || 180;
  const ctx = canvas.getContext('2d')!;
  const [r, g, b] = hsvToRgb(hue, 1, 1);
  ctx.fillStyle = `rgb(${r},${g},${b})`;
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  const wg = ctx.createLinearGradient(0, 0, canvas.width, 0);
  wg.addColorStop(0, '#fff'); wg.addColorStop(1, 'rgba(255,255,255,0)');
  ctx.fillStyle = wg; ctx.fillRect(0, 0, canvas.width, canvas.height);
  const bg = ctx.createLinearGradient(0, 0, 0, canvas.height);
  bg.addColorStop(0, 'rgba(0,0,0,0)'); bg.addColorStop(1, '#000');
  ctx.fillStyle = bg; ctx.fillRect(0, 0, canvas.width, canvas.height);
}

function drawHue(canvas: HTMLCanvasElement) {
  canvas.width = canvas.offsetWidth || 228;
  canvas.height = canvas.offsetHeight || 10;
  const ctx = canvas.getContext('2d')!;
  const g = ctx.createLinearGradient(0, 0, canvas.width, 0);
  [0, 60, 120, 180, 240, 300, 360].forEach(h => {
    const [r, gr, b] = hsvToRgb(h, 1, 1);
    g.addColorStop(h / 360, `rgb(${r},${gr},${b})`);
  });
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, canvas.width, canvas.height);
}

// ─── Drag ─────────────────────────────────────────────────────────────────────

function useDrag(onDrag: (x: number, y: number) => void) {
  const ref = useRef<HTMLDivElement>(null);
  const cbRef = useRef(onDrag);
  cbRef.current = onDrag;

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const pos = (e: MouseEvent) => {
      const r = el.getBoundingClientRect();
      return {
        x: Math.max(0, Math.min(1, (e.clientX - r.left) / r.width)),
        y: Math.max(0, Math.min(1, (e.clientY - r.top) / r.height)),
      };
    };
    const down = (e: MouseEvent) => {
      e.preventDefault(); e.stopPropagation();
      const { x, y } = pos(e); cbRef.current(x, y);
      const move = (e: MouseEvent) => { const { x, y } = pos(e); cbRef.current(x, y); };
      const up = () => { document.removeEventListener('mousemove', move); document.removeEventListener('mouseup', up); };
      document.addEventListener('mousemove', move);
      document.addEventListener('mouseup', up);
    };
    el.addEventListener('mousedown', down);
    return () => el.removeEventListener('mousedown', down);
  }, []);

  return ref;
}

// ─── NumInput ─────────────────────────────────────────────────────────────────

function NumInput({
  value,
  min,
  max,
  onChange,
  mono,
}: {
  value: number;
  min: number;
  max: number;
  onChange: (v: number) => void;
  mono?: boolean;
}) {
  const [text, setText] = useState(String(Math.round(value)));
  const ref = useRef<HTMLInputElement>(null);

  // Sync from external when value changes meaningfully (e.g. dragging gradient)
  useEffect(() => {
    // Don't override if the input is focused (user is typing/arrowing)
    if (document.activeElement !== ref.current) {
      setText(String(Math.round(value)));
    }
  }, [value]);

  const commit = (raw: string) => {
    const n = parseInt(raw, 10);
    if (!isNaN(n)) {
      const clamped = Math.max(min, Math.min(max, n));
      setText(String(clamped));
      onChange(clamped);
    }
  };

  return (
    <input
      ref={ref}
      type="text"
      value={text}
      onChange={e => setText(e.target.value)}
      onBlur={e => commit(e.target.value)}
      onKeyDown={e => {
        if (e.key === 'ArrowUp' || e.key === 'ArrowDown') {
          e.preventDefault();
          const step = (e.metaKey || e.ctrlKey) ? 10 : 1;
          const dir = e.key === 'ArrowUp' ? 1 : -1;
          const current = parseInt(text, 10) || 0;
          const next = Math.max(min, Math.min(max, current + dir * step));
          setText(String(next));
          onChange(next);
        } else if (e.key === 'Enter') {
          commit(text);
        }
      }}
      style={{
        flex: 1,
        minWidth: 0,
        padding: '5px 2px',
        border: 'none',
        borderRadius: 4,
        background: '#f0f0f0',
        fontSize: 11,
        textAlign: 'center',
        color: '#333',
        fontFamily: mono ? 'monospace' : 'inherit',
        outline: 'none',
      }}
      onFocus={e => e.target.select()}
    />
  );
}

// ─── HexInput ─────────────────────────────────────────────────────────────────

function HexInput({ value, onChange }: { value: string; onChange: (hex: string) => void }) {
  const [text, setText] = useState(value.replace('#', '').toUpperCase());
  const ref = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (document.activeElement !== ref.current) {
      setText(value.replace('#', '').toUpperCase());
    }
  }, [value]);

  return (
    <input
      ref={ref}
      type="text"
      value={text}
      maxLength={6}
      onChange={e => {
        const raw = e.target.value.replace(/[^0-9a-fA-F]/g, '').slice(0, 6).toUpperCase();
        setText(raw);
        if (raw.length === 6) onChange('#' + raw);
      }}
      onFocus={e => e.target.select()}
      style={{
        flex: 1,
        minWidth: 0,
        padding: '5px 2px',
        border: 'none',
        borderRadius: 4,
        background: '#f0f0f0',
        fontSize: 11,
        textAlign: 'center',
        color: '#333',
        fontFamily: 'monospace',
        letterSpacing: '0.02em',
        outline: 'none',
      }}
    />
  );
}

// ─── ColorPicker ──────────────────────────────────────────────────────────────

type Mode = 'HEX' | 'RGB' | 'HSL' | 'HSB';

export function ColorPicker({ value, onChange }: { value: string; onChange: (hex: string) => void }) {
  const rgb0 = hexToRgb(value) ?? ([0, 95, 249] as [number, number, number]);
  const [hsv, setHsv] = useState<[number, number, number]>(() => rgbToHsv(...rgb0));
  const [mode, setMode] = useState<Mode>('HSB');
  const [modeOpen, setModeOpen] = useState(false);

  const gradCanvasRef = useRef<HTMLCanvasElement>(null);
  const hueCanvasRef = useRef<HTMLCanvasElement>(null);

  const [h, s, v] = hsv;

  // Sync external value in (only when hex doesn't match current)
  useEffect(() => {
    const rgb = hexToRgb(value);
    if (!rgb) return;
    const cur = toHex(...hsvToRgb(h, s, v));
    if (toHex(...rgb) !== cur) setHsv(rgbToHsv(...rgb));
  }, [value]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => { if (gradCanvasRef.current) drawGrad(gradCanvasRef.current, h); }, [h, s, v]);
  useEffect(() => { if (hueCanvasRef.current) drawHue(hueCanvasRef.current); }, []);

  const emit = useCallback((newHsv: [number, number, number]) => {
    onChange(toHex(...hsvToRgb(...newHsv)));
  }, [onChange]);

  const gradRef = useDrag(useCallback((x, y) => {
    const next: [number, number, number] = [h, x, 1 - y];
    setHsv(next); emit(next);
  }, [h, emit]));

  const hueRef = useDrag(useCallback((x) => {
    const next: [number, number, number] = [x * 360, s, v];
    setHsv(next); emit(next);
  }, [s, v, emit]));

  const [r, g, b] = hsvToRgb(h, s, v);
  const hex = toHex(r, g, b);
  const [hl, sl, l] = hsvToHsl(h, s, v);

  const setR = (val: number) => { const n = rgbToHsv(val, g, b); setHsv(n); emit(n); };
  const setG = (val: number) => { const n = rgbToHsv(r, val, b); setHsv(n); emit(n); };
  const setB = (val: number) => { const n = rgbToHsv(r, g, val); setHsv(n); emit(n); };
  const setHH = (val: number) => { const n: [number,number,number] = [val, s, v]; setHsv(n); emit(n); };
  const setSS = (val: number) => { const n: [number,number,number] = [h, val / 100, v]; setHsv(n); emit(n); };
  const setVV = (val: number) => { const n: [number,number,number] = [h, s, val / 100]; setHsv(n); emit(n); };
  const setHL = (val: number) => { const n = hslToHsv(val, sl, l); setHsv(n); emit(n); };
  const setSL = (val: number) => { const n = hslToHsv(hl, val / 100, l); setHsv(n); emit(n); };
  const setLL = (val: number) => { const n = hslToHsv(hl, sl, val / 100); setHsv(n); emit(n); };

  const renderInputs = () => {
    if (mode === 'HEX') return <HexInput value={hex} onChange={v => { const rgb = hexToRgb(v); if (rgb) { const n = rgbToHsv(...rgb); setHsv(n); emit(n); } }} />;
    if (mode === 'RGB') return <>
      <NumInput value={r} min={0} max={255} onChange={setR} />
      <NumInput value={g} min={0} max={255} onChange={setG} />
      <NumInput value={b} min={0} max={255} onChange={setB} />
    </>;
    if (mode === 'HSL') return <>
      <NumInput value={Math.round(hl)} min={0} max={360} onChange={setHL} />
      <NumInput value={Math.round(sl * 100)} min={0} max={100} onChange={setSL} />
      <NumInput value={Math.round(l * 100)} min={0} max={100} onChange={setLL} />
    </>;
    return <>
      <NumInput value={Math.round(h)} min={0} max={360} onChange={setHH} />
      <NumInput value={Math.round(s * 100)} min={0} max={100} onChange={setSS} />
      <NumInput value={Math.round(v * 100)} min={0} max={100} onChange={setVV} />
    </>;
  };

  return (
    <div style={{ width: 252, background: '#fff', userSelect: 'none' }}>
      {/* Gradient */}
      <div ref={gradRef} style={{ position: 'relative', width: '100%', height: 180, cursor: 'crosshair', borderRadius: '8px 8px 0 0', overflow: 'hidden', flexShrink: 0 }}>
        <canvas ref={gradCanvasRef} style={{ width: '100%', height: '100%', display: 'block' }} />
        <div style={{
          position: 'absolute',
          width: 12, height: 12,
          borderRadius: '50%',
          border: '2px solid #fff',
          boxShadow: '0 0 0 1px rgba(0,0,0,.3)',
          transform: 'translate(-50%,-50%)',
          pointerEvents: 'none',
          left: `${s * 100}%`,
          top: `${(1 - v) * 100}%`,
        }} />
      </div>

      {/* Sliders */}
      <div style={{ padding: '12px 12px 0', display: 'flex', flexDirection: 'column', gap: 8 }}>
        <div ref={hueRef} style={{ position: 'relative', height: 10, borderRadius: 5, cursor: 'ew-resize', overflow: 'hidden' }}>
          <canvas ref={hueCanvasRef} style={{ width: '100%', height: '100%', display: 'block' }} />
          <div style={{
            position: 'absolute',
            top: '50%',
            width: 14, height: 14,
            borderRadius: '50%',
            background: '#fff',
            boxShadow: '0 0 0 1px rgba(0,0,0,.25), 0 1px 4px rgba(0,0,0,.2)',
            transform: 'translate(-50%,-50%)',
            pointerEvents: 'none',
            left: `${h / 360 * 100}%`,
          }} />
        </div>
      </div>

      {/* Bottom: mode + values */}
      <div style={{ display: 'flex', alignItems: 'center', padding: '10px 12px 12px', gap: 6 }}>
        {/* Mode dropdown */}
        <div style={{ position: 'relative', flexShrink: 0 }}>
          <button
            type="button"
            onMouseDown={e => { e.stopPropagation(); setModeOpen(o => !o); }}
            style={{
              background: '#f0f0f0',
              border: 'none',
              borderRadius: 5,
              padding: '5px 8px',
              fontSize: 11,
              fontWeight: 500,
              color: '#333',
              cursor: 'pointer',
              whiteSpace: 'nowrap',
              margin: 0,
              fontFamily: 'inherit',
              display: 'flex',
              alignItems: 'center',
              gap: 3,
            }}
          >
            {mode} <span style={{ opacity: 0.5, fontSize: 8 }}>▾</span>
          </button>
          {modeOpen && (
            <div style={{
              position: 'absolute',
              bottom: 'calc(100% + 4px)',
              left: 0,
              background: '#2c2c2c',
              borderRadius: 6,
              padding: 4,
              zIndex: 1,
              minWidth: 72,
              boxShadow: '0 4px 16px rgba(0,0,0,.35)',
            }}>
              {(['HEX', 'RGB', 'HSL', 'HSB'] as Mode[]).map(m => (
                <div
                  key={m}
                  onMouseDown={e => { e.stopPropagation(); setMode(m); setModeOpen(false); }}
                  style={{
                    padding: '5px 10px',
                    color: '#eee',
                    fontSize: 12,
                    borderRadius: 4,
                    cursor: 'pointer',
                    background: mode === m ? 'rgba(255,255,255,.15)' : 'transparent',
                  }}
                >
                  {m}
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Value inputs */}
        <div style={{ flex: 1, display: 'flex', gap: 3, minWidth: 0 }}>
          {renderInputs()}
        </div>
      </div>
    </div>
  );
}
