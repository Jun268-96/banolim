export type Json =
    | string
    | number
    | boolean
    | null
    | { [key: string]: Json | undefined }
    | Json[];

export interface Database {
    public: {
        Tables: {
            roles: {
                Row: {
                    id: string;
                    name: string;
                    permission_scope: string;
                    rank_order: number;
                    created_at: string;
                };
                Insert: {
                    id?: string;
                    name: string;
                    permission_scope: string;
                    rank_order?: number;
                    created_at?: string;
                };
                Update: {
                    id?: string;
                    name?: string;
                    permission_scope?: string;
                    rank_order?: number;
                    created_at?: string;
                };
                Relationships: [];
            };
            teams: {
                Row: {
                    id: string;
                    name: string;
                    type: Database['public']['Enums']['team_type'];
                    is_active: boolean;
                    created_at: string;
                };
                Insert: {
                    id?: string;
                    name: string;
                    type?: Database['public']['Enums']['team_type'];
                    is_active?: boolean;
                    created_at?: string;
                };
                Update: {
                    id?: string;
                    name?: string;
                    type?: Database['public']['Enums']['team_type'];
                    is_active?: boolean;
                    created_at?: string;
                };
                Relationships: [];
            };
            seasons: {
                Row: {
                    id: string;
                    name: string;
                    start_date: string;
                    end_date: string | null;
                    status: Database['public']['Enums']['season_status'];
                    created_at: string;
                };
                Insert: {
                    id?: string;
                    name: string;
                    start_date: string;
                    end_date?: string | null;
                    status?: Database['public']['Enums']['season_status'];
                    created_at?: string;
                };
                Update: {
                    id?: string;
                    name?: string;
                    start_date?: string;
                    end_date?: string | null;
                    status?: Database['public']['Enums']['season_status'];
                    created_at?: string;
                };
                Relationships: [];
            };
            members: {
                Row: {
                    id: string;
                    name: string;
                    role_id: string | null;
                    team_id: string | null;
                    status: Database['public']['Enums']['member_status'];
                    joined_at: string;
                    avatar_key: string | null;
                    is_visible: boolean;
                    is_approved: boolean;
                    created_at: string;
                };
                Insert: {
                    id?: string;
                    name: string;
                    role_id?: string | null;
                    team_id?: string | null;
                    status?: Database['public']['Enums']['member_status'];
                    joined_at?: string;
                    avatar_key?: string | null;
                    is_visible?: boolean;
                    is_approved?: boolean;
                    created_at?: string;
                };
                Update: {
                    id?: string;
                    name?: string;
                    role_id?: string | null;
                    team_id?: string | null;
                    status?: Database['public']['Enums']['member_status'];
                    joined_at?: string;
                    avatar_key?: string | null;
                    is_visible?: boolean;
                    is_approved?: boolean;
                    created_at?: string;
                };
                Relationships: [];
            };
            activity_types: {
                Row: {
                    id: string;
                    code: string;
                    name: string;
                    group_name: string;
                    created_at: string;
                };
                Insert: {
                    id?: string;
                    code: string;
                    name: string;
                    group_name?: string;
                    created_at?: string;
                };
                Update: {
                    id?: string;
                    code?: string;
                    name?: string;
                    group_name?: string;
                    created_at?: string;
                };
                Relationships: [];
            };
            point_rules: {
                Row: {
                    id: string;
                    activity_type_id: string;
                    base_point: number;
                    penalty_point: number;
                    condition_json: Json;
                    is_active: boolean;
                    version: number;
                    created_at: string;
                };
                Insert: {
                    id?: string;
                    activity_type_id: string;
                    base_point: number;
                    penalty_point?: number;
                    condition_json?: Json;
                    is_active?: boolean;
                    version?: number;
                    created_at?: string;
                };
                Update: {
                    id?: string;
                    activity_type_id?: string;
                    base_point?: number;
                    penalty_point?: number;
                    condition_json?: Json;
                    is_active?: boolean;
                    version?: number;
                    created_at?: string;
                };
                Relationships: [];
            };
            activity_records: {
                Row: {
                    id: string;
                    member_id: string;
                    season_id: string | null;
                    activity_type_id: string;
                    occurred_at: string;
                    status: string;
                    note: string | null;
                    created_by: string | null;
                    created_at: string;
                };
                Insert: {
                    id?: string;
                    member_id: string;
                    season_id?: string | null;
                    activity_type_id: string;
                    occurred_at?: string;
                    status?: string;
                    note?: string | null;
                    created_by?: string | null;
                    created_at?: string;
                };
                Update: {
                    id?: string;
                    member_id?: string;
                    season_id?: string | null;
                    activity_type_id?: string;
                    occurred_at?: string;
                    status?: string;
                    note?: string | null;
                    created_by?: string | null;
                    created_at?: string;
                };
                Relationships: [];
            };
            point_ledgers: {
                Row: {
                    id: string;
                    record_id: string;
                    member_id: string;
                    point_rule_id: string;
                    delta: number;
                    reason: string | null;
                    created_by: string | null;
                    reversal_of: string | null;
                    created_at: string;
                };
                Insert: {
                    id?: string;
                    record_id: string;
                    member_id: string;
                    point_rule_id: string;
                    delta: number;
                    reason?: string | null;
                    created_by?: string | null;
                    reversal_of?: string | null;
                    created_at?: string;
                };
                Update: {
                    id?: string;
                    record_id?: string;
                    member_id?: string;
                    point_rule_id?: string;
                    delta?: number;
                    reason?: string | null;
                    created_by?: string | null;
                    reversal_of?: string | null;
                    created_at?: string;
                };
                Relationships: [];
            };
            user_profiles: {
                Row: {
                    id: string;
                    email: string;
                    member_id: string | null;
                    app_role: string;
                    display_name: string | null;
                    is_active: boolean;
                    created_at: string;
                    updated_at: string;
                };
                Insert: {
                    id: string;
                    email: string;
                    member_id?: string | null;
                    app_role?: string;
                    display_name?: string | null;
                    is_active?: boolean;
                    created_at?: string;
                    updated_at?: string;
                };
                Update: {
                    id?: string;
                    email?: string;
                    member_id?: string | null;
                    app_role?: string;
                    display_name?: string | null;
                    is_active?: boolean;
                    created_at?: string;
                    updated_at?: string;
                };
                Relationships: [];
            };
        };
        Views: {
            member_score_summary: {
                Row: {
                    id: string;
                    name: string;
                    is_approved: boolean;
                    score: number;
                };
                Relationships: [];
            };
            point_rule_catalog: {
                Row: {
                    id: string;
                    activity_type_id: string;
                    category_name: string;
                    point_value: number;
                    is_active: boolean;
                    version: number;
                };
                Relationships: [];
            };
            activity_log_feed: {
                Row: {
                    id: string;
                    timestamp: string;
                    member_id: string;
                    category_id: string;
                    point_delta: number;
                    reason: string | null;
                };
                Relationships: [];
            };
        };
        Functions: Record<string, never>;
        Enums: {
            member_status: 'active' | 'dormant' | 'inactive';
            team_type: 'core' | 'study' | 'project';
            season_status: 'planned' | 'active' | 'closed';
        };
        CompositeTypes: Record<string, never>;
    };
}
