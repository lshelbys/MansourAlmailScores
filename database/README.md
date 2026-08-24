# Database

## Contents
- `../supabase/migrations/*.sql` — every migration, in order. This is the source of truth for schema, RLS policies, GRANTs, functions and triggers.
- `schema.sql` — all migrations concatenated into one file, for a single-shot restore.
- `data/*.csv` — full row export of every public table at export time (one file per table).

## Restore into a fresh Postgres/Supabase project
1. Apply the schema:
   ```
   psql "$DATABASE_URL" -f database/schema.sql
   ```
   (or `supabase db push` if you use the Supabase CLI with the `supabase/migrations` folder)
2. Load the data. Import parents before children (competitions, teams, venues, coaches, players, then matches and their child tables):
   ```
   psql "$DATABASE_URL" -c "\copy public.competitions FROM 'database/data/competitions.csv' WITH CSV HEADER"
   ```
   Repeat for each CSV. Suggested order:
   venues, broadcast_channels, competitions, teams, competition_teams, coaches,
   players, national_team_players, team_titles, standing_labels,
   standings_position_labels, standings_rows, matches, match_events,
   match_lineups, match_stats, match_broadcasts, match_predictions,
   match_prediction_votes, match_momentum, player_ratings, competition_awards,
   transfers, media_items, news_posts, translations.
3. `profiles`, `admins`, `news_reporters`, `news_submissions`, `match_chat_*` reference `auth.users`. Import those only after the matching auth users exist, otherwise skip them.

## Storage
Buckets used by the app: `avatars`, `team-logos`, `player-photos`, `competition-logos`, `news-covers` (all private, read through signed URLs). Recreate them in the new project and re-upload the files; image paths in the CSVs are bucket-relative.

## Secrets
See `.env.example` in the project root. No secret values are included in this archive.
