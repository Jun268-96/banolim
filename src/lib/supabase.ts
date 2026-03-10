import { createClient } from '@supabase/supabase-js';
import type { Database } from '../types/database';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL?.trim();
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY?.trim();
const bypassAuthValue = import.meta.env.VITE_BYPASS_AUTH?.trim().toLowerCase();
const hasSupabaseCredentials = Boolean(supabaseUrl && supabaseAnonKey);

export const isAuthBypassed = bypassAuthValue === 'true';
export const isSupabaseConfigured = hasSupabaseCredentials && !isAuthBypassed;

export const supabase = isSupabaseConfigured
    ? createClient<Database>(supabaseUrl!, supabaseAnonKey!, {
        auth: {
            autoRefreshToken: true,
            persistSession: true,
        },
    })
    : null;
