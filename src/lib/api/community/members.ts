import { isSupabaseConfigured } from '../../supabase';
import { getSupabaseClient } from '../shared/client';
import { getErrorMessage } from '../shared/errors';
import { localState } from '../shared/localState';

export interface CommunityMemberSummary {
    id: string;
    name: string;
}

export const listCommunityMembers = async (): Promise<CommunityMemberSummary[]> => {
    if (!isSupabaseConfigured) {
        return localState.members.map((m) => ({ id: m.id, name: m.name }));
    }
    const supabase = getSupabaseClient();
    const { data, error } = await supabase.rpc('community_list_member_names');
    if (error) throw new Error(getErrorMessage(error));
    return (data ?? []).map((row) => ({ id: row.id, name: row.name }));
};
