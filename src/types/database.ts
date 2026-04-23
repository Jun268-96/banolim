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
    PostgrestVersion: "14.4"
  }
  public: {
    Tables: {
      activity_groups: {
        Row: {
          code: string
          created_at: string
          is_active: boolean
          name: string
          sort_order: number
        }
        Insert: {
          code: string
          created_at?: string
          is_active?: boolean
          name: string
          sort_order?: number
        }
        Update: {
          code?: string
          created_at?: string
          is_active?: boolean
          name?: string
          sort_order?: number
        }
        Relationships: []
      }
      activity_records: {
        Row: {
          activity_type_id: string
          created_at: string
          created_by: string | null
          evidence_url: string | null
          id: string
          member_id: string
          note: string | null
          occurred_at: string
          season_id: string | null
          status: string
        }
        Insert: {
          activity_type_id: string
          created_at?: string
          created_by?: string | null
          evidence_url?: string | null
          id?: string
          member_id: string
          note?: string | null
          occurred_at?: string
          season_id?: string | null
          status?: string
        }
        Update: {
          activity_type_id?: string
          created_at?: string
          created_by?: string | null
          evidence_url?: string | null
          id?: string
          member_id?: string
          note?: string | null
          occurred_at?: string
          season_id?: string | null
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "activity_records_activity_type_id_fkey"
            columns: ["activity_type_id"]
            isOneToOne: false
            referencedRelation: "activity_types"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "activity_records_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "member_score_summary"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "activity_records_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "members"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "activity_records_member_id_fkey"
            columns: ["member_id"]
            isOneToOne: false
            referencedRelation: "member_score_summary"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "activity_records_member_id_fkey"
            columns: ["member_id"]
            isOneToOne: false
            referencedRelation: "members"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "activity_records_season_id_fkey"
            columns: ["season_id"]
            isOneToOne: false
            referencedRelation: "seasons"
            referencedColumns: ["id"]
          },
        ]
      }
      activity_types: {
        Row: {
          code: string
          created_at: string
          group_name: string
          id: string
          name: string
        }
        Insert: {
          code: string
          created_at?: string
          group_name?: string
          id?: string
          name: string
        }
        Update: {
          code?: string
          created_at?: string
          group_name?: string
          id?: string
          name?: string
        }
        Relationships: []
      }
      announcements: {
        Row: {
          body: string
          created_at: string
          created_by: string | null
          ends_at: string | null
          id: string
          is_active: boolean
          is_pinned: boolean
          starts_at: string | null
          title: string
        }
        Insert: {
          body: string
          created_at?: string
          created_by?: string | null
          ends_at?: string | null
          id?: string
          is_active?: boolean
          is_pinned?: boolean
          starts_at?: string | null
          title: string
        }
        Update: {
          body?: string
          created_at?: string
          created_by?: string | null
          ends_at?: string | null
          id?: string
          is_active?: boolean
          is_pinned?: boolean
          starts_at?: string | null
          title?: string
        }
        Relationships: [
          {
            foreignKeyName: "announcements_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "member_score_summary"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "announcements_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "members"
            referencedColumns: ["id"]
          },
        ]
      }
      attendance_session_members: {
        Row: {
          activity_record_id: string | null
          attendance_status: string
          created_at: string
          id: string
          member_id: string
          session_id: string
          updated_at: string
        }
        Insert: {
          activity_record_id?: string | null
          attendance_status?: string
          created_at?: string
          id?: string
          member_id: string
          session_id: string
          updated_at?: string
        }
        Update: {
          activity_record_id?: string | null
          attendance_status?: string
          created_at?: string
          id?: string
          member_id?: string
          session_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "attendance_session_members_activity_record_id_fkey"
            columns: ["activity_record_id"]
            isOneToOne: false
            referencedRelation: "activity_records"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "attendance_session_members_member_id_fkey"
            columns: ["member_id"]
            isOneToOne: false
            referencedRelation: "member_score_summary"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "attendance_session_members_member_id_fkey"
            columns: ["member_id"]
            isOneToOne: false
            referencedRelation: "members"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "attendance_session_members_session_id_fkey"
            columns: ["session_id"]
            isOneToOne: false
            referencedRelation: "attendance_sessions"
            referencedColumns: ["id"]
          },
        ]
      }
      attendance_sessions: {
        Row: {
          created_at: string
          created_by: string | null
          ends_at: string | null
          id: string
          is_active: boolean
          note: string | null
          point_rule_id: string
          season_id: string | null
          session_code: string
          starts_at: string
          target_group_type: string
          target_team_id: string | null
          title: string
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          ends_at?: string | null
          id?: string
          is_active?: boolean
          note?: string | null
          point_rule_id: string
          season_id?: string | null
          session_code: string
          starts_at: string
          target_group_type?: string
          target_team_id?: string | null
          title: string
        }
        Update: {
          created_at?: string
          created_by?: string | null
          ends_at?: string | null
          id?: string
          is_active?: boolean
          note?: string | null
          point_rule_id?: string
          season_id?: string | null
          session_code?: string
          starts_at?: string
          target_group_type?: string
          target_team_id?: string | null
          title?: string
        }
        Relationships: [
          {
            foreignKeyName: "attendance_sessions_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "member_score_summary"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "attendance_sessions_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "members"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "attendance_sessions_point_rule_id_fkey"
            columns: ["point_rule_id"]
            isOneToOne: false
            referencedRelation: "point_rule_catalog"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "attendance_sessions_point_rule_id_fkey"
            columns: ["point_rule_id"]
            isOneToOne: false
            referencedRelation: "point_rules"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "attendance_sessions_season_id_fkey"
            columns: ["season_id"]
            isOneToOne: false
            referencedRelation: "seasons"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "attendance_sessions_target_team_id_fkey"
            columns: ["target_team_id"]
            isOneToOne: false
            referencedRelation: "teams"
            referencedColumns: ["id"]
          },
        ]
      }
      audit_logs: {
        Row: {
          action: string
          actor_id: string | null
          created_at: string
          diff_json: Json
          entity_id: string
          entity_type: string
          id: string
        }
        Insert: {
          action: string
          actor_id?: string | null
          created_at?: string
          diff_json?: Json
          entity_id: string
          entity_type: string
          id?: string
        }
        Update: {
          action?: string
          actor_id?: string | null
          created_at?: string
          diff_json?: Json
          entity_id?: string
          entity_type?: string
          id?: string
        }
        Relationships: [
          {
            foreignKeyName: "audit_logs_actor_id_fkey"
            columns: ["actor_id"]
            isOneToOne: false
            referencedRelation: "member_score_summary"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "audit_logs_actor_id_fkey"
            columns: ["actor_id"]
            isOneToOne: false
            referencedRelation: "members"
            referencedColumns: ["id"]
          },
        ]
      }
      badges: {
        Row: {
          code: string
          created_at: string
          criteria_json: Json
          description: string
          evaluation_scope: string
          icon_key: string
          id: string
          image_url: string | null
          is_active: boolean
          name: string
          sort_order: number
          tone: string
        }
        Insert: {
          code: string
          created_at?: string
          criteria_json?: Json
          description: string
          evaluation_scope?: string
          icon_key: string
          id?: string
          image_url?: string | null
          is_active?: boolean
          name: string
          sort_order?: number
          tone?: string
        }
        Update: {
          code?: string
          created_at?: string
          criteria_json?: Json
          description?: string
          evaluation_scope?: string
          icon_key?: string
          id?: string
          image_url?: string | null
          is_active?: boolean
          name?: string
          sort_order?: number
          tone?: string
        }
        Relationships: []
      }
      community_comments: {
        Row: {
          author_member_id: string
          body: string
          created_at: string
          hidden_at: string | null
          hidden_by: string | null
          id: string
          is_hidden: boolean
          post_id: string
          updated_at: string
        }
        Insert: {
          author_member_id: string
          body: string
          created_at?: string
          hidden_at?: string | null
          hidden_by?: string | null
          id?: string
          is_hidden?: boolean
          post_id: string
          updated_at?: string
        }
        Update: {
          author_member_id?: string
          body?: string
          created_at?: string
          hidden_at?: string | null
          hidden_by?: string | null
          id?: string
          is_hidden?: boolean
          post_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "community_comments_author_member_id_fkey"
            columns: ["author_member_id"]
            isOneToOne: false
            referencedRelation: "member_score_summary"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "community_comments_author_member_id_fkey"
            columns: ["author_member_id"]
            isOneToOne: false
            referencedRelation: "members"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "community_comments_hidden_by_fkey"
            columns: ["hidden_by"]
            isOneToOne: false
            referencedRelation: "member_score_summary"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "community_comments_hidden_by_fkey"
            columns: ["hidden_by"]
            isOneToOne: false
            referencedRelation: "members"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "community_comments_post_id_fkey"
            columns: ["post_id"]
            isOneToOne: false
            referencedRelation: "community_posts"
            referencedColumns: ["id"]
          },
        ]
      }
      community_posts: {
        Row: {
          author_member_id: string
          body: string
          comment_count: number
          created_at: string
          hidden_at: string | null
          hidden_by: string | null
          hidden_reason: string | null
          id: string
          is_hidden: boolean
          is_pinned: boolean
          title: string
          updated_at: string
        }
        Insert: {
          author_member_id: string
          body: string
          comment_count?: number
          created_at?: string
          hidden_at?: string | null
          hidden_by?: string | null
          hidden_reason?: string | null
          id?: string
          is_hidden?: boolean
          is_pinned?: boolean
          title: string
          updated_at?: string
        }
        Update: {
          author_member_id?: string
          body?: string
          comment_count?: number
          created_at?: string
          hidden_at?: string | null
          hidden_by?: string | null
          hidden_reason?: string | null
          id?: string
          is_hidden?: boolean
          is_pinned?: boolean
          title?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "community_posts_author_member_id_fkey"
            columns: ["author_member_id"]
            isOneToOne: false
            referencedRelation: "member_score_summary"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "community_posts_author_member_id_fkey"
            columns: ["author_member_id"]
            isOneToOne: false
            referencedRelation: "members"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "community_posts_hidden_by_fkey"
            columns: ["hidden_by"]
            isOneToOne: false
            referencedRelation: "member_score_summary"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "community_posts_hidden_by_fkey"
            columns: ["hidden_by"]
            isOneToOne: false
            referencedRelation: "members"
            referencedColumns: ["id"]
          },
        ]
      }
      correction_requests: {
        Row: {
          activity_record_id: string
          created_at: string
          id: string
          reason: string
          requester_member_id: string
          review_note: string | null
          reviewed_at: string | null
          reviewed_by: string | null
          status: Database["public"]["Enums"]["correction_request_status"]
          updated_at: string
        }
        Insert: {
          activity_record_id: string
          created_at?: string
          id?: string
          reason: string
          requester_member_id: string
          review_note?: string | null
          reviewed_at?: string | null
          reviewed_by?: string | null
          status?: Database["public"]["Enums"]["correction_request_status"]
          updated_at?: string
        }
        Update: {
          activity_record_id?: string
          created_at?: string
          id?: string
          reason?: string
          requester_member_id?: string
          review_note?: string | null
          reviewed_at?: string | null
          reviewed_by?: string | null
          status?: Database["public"]["Enums"]["correction_request_status"]
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "correction_requests_activity_record_id_fkey"
            columns: ["activity_record_id"]
            isOneToOne: false
            referencedRelation: "activity_records"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "correction_requests_requester_member_id_fkey"
            columns: ["requester_member_id"]
            isOneToOne: false
            referencedRelation: "member_score_summary"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "correction_requests_requester_member_id_fkey"
            columns: ["requester_member_id"]
            isOneToOne: false
            referencedRelation: "members"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "correction_requests_reviewed_by_fkey"
            columns: ["reviewed_by"]
            isOneToOne: false
            referencedRelation: "member_score_summary"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "correction_requests_reviewed_by_fkey"
            columns: ["reviewed_by"]
            isOneToOne: false
            referencedRelation: "members"
            referencedColumns: ["id"]
          },
        ]
      }
      member_badges: {
        Row: {
          awarded_at: string
          badge_id: string
          id: string
          member_id: string
          season_id: string | null
        }
        Insert: {
          awarded_at?: string
          badge_id: string
          id?: string
          member_id: string
          season_id?: string | null
        }
        Update: {
          awarded_at?: string
          badge_id?: string
          id?: string
          member_id?: string
          season_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "member_badges_badge_id_fkey"
            columns: ["badge_id"]
            isOneToOne: false
            referencedRelation: "badges"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "member_badges_member_id_fkey"
            columns: ["member_id"]
            isOneToOne: false
            referencedRelation: "member_score_summary"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "member_badges_member_id_fkey"
            columns: ["member_id"]
            isOneToOne: false
            referencedRelation: "members"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "member_badges_season_id_fkey"
            columns: ["season_id"]
            isOneToOne: false
            referencedRelation: "seasons"
            referencedColumns: ["id"]
          },
        ]
      }
      member_team_links: {
        Row: {
          created_at: string
          id: string
          member_id: string
          team_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          member_id: string
          team_id: string
        }
        Update: {
          created_at?: string
          id?: string
          member_id?: string
          team_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "member_team_links_member_id_fkey"
            columns: ["member_id"]
            isOneToOne: false
            referencedRelation: "member_score_summary"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "member_team_links_member_id_fkey"
            columns: ["member_id"]
            isOneToOne: false
            referencedRelation: "members"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "member_team_links_team_id_fkey"
            columns: ["team_id"]
            isOneToOne: false
            referencedRelation: "teams"
            referencedColumns: ["id"]
          },
        ]
      }
      members: {
        Row: {
          auth_provisioned_at: string | null
          auth_user_id: string | null
          avatar_key: string | null
          created_at: string
          id: string
          is_approved: boolean
          is_visible: boolean
          joined_at: string
          login_email: string | null
          name: string
          password_reset_required: boolean
          role_id: string | null
          status: Database["public"]["Enums"]["member_status"]
          team_id: string | null
        }
        Insert: {
          auth_provisioned_at?: string | null
          auth_user_id?: string | null
          avatar_key?: string | null
          created_at?: string
          id?: string
          is_approved?: boolean
          is_visible?: boolean
          joined_at?: string
          login_email?: string | null
          name: string
          password_reset_required?: boolean
          role_id?: string | null
          status?: Database["public"]["Enums"]["member_status"]
          team_id?: string | null
        }
        Update: {
          auth_provisioned_at?: string | null
          auth_user_id?: string | null
          avatar_key?: string | null
          created_at?: string
          id?: string
          is_approved?: boolean
          is_visible?: boolean
          joined_at?: string
          login_email?: string | null
          name?: string
          password_reset_required?: boolean
          role_id?: string | null
          status?: Database["public"]["Enums"]["member_status"]
          team_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "members_role_id_fkey"
            columns: ["role_id"]
            isOneToOne: false
            referencedRelation: "roles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "members_team_id_fkey"
            columns: ["team_id"]
            isOneToOne: false
            referencedRelation: "teams"
            referencedColumns: ["id"]
          },
        ]
      }
      point_ledgers: {
        Row: {
          created_at: string
          created_by: string | null
          delta: number
          id: string
          member_id: string
          point_rule_id: string
          reason: string | null
          record_id: string
          reversal_of: string | null
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          delta: number
          id?: string
          member_id: string
          point_rule_id: string
          reason?: string | null
          record_id: string
          reversal_of?: string | null
        }
        Update: {
          created_at?: string
          created_by?: string | null
          delta?: number
          id?: string
          member_id?: string
          point_rule_id?: string
          reason?: string | null
          record_id?: string
          reversal_of?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "point_ledgers_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "member_score_summary"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "point_ledgers_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "members"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "point_ledgers_member_id_fkey"
            columns: ["member_id"]
            isOneToOne: false
            referencedRelation: "member_score_summary"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "point_ledgers_member_id_fkey"
            columns: ["member_id"]
            isOneToOne: false
            referencedRelation: "members"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "point_ledgers_point_rule_id_fkey"
            columns: ["point_rule_id"]
            isOneToOne: false
            referencedRelation: "point_rule_catalog"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "point_ledgers_point_rule_id_fkey"
            columns: ["point_rule_id"]
            isOneToOne: false
            referencedRelation: "point_rules"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "point_ledgers_record_id_fkey"
            columns: ["record_id"]
            isOneToOne: false
            referencedRelation: "activity_records"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "point_ledgers_reversal_of_fkey"
            columns: ["reversal_of"]
            isOneToOne: false
            referencedRelation: "activity_log_feed"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "point_ledgers_reversal_of_fkey"
            columns: ["reversal_of"]
            isOneToOne: false
            referencedRelation: "point_ledgers"
            referencedColumns: ["id"]
          },
        ]
      }
      point_rules: {
        Row: {
          activity_type_id: string
          base_point: number
          condition_json: Json
          created_at: string
          id: string
          is_active: boolean
          penalty_point: number
          version: number
        }
        Insert: {
          activity_type_id: string
          base_point: number
          condition_json?: Json
          created_at?: string
          id?: string
          is_active?: boolean
          penalty_point?: number
          version?: number
        }
        Update: {
          activity_type_id?: string
          base_point?: number
          condition_json?: Json
          created_at?: string
          id?: string
          is_active?: boolean
          penalty_point?: number
          version?: number
        }
        Relationships: [
          {
            foreignKeyName: "point_rules_activity_type_id_fkey"
            columns: ["activity_type_id"]
            isOneToOne: false
            referencedRelation: "activity_types"
            referencedColumns: ["id"]
          },
        ]
      }
      push_subscriptions: {
        Row: {
          auth: string
          created_at: string | null
          endpoint: string
          id: string
          member_id: string
          p256dh: string
        }
        Insert: {
          auth: string
          created_at?: string | null
          endpoint: string
          id?: string
          member_id: string
          p256dh: string
        }
        Update: {
          auth?: string
          created_at?: string | null
          endpoint?: string
          id?: string
          member_id?: string
          p256dh?: string
        }
        Relationships: [
          {
            foreignKeyName: "push_subscriptions_member_id_fkey"
            columns: ["member_id"]
            isOneToOne: false
            referencedRelation: "member_score_summary"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "push_subscriptions_member_id_fkey"
            columns: ["member_id"]
            isOneToOne: false
            referencedRelation: "members"
            referencedColumns: ["id"]
          },
        ]
      }
      roles: {
        Row: {
          created_at: string
          id: string
          name: string
          permission_scope: string
          rank_order: number
        }
        Insert: {
          created_at?: string
          id?: string
          name: string
          permission_scope: string
          rank_order?: number
        }
        Update: {
          created_at?: string
          id?: string
          name?: string
          permission_scope?: string
          rank_order?: number
        }
        Relationships: []
      }
      schedule_events: {
        Row: {
          created_at: string
          created_by: string | null
          description: string | null
          end_at: string | null
          id: string
          is_active: boolean
          location: string | null
          season_id: string | null
          start_at: string
          title: string
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          description?: string | null
          end_at?: string | null
          id?: string
          is_active?: boolean
          location?: string | null
          season_id?: string | null
          start_at: string
          title: string
        }
        Update: {
          created_at?: string
          created_by?: string | null
          description?: string | null
          end_at?: string | null
          id?: string
          is_active?: boolean
          location?: string | null
          season_id?: string | null
          start_at?: string
          title?: string
        }
        Relationships: [
          {
            foreignKeyName: "schedule_events_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "member_score_summary"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "schedule_events_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "members"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "schedule_events_season_id_fkey"
            columns: ["season_id"]
            isOneToOne: false
            referencedRelation: "seasons"
            referencedColumns: ["id"]
          },
        ]
      }
      seasons: {
        Row: {
          created_at: string
          end_date: string | null
          id: string
          name: string
          start_date: string
          status: Database["public"]["Enums"]["season_status"]
        }
        Insert: {
          created_at?: string
          end_date?: string | null
          id?: string
          name: string
          start_date: string
          status?: Database["public"]["Enums"]["season_status"]
        }
        Update: {
          created_at?: string
          end_date?: string | null
          id?: string
          name?: string
          start_date?: string
          status?: Database["public"]["Enums"]["season_status"]
        }
        Relationships: []
      }
      site_banners: {
        Row: {
          created_at: string
          created_by: string | null
          display_order: number
          id: string
          image_url: string
          is_active: boolean
          title: string | null
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          display_order?: number
          id?: string
          image_url: string
          is_active?: boolean
          title?: string | null
        }
        Update: {
          created_at?: string
          created_by?: string | null
          display_order?: number
          id?: string
          image_url?: string
          is_active?: boolean
          title?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "site_banners_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "member_score_summary"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "site_banners_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "members"
            referencedColumns: ["id"]
          },
        ]
      }
      teams: {
        Row: {
          created_at: string
          id: string
          is_active: boolean
          name: string
          type: Database["public"]["Enums"]["team_type"]
        }
        Insert: {
          created_at?: string
          id?: string
          is_active?: boolean
          name: string
          type?: Database["public"]["Enums"]["team_type"]
        }
        Update: {
          created_at?: string
          id?: string
          is_active?: boolean
          name?: string
          type?: Database["public"]["Enums"]["team_type"]
        }
        Relationships: []
      }
      user_profiles: {
        Row: {
          app_role: string
          created_at: string
          display_name: string | null
          email: string
          id: string
          is_active: boolean
          member_id: string | null
          updated_at: string
        }
        Insert: {
          app_role?: string
          created_at?: string
          display_name?: string | null
          email: string
          id: string
          is_active?: boolean
          member_id?: string | null
          updated_at?: string
        }
        Update: {
          app_role?: string
          created_at?: string
          display_name?: string | null
          email?: string
          id?: string
          is_active?: boolean
          member_id?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "user_profiles_member_id_fkey"
            columns: ["member_id"]
            isOneToOne: false
            referencedRelation: "member_score_summary"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "user_profiles_member_id_fkey"
            columns: ["member_id"]
            isOneToOne: false
            referencedRelation: "members"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      activity_log_feed: {
        Row: {
          category_id: string | null
          id: string | null
          member_id: string | null
          point_delta: number | null
          reason: string | null
          timestamp: string | null
        }
        Insert: {
          category_id?: string | null
          id?: string | null
          member_id?: string | null
          point_delta?: number | null
          reason?: string | null
          timestamp?: string | null
        }
        Update: {
          category_id?: string | null
          id?: string | null
          member_id?: string | null
          point_delta?: number | null
          reason?: string | null
          timestamp?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "point_ledgers_member_id_fkey"
            columns: ["member_id"]
            isOneToOne: false
            referencedRelation: "member_score_summary"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "point_ledgers_member_id_fkey"
            columns: ["member_id"]
            isOneToOne: false
            referencedRelation: "members"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "point_ledgers_point_rule_id_fkey"
            columns: ["category_id"]
            isOneToOne: false
            referencedRelation: "point_rule_catalog"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "point_ledgers_point_rule_id_fkey"
            columns: ["category_id"]
            isOneToOne: false
            referencedRelation: "point_rules"
            referencedColumns: ["id"]
          },
        ]
      }
      member_score_summary: {
        Row: {
          id: string | null
          is_approved: boolean | null
          name: string | null
          score: number | null
        }
        Relationships: []
      }
      point_rule_catalog: {
        Row: {
          activity_type_id: string | null
          category_name: string | null
          condition_json: Json | null
          group_name: string | null
          id: string | null
          is_active: boolean | null
          penalty_point: number | null
          point_value: number | null
          version: number | null
        }
        Relationships: [
          {
            foreignKeyName: "point_rules_activity_type_id_fkey"
            columns: ["activity_type_id"]
            isOneToOne: false
            referencedRelation: "activity_types"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Functions: {
      admin_adjust_member_points: {
        Args: {
          p_delta: number
          p_member_id: string
          p_reason: string
        }
        Returns: string
      }
      admin_adjust_member_points_bulk: {
        Args: {
          p_delta: number
          p_member_ids: string[]
          p_reason: string
        }
        Returns: string[]
      }
      award_member_badges: { Args: { p_member_id?: string }; Returns: number }
      badge_criteria_met: {
        Args: { p_criteria: Json; p_metrics: Json }
        Returns: boolean
      }
      can_access_member: { Args: { p_member_id: string }; Returns: boolean }
      can_manage_activities: { Args: never; Returns: boolean }
      can_manage_admin_tables: { Args: never; Returns: boolean }
      community_list_member_names: {
        Args: never
        Returns: {
          id: string
          name: string
        }[]
      }
      community_moderate_comment: {
        Args: { p_comment_id: string; p_hide: boolean }
        Returns: undefined
      }
      community_moderate_post: {
        Args: { p_hide: boolean; p_post_id: string; p_reason?: string }
        Returns: undefined
      }
      community_pin_post: {
        Args: { p_pinned: boolean; p_post_id: string }
        Returns: undefined
      }
      community_purge_hidden_after: {
        Args: { p_days?: number }
        Returns: {
          deleted_comments: number
          deleted_posts: number
        }[]
      }
      complete_my_password_setup: { Args: never; Returns: undefined }
      create_activity_entry:
        | {
            Args: {
              p_member_id: string
              p_note?: string
              p_occurred_at?: string
              p_point_rule_id: string
              p_reason?: string
            }
            Returns: string
          }
        | {
            Args: {
              p_evidence_url?: string
              p_member_id: string
              p_note?: string
              p_occurred_at?: string
              p_point_rule_id: string
              p_reason?: string
            }
            Returns: string
          }
      create_audit_log: {
        Args: {
          p_action: string
          p_diff_json?: Json
          p_entity_id: string
          p_entity_type: string
        }
        Returns: string
      }
      create_batch_activity_entries:
        | {
            Args: {
              p_member_ids: string[]
              p_note?: string
              p_occurred_at?: string
              p_point_rule_id: string
              p_reason?: string
            }
            Returns: string[]
          }
        | {
            Args: {
              p_evidence_url?: string
              p_member_ids: string[]
              p_note?: string
              p_occurred_at?: string
              p_point_rule_id: string
              p_reason?: string
            }
            Returns: string[]
          }
      create_point_rule_version: {
        Args: {
          p_base_point: number
          p_condition_json?: Json
          p_penalty_point?: number
          p_source_rule_id: string
        }
        Returns: string
      }
      current_actor_member_id: { Args: never; Returns: string }
      current_app_role: { Args: never; Returns: string }
      delete_team: { Args: { p_team_id: string }; Returns: Json }
      get_member_badge_metrics: {
        Args: { p_member_id: string; p_scope?: string; p_season_id?: string }
        Returns: Json
      }
      get_member_team_ids: { Args: { p_member_id: string }; Returns: string[] }
      get_my_activity_logs: {
        Args: never
        Returns: {
          category_id: string
          category_name: string
          evidence_url: string
          id: string
          is_reversal: boolean
          member_id: string
          member_name: string
          note: string
          point_delta: number
          reason: string
          record_id: string
          record_status: string
          reversal_of: string
          timestamp: string
        }[]
      }
      get_my_member_badges: {
        Args: never
        Returns: {
          awarded_at: string
          badge_code: string
          badge_description: string
          badge_id: string
          badge_name: string
          criteria_json: Json
          evaluation_scope: string
          icon_key: string
          id: string
          image_url: string
          member_id: string
          season_id: string
          tone: string
        }[]
      }
      get_my_member_overview: {
        Args: never
        Returns: {
          auth_provisioned_at: string
          auth_user_id: string
          id: string
          is_approved: boolean
          is_visible: boolean
          joined_at: string
          name: string
          password_reset_required: boolean
          role_id: string
          role_name: string
          score: number
          status: Database["public"]["Enums"]["member_status"]
          team_id: string
          team_name: string
        }[]
      }
      is_registered_login_email: { Args: { p_email: string }; Returns: boolean }
      member_role_scope: { Args: { p_role_id: string }; Returns: string }
      member_team_id: { Args: { p_member_id: string }; Returns: string }
      recalculate_member_primary_team: {
        Args: { p_member_id: string }
        Returns: string
      }
      refresh_all_member_badges: { Args: never; Returns: number }
      refresh_member_badges_for_members: {
        Args: { p_member_ids: string[] }
        Returns: number
      }
      replace_team_members: {
        Args: { p_member_ids: string[]; p_team_id: string }
        Returns: Json
      }
      reset_activity_data_current_season: { Args: never; Returns: Json }
      reset_attendance_data_current_season: { Args: never; Returns: Json }
      reset_manual_activity_data_current_season: { Args: never; Returns: Json }
      reverse_activity_entry: {
        Args: { p_note?: string; p_record_id: string }
        Returns: string
      }
      submit_correction_request: {
        Args: { p_reason: string; p_record_id: string }
        Returns: string
      }
      swap_banner_display_order: {
        Args: { p_first_banner_id: string; p_second_banner_id: string }
        Returns: undefined
      }
      sync_my_profile: {
        Args: never
        Returns: {
          app_role: string
          display_name: string
          email: string
          id: string
          is_active: boolean
          member_id: string
          must_reset_password: boolean
        }[]
      }
      update_correction_request_status: {
        Args: {
          p_request_id: string
          p_review_note?: string
          p_status: Database["public"]["Enums"]["correction_request_status"]
        }
        Returns: string
      }
      upsert_user_profile_from_identity: {
        Args: { p_display_name?: string; p_email: string; p_user_id: string }
        Returns: {
          app_role: string
          display_name: string
          email: string
          id: string
          is_active: boolean
          member_id: string
          must_reset_password: boolean
        }[]
      }
    }
    Enums: {
      correction_request_status:
        | "pending"
        | "reviewing"
        | "resolved"
        | "rejected"
      member_status: "active" | "dormant" | "inactive"
      season_status: "planned" | "active" | "closed"
      team_type: "core" | "study" | "project"
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
    Enums: {
      correction_request_status: [
        "pending",
        "reviewing",
        "resolved",
        "rejected",
      ],
      member_status: ["active", "dormant", "inactive"],
      season_status: ["planned", "active", "closed"],
      team_type: ["core", "study", "project"],
    },
  },
} as const

