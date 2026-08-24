import { useEffect, useMemo, useRef, useState } from "react";
import { COUNTRIES, findCountry, searchCountries, type Country } from "@/lib/countries";
import { FlagIcon } from "@/components/flag";

export function CountryFlag({ value, className = "" }: { value: string | null | undefined; className?: string }) {
  return <FlagIcon value={value} className={className} />;
}

export function CountryTag({ value, className = "" }: { value: string | null | undefined; className?: string }) {
  const c = findCountry(value);
  if (!c) return value ? <span className={className}>{value}</span> : null;
  return <span className={`inline-flex items-center gap-1.5 ${className}`}><FlagIcon value={c.code} />{c.name}</span>;
}

export function CountrySelect({
  value,
  onChange,
  placeholder = "Search a country…",
}: {
  value: string | null | undefined;
  onChange: (name: string | null, country: Country | null) => void;
  placeholder?: string;
}) {
  const selected = findCountry(value);
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const boxRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const justPicked = useRef(false);

  useEffect(() => {
    const onDoc = (e: MouseEvent) => {
      if (boxRef.current && !boxRef.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, []);

  const results = useMemo(() => (open ? searchCountries(query) : []), [open, query]);

  return (
    <div className="relative" ref={boxRef}>
      <div
        className="flex w-full cursor-text items-center gap-2 rounded-lg border border-border bg-background px-3 py-2 text-sm focus-within:border-primary"
        onClick={() => setOpen(true)}
      >
        {selected && <FlagIcon value={selected.code} size="md" />}
        <input
          ref={inputRef}
          className="w-full bg-transparent outline-none"
          value={open ? query : (selected?.name ?? value ?? "")}
          placeholder={placeholder}
          onFocus={() => { if (justPicked.current) { justPicked.current = false; return; } setOpen(true); setQuery(""); }}
          onChange={(e) => { setQuery(e.target.value); setOpen(true); }}
        />
        {(selected || value) && (
          <button type="button" className="text-xs text-muted-foreground hover:text-destructive"
            onClick={(e) => { e.stopPropagation(); onChange(null, null); setQuery(""); setOpen(false); }}>✕</button>
        )}
      </div>
      {open && (
        <div className="absolute z-50 mt-1 max-h-64 w-full overflow-y-auto rounded-xl border border-border bg-card p-1 shadow-2xl">
          {results.length === 0 && <div className="p-3 text-xs text-muted-foreground">{"لا توجد نتيجة مطابقة / No match"}</div>}
          {results.map((c) => (
            <button key={c.code} type="button"
              className="flex w-full items-center gap-2 rounded-lg px-2 py-1.5 text-left text-sm hover:bg-accent"
              onMouseDown={(e) => { e.preventDefault(); justPicked.current = true; onChange(c.name, c); setOpen(false); setQuery(""); inputRef.current?.blur(); }}
              onClick={(e) => { e.preventDefault(); e.stopPropagation(); }}>
              <FlagIcon value={c.code} size="md" />
              <span className="flex-1 truncate">{c.name}</span>
              <span className="text-[0.6rem] text-muted-foreground">{c.code}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

export { COUNTRIES };