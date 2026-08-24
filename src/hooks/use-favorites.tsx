import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "./use-auth";
import { Bell } from "lucide-react";

export type FavoriteKind = "team" | "player" | "competition" | "match";

const COLS = {
  team: "favorite_team_ids",
  player: "favorite_player_ids",
  competition: "favorite_competition_ids",
} as const;

const MATCH_KEY = "mas.favorite_match_ids";
const ALERT_KEY = "mas.match_notification_ids";

type FavoritesState = { team: string[]; player: string[]; competition: string[]; match: string[] };

export function useFavorites() {
  const { user } = useAuth();
  const [favorites, setFavorites] = useState<FavoritesState>({ team: [], player: [], competition: [], match: [] });
  const [ready, setReady] = useState(false);

  useEffect(() => {
    let cancel = false;
    (async () => {
      const match = safeReadLocal(MATCH_KEY);
      if (!user) {
        if (!cancel) {
          setFavorites({ team: [], player: [], competition: [], match });
          setReady(true);
        }
        return;
      }
      const { data } = await supabase
        .from("profiles")
        .select("favorite_team_ids, favorite_player_ids, favorite_competition_ids, favorite_match_ids")
        .eq("id", user.id)
        .maybeSingle();
      if (!cancel) {
        setFavorites({
          team: data?.favorite_team_ids ?? [],
          player: data?.favorite_player_ids ?? [],
          competition: data?.favorite_competition_ids ?? [],
          match: data?.favorite_match_ids ?? match,
        });
        setReady(true);
      }
    })();
    return () => {
      cancel = true;
    };
  }, [user]);

  const isFavorite = useCallback(
    (kind: FavoriteKind, id: string | number) => favorites[kind].includes(String(id)),
    [favorites],
  );

  const toggle = useCallback(
    async (kind: FavoriteKind, id: string | number) => {
      const strId = String(id);
      const has = favorites[kind].includes(strId);
      const next = has ? favorites[kind].filter((x) => x !== strId) : [...favorites[kind], strId];
      setFavorites((prev) => ({ ...prev, [kind]: next }));
      if (kind === "match") {
        try {
          localStorage.setItem(MATCH_KEY, JSON.stringify(next));
        } catch {
          /* ignore */
        }
        if (user) await supabase.from("profiles").update({ favorite_match_ids: next }).eq("id", user.id);
        return;
      }
      if (!user) return;
      const patch =
        kind === "team" ? { favorite_team_ids: next }
        : kind === "player" ? { favorite_player_ids: next }
        : { favorite_competition_ids: next };
      await supabase.from("profiles").update(patch).eq("id", user.id);
    },
    [favorites, user],
  );

  return { favorites, isFavorite, toggle, ready };
}

function safeReadLocal(key: string): string[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as string[]) : [];
  } catch {
    return [];
  }
}

export function FavoriteButton({ kind, id, size = "sm" }: { kind: FavoriteKind; id: string | number; size?: "sm" | "md" }) {
  const { user } = useAuth();
  const { isFavorite, toggle } = useFavorites();
  const active = isFavorite(kind, id);
  const disabled = kind !== "match" && !user;
  const dim = size === "md" ? "h-10 w-10" : "h-8 w-8";
  return (
    <button
      type="button"
      title={disabled ? "Sign in to save favorites" : active ? "Remove favorite" : "Add to favorites"}
      onClick={(e) => {
        e.preventDefault();
        e.stopPropagation();
        if (disabled) return;
        toggle(kind, id);
      }}
      className={`inline-flex ${dim} items-center justify-center rounded-full border transition ${
        active
          ? "border-primary bg-primary text-primary-foreground"
          : "border-border bg-card text-muted-foreground hover:border-primary hover:text-primary"
      } ${disabled ? "opacity-40" : ""}`}
    >
      <svg width="16" height="16" viewBox="0 0 24 24" fill={active ? "currentColor" : "none"} stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <polygon points="12 2 15 8.5 22 9.3 17 14.1 18.2 21 12 17.8 5.8 21 7 14.1 2 9.3 9 8.5 12 2" />
      </svg>
    </button>
  );
}

export function MatchNotificationButton({ matchId, teamIds = [] }: { matchId: string; teamIds?: (string | null | undefined)[] }) {
  const { user } = useAuth();
  const { favorites } = useFavorites();
  const [alerts, setAlerts] = useState<string[]>([]);
  const [loaded, setLoaded] = useState(false);
  const inherited = teamIds.some((id) => Boolean(id && favorites.team.includes(id)));

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const local = safeReadLocal(ALERT_KEY);
      if (!user) {
        if (!cancelled) { setAlerts(local); setLoaded(true); }
        return;
      }
      const { data } = await supabase.from("profiles").select("match_notification_ids").eq("id", user.id).maybeSingle();
      if (!cancelled) { setAlerts(data?.match_notification_ids ?? local); setLoaded(true); }
    })();
    return () => { cancelled = true; };
  }, [user]);

  const explicit = alerts.includes(matchId);
  // For a followed club the saved match id is a deliberate mute override;
  // otherwise it is an explicit opt-in for this individual fixture.
  const active = inherited ? !explicit : explicit;
  return (
    <button
      type="button"
      aria-label={active ? "Disable match notifications" : "Enable match notifications"}
      title={inherited && active ? "Following this club's matches" : active ? "Disable match notifications" : "Enable match notifications"}
      disabled={!loaded}
      onClick={async (event) => {
        event.preventDefault(); event.stopPropagation();
        const next = explicit ? alerts.filter((id) => id !== matchId) : [...alerts, matchId];
        setAlerts(next);
        try { localStorage.setItem(ALERT_KEY, JSON.stringify(next)); } catch { /* optional */ }
        if (user) await supabase.from("profiles").update({ match_notification_ids: next }).eq("id", user.id);
      }}
      className={`inline-flex h-8 w-8 items-center justify-center rounded-full border transition ${active ? "border-primary bg-primary/10 text-primary" : "border-border bg-card text-muted-foreground hover:text-primary"}`}
    >
      <Bell className="h-4 w-4" fill={active ? "currentColor" : "none"} />
    </button>
  );
}