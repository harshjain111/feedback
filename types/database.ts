/**
 * GENERATED FILE — do not edit by hand.
 *
 * Regenerate after every migration (CLAUDE.md §13.2):
 *   pnpm gen:types
 *
 * Produced by scripts/generate-database-types.mjs, which applies
 * supabase/migrations/ to a real Postgres and introspects the result.
 */

export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[]

export type Database = {
  public: {
    Tables: {
      alerts: {
        Row: {
          alert_id: string
          outlet_id: string
          type: string
          severity: string
          dedupe_key: string
          title: string
          body: string | null
          payload: Json
          first_fired_at: string
          last_fired_at: string
          cooldown_until: string | null
          acknowledged_at: string | null
          acknowledged_by: string | null
          created_at: string
        }
        Insert: {
          alert_id?: string
          outlet_id: string
          type: string
          severity?: string
          dedupe_key: string
          title: string
          body?: string | null
          payload?: Json
          first_fired_at?: string
          last_fired_at?: string
          cooldown_until?: string | null
          acknowledged_at?: string | null
          acknowledged_by?: string | null
          created_at?: string
        }
        Update: {
          alert_id?: string
          outlet_id?: string
          type?: string
          severity?: string
          dedupe_key?: string
          title?: string
          body?: string | null
          payload?: Json
          first_fired_at?: string
          last_fired_at?: string
          cooldown_until?: string | null
          acknowledged_at?: string | null
          acknowledged_by?: string | null
          created_at?: string
        }
        Relationships: [
          {
            foreignKeyName: 'alerts_acknowledged_by_fkey'
            columns: ['acknowledged_by']
            isOneToOne: false
            referencedRelation: 'app_users'
            referencedColumns: ['user_id']
          },
          {
            foreignKeyName: 'alerts_outlet_id_fkey'
            columns: ['outlet_id']
            isOneToOne: false
            referencedRelation: 'outlets'
            referencedColumns: ['outlet_id']
          },
        ]
      }
      app_config: {
        Row: {
          outlet_id: string
          key: string
          section: string
          value: Json
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          outlet_id: string
          key: string
          section: string
          value: Json
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          outlet_id?: string
          key?: string
          section?: string
          value?: Json
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: 'app_config_outlet_id_fkey'
            columns: ['outlet_id']
            isOneToOne: false
            referencedRelation: 'outlets'
            referencedColumns: ['outlet_id']
          },
          {
            foreignKeyName: 'app_config_updated_by_fkey'
            columns: ['updated_by']
            isOneToOne: false
            referencedRelation: 'app_users'
            referencedColumns: ['user_id']
          },
        ]
      }
      app_users: {
        Row: {
          user_id: string
          outlet_id: string
          name: string
          email: string
          role: string
          active: boolean
          created_at: string
          updated_at: string
        }
        Insert: {
          user_id: string
          outlet_id: string
          name: string
          email: string
          role: string
          active?: boolean
          created_at?: string
          updated_at?: string
        }
        Update: {
          user_id?: string
          outlet_id?: string
          name?: string
          email?: string
          role?: string
          active?: boolean
          created_at?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: 'app_users_outlet_id_fkey'
            columns: ['outlet_id']
            isOneToOne: false
            referencedRelation: 'outlets'
            referencedColumns: ['outlet_id']
          },
          {
            foreignKeyName: 'app_users_user_id_fkey'
            columns: ['user_id']
            isOneToOne: true
            referencedRelation: 'users'
            referencedColumns: ['id']
          },
        ]
      }
      audit_log: {
        Row: {
          id: number
          outlet_id: string | null
          user_id: string | null
          action: string
          entity: string
          entity_id: string | null
          before: Json | null
          after: Json | null
          created_at: string
        }
        Insert: {
          id?: number
          outlet_id?: string | null
          user_id?: string | null
          action: string
          entity: string
          entity_id?: string | null
          before?: Json | null
          after?: Json | null
          created_at?: string
        }
        Update: {
          id?: number
          outlet_id?: string | null
          user_id?: string | null
          action?: string
          entity?: string
          entity_id?: string | null
          before?: Json | null
          after?: Json | null
          created_at?: string
        }
        Relationships: [
          {
            foreignKeyName: 'audit_log_outlet_id_fkey'
            columns: ['outlet_id']
            isOneToOne: false
            referencedRelation: 'outlets'
            referencedColumns: ['outlet_id']
          },
          {
            foreignKeyName: 'audit_log_user_id_fkey'
            columns: ['user_id']
            isOneToOne: false
            referencedRelation: 'app_users'
            referencedColumns: ['user_id']
          },
        ]
      }
      categories: {
        Row: {
          category_id: string
          outlet_id: string
          name: string
          question: string
          icon: string
          display_order: number
          active: boolean
          created_at: string
          updated_at: string
        }
        Insert: {
          category_id?: string
          outlet_id: string
          name: string
          question: string
          icon: string
          display_order?: number
          active?: boolean
          created_at?: string
          updated_at?: string
        }
        Update: {
          category_id?: string
          outlet_id?: string
          name?: string
          question?: string
          icon?: string
          display_order?: number
          active?: boolean
          created_at?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: 'categories_outlet_id_fkey'
            columns: ['outlet_id']
            isOneToOne: false
            referencedRelation: 'outlets'
            referencedColumns: ['outlet_id']
          },
        ]
      }
      code_counters: {
        Row: {
          outlet_id: string
          scope: string
          bucket: string
          last_value: number
        }
        Insert: {
          outlet_id: string
          scope: string
          bucket: string
          last_value?: number
        }
        Update: {
          outlet_id?: string
          scope?: string
          bucket?: string
          last_value?: number
        }
        Relationships: [
          {
            foreignKeyName: 'code_counters_outlet_id_fkey'
            columns: ['outlet_id']
            isOneToOne: false
            referencedRelation: 'outlets'
            referencedColumns: ['outlet_id']
          },
        ]
      }
      feedback: {
        Row: {
          feedback_id: string
          feedback_code: string
          outlet_id: string
          kiosk_id: string | null
          guest_id: string | null
          submission_id: string
          submitted_at: string
          local_date: string
          local_time: string
          day_of_week: number
          hour_bucket: string
          overall_score: number | null
          sentiment: string | null
          comment: string | null
          follow_up_requested: boolean
          status: string
          created_at: string
          memory_offered: boolean
          memory_printed: boolean
          memory_retries: number
        }
        Insert: {
          feedback_id?: string
          feedback_code?: string
          outlet_id: string
          kiosk_id?: string | null
          guest_id?: string | null
          submission_id?: string
          submitted_at?: string
          local_date?: string
          local_time?: string
          day_of_week?: number
          hour_bucket?: string
          overall_score?: number | null
          sentiment?: string | null
          comment?: string | null
          follow_up_requested?: boolean
          status?: string
          created_at?: string
          memory_offered?: boolean
          memory_printed?: boolean
          memory_retries?: number
        }
        Update: {
          feedback_id?: string
          feedback_code?: string
          outlet_id?: string
          kiosk_id?: string | null
          guest_id?: string | null
          submission_id?: string
          submitted_at?: string
          local_date?: string
          local_time?: string
          day_of_week?: number
          hour_bucket?: string
          overall_score?: number | null
          sentiment?: string | null
          comment?: string | null
          follow_up_requested?: boolean
          status?: string
          created_at?: string
          memory_offered?: boolean
          memory_printed?: boolean
          memory_retries?: number
        }
        Relationships: [
          {
            foreignKeyName: 'feedback_guest_id_fkey'
            columns: ['guest_id']
            isOneToOne: false
            referencedRelation: 'guests'
            referencedColumns: ['guest_id']
          },
          {
            foreignKeyName: 'feedback_kiosk_id_fkey'
            columns: ['kiosk_id']
            isOneToOne: false
            referencedRelation: 'kiosks'
            referencedColumns: ['kiosk_id']
          },
          {
            foreignKeyName: 'feedback_outlet_id_fkey'
            columns: ['outlet_id']
            isOneToOne: false
            referencedRelation: 'outlets'
            referencedColumns: ['outlet_id']
          },
        ]
      }
      feedback_issues: {
        Row: {
          feedback_id: string
          issue_id: string
        }
        Insert: {
          feedback_id: string
          issue_id: string
        }
        Update: {
          feedback_id?: string
          issue_id?: string
        }
        Relationships: [
          {
            foreignKeyName: 'feedback_issues_feedback_id_fkey'
            columns: ['feedback_id']
            isOneToOne: false
            referencedRelation: 'feedback'
            referencedColumns: ['feedback_id']
          },
          {
            foreignKeyName: 'feedback_issues_issue_id_fkey'
            columns: ['issue_id']
            isOneToOne: false
            referencedRelation: 'issues'
            referencedColumns: ['issue_id']
          },
        ]
      }
      feedback_ratings: {
        Row: {
          feedback_id: string
          category_id: string
          rating: number
        }
        Insert: {
          feedback_id: string
          category_id: string
          rating: number
        }
        Update: {
          feedback_id?: string
          category_id?: string
          rating?: number
        }
        Relationships: [
          {
            foreignKeyName: 'feedback_ratings_category_id_fkey'
            columns: ['category_id']
            isOneToOne: false
            referencedRelation: 'categories'
            referencedColumns: ['category_id']
          },
          {
            foreignKeyName: 'feedback_ratings_feedback_id_fkey'
            columns: ['feedback_id']
            isOneToOne: false
            referencedRelation: 'feedback'
            referencedColumns: ['feedback_id']
          },
        ]
      }
      feedback_themes: {
        Row: {
          feedback_id: string
          theme_id: string
          mentions: number
        }
        Insert: {
          feedback_id: string
          theme_id: string
          mentions?: number
        }
        Update: {
          feedback_id?: string
          theme_id?: string
          mentions?: number
        }
        Relationships: [
          {
            foreignKeyName: 'feedback_themes_feedback_id_fkey'
            columns: ['feedback_id']
            isOneToOne: false
            referencedRelation: 'feedback'
            referencedColumns: ['feedback_id']
          },
          {
            foreignKeyName: 'feedback_themes_theme_id_fkey'
            columns: ['theme_id']
            isOneToOne: false
            referencedRelation: 'themes'
            referencedColumns: ['theme_id']
          },
        ]
      }
      follow_up_notes: {
        Row: {
          note_id: string
          follow_up_id: string
          author_id: string | null
          body: string
          created_at: string
        }
        Insert: {
          note_id?: string
          follow_up_id: string
          author_id?: string | null
          body: string
          created_at?: string
        }
        Update: {
          note_id?: string
          follow_up_id?: string
          author_id?: string | null
          body?: string
          created_at?: string
        }
        Relationships: [
          {
            foreignKeyName: 'follow_up_notes_author_id_fkey'
            columns: ['author_id']
            isOneToOne: false
            referencedRelation: 'app_users'
            referencedColumns: ['user_id']
          },
          {
            foreignKeyName: 'follow_up_notes_follow_up_id_fkey'
            columns: ['follow_up_id']
            isOneToOne: false
            referencedRelation: 'follow_ups'
            referencedColumns: ['follow_up_id']
          },
        ]
      }
      follow_ups: {
        Row: {
          follow_up_id: string
          outlet_id: string
          feedback_id: string
          guest_id: string | null
          status: string
          assigned_to: string | null
          resolution: string | null
          created_at: string
          updated_at: string
          resolved_at: string | null
        }
        Insert: {
          follow_up_id?: string
          outlet_id: string
          feedback_id: string
          guest_id?: string | null
          status?: string
          assigned_to?: string | null
          resolution?: string | null
          created_at?: string
          updated_at?: string
          resolved_at?: string | null
        }
        Update: {
          follow_up_id?: string
          outlet_id?: string
          feedback_id?: string
          guest_id?: string | null
          status?: string
          assigned_to?: string | null
          resolution?: string | null
          created_at?: string
          updated_at?: string
          resolved_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: 'follow_ups_assigned_to_fkey'
            columns: ['assigned_to']
            isOneToOne: false
            referencedRelation: 'app_users'
            referencedColumns: ['user_id']
          },
          {
            foreignKeyName: 'follow_ups_feedback_id_fkey'
            columns: ['feedback_id']
            isOneToOne: true
            referencedRelation: 'feedback'
            referencedColumns: ['feedback_id']
          },
          {
            foreignKeyName: 'follow_ups_guest_id_fkey'
            columns: ['guest_id']
            isOneToOne: false
            referencedRelation: 'guests'
            referencedColumns: ['guest_id']
          },
          {
            foreignKeyName: 'follow_ups_outlet_id_fkey'
            columns: ['outlet_id']
            isOneToOne: false
            referencedRelation: 'outlets'
            referencedColumns: ['outlet_id']
          },
        ]
      }
      guests: {
        Row: {
          guest_id: string
          outlet_id: string
          guest_code: string
          name: string | null
          phone: string | null
          first_feedback_date: string | null
          last_feedback_date: string | null
          total_feedbacks: number
          average_rating: number | null
          created_at: string
          updated_at: string
        }
        Insert: {
          guest_id?: string
          outlet_id: string
          guest_code?: string
          name?: string | null
          phone?: string | null
          first_feedback_date?: string | null
          last_feedback_date?: string | null
          total_feedbacks?: number
          average_rating?: number | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          guest_id?: string
          outlet_id?: string
          guest_code?: string
          name?: string | null
          phone?: string | null
          first_feedback_date?: string | null
          last_feedback_date?: string | null
          total_feedbacks?: number
          average_rating?: number | null
          created_at?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: 'guests_outlet_id_fkey'
            columns: ['outlet_id']
            isOneToOne: false
            referencedRelation: 'outlets'
            referencedColumns: ['outlet_id']
          },
        ]
      }
      issues: {
        Row: {
          issue_id: string
          outlet_id: string
          name: string
          icon: string | null
          kind: string
          display_order: number
          active: boolean
          created_at: string
          updated_at: string
        }
        Insert: {
          issue_id?: string
          outlet_id: string
          name: string
          icon?: string | null
          kind: string
          display_order?: number
          active?: boolean
          created_at?: string
          updated_at?: string
        }
        Update: {
          issue_id?: string
          outlet_id?: string
          name?: string
          icon?: string | null
          kind?: string
          display_order?: number
          active?: boolean
          created_at?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: 'issues_outlet_id_fkey'
            columns: ['outlet_id']
            isOneToOne: false
            referencedRelation: 'outlets'
            referencedColumns: ['outlet_id']
          },
        ]
      }
      kiosk_write_budget: {
        Row: {
          outlet_id: string
          kiosk_key: string
          minute: string
          hits: number
        }
        Insert: {
          outlet_id: string
          kiosk_key: string
          minute: string
          hits?: number
        }
        Update: {
          outlet_id?: string
          kiosk_key?: string
          minute?: string
          hits?: number
        }
        Relationships: [
          {
            foreignKeyName: 'kiosk_write_budget_outlet_id_fkey'
            columns: ['outlet_id']
            isOneToOne: false
            referencedRelation: 'outlets'
            referencedColumns: ['outlet_id']
          },
        ]
      }
      kiosks: {
        Row: {
          kiosk_id: string
          outlet_id: string
          label: string
          active: boolean
          last_seen_at: string | null
          created_at: string
          printer_status: string
          camera_status: string
          agent_version: string | null
          status_checked_at: string | null
        }
        Insert: {
          kiosk_id?: string
          outlet_id: string
          label: string
          active?: boolean
          last_seen_at?: string | null
          created_at?: string
          printer_status?: string
          camera_status?: string
          agent_version?: string | null
          status_checked_at?: string | null
        }
        Update: {
          kiosk_id?: string
          outlet_id?: string
          label?: string
          active?: boolean
          last_seen_at?: string | null
          created_at?: string
          printer_status?: string
          camera_status?: string
          agent_version?: string | null
          status_checked_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: 'kiosks_outlet_id_fkey'
            columns: ['outlet_id']
            isOneToOne: false
            referencedRelation: 'outlets'
            referencedColumns: ['outlet_id']
          },
        ]
      }
      outlets: {
        Row: {
          outlet_id: string
          name: string
          code: string
          city: string | null
          active: boolean
          created_at: string
        }
        Insert: {
          outlet_id?: string
          name: string
          code: string
          city?: string | null
          active?: boolean
          created_at?: string
        }
        Update: {
          outlet_id?: string
          name?: string
          code?: string
          city?: string | null
          active?: boolean
          created_at?: string
        }
        Relationships: []
      }
      rating_scale: {
        Row: {
          scale_id: string
          outlet_id: string
          value: number
          face_key: string
          label: string
          colour: string
          active: boolean
          created_at: string
          updated_at: string
        }
        Insert: {
          scale_id?: string
          outlet_id: string
          value: number
          face_key: string
          label: string
          colour: string
          active?: boolean
          created_at?: string
          updated_at?: string
        }
        Update: {
          scale_id?: string
          outlet_id?: string
          value?: number
          face_key?: string
          label?: string
          colour?: string
          active?: boolean
          created_at?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: 'rating_scale_outlet_id_fkey'
            columns: ['outlet_id']
            isOneToOne: false
            referencedRelation: 'outlets'
            referencedColumns: ['outlet_id']
          },
        ]
      }
      theme_keywords: {
        Row: {
          keyword_id: string
          theme_id: string
          keyword: string
          active: boolean
          created_at: string
        }
        Insert: {
          keyword_id?: string
          theme_id: string
          keyword: string
          active?: boolean
          created_at?: string
        }
        Update: {
          keyword_id?: string
          theme_id?: string
          keyword?: string
          active?: boolean
          created_at?: string
        }
        Relationships: [
          {
            foreignKeyName: 'theme_keywords_theme_id_fkey'
            columns: ['theme_id']
            isOneToOne: false
            referencedRelation: 'themes'
            referencedColumns: ['theme_id']
          },
        ]
      }
      themes: {
        Row: {
          theme_id: string
          outlet_id: string
          name: string
          kind: string
          display_order: number
          active: boolean
          created_at: string
          updated_at: string
        }
        Insert: {
          theme_id?: string
          outlet_id: string
          name: string
          kind: string
          display_order?: number
          active?: boolean
          created_at?: string
          updated_at?: string
        }
        Update: {
          theme_id?: string
          outlet_id?: string
          name?: string
          kind?: string
          display_order?: number
          active?: boolean
          created_at?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: 'themes_outlet_id_fkey'
            columns: ['outlet_id']
            isOneToOne: false
            referencedRelation: 'outlets'
            referencedColumns: ['outlet_id']
          },
        ]
      }
    }
    Views: {
      guests_visible: {
        Row: {
          guest_id: string | null
          outlet_id: string | null
          guest_code: string | null
          name: string | null
          phone_masked: string | null
          has_phone: boolean | null
          first_feedback_date: string | null
          last_feedback_date: string | null
          total_feedbacks: number | null
          average_rating: number | null
          created_at: string | null
          updated_at: string | null
        }
        Relationships: []
      }
      v_category_daily: {
        Row: {
          outlet_id: string | null
          local_date: string | null
          category_id: string | null
          rating_count: number | null
          avg_rating: number | null
          positive_count: number | null
          neutral_count: number | null
          negative_count: number | null
        }
        Relationships: []
      }
      v_feedback_daily: {
        Row: {
          outlet_id: string | null
          local_date: string | null
          feedback_count: number | null
          avg_score: number | null
          positive_count: number | null
          neutral_count: number | null
          negative_count: number | null
          follow_up_count: number | null
          comment_count: number | null
          identified_guest_count: number | null
        }
        Relationships: []
      }
      v_follow_up_facts: {
        Row: {
          outlet_id: string | null
          follow_up_id: string | null
          feedback_id: string | null
          guest_id: string | null
          status: string | null
          assigned_to: string | null
          local_date: string | null
          created_at: string | null
          resolved_at: string | null
          resolution_hours: number | null
        }
        Relationships: []
      }
      v_guest_summary: {
        Row: {
          guest_id: string | null
          outlet_id: string | null
          guest_code: string | null
          name: string | null
          total_feedbacks: number | null
          average_rating: number | null
          first_feedback_date: string | null
          last_feedback_date: string | null
          has_phone: boolean | null
          is_repeat: boolean | null
          is_negative: boolean | null
          is_high_engagement: boolean | null
          has_open_follow_up: boolean | null
        }
        Relationships: []
      }
      v_issue_daily: {
        Row: {
          outlet_id: string | null
          local_date: string | null
          issue_id: string | null
          mention_count: number | null
        }
        Relationships: []
      }
      v_rating_distribution_daily: {
        Row: {
          outlet_id: string | null
          local_date: string | null
          rating: number | null
          rating_count: number | null
        }
        Relationships: []
      }
      v_rating_facts: {
        Row: {
          outlet_id: string | null
          feedback_id: string | null
          guest_id: string | null
          local_date: string | null
          day_of_week: number | null
          hour_bucket: string | null
          sentiment: string | null
          follow_up_requested: boolean | null
          category_id: string | null
          rating: number | null
        }
        Relationships: []
      }
      v_theme_daily: {
        Row: {
          outlet_id: string | null
          local_date: string | null
          theme_id: string | null
          feedback_count: number | null
          mention_count: number | null
        }
        Relationships: []
      }
    }
    Functions: {
      /** aic_assign_guest_code() -> trigger */
      aic_assign_guest_code: {
        Args: Record<string, unknown>
        Returns: unknown
      }
      /** aic_consume_write_budget(p_outlet uuid, p_kiosk_key text, p_limit integer) -> boolean */
      aic_consume_write_budget: {
        Args: Record<string, unknown>
        Returns: unknown
      }
      /** aic_current_outlet() -> uuid */
      aic_current_outlet: {
        Args: Record<string, unknown>
        Returns: unknown
      }
      /** aic_current_role() -> text */
      aic_current_role: {
        Args: Record<string, unknown>
        Returns: unknown
      }
      /** aic_feedback_guest_aggregates() -> trigger */
      aic_feedback_guest_aggregates: {
        Args: Record<string, unknown>
        Returns: unknown
      }
      /** aic_guard_feedback_status() -> trigger */
      aic_guard_feedback_status: {
        Args: Record<string, unknown>
        Returns: unknown
      }
      /** aic_has_role(VARIADIC p_roles text[]) -> boolean */
      aic_has_role: {
        Args: Record<string, unknown>
        Returns: unknown
      }
      /** aic_hour_bucket(p_at timestamp with time zone) -> text */
      aic_hour_bucket: {
        Args: Record<string, unknown>
        Returns: unknown
      }
      /** aic_is_config_owner() -> boolean */
      aic_is_config_owner: {
        Args: Record<string, unknown>
        Returns: unknown
      }
      /** aic_is_manager_plus() -> boolean */
      aic_is_manager_plus: {
        Args: Record<string, unknown>
        Returns: unknown
      }
      /** aic_is_member() -> boolean */
      aic_is_member: {
        Args: Record<string, unknown>
        Returns: unknown
      }
      /** aic_mask_phone(p_phone text, p_visible integer DEFAULT 4) -> text */
      aic_mask_phone: {
        Args: Record<string, unknown>
        Returns: unknown
      }
      /** aic_mirror_follow_up_status() -> trigger */
      aic_mirror_follow_up_status: {
        Args: Record<string, unknown>
        Returns: unknown
      }
      /** aic_next_counter(p_outlet uuid, p_scope text, p_bucket text) -> bigint */
      aic_next_counter: {
        Args: Record<string, unknown>
        Returns: unknown
      }
      /** aic_next_feedback_code(p_outlet uuid, p_at timestamp with time zone DEFAULT now()) -> text */
      aic_next_feedback_code: {
        Args: Record<string, unknown>
        Returns: unknown
      }
      /** aic_next_guest_code(p_outlet uuid) -> text */
      aic_next_guest_code: {
        Args: Record<string, unknown>
        Returns: unknown
      }
      /** aic_prepare_feedback_row() -> trigger */
      aic_prepare_feedback_row: {
        Args: Record<string, unknown>
        Returns: unknown
      }
      /** aic_purge_expired_contacts(p_outlet uuid DEFAULT NULL::uuid) -> TABLE(outlet_id uuid, guests_anonymised integer) */
      aic_purge_expired_contacts: {
        Args: Record<string, unknown>
        Returns: unknown
      }
      /** aic_recalc_guest_aggregates(p_guest uuid) -> void */
      aic_recalc_guest_aggregates: {
        Args: Record<string, unknown>
        Returns: unknown
      }
      /** aic_reveal_phone(p_guest uuid, p_reason text DEFAULT NULL::text) -> text */
      aic_reveal_phone: {
        Args: Record<string, unknown>
        Returns: unknown
      }
      /** aic_touch_kiosk(p_kiosk uuid) -> void */
      aic_touch_kiosk: {
        Args: Record<string, unknown>
        Returns: unknown
      }
      /** aic_touch_updated_at() -> trigger */
      aic_touch_updated_at: {
        Args: Record<string, unknown>
        Returns: unknown
      }
    }
    Enums: Record<string, never>
    CompositeTypes: Record<string, never>
  }
}

export type Tables<T extends keyof Database["public"]["Tables"]> =
  Database["public"]["Tables"][T]["Row"]
export type TablesInsert<T extends keyof Database["public"]["Tables"]> =
  Database["public"]["Tables"][T]["Insert"]
export type TablesUpdate<T extends keyof Database["public"]["Tables"]> =
  Database["public"]["Tables"][T]["Update"]
export type Views<T extends keyof Database["public"]["Views"]> =
  Database["public"]["Views"][T]["Row"]
