import { supabase } from '../../supabase';

export const getSupabaseClient = () => {
    if (!supabase) {
        throw new Error('Supabase 클라이언트가 설정되지 않았습니다.');
    }

    return supabase;
};
