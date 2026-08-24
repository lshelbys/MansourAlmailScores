import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase, type Venue } from "@/lib/db";
import { inputCls } from "./ui";

/** Venue picker backed by a saved venue list — pick once, reuse forever. */
export function VenueSelect({
  venue,
  city,
  onChange,
}: {
  venue: string | null | undefined;
  city: string | null | undefined;
  onChange: (venue: string | null, city: string | null) => void;
}) {
  const qc = useQueryClient();
  const [adding, setAdding] = useState(false);
  const [newName, setNewName] = useState("");
  const [newCity, setNewCity] = useState("");

  const q = useQuery({
    queryKey: ["admin", "venues"],
    queryFn: async () => {
      const { data } = await supabase.from("venues").select("*").order("name");
      return (data ?? []) as Venue[];
    },
  });
  const venues = q.data ?? [];

  const saveNew = async () => {
    const name = newName.trim();
    if (!name) return;
    await supabase.from("venues").insert({ name, city: newCity.trim() || null } as never);
    await qc.invalidateQueries({ queryKey: ["admin", "venues"] });
    onChange(name, newCity.trim() || null);
    setAdding(false); setNewName(""); setNewCity("");
  };

  if (adding) {
    return (
      <div className="grid gap-2 rounded-lg border border-border bg-background/60 p-2">
        <input className={inputCls} placeholder="Stadium name" value={newName} onChange={(e) => setNewName(e.target.value)} />
        <input className={inputCls} placeholder="City" value={newCity} onChange={(e) => setNewCity(e.target.value)} />
        <div className="flex gap-2">
          <button type="button" className="text-xs font-semibold text-primary" onClick={saveNew}>Save venue</button>
          <button type="button" className="text-xs text-muted-foreground" onClick={() => setAdding(false)}>Cancel</button>
        </div>
      </div>
    );
  }

  return (
    <div className="flex items-center gap-2">
      <select
        className={inputCls}
        value={venue ?? ""}
        onChange={(e) => {
          const v = venues.find((x) => x.name === e.target.value);
          onChange(e.target.value || null, v?.city ?? null);
        }}
      >
        <option value="">— no venue —</option>
        {venues.map((v) => <option key={v.id} value={v.name}>{v.name}{v.city ? ` · ${v.city}` : ""}</option>)}
        {venue && !venues.some((v) => v.name === venue) && <option value={venue}>{venue}</option>}
      </select>
      <button type="button" className="shrink-0 text-xs font-semibold text-primary" onClick={() => setAdding(true)}>+ New</button>
      {city && <span className="shrink-0 text-[0.65rem] text-muted-foreground">{city}</span>}
    </div>
  );
}