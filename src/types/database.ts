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
            member_team_links: {
                Row: {
                    id: string;
                    member_id: string;
                    team_id: string;
                    created_at: string;
                };
                Insert: {
                    id?: string;
                    member_id: string;
                    team_id: string;
                    created_at?: string;
                };
                Update: {
                    id?: string;
                    member_id?: string;
                    team_id?: string;
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
                    auth_provisioned_at: string | null;
                    auth_user_id: string | null;
                    id: string;
                    name: string;
                    login_email: string | null;
                    password_reset_required: boolean;
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
                    auth_provisioned_at?: string | null;
                    auth_user_id?: string | null;
                    id?: string;
                    name: string;
                    login_email?: string | null;
                    password_reset_required?: boolean;
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
                    auth_provisioned_at?: string | null;
                    auth_user_id?: string | null;
                    id?: string;
                    name?: string;
                    login_email?: string | null;
                    password_reset_required?: boolean;
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
            activity_groups: {
                Row: {
                    code: string;
                    name: string;
                    sort_order: number;
                    is_active: boolean;
                    created_at: string;
                };
                Insert: {
                    code: string;
                    name: string;
                    sort_order?: number;
                    is_active?: boolean;
                    created_at?: string;
                };
                Update: {
                    code?: string;
                    name?: string;
                    sort_order?: number;
                    is_active?: boolean;
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
                    evidence_url: string | null;
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
                    evidence_url?: string | null;
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
                    evidence_url?: string | null;
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
            audit_logs: {
                Row: {
                    id: string;
                    actor_id: string | null;
                    entity_type: string;
                    entity_id: string;
                    action: string;
                    diff_json: Json;
                    created_at: string;
                };
                Insert: {
                    id?: string;
                    actor_id?: string | null;
                    entity_type: string;
                    entity_id: string;
                    action: string;
                    diff_json?: Json;
                    created_at?: string;
                };
                Update: {
                    id?: string;
                    actor_id?: string | null;
                    entity_type?: string;
                    entity_id?: string;
                    action?: string;
                    diff_json?: Json;
                    created_at?: string;
                };
                Relationships: [];
            };
            correction_requests: {
                Row: {
                    id: string;
                    requester_member_id: string;
                    activity_record_id: string;
                    status: Database['public']['Enums']['correction_request_status'];
                    reason: string;
                    review_note: string | null;
                    reviewed_by: string | null;
                    reviewed_at: string | null;
                    created_at: string;
                    updated_at: string;
                };
                Insert: {
                    id?: string;
                    requester_member_id: string;
                    activity_record_id: string;
                    status?: Database['public']['Enums']['correction_request_status'];
                    reason: string;
                    review_note?: string | null;
                    reviewed_by?: string | null;
                    reviewed_at?: string | null;
                    created_at?: string;
                    updated_at?: string;
                };
                Update: {
                    id?: string;
                    requester_member_id?: string;
                    activity_record_id?: string;
                    status?: Database['public']['Enums']['correction_request_status'];
                    reason?: string;
                    review_note?: string | null;
                    reviewed_by?: string | null;
                    reviewed_at?: string | null;
                    created_at?: string;
                    updated_at?: string;
                };
                Relationships: [];
            };
            badges: {
                Row: {
                    id: string;
                    code: string;
                    name: string;
                    description: string;
                    icon_key: string;
                    tone: string;
                    sort_order: number;
                    is_active: boolean;
                    created_at: string;
                };
                Insert: {
                    id?: string;
                    code: string;
                    name: string;
                    description: string;
                    icon_key: string;
                    tone?: string;
                    sort_order?: number;
                    is_active?: boolean;
                    created_at?: string;
                };
                Update: {
                    id?: string;
                    code?: string;
                    name?: string;
                    description?: string;
                    icon_key?: string;
                    tone?: string;
                    sort_order?: number;
                    is_active?: boolean;
                    created_at?: string;
                };
                Relationships: [];
            };
            member_badges: {
                Row: {
                    id: string;
                    member_id: string;
                    badge_id: string;
                    awarded_at: string;
                    season_id: string | null;
                };
                Insert: {
                    id?: string;
                    member_id: string;
                    badge_id: string;
                    awarded_at?: string;
                    season_id?: string | null;
                };
                Update: {
                    id?: string;
                    member_id?: string;
                    badge_id?: string;
                    awarded_at?: string;
                    season_id?: string | null;
                };
                Relationships: [];
            };
            announcements: {
                Row: {
                    id: string;
                    title: string;
                    body: string;
                    starts_at: string | null;
                    ends_at: string | null;
                    is_pinned: boolean;
                    is_active: boolean;
                    created_by: string | null;
                    created_at: string;
                };
                Insert: {
                    id?: string;
                    title: string;
                    body: string;
                    starts_at?: string | null;
                    ends_at?: string | null;
                    is_pinned?: boolean;
                    is_active?: boolean;
                    created_by?: string | null;
                    created_at?: string;
                };
                Update: {
                    id?: string;
                    title?: string;
                    body?: string;
                    starts_at?: string | null;
                    ends_at?: string | null;
                    is_pinned?: boolean;
                    is_active?: boolean;
                    created_by?: string | null;
                    created_at?: string;
                };
                Relationships: [];
            };
            schedule_events: {
                Row: {
                    id: string;
                    title: string;
                    description: string | null;
                    location: string | null;
                    start_at: string;
                    end_at: string | null;
                    season_id: string | null;
                    is_active: boolean;
                    created_by: string | null;
                    created_at: string;
                };
                Insert: {
                    id?: string;
                    title: string;
                    description?: string | null;
                    location?: string | null;
                    start_at: string;
                    end_at?: string | null;
                    season_id?: string | null;
                    is_active?: boolean;
                    created_by?: string | null;
                    created_at?: string;
                };
                Update: {
                    id?: string;
                    title?: string;
                    description?: string | null;
                    location?: string | null;
                    start_at?: string;
                    end_at?: string | null;
                    season_id?: string | null;
                    is_active?: boolean;
                    created_by?: string | null;
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
            recap_snapshots: {
                Row: {
                    id: string;
                    snapshot_scope: string;
                    period_type: string;
                    title: string;
                    subtitle: string;
                    summary: string;
                    badge_label: string;
                    note: string;
                    starts_at: string;
                    ends_at: string;
                    member_id: string | null;
                    member_name: string | null;
                    season_id: string | null;
                    payload: Json;
                    created_by: string | null;
                    created_at: string;
                };
                Insert: {
                    id?: string;
                    snapshot_scope: string;
                    period_type: string;
                    title: string;
                    subtitle: string;
                    summary: string;
                    badge_label: string;
                    note: string;
                    starts_at: string;
                    ends_at: string;
                    member_id?: string | null;
                    member_name?: string | null;
                    season_id?: string | null;
                    payload?: Json;
                    created_by?: string | null;
                    created_at?: string;
                };
                Update: {
                    id?: string;
                    snapshot_scope?: string;
                    period_type?: string;
                    title?: string;
                    subtitle?: string;
                    summary?: string;
                    badge_label?: string;
                    note?: string;
                    starts_at?: string;
                    ends_at?: string;
                    member_id?: string | null;
                    member_name?: string | null;
                    season_id?: string | null;
                    payload?: Json;
                    created_by?: string | null;
                    created_at?: string;
                };
                Relationships: [];
            };
            attendance_sessions: {
                Row: {
                    id: string;
                    title: string;
                    session_code: string;
                    point_rule_id: string;
                    season_id: string | null;
                    starts_at: string;
                    ends_at: string | null;
                    note: string | null;
                    is_active: boolean;
                    target_group_type: string;
                    target_team_id: string | null;
                    created_by: string | null;
                    created_at: string;
                };
                Insert: {
                    id?: string;
                    title: string;
                    session_code: string;
                    point_rule_id: string;
                    season_id?: string | null;
                    starts_at: string;
                    ends_at?: string | null;
                    note?: string | null;
                    is_active?: boolean;
                    target_group_type?: string;
                    target_team_id?: string | null;
                    created_by?: string | null;
                    created_at?: string;
                };
                Update: {
                    id?: string;
                    title?: string;
                    session_code?: string;
                    point_rule_id?: string;
                    season_id?: string | null;
                    starts_at?: string;
                    ends_at?: string | null;
                    note?: string | null;
                    is_active?: boolean;
                    target_group_type?: string;
                    target_team_id?: string | null;
                    created_by?: string | null;
                    created_at?: string;
                };
                Relationships: [];
            };
            attendance_session_members: {
                Row: {
                    id: string;
                    session_id: string;
                    member_id: string;
                    attendance_status: string;
                    activity_record_id: string | null;
                    created_at: string;
                    updated_at: string;
                };
                Insert: {
                    id?: string;
                    session_id: string;
                    member_id: string;
                    attendance_status?: string;
                    activity_record_id?: string | null;
                    created_at?: string;
                    updated_at?: string;
                };
                Update: {
                    id?: string;
                    session_id?: string;
                    member_id?: string;
                    attendance_status?: string;
                    activity_record_id?: string | null;
                    created_at?: string;
                    updated_at?: string;
                };
                Relationships: [];
            };
            attendance_checkins: {
                Row: {
                    id: string;
                    session_id: string;
                    member_id: string;
                    activity_record_id: string;
                    point_ledger_id: string;
                    checked_in_at: string;
                };
                Insert: {
                    id?: string;
                    session_id: string;
                    member_id: string;
                    activity_record_id: string;
                    point_ledger_id: string;
                    checked_in_at?: string;
                };
                Update: {
                    id?: string;
                    session_id?: string;
                    member_id?: string;
                    activity_record_id?: string;
                    point_ledger_id?: string;
                    checked_in_at?: string;
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
                    group_name: string;
                    point_value: number;
                    penalty_point: number;
                    condition_json: Json;
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
        Functions: {
            create_activity_entry: {
                Args: {
                    p_evidence_url?: string | null;
                    p_member_id: string;
                    p_note?: string | null;
                    p_occurred_at?: string | null;
                    p_point_rule_id: string;
                    p_reason?: string | null;
                };
                Returns: string;
            };
            create_batch_activity_entries: {
                Args: {
                    p_evidence_url?: string | null;
                    p_member_ids: string[];
                    p_note?: string | null;
                    p_occurred_at?: string | null;
                    p_point_rule_id: string;
                    p_reason?: string | null;
                };
                Returns: string[];
            };
            create_attendance_session: {
                Args: {
                    p_ends_at?: string | null;
                    p_note?: string | null;
                    p_point_rule_id: string;
                    p_starts_at: string;
                    p_title: string;
                };
                Returns: string;
            };
            create_point_rule_version: {
                Args: {
                    p_base_point: number;
                    p_condition_json?: Json;
                    p_penalty_point?: number;
                    p_source_rule_id: string;
                };
                Returns: string;
            };
            complete_my_password_setup: {
                Args: Record<string, never>;
                Returns: undefined;
            };
            is_registered_login_email: {
                Args: {
                    p_email: string;
                };
                Returns: boolean;
            };
            get_my_activity_logs: {
                Args: Record<string, never>;
                Returns: {
                    category_id: string;
                    category_name: string | null;
                    evidence_url: string | null;
                    id: string;
                    is_reversal: boolean;
                    member_id: string;
                    member_name: string | null;
                    note: string | null;
                    point_delta: number;
                    reason: string | null;
                    record_id: string | null;
                    record_status: string | null;
                    reversal_of: string | null;
                    timestamp: string;
                }[];
            };
            get_my_member_overview: {
                Args: Record<string, never>;
                Returns: {
                    id: string;
                    is_approved: boolean;
                    is_visible: boolean;
                    joined_at: string | null;
                    name: string;
                    role_id: string | null;
                    role_name: string | null;
                    score: number;
                    status: Database['public']['Enums']['member_status'];
                    team_id: string | null;
                    team_name: string | null;
                }[];
            };
            get_my_member_badges: {
                Args: Record<string, never>;
                Returns: {
                    awarded_at: string;
                    badge_code: string;
                    badge_description: string;
                    badge_id: string;
                    badge_name: string;
                    icon_key: string;
                    id: string;
                    member_id: string;
                    season_id: string | null;
                    tone: string;
                }[];
            };
            reverse_activity_entry: {
                Args: {
                    p_note?: string | null;
                    p_record_id: string;
                };
                Returns: string;
            };
            submit_correction_request: {
                Args: {
                    p_reason: string;
                    p_record_id: string;
                };
                Returns: string;
            };
            submit_attendance_checkin: {
                Args: {
                    p_session_code: string;
                };
                Returns: string;
            };
            sync_my_profile: {
                Args: Record<string, never>;
                Returns: {
                    app_role: string;
                    display_name: string | null;
                    email: string;
                    id: string;
                    is_active: boolean;
                    member_id: string | null;
                    must_reset_password: boolean;
                }[];
            };
            update_correction_request_status: {
                Args: {
                    p_request_id: string;
                    p_review_note?: string | null;
                    p_status: Database['public']['Enums']['correction_request_status'];
                };
                Returns: string;
            };
        };
        Enums: {
            correction_request_status: 'pending' | 'reviewing' | 'resolved' | 'rejected';
            member_status: 'active' | 'dormant' | 'inactive';
            team_type: 'core' | 'study' | 'project';
            season_status: 'planned' | 'active' | 'closed';
        };
        CompositeTypes: Record<string, never>;
    };
}
