import { isSupabaseConfigured } from '../../supabase';
import { getSupabaseClient } from '../shared/client';

const MIN_DELTA = -100;
const MAX_DELTA = 100;
const MIN_REASON_LENGTH = 2;

export class ScoreAdjustmentError extends Error {
    public readonly cause?: unknown;

    constructor(message: string, cause?: unknown) {
        super(message);
        this.name = 'ScoreAdjustmentError';
        this.cause = cause;
    }
}

const validateDelta = (delta: number) => {
    if (!Number.isFinite(delta) || !Number.isInteger(delta)) {
        throw new ScoreAdjustmentError('점수 변화량은 정수여야 합니다.');
    }
    if (delta === 0) {
        throw new ScoreAdjustmentError('점수 변화량은 0이 될 수 없습니다.');
    }
    if (delta < MIN_DELTA || delta > MAX_DELTA) {
        throw new ScoreAdjustmentError(`한 번에 조정 가능한 점수는 ${MIN_DELTA} ~ +${MAX_DELTA} 범위입니다.`);
    }
};

const validateReason = (reason: string) => {
    const trimmed = reason.trim();
    if (trimmed.length < MIN_REASON_LENGTH) {
        throw new ScoreAdjustmentError(`사유는 ${MIN_REASON_LENGTH}자 이상 입력해야 합니다.`);
    }
    return trimmed;
};

export const adjustMemberScore = async (
    memberId: string,
    delta: number,
    reason: string,
): Promise<string> => {
    validateDelta(delta);
    const trimmedReason = validateReason(reason);

    if (!isSupabaseConfigured) {
        throw new ScoreAdjustmentError('Supabase 설정이 없는 환경에서는 점수를 조정할 수 없습니다.');
    }

    const client = getSupabaseClient();
    const { data, error } = await client.rpc('admin_adjust_member_points', {
        p_member_id: memberId,
        p_delta: delta,
        p_reason: trimmedReason,
    });

    if (error) {
        throw new ScoreAdjustmentError(error.message || '점수 조정 요청이 실패했습니다.', error);
    }

    return data as string;
};

export const adjustMemberScoreBulk = async (
    memberIds: string[],
    delta: number,
    reason: string,
): Promise<string[]> => {
    if (memberIds.length === 0) {
        throw new ScoreAdjustmentError('대상 멤버가 선택되지 않았습니다.');
    }
    if (memberIds.length > 200) {
        throw new ScoreAdjustmentError('한 번에 조정할 수 있는 멤버 수는 200명 이하입니다.');
    }

    validateDelta(delta);
    const trimmedReason = validateReason(reason);

    if (!isSupabaseConfigured) {
        throw new ScoreAdjustmentError('Supabase 설정이 없는 환경에서는 점수를 조정할 수 없습니다.');
    }

    const client = getSupabaseClient();
    const { data, error } = await client.rpc('admin_adjust_member_points_bulk', {
        p_member_ids: memberIds,
        p_delta: delta,
        p_reason: trimmedReason,
    });

    if (error) {
        throw new ScoreAdjustmentError(error.message || '벌크 점수 조정 요청이 실패했습니다.', error);
    }

    return (data as string[]) ?? [];
};

export const SCORE_ADJUSTMENT_LIMITS = {
    minDelta: MIN_DELTA,
    maxDelta: MAX_DELTA,
    minReasonLength: MIN_REASON_LENGTH,
} as const;
