import { useEffect } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export function useRealtime(tables: string[]) {
  const qc = useQueryClient();
  useEffect(() => {
    const channel = supabase.channel(`rt-${tables.join("-")}`);
    tables.forEach((table) => {
      channel.on(
        "postgres_changes" as never,
        { event: "*", schema: "public", table },
        () => qc.invalidateQueries(),
      );
    });
    channel.subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
}