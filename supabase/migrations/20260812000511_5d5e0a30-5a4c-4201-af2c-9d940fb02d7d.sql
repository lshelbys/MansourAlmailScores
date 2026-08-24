CREATE OR REPLACE FUNCTION public.recompute_standings(_comp uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE public.standings_rows SET played = 0, won = 0, drawn = 0, lost = 0, gf = 0, ga = 0, points = 0
   WHERE competition_id = _comp;

  WITH finished AS (
    SELECT * FROM public.matches
     WHERE competition_id = _comp
       AND status IN ('ft','aet','pen','awarded')
       AND home_team_id IS NOT NULL AND away_team_id IS NOT NULL
       AND home_score IS NOT NULL AND away_score IS NOT NULL
  ), sides AS (
    SELECT home_team_id AS team_id, season, home_score AS gf, away_score AS ga FROM finished
    UNION ALL
    SELECT away_team_id AS team_id, season, away_score AS gf, home_score AS ga FROM finished
  ), agg AS (
    SELECT team_id, season,
      COUNT(*) AS played,
      COUNT(*) FILTER (WHERE gf > ga) AS won,
      COUNT(*) FILTER (WHERE gf = ga) AS drawn,
      COUNT(*) FILTER (WHERE gf < ga) AS lost,
      COALESCE(SUM(gf),0) AS gf,
      COALESCE(SUM(ga),0) AS ga
    FROM sides GROUP BY team_id, season
  )
  UPDATE public.standings_rows sr SET
    played = a.played, won = a.won, drawn = a.drawn, lost = a.lost,
    gf = a.gf, ga = a.ga,
    points = a.won * 3 + a.drawn
  FROM agg a
  WHERE sr.competition_id = _comp
    AND sr.team_id = a.team_id
    AND (sr.season IS NOT DISTINCT FROM a.season OR sr.season IS NULL OR a.season IS NULL);

  -- Re-rank each group/season by points, goal difference, goals scored
  WITH ranked AS (
    SELECT id, ROW_NUMBER() OVER (
      PARTITION BY competition_id, COALESCE(group_label,''), COALESCE(season,'')
      ORDER BY (points + points_adjust) DESC, (gf - ga) DESC, gf DESC, played ASC
    ) AS rn
    FROM public.standings_rows WHERE competition_id = _comp
  )
  UPDATE public.standings_rows sr SET sort_order = r.rn
  FROM ranked r WHERE sr.id = r.id;
END;
$$;