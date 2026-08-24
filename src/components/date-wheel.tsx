import { useEffect, useMemo, useRef, useState } from "react";

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
const ITEM_H = 32;

function Column({ values, labels, value, onChange }: { values: number[]; labels: string[]; value: number; onChange: (v: number) => void }) {
  const ref = useRef<HTMLDivElement>(null);
  const idx = Math.max(0, values.indexOf(value));

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const target = idx * ITEM_H;
    if (Math.abs(el.scrollTop - target) > 2) el.scrollTop = target;
  }, [idx]);

  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const onScroll = () => {
    const el = ref.current;
    if (!el) return;
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => {
      const i = Math.min(values.length - 1, Math.max(0, Math.round(el.scrollTop / ITEM_H)));
      el.scrollTo({ top: i * ITEM_H, behavior: "smooth" });
      if (values[i] !== value) onChange(values[i]);
    }, 120);
  };

  return (
    <div className="relative flex-1">
      <div
        ref={ref}
        onScroll={onScroll}
        className="h-40 overflow-y-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
        style={{ paddingTop: ITEM_H * 2, paddingBottom: ITEM_H * 2 }}
      >
        {values.map((v, i) => (
          <div
            key={v}
            style={{ height: ITEM_H }}
            onClick={() => onChange(v)}
            className={`flex cursor-pointer items-center justify-center text-sm tabular-nums transition-colors ${v === value ? "font-bold text-foreground" : "text-muted-foreground/60"}`}
          >
            {labels[i]}
          </div>
        ))}
      </div>
      <div className="pointer-events-none absolute inset-x-0 top-1/2 -translate-y-1/2 border-y border-primary/40" style={{ height: ITEM_H }} />
    </div>
  );
}

/** Scroll-wheel date picker. Value/onChange use "YYYY-MM-DD" (or null). Optional: stays empty until opened. */
export function DateWheel({ value, onChange, minYear = 1930, placeholder = "Add date" }: { value: string | null | undefined; onChange: (v: string | null) => void; minYear?: number; placeholder?: string }) {
  const [open, setOpen] = useState(false);
  const now = new Date();
  const parsed = value ? new Date(`${value}T00:00:00`) : null;
  const y = parsed ? parsed.getFullYear() : 2000;
  const m = parsed ? parsed.getMonth() + 1 : 1;
  const d = parsed ? parsed.getDate() : 1;

  const years = useMemo(() => {
    const arr: number[] = [];
    for (let i = now.getFullYear(); i >= minYear; i--) arr.push(i);
    return arr;
  }, [minYear, now]);
  const months = useMemo(() => Array.from({ length: 12 }, (_, i) => i + 1), []);
  const daysInMonth = new Date(y, m, 0).getDate();
  const days = useMemo(() => Array.from({ length: daysInMonth }, (_, i) => i + 1), [daysInMonth]);

  const emit = (ny: number, nm: number, nd: number) => {
    const max = new Date(ny, nm, 0).getDate();
    const day = Math.min(nd, max);
    onChange(`${ny}-${String(nm).padStart(2, "0")}-${String(day).padStart(2, "0")}`);
  };

  return (
    !value && !open ? (
      <button type="button" onClick={() => setOpen(true)}
        className="flex h-10 w-full items-center rounded-xl border border-border bg-background px-3 text-sm text-muted-foreground hover:border-primary/50">
        {placeholder}
      </button>
    ) : (
    <div className="rounded-xl border border-border bg-background p-2">
      <div className="flex gap-1">
        <Column values={days} labels={days.map(String)} value={d} onChange={(v) => emit(y, m, v)} />
        <Column values={months} labels={MONTHS} value={m} onChange={(v) => emit(y, v, d)} />
        <Column values={years} labels={years.map(String)} value={y} onChange={(v) => emit(v, m, d)} />
      </div>
      <div className="mt-1 flex items-center justify-between px-1">
        <span className="text-[0.65rem] text-muted-foreground">{value ?? "Not set"}</span>
        <button type="button" className="text-[0.65rem] text-muted-foreground hover:text-destructive" onClick={() => { onChange(null); setOpen(false); }}>Clear</button>
      </div>
    </div>
    )
  );
}