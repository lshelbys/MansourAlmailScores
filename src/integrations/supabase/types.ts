export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "14.5"
  }
  public: {
    Tables: {
      admin_unlock_attempts: {
        Row: {
          attempted_at: string
          id: string
          succeeded: boolean
          user_id: string
        }
        Insert: {
          attempted_at?: string
          id?: string
          succeeded?: boolean
          user_id: string
        }
        Update: {
          attempted_at?: string
          id?: string
          succeeded?: boolean
          user_id?: string
        }
        Relationships: []
      }
      admins: {
        Row: {
          created_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          user_id?: string
        }
        Relationships: []
      }
      broadcast_channels: {
        Row: {
          country_code: string | null
          created_at: string
          id: string
          logo_url: string | null
          name: string
          updated_at: string
        }
        Insert: {
          country_code?: string | null
          created_at?: string
          id?: string
          logo_url?: string | null
          name: string
          updated_at?: string
        }
        Update: {
          country_code?: string | null
          created_at?: string
          id?: string
          logo_url?: string | null
          name?: string
          updated_at?: string
        }
        Relationships: []
      }
      coaches: {
        Row: {
          appointed_on: string | null
          bio: string | null
          birth_place: string | null
          contract_until: string | null
          created_at: string
          dob: string | null
          id: string
          name: string
          nationality: string | null
          nationality_code: string | null
          photo_url: string | null
          preferred_formation: string | null
          team_id: string | null
          trophies: number
          updated_at: string
        }
        Insert: {
          appointed_on?: string | null
          bio?: string | null
          birth_place?: string | null
          contract_until?: string | null
          created_at?: string
          dob?: string | null
          id?: string
          name: string
          nationality?: string | null
          nationality_code?: string | null
          photo_url?: string | null
          preferred_formation?: string | null
          team_id?: string | null
          trophies?: number
          updated_at?: string
        }
        Update: {
          appointed_on?: string | null
          bio?: string | null
          birth_place?: string | null
          contract_until?: string | null
          created_at?: string
          dob?: string | null
          id?: string
          name?: string
          nationality?: string | null
          nationality_code?: string | null
          photo_url?: string | null
          preferred_formation?: string | null
          team_id?: string | null
          trophies?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "coaches_team_id_fkey"
            columns: ["team_id"]
            isOneToOne: false
            referencedRelation: "teams"
            referencedColumns: ["id"]
          },
        ]
      }
      competition_awards: {
        Row: {
          award_type: string
          competition_id: string
          created_at: string
          id: string
          note: string | null
          player_id: string | null
          round_number: number | null
          season: string | null
          updated_at: string
        }
        Insert: {
          award_type: string
          competition_id: string
          created_at?: string
          id?: string
          note?: string | null
          player_id?: string | null
          round_number?: number | null
          season?: string | null
          updated_at?: string
        }
        Update: {
          award_type?: string
          competition_id?: string
          created_at?: string
          id?: string
          note?: string | null
          player_id?: string | null
          round_number?: number | null
          season?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "competition_awards_competition_id_fkey"
            columns: ["competition_id"]
            isOneToOne: false
            referencedRelation: "competitions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "competition_awards_player_id_fkey"
            columns: ["player_id"]
            isOneToOne: false
            referencedRelation: "players"
            referencedColumns: ["id"]
          },
        ]
      }
      competition_teams: {
        Row: {
          competition_id: string
          created_at: string
          id: string
          season: string | null
          team_id: string
          titles: number
        }
        Insert: {
          competition_id: string
          created_at?: string
          id?: string
          season?: string | null
          team_id: string
          titles?: number
        }
        Update: {
          competition_id?: string
          created_at?: string
          id?: string
          season?: string | null
          team_id?: string
          titles?: number
        }
        Relationships: [
          {
            foreignKeyName: "competition_teams_competition_id_fkey"
            columns: ["competition_id"]
            isOneToOne: false
            referencedRelation: "competitions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "competition_teams_team_id_fkey"
            columns: ["team_id"]
            isOneToOne: false
            referencedRelation: "teams"
            referencedColumns: ["id"]
          },
        ]
      }
      competitions: {
        Row: {
          category: string | null
          country: string | null
          country_code: string | null
          created_at: string
          description: string | null
          ends_on: string | null
          featured: boolean
          format: string
          higher_division_id: string | null
          id: string
          is_national: boolean
          logo_url: string | null
          lower_division_id: string | null
          name: string
          parent_competition_id: string | null
          season: string | null
          seasons: string[]
          slug: string
          sort_order: number
          sport: string
          standings_mode: string
          starts_on: string | null
          title_holder_team_id: string | null
          updated_at: string
        }
        Insert: {
          category?: string | null
          country?: string | null
          country_code?: string | null
          created_at?: string
          description?: string | null
          ends_on?: string | null
          featured?: boolean
          format?: string
          higher_division_id?: string | null
          id?: string
          is_national?: boolean
          logo_url?: string | null
          lower_division_id?: string | null
          name: string
          parent_competition_id?: string | null
          season?: string | null
          seasons?: string[]
          slug: string
          sort_order?: number
          sport?: string
          standings_mode?: string
          starts_on?: string | null
          title_holder_team_id?: string | null
          updated_at?: string
        }
        Update: {
          category?: string | null
          country?: string | null
          country_code?: string | null
          created_at?: string
          description?: string | null
          ends_on?: string | null
          featured?: boolean
          format?: string
          higher_division_id?: string | null
          id?: string
          is_national?: boolean
          logo_url?: string | null
          lower_division_id?: string | null
          name?: string
          parent_competition_id?: string | null
          season?: string | null
          seasons?: string[]
          slug?: string
          sort_order?: number
          sport?: string
          standings_mode?: string
          starts_on?: string | null
          title_holder_team_id?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "competitions_higher_division_id_fkey"
            columns: ["higher_division_id"]
            isOneToOne: false
            referencedRelation: "competitions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "competitions_lower_division_id_fkey"
            columns: ["lower_division_id"]
            isOneToOne: false
            referencedRelation: "competitions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "competitions_parent_competition_id_fkey"
            columns: ["parent_competition_id"]
            isOneToOne: false
            referencedRelation: "competitions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "competitions_title_holder_team_id_fkey"
            columns: ["title_holder_team_id"]
            isOneToOne: false
            referencedRelation: "teams"
            referencedColumns: ["id"]
          },
        ]
      }
      match_broadcasts: {
        Row: {
          channel_id: string
          created_at: string
          id: string
          match_id: string
        }
        Insert: {
          channel_id: string
          created_at?: string
          id?: string
          match_id: string
        }
        Update: {
          channel_id?: string
          created_at?: string
          id?: string
          match_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "match_broadcasts_channel_id_fkey"
            columns: ["channel_id"]
            isOneToOne: false
            referencedRelation: "broadcast_channels"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "match_broadcasts_match_id_fkey"
            columns: ["match_id"]
            isOneToOne: false
            referencedRelation: "matches"
            referencedColumns: ["id"]
          },
        ]
      }
      match_chat_messages: {
        Row: {
          body: string
          created_at: string
          edited_at: string | null
          id: string
          match_id: string
          user_id: string
        }
        Insert: {
          body: string
          created_at?: string
          edited_at?: string | null
          id?: string
          match_id: string
          user_id: string
        }
        Update: {
          body?: string
          created_at?: string
          edited_at?: string | null
          id?: string
          match_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "match_chat_messages_match_id_fkey"
            columns: ["match_id"]
            isOneToOne: false
            referencedRelation: "matches"
            referencedColumns: ["id"]
          },
        ]
      }
      match_chat_reports: {
        Row: {
          author_id: string | null
          created_at: string
          id: string
          match_id: string
          message_body: string
          message_id: string | null
          reason: string | null
          reporter_id: string
          status: string
        }
        Insert: {
          author_id?: string | null
          created_at?: string
          id?: string
          match_id: string
          message_body: string
          message_id?: string | null
          reason?: string | null
          reporter_id: string
          status?: string
        }
        Update: {
          author_id?: string | null
          created_at?: string
          id?: string
          match_id?: string
          message_body?: string
          message_id?: string | null
          reason?: string | null
          reporter_id?: string
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "match_chat_reports_match_id_fkey"
            columns: ["match_id"]
            isOneToOne: false
            referencedRelation: "matches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "match_chat_reports_message_id_fkey"
            columns: ["message_id"]
            isOneToOne: false
            referencedRelation: "match_chat_messages"
            referencedColumns: ["id"]
          },
        ]
      }
      match_events: {
        Row: {
          assist_player_id: string | null
          created_at: string
          description: string | null
          extra: number | null
          id: string
          match_id: string
          minute: number | null
          player_id: string | null
          sub_out_player_id: string | null
          team_id: string | null
          type: string
        }
        Insert: {
          assist_player_id?: string | null
          created_at?: string
          description?: string | null
          extra?: number | null
          id?: string
          match_id: string
          minute?: number | null
          player_id?: string | null
          sub_out_player_id?: string | null
          team_id?: string | null
          type: string
        }
        Update: {
          assist_player_id?: string | null
          created_at?: string
          description?: string | null
          extra?: number | null
          id?: string
          match_id?: string
          minute?: number | null
          player_id?: string | null
          sub_out_player_id?: string | null
          team_id?: string | null
          type?: string
        }
        Relationships: [
          {
            foreignKeyName: "match_events_assist_player_id_fkey"
            columns: ["assist_player_id"]
            isOneToOne: false
            referencedRelation: "players"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "match_events_match_id_fkey"
            columns: ["match_id"]
            isOneToOne: false
            referencedRelation: "matches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "match_events_player_id_fkey"
            columns: ["player_id"]
            isOneToOne: false
            referencedRelation: "players"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "match_events_sub_out_player_id_fkey"
            columns: ["sub_out_player_id"]
            isOneToOne: false
            referencedRelation: "players"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "match_events_team_id_fkey"
            columns: ["team_id"]
            isOneToOne: false
            referencedRelation: "teams"
            referencedColumns: ["id"]
          },
        ]
      }
      match_lineups: {
        Row: {
          created_at: string
          id: string
          is_starting: boolean
          match_id: string
          player_id: string
          position_code: string | null
          shirt_number: number | null
          team_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          is_starting?: boolean
          match_id: string
          player_id: string
          position_code?: string | null
          shirt_number?: number | null
          team_id: string
        }
        Update: {
          created_at?: string
          id?: string
          is_starting?: boolean
          match_id?: string
          player_id?: string
          position_code?: string | null
          shirt_number?: number | null
          team_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "match_lineups_match_id_fkey"
            columns: ["match_id"]
            isOneToOne: false
            referencedRelation: "matches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "match_lineups_player_id_fkey"
            columns: ["player_id"]
            isOneToOne: false
            referencedRelation: "players"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "match_lineups_team_id_fkey"
            columns: ["team_id"]
            isOneToOne: false
            referencedRelation: "teams"
            referencedColumns: ["id"]
          },
        ]
      }
      match_momentum: {
        Row: {
          match_id: string
          minute: number
          updated_at: string
          value: number
        }
        Insert: {
          match_id: string
          minute: number
          updated_at?: string
          value?: number
        }
        Update: {
          match_id?: string
          minute?: number
          updated_at?: string
          value?: number
        }
        Relationships: [
          {
            foreignKeyName: "match_momentum_match_id_fkey"
            columns: ["match_id"]
            isOneToOne: false
            referencedRelation: "matches"
            referencedColumns: ["id"]
          },
        ]
      }
      match_prediction_votes: {
        Row: {
          choice: string
          created_at: string
          id: string
          match_id: string
          updated_at: string
          user_id: string
        }
        Insert: {
          choice: string
          created_at?: string
          id?: string
          match_id: string
          updated_at?: string
          user_id: string
        }
        Update: {
          choice?: string
          created_at?: string
          id?: string
          match_id?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "match_prediction_votes_match_id_fkey"
            columns: ["match_id"]
            isOneToOne: false
            referencedRelation: "matches"
            referencedColumns: ["id"]
          },
        ]
      }
      match_predictions: {
        Row: {
          away_percent: number
          draw_percent: number
          home_percent: number
          match_id: string
          updated_at: string
        }
        Insert: {
          away_percent?: number
          draw_percent?: number
          home_percent?: number
          match_id: string
          updated_at?: string
        }
        Update: {
          away_percent?: number
          draw_percent?: number
          home_percent?: number
          match_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "match_predictions_match_id_fkey"
            columns: ["match_id"]
            isOneToOne: true
            referencedRelation: "matches"
            referencedColumns: ["id"]
          },
        ]
      }
      match_stats: {
        Row: {
          away_value: string | null
          created_at: string
          home_value: string | null
          id: string
          label: string
          match_id: string
          sort_order: number
        }
        Insert: {
          away_value?: string | null
          created_at?: string
          home_value?: string | null
          id?: string
          label: string
          match_id: string
          sort_order?: number
        }
        Update: {
          away_value?: string | null
          created_at?: string
          home_value?: string | null
          id?: string
          label?: string
          match_id?: string
          sort_order?: number
        }
        Relationships: [
          {
            foreignKeyName: "match_stats_match_id_fkey"
            columns: ["match_id"]
            isOneToOne: false
            referencedRelation: "matches"
            referencedColumns: ["id"]
          },
        ]
      }
      matches: {
        Row: {
          away_formation: string | null
          away_pen: number | null
          away_score: number | null
          away_team_id: string | null
          city: string | null
          competition_id: string
          created_at: string
          highlight_url: string | null
          home_formation: string | null
          home_pen: number | null
          home_score: number | null
          home_team_id: string | null
          id: string
          kickoff_at: string | null
          lineup_mode: string
          lineups_published: boolean
          live_minute: number | null
          momentum_minutes: number
          notes: string | null
          referee: string | null
          result_only: boolean
          round: string | null
          round_number: number | null
          season: string | null
          status: string
          timer_elapsed_seconds: number
          timer_running: boolean
          timer_started_at: string | null
          updated_at: string
          venue: string | null
          venue_id: string | null
        }
        Insert: {
          away_formation?: string | null
          away_pen?: number | null
          away_score?: number | null
          away_team_id?: string | null
          city?: string | null
          competition_id: string
          created_at?: string
          highlight_url?: string | null
          home_formation?: string | null
          home_pen?: number | null
          home_score?: number | null
          home_team_id?: string | null
          id?: string
          kickoff_at?: string | null
          lineup_mode?: string
          lineups_published?: boolean
          live_minute?: number | null
          momentum_minutes?: number
          notes?: string | null
          referee?: string | null
          result_only?: boolean
          round?: string | null
          round_number?: number | null
          season?: string | null
          status?: string
          timer_elapsed_seconds?: number
          timer_running?: boolean
          timer_started_at?: string | null
          updated_at?: string
          venue?: string | null
          venue_id?: string | null
        }
        Update: {
          away_formation?: string | null
          away_pen?: number | null
          away_score?: number | null
          away_team_id?: string | null
          city?: string | null
          competition_id?: string
          created_at?: string
          highlight_url?: string | null
          home_formation?: string | null
          home_pen?: number | null
          home_score?: number | null
          home_team_id?: string | null
          id?: string
          kickoff_at?: string | null
          lineup_mode?: string
          lineups_published?: boolean
          live_minute?: number | null
          momentum_minutes?: number
          notes?: string | null
          referee?: string | null
          result_only?: boolean
          round?: string | null
          round_number?: number | null
          season?: string | null
          status?: string
          timer_elapsed_seconds?: number
          timer_running?: boolean
          timer_started_at?: string | null
          updated_at?: string
          venue?: string | null
          venue_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "matches_away_team_id_fkey"
            columns: ["away_team_id"]
            isOneToOne: false
            referencedRelation: "teams"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "matches_competition_id_fkey"
            columns: ["competition_id"]
            isOneToOne: false
            referencedRelation: "competitions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "matches_home_team_id_fkey"
            columns: ["home_team_id"]
            isOneToOne: false
            referencedRelation: "teams"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "matches_venue_id_fkey"
            columns: ["venue_id"]
            isOneToOne: false
            referencedRelation: "venues"
            referencedColumns: ["id"]
          },
        ]
      }
      media_items: {
        Row: {
          created_at: string
          id: string
          owner_id: string
          owner_type: string
          sort_order: number
          source: string
          title: string | null
          url: string
        }
        Insert: {
          created_at?: string
          id?: string
          owner_id: string
          owner_type: string
          sort_order?: number
          source?: string
          title?: string | null
          url: string
        }
        Update: {
          created_at?: string
          id?: string
          owner_id?: string
          owner_type?: string
          sort_order?: number
          source?: string
          title?: string | null
          url?: string
        }
        Relationships: []
      }
      national_team_players: {
        Row: {
          created_at: string
          id: string
          photo_url: string | null
          player_id: string
          position: string | null
          shirt_number: number | null
          team_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          photo_url?: string | null
          player_id: string
          position?: string | null
          shirt_number?: number | null
          team_id: string
        }
        Update: {
          created_at?: string
          id?: string
          photo_url?: string | null
          player_id?: string
          position?: string | null
          shirt_number?: number | null
          team_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "national_team_players_player_id_fkey"
            columns: ["player_id"]
            isOneToOne: false
            referencedRelation: "players"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "national_team_players_team_id_fkey"
            columns: ["team_id"]
            isOneToOne: false
            referencedRelation: "teams"
            referencedColumns: ["id"]
          },
        ]
      }
      news_posts: {
        Row: {
          author_display: string | null
          body_markdown: string
          body_markdown_ar: string | null
          competition_id: string | null
          cover_url: string | null
          created_at: string
          excerpt: string | null
          excerpt_ar: string | null
          id: string
          player_id: string | null
          published_at: string | null
          slug: string
          team_id: string | null
          title: string
          title_ar: string | null
          updated_at: string
        }
        Insert: {
          author_display?: string | null
          body_markdown?: string
          body_markdown_ar?: string | null
          competition_id?: string | null
          cover_url?: string | null
          created_at?: string
          excerpt?: string | null
          excerpt_ar?: string | null
          id?: string
          player_id?: string | null
          published_at?: string | null
          slug: string
          team_id?: string | null
          title: string
          title_ar?: string | null
          updated_at?: string
        }
        Update: {
          author_display?: string | null
          body_markdown?: string
          body_markdown_ar?: string | null
          competition_id?: string | null
          cover_url?: string | null
          created_at?: string
          excerpt?: string | null
          excerpt_ar?: string | null
          id?: string
          player_id?: string | null
          published_at?: string | null
          slug?: string
          team_id?: string | null
          title?: string
          title_ar?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "news_posts_competition_id_fkey"
            columns: ["competition_id"]
            isOneToOne: false
            referencedRelation: "competitions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "news_posts_player_id_fkey"
            columns: ["player_id"]
            isOneToOne: false
            referencedRelation: "players"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "news_posts_team_id_fkey"
            columns: ["team_id"]
            isOneToOne: false
            referencedRelation: "teams"
            referencedColumns: ["id"]
          },
        ]
      }
      news_reporters: {
        Row: {
          access_code: string | null
          code_redeemed_at: string | null
          created_at: string
          email: string | null
          full_name: string | null
          handle: string
          id: string
          phone: string | null
          platform: string
          status: string
          subscription_status: string
          updated_at: string
          user_id: string
        }
        Insert: {
          access_code?: string | null
          code_redeemed_at?: string | null
          created_at?: string
          email?: string | null
          full_name?: string | null
          handle: string
          id?: string
          phone?: string | null
          platform?: string
          status?: string
          subscription_status?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          access_code?: string | null
          code_redeemed_at?: string | null
          created_at?: string
          email?: string | null
          full_name?: string | null
          handle?: string
          id?: string
          phone?: string | null
          platform?: string
          status?: string
          subscription_status?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      news_submissions: {
        Row: {
          author_id: string
          body_markdown: string
          competition_id: string | null
          cover_url: string | null
          created_at: string
          excerpt: string | null
          id: string
          player_id: string | null
          proof_note: string | null
          proof_url: string | null
          review_note: string | null
          status: string
          team_id: string | null
          title: string
          updated_at: string
        }
        Insert: {
          author_id: string
          body_markdown?: string
          competition_id?: string | null
          cover_url?: string | null
          created_at?: string
          excerpt?: string | null
          id?: string
          player_id?: string | null
          proof_note?: string | null
          proof_url?: string | null
          review_note?: string | null
          status?: string
          team_id?: string | null
          title: string
          updated_at?: string
        }
        Update: {
          author_id?: string
          body_markdown?: string
          competition_id?: string | null
          cover_url?: string | null
          created_at?: string
          excerpt?: string | null
          id?: string
          player_id?: string | null
          proof_note?: string | null
          proof_url?: string | null
          review_note?: string | null
          status?: string
          team_id?: string | null
          title?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "news_submissions_competition_id_fkey"
            columns: ["competition_id"]
            isOneToOne: false
            referencedRelation: "competitions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "news_submissions_player_id_fkey"
            columns: ["player_id"]
            isOneToOne: false
            referencedRelation: "players"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "news_submissions_team_id_fkey"
            columns: ["team_id"]
            isOneToOne: false
            referencedRelation: "teams"
            referencedColumns: ["id"]
          },
        ]
      }
      player_ratings: {
        Row: {
          competition_id: string | null
          created_at: string
          id: string
          match_id: string | null
          player_id: string
          rating: number
          updated_at: string
        }
        Insert: {
          competition_id?: string | null
          created_at?: string
          id?: string
          match_id?: string | null
          player_id: string
          rating: number
          updated_at?: string
        }
        Update: {
          competition_id?: string | null
          created_at?: string
          id?: string
          match_id?: string | null
          player_id?: string
          rating?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "player_ratings_competition_id_fkey"
            columns: ["competition_id"]
            isOneToOne: false
            referencedRelation: "competitions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "player_ratings_match_id_fkey"
            columns: ["match_id"]
            isOneToOne: false
            referencedRelation: "matches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "player_ratings_player_id_fkey"
            columns: ["player_id"]
            isOneToOne: false
            referencedRelation: "players"
            referencedColumns: ["id"]
          },
        ]
      }
      players: {
        Row: {
          created_at: string
          dob: string | null
          height_cm: number | null
          id: string
          market_value: string | null
          media_urls: string[]
          name: string
          nationality: string | null
          nationality_code: string | null
          photo_url: string | null
          position: string | null
          shirt_number: number | null
          team_id: string | null
          updated_at: string
        }
        Insert: {
          created_at?: string
          dob?: string | null
          height_cm?: number | null
          id?: string
          market_value?: string | null
          media_urls?: string[]
          name: string
          nationality?: string | null
          nationality_code?: string | null
          photo_url?: string | null
          position?: string | null
          shirt_number?: number | null
          team_id?: string | null
          updated_at?: string
        }
        Update: {
          created_at?: string
          dob?: string | null
          height_cm?: number | null
          id?: string
          market_value?: string | null
          media_urls?: string[]
          name?: string
          nationality?: string | null
          nationality_code?: string | null
          photo_url?: string | null
          position?: string | null
          shirt_number?: number | null
          team_id?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "players_team_id_fkey"
            columns: ["team_id"]
            isOneToOne: false
            referencedRelation: "teams"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          avatar_url: string | null
          created_at: string
          currency: string
          display_name: string | null
          favorite_competition_ids: string[]
          favorite_match_ids: string[]
          favorite_player_ids: string[]
          favorite_team_ids: string[]
          height_unit: string
          id: string
          language: string
          match_notification_ids: string[]
          notification_preferences: Json
          theme: string
          updated_at: string
        }
        Insert: {
          avatar_url?: string | null
          created_at?: string
          currency?: string
          display_name?: string | null
          favorite_competition_ids?: string[]
          favorite_match_ids?: string[]
          favorite_player_ids?: string[]
          favorite_team_ids?: string[]
          height_unit?: string
          id: string
          language?: string
          match_notification_ids?: string[]
          notification_preferences?: Json
          theme?: string
          updated_at?: string
        }
        Update: {
          avatar_url?: string | null
          created_at?: string
          currency?: string
          display_name?: string | null
          favorite_competition_ids?: string[]
          favorite_match_ids?: string[]
          favorite_player_ids?: string[]
          favorite_team_ids?: string[]
          height_unit?: string
          id?: string
          language?: string
          match_notification_ids?: string[]
          notification_preferences?: Json
          theme?: string
          updated_at?: string
        }
        Relationships: []
      }
      standing_labels: {
        Row: {
          color: string
          competition_id: string | null
          created_at: string
          id: string
          label: string
        }
        Insert: {
          color?: string
          competition_id?: string | null
          created_at?: string
          id?: string
          label: string
        }
        Update: {
          color?: string
          competition_id?: string | null
          created_at?: string
          id?: string
          label?: string
        }
        Relationships: [
          {
            foreignKeyName: "standing_labels_competition_id_fkey"
            columns: ["competition_id"]
            isOneToOne: false
            referencedRelation: "competitions"
            referencedColumns: ["id"]
          },
        ]
      }
      standings_position_labels: {
        Row: {
          color: string
          competition_id: string
          created_at: string
          group_label: string | null
          id: string
          label: string
          position: number
          season: string | null
          updated_at: string
        }
        Insert: {
          color?: string
          competition_id: string
          created_at?: string
          group_label?: string | null
          id?: string
          label: string
          position: number
          season?: string | null
          updated_at?: string
        }
        Update: {
          color?: string
          competition_id?: string
          created_at?: string
          group_label?: string | null
          id?: string
          label?: string
          position?: number
          season?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "standings_position_labels_competition_id_fkey"
            columns: ["competition_id"]
            isOneToOne: false
            referencedRelation: "competitions"
            referencedColumns: ["id"]
          },
        ]
      }
      standings_rows: {
        Row: {
          competition_id: string
          drawn: number
          ga: number
          gf: number
          group_label: string | null
          id: string
          lost: number
          played: number
          points: number
          points_adjust: number
          qualification_color: string | null
          qualification_label: string | null
          season: string | null
          sort_order: number
          team_id: string
          updated_at: string
          won: number
        }
        Insert: {
          competition_id: string
          drawn?: number
          ga?: number
          gf?: number
          group_label?: string | null
          id?: string
          lost?: number
          played?: number
          points?: number
          points_adjust?: number
          qualification_color?: string | null
          qualification_label?: string | null
          season?: string | null
          sort_order?: number
          team_id: string
          updated_at?: string
          won?: number
        }
        Update: {
          competition_id?: string
          drawn?: number
          ga?: number
          gf?: number
          group_label?: string | null
          id?: string
          lost?: number
          played?: number
          points?: number
          points_adjust?: number
          qualification_color?: string | null
          qualification_label?: string | null
          season?: string | null
          sort_order?: number
          team_id?: string
          updated_at?: string
          won?: number
        }
        Relationships: [
          {
            foreignKeyName: "standings_rows_competition_id_fkey"
            columns: ["competition_id"]
            isOneToOne: false
            referencedRelation: "competitions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "standings_rows_team_id_fkey"
            columns: ["team_id"]
            isOneToOne: false
            referencedRelation: "teams"
            referencedColumns: ["id"]
          },
        ]
      }
      team_titles: {
        Row: {
          competition_id: string | null
          created_at: string
          id: string
          sort_order: number
          team_id: string
          title_name: string | null
          titles: number
          updated_at: string
        }
        Insert: {
          competition_id?: string | null
          created_at?: string
          id?: string
          sort_order?: number
          team_id: string
          title_name?: string | null
          titles?: number
          updated_at?: string
        }
        Update: {
          competition_id?: string | null
          created_at?: string
          id?: string
          sort_order?: number
          team_id?: string
          title_name?: string | null
          titles?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "team_titles_competition_id_fkey"
            columns: ["competition_id"]
            isOneToOne: false
            referencedRelation: "competitions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "team_titles_team_id_fkey"
            columns: ["team_id"]
            isOneToOne: false
            referencedRelation: "teams"
            referencedColumns: ["id"]
          },
        ]
      }
      teams: {
        Row: {
          chairman: string | null
          coach_name: string | null
          coach_photo_url: string | null
          competition_id: string | null
          country: string | null
          country_code: string | null
          created_at: string
          description: string | null
          founded_on: string | null
          group_label: string | null
          id: string
          is_national: boolean
          is_temporary: boolean
          logo_url: string | null
          media_urls: string[]
          name: string
          short_name: string | null
          trophies: number
          updated_at: string
          venue_city: string | null
          venue_name: string | null
        }
        Insert: {
          chairman?: string | null
          coach_name?: string | null
          coach_photo_url?: string | null
          competition_id?: string | null
          country?: string | null
          country_code?: string | null
          created_at?: string
          description?: string | null
          founded_on?: string | null
          group_label?: string | null
          id?: string
          is_national?: boolean
          is_temporary?: boolean
          logo_url?: string | null
          media_urls?: string[]
          name: string
          short_name?: string | null
          trophies?: number
          updated_at?: string
          venue_city?: string | null
          venue_name?: string | null
        }
        Update: {
          chairman?: string | null
          coach_name?: string | null
          coach_photo_url?: string | null
          competition_id?: string | null
          country?: string | null
          country_code?: string | null
          created_at?: string
          description?: string | null
          founded_on?: string | null
          group_label?: string | null
          id?: string
          is_national?: boolean
          is_temporary?: boolean
          logo_url?: string | null
          media_urls?: string[]
          name?: string
          short_name?: string | null
          trophies?: number
          updated_at?: string
          venue_city?: string | null
          venue_name?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "teams_competition_id_fkey"
            columns: ["competition_id"]
            isOneToOne: false
            referencedRelation: "competitions"
            referencedColumns: ["id"]
          },
        ]
      }
      transfers: {
        Row: {
          created_at: string
          fee: string | null
          from_club: string | null
          id: string
          moved_on: string | null
          person_id: string
          person_type: string
          season: string | null
          sort_order: number
          to_club: string | null
          transfer_type: string | null
        }
        Insert: {
          created_at?: string
          fee?: string | null
          from_club?: string | null
          id?: string
          moved_on?: string | null
          person_id: string
          person_type?: string
          season?: string | null
          sort_order?: number
          to_club?: string | null
          transfer_type?: string | null
        }
        Update: {
          created_at?: string
          fee?: string | null
          from_club?: string | null
          id?: string
          moved_on?: string | null
          person_id?: string
          person_type?: string
          season?: string | null
          sort_order?: number
          to_club?: string | null
          transfer_type?: string | null
        }
        Relationships: []
      }
      translations: {
        Row: {
          created_at: string
          id: string
          locale: string
          source_text: string
          translated_text: string
        }
        Insert: {
          created_at?: string
          id?: string
          locale: string
          source_text: string
          translated_text: string
        }
        Update: {
          created_at?: string
          id?: string
          locale?: string
          source_text?: string
          translated_text?: string
        }
        Relationships: []
      }
      venues: {
        Row: {
          capacity: number | null
          city: string | null
          country: string | null
          country_code: string | null
          created_at: string
          description: string | null
          id: string
          image_url: string | null
          name: string
          updated_at: string
        }
        Insert: {
          capacity?: number | null
          city?: string | null
          country?: string | null
          country_code?: string | null
          created_at?: string
          description?: string | null
          id?: string
          image_url?: string | null
          name: string
          updated_at?: string
        }
        Update: {
          capacity?: number | null
          city?: string | null
          country?: string | null
          country_code?: string | null
          created_at?: string
          description?: string | null
          id?: string
          image_url?: string | null
          name?: string
          updated_at?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      admin_unlock_allowed: { Args: { _uid: string }; Returns: boolean }
      chat_author_profiles: {
        Args: { _ids: string[] }
        Returns: {
          avatar_url: string
          display_name: string
          id: string
        }[]
      }
      grant_admin: { Args: { _uid: string }; Returns: undefined }
      is_admin: { Args: { _uid: string }; Returns: boolean }
      recompute_standings: { Args: { _comp: string }; Returns: undefined }
      record_admin_unlock_attempt: {
        Args: { _succeeded: boolean; _uid: string }
        Returns: undefined
      }
      revoke_admin: { Args: { _uid: string }; Returns: undefined }
    }
    Enums: {
      [_ in never]: never
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
        DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] &
        DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R
      }
      ? R
      : never
    : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I
      }
      ? I
      : never
    : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U
      }
      ? U
      : never
    : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  public: {
    Enums: {},
  },
} as const
