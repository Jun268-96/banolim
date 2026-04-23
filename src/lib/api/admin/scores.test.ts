import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const rpcMock = vi.fn();

vi.mock('../../supabase', () => ({
    isSupabaseConfigured: true,
}));

vi.mock('../shared/client', () => ({
    getSupabaseClient: () => ({
        rpc: rpcMock,
    }),
}));

import {
    adjustMemberScore,
    adjustMemberScoreBulk,
    SCORE_ADJUSTMENT_LIMITS,
    ScoreAdjustmentError,
} from './scores';

const validMemberId = '00000000-0000-0000-0000-000000000001';
const validReason = '월간 보너스';

describe('adjustMemberScore — 유효성 검증', () => {
    beforeEach(() => {
        rpcMock.mockReset();
    });

    afterEach(() => {
        expect(rpcMock).not.toHaveBeenCalledWith(
            'admin_adjust_member_points',
            expect.objectContaining({ p_delta: 0 }),
        );
    });

    it('delta 가 0 이면 에러를 던진다', async () => {
        await expect(adjustMemberScore(validMemberId, 0, validReason)).rejects.toBeInstanceOf(ScoreAdjustmentError);
    });

    it('delta 가 최대값을 초과하면 에러를 던진다', async () => {
        await expect(
            adjustMemberScore(validMemberId, SCORE_ADJUSTMENT_LIMITS.maxDelta + 1, validReason),
        ).rejects.toBeInstanceOf(ScoreAdjustmentError);
    });

    it('delta 가 최소값 미만이면 에러를 던진다', async () => {
        await expect(
            adjustMemberScore(validMemberId, SCORE_ADJUSTMENT_LIMITS.minDelta - 1, validReason),
        ).rejects.toBeInstanceOf(ScoreAdjustmentError);
    });

    it('정수가 아닌 delta 는 에러를 던진다', async () => {
        await expect(adjustMemberScore(validMemberId, 5.5, validReason)).rejects.toBeInstanceOf(ScoreAdjustmentError);
    });

    it('사유가 너무 짧으면 에러를 던진다', async () => {
        await expect(adjustMemberScore(validMemberId, 5, 'a')).rejects.toBeInstanceOf(ScoreAdjustmentError);
    });

    it('공백만 있는 사유는 에러를 던진다', async () => {
        await expect(adjustMemberScore(validMemberId, 5, '   ')).rejects.toBeInstanceOf(ScoreAdjustmentError);
    });
});

describe('adjustMemberScore — RPC 호출', () => {
    beforeEach(() => {
        rpcMock.mockReset();
    });

    it('유효한 입력이면 RPC 를 호출하고 record_id 를 반환한다', async () => {
        rpcMock.mockResolvedValueOnce({ data: 'record-uuid', error: null });
        const result = await adjustMemberScore(validMemberId, 10, validReason);
        expect(result).toBe('record-uuid');
        expect(rpcMock).toHaveBeenCalledWith('admin_adjust_member_points', {
            p_member_id: validMemberId,
            p_delta: 10,
            p_reason: validReason,
        });
    });

    it('사유의 양끝 공백을 제거하여 RPC 에 전달한다', async () => {
        rpcMock.mockResolvedValueOnce({ data: 'record-uuid', error: null });
        await adjustMemberScore(validMemberId, -5, '  지각 누적  ');
        expect(rpcMock).toHaveBeenCalledWith('admin_adjust_member_points', expect.objectContaining({
            p_reason: '지각 누적',
        }));
    });

    it('RPC 에러는 ScoreAdjustmentError 로 래핑된다', async () => {
        rpcMock.mockResolvedValueOnce({ data: null, error: { message: '권한이 없습니다.' } });
        await expect(adjustMemberScore(validMemberId, 10, validReason)).rejects.toBeInstanceOf(ScoreAdjustmentError);
    });
});

describe('adjustMemberScoreBulk', () => {
    beforeEach(() => {
        rpcMock.mockReset();
    });

    it('빈 배열이면 에러를 던진다', async () => {
        await expect(adjustMemberScoreBulk([], 5, validReason)).rejects.toBeInstanceOf(ScoreAdjustmentError);
    });

    it('200명 초과면 에러를 던진다', async () => {
        const ids = Array.from({ length: 201 }, (_, i) => `00000000-0000-0000-0000-${String(i).padStart(12, '0')}`);
        await expect(adjustMemberScoreBulk(ids, 5, validReason)).rejects.toBeInstanceOf(ScoreAdjustmentError);
    });

    it('유효한 입력이면 RPC 를 호출하고 record_id 배열을 반환한다', async () => {
        rpcMock.mockResolvedValueOnce({ data: ['r1', 'r2'], error: null });
        const result = await adjustMemberScoreBulk([validMemberId, '00000000-0000-0000-0000-000000000002'], 10, validReason);
        expect(result).toEqual(['r1', 'r2']);
        expect(rpcMock).toHaveBeenCalledWith('admin_adjust_member_points_bulk', expect.objectContaining({
            p_delta: 10,
            p_reason: validReason,
        }));
    });

    it('data 가 null 이면 빈 배열을 반환한다', async () => {
        rpcMock.mockResolvedValueOnce({ data: null, error: null });
        const result = await adjustMemberScoreBulk([validMemberId], 10, validReason);
        expect(result).toEqual([]);
    });
});
