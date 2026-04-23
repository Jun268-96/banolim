import { StrictMode } from 'react';
import { act, renderHook, waitFor } from '@testing-library/react';
import { describe, expect, it, vi, beforeEach } from 'vitest';
import { useCommunityResources } from './useCommunityResources';
import type { CommunityPost, CommunityComment } from '../../../types';

// Mock the API modules
vi.mock('../../../lib/api/community', () => ({
        listPosts: vi.fn(),
        listComments: vi.fn(),
}));

vi.mock('../../../lib/api/admin/members', () => ({
        getMembers: vi.fn(),
}));

import { listPosts, listComments } from '../../../lib/api/community';
import { getMembers } from '../../../lib/api/admin/members';

const mockListPosts = listPosts as ReturnType<typeof vi.fn>;
const mockListComments = listComments as ReturnType<typeof vi.fn>;
const mockGetMembers = getMembers as ReturnType<typeof vi.fn>;

const makePost = (id: string, overrides: Partial<CommunityPost> = {}): CommunityPost => ({
        id,
        authorMemberId: 'member-1',
        title: `제목 ${id}`,
        body: `본문 ${id}`,
        isPinned: false,
        isHidden: false,
        hiddenBy: null,
        hiddenReason: null,
        hiddenAt: null,
        commentCount: 0,
        createdAt: '2026-04-01T00:00:00Z',
        updatedAt: '2026-04-01T00:00:00Z',
        ...overrides,
});

const makeComment = (id: string, postId: string, overrides: Partial<CommunityComment> = {}): CommunityComment => ({
        id,
        postId,
        authorMemberId: 'member-1',
        body: `댓글 ${id}`,
        isHidden: false,
        hiddenBy: null,
        hiddenAt: null,
        createdAt: '2026-04-01T00:00:00Z',
        updatedAt: '2026-04-01T00:00:00Z',
        ...overrides,
});

beforeEach(() => {
        vi.clearAllMocks();
        mockListPosts.mockResolvedValue({
                items: [makePost('p1'), makePost('p2')],
                nextCursor: null,
        });
        mockListComments.mockResolvedValue([]);
        mockGetMembers.mockResolvedValue([
                { id: 'member-1', name: '테스트 회원', score: 0, isApproved: true },
        ]);
});

describe('useCommunityResources — initial load', () => {
        it('loads posts on mount and exposes them via state', async () => {
                const { result } = renderHook(() => useCommunityResources(), {
                        wrapper: StrictMode,
                });

                await waitFor(() => expect(result.current.isLoading).toBe(false));

                expect(result.current.posts).toHaveLength(2);
                expect(result.current.posts.map((p) => p.id).sort()).toEqual(['p1', 'p2']);
        });

        it('exposes memberNameMap derived from loaded members', async () => {
                const { result } = renderHook(() => useCommunityResources(), {
                        wrapper: StrictMode,
                });

                await waitFor(() => expect(result.current.isLoading).toBe(false));

                expect(result.current.memberNameMap['member-1']).toBe('테스트 회원');
        });
});

describe('useCommunityResources — optimisticallyHidePost rollback (StrictMode regression)', () => {
        it('hides post optimistically then fully restores on rollback — StrictMode safe', async () => {
                const { result } = renderHook(() => useCommunityResources(), {
                        wrapper: StrictMode,
                });

                await waitFor(() => expect(result.current.posts).toHaveLength(2));

                // Optimistically hide p1
                let rollback!: () => void;
                act(() => {
                        rollback = result.current.optimisticallyHidePost('p1');
                });

                expect(result.current.posts).toHaveLength(1);
                expect(result.current.posts[0].id).toBe('p2');

                // Rollback — must restore both posts even under StrictMode (setter called twice)
                act(() => {
                        rollback();
                });

                expect(result.current.posts).toHaveLength(2);
                expect(result.current.posts.map((p) => p.id).sort()).toEqual(['p1', 'p2']);
        });

        it('rollback after hiding multiple posts only restores the targeted snapshot', async () => {
                const { result } = renderHook(() => useCommunityResources(), {
                        wrapper: StrictMode,
                });

                await waitFor(() => expect(result.current.posts).toHaveLength(2));

                let rollback1!: () => void;
                let rollback2!: () => void;

                act(() => {
                        rollback1 = result.current.optimisticallyHidePost('p1');
                });
                expect(result.current.posts).toHaveLength(1);

                act(() => {
                        rollback2 = result.current.optimisticallyHidePost('p2');
                });
                expect(result.current.posts).toHaveLength(0);

                // Rollback p2 hides rollback → should restore to state just before p2 was hidden
                act(() => {
                        rollback2();
                });
                expect(result.current.posts).toHaveLength(1);
                expect(result.current.posts[0].id).toBe('p2');

                // Rollback p1 hide
                act(() => {
                        rollback1();
                });
                expect(result.current.posts).toHaveLength(2);
        });
});

describe('useCommunityResources — optimisticallyHideComment rollback', () => {
        it('hides comment optimistically then fully restores on rollback — StrictMode safe', async () => {
                mockListComments.mockResolvedValue([
                        makeComment('c1', 'p1'),
                        makeComment('c2', 'p1'),
                ]);

                const { result } = renderHook(() => useCommunityResources(), {
                        wrapper: StrictMode,
                });

                await waitFor(() => expect(result.current.posts).toHaveLength(2));

                // Load comments for p1
                await act(async () => {
                        await result.current.loadComments('p1');
                });

                expect(result.current.commentsByPost['p1']).toHaveLength(2);

                // Optimistically hide c1
                let rollback!: () => void;
                act(() => {
                        rollback = result.current.optimisticallyHideComment('p1', 'c1');
                });

                expect(result.current.commentsByPost['p1']).toHaveLength(1);
                expect(result.current.commentsByPost['p1'][0].id).toBe('c2');

                // Rollback — must restore both comments even under StrictMode
                act(() => {
                        rollback();
                });

                expect(result.current.commentsByPost['p1']).toHaveLength(2);
                expect(result.current.commentsByPost['p1'].map((c) => c.id).sort()).toEqual(['c1', 'c2']);
        });
});
