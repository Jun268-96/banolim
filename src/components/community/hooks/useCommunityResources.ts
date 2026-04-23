import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { CommunityPost, CommunityComment, Cursor } from '../../../types';
import { listPosts, listComments, listCommunityMembers } from '../../../lib/api/community';
import type { CommunityMemberSummary } from '../../../lib/api/community';

interface CommunityState {
    posts: CommunityPost[];
    commentsByPost: Record<string, CommunityComment[]>;
    nextCursor: Cursor | null;
    members: CommunityMemberSummary[];
}

interface Snapshot {
    posts?: CommunityPost[];
    comments?: { postId: string; items: CommunityComment[] };
}

const initialState: CommunityState = { posts: [], commentsByPost: {}, nextCursor: null, members: [] };

export const useCommunityResources = () => {
    const [state, setState] = useState<CommunityState>(initialState);
    const [isLoading, setIsLoading] = useState(true);

    // ★ snapshot은 setter 바깥 ref에 보관 → React StrictMode의 setter 2회 호출에도 안전
    const rollbackRef = useRef<Map<string, Snapshot>>(new Map());

    const refreshData = useCallback(async () => {
        setIsLoading(true);
        const [{ items, nextCursor }, members] = await Promise.all([
            listPosts(),
            listCommunityMembers(),
        ]);
        setState({ posts: items, commentsByPost: {}, nextCursor, members });
        setIsLoading(false);
    }, []);

    useEffect(() => {
        let isMounted = true;
        void (async () => {
            const [{ items, nextCursor }, members] = await Promise.all([
                listPosts(),
                listCommunityMembers(),
            ]);
            if (!isMounted) return;
            setState({ posts: items, commentsByPost: {}, nextCursor, members });
            setIsLoading(false);
        })();
        return () => {
            isMounted = false;
        };
    }, []);

    const loadMore = useCallback(async () => {
        if (!state.nextCursor) return;
        const { items, nextCursor } = await listPosts({}, state.nextCursor);
        setState((prev) => ({ ...prev, posts: [...prev.posts, ...items], nextCursor }));
    }, [state.nextCursor]);

    const loadComments = useCallback(async (postId: string) => {
        const items = await listComments(postId);
        setState((prev) => ({
            ...prev,
            commentsByPost: { ...prev.commentsByPost, [postId]: items },
        }));
    }, []);

    // ★★ 낙관적 숨김 — 토큰으로 snapshot을 ref에 저장
    const optimisticallyHidePost = useCallback((id: string) => {
        const token = `post:${id}:${Date.now()}:${Math.random()}`;
        setState((prev) => {
            // 첫 저장만 유지 (StrictMode 2회 호출 시 덮어쓰기 방지)
            if (!rollbackRef.current.has(token)) {
                rollbackRef.current.set(token, { posts: prev.posts });
            }
            return { ...prev, posts: prev.posts.filter((p) => p.id !== id) };
        });
        return () => {
            const snap = rollbackRef.current.get(token);
            rollbackRef.current.delete(token);
            if (!snap?.posts) return;
            setState((prev) => ({ ...prev, posts: snap.posts! }));
        };
    }, []);

    const optimisticallyHideComment = useCallback((postId: string, commentId: string) => {
        const token = `comment:${commentId}:${Date.now()}:${Math.random()}`;
        setState((prev) => {
            if (!rollbackRef.current.has(token)) {
                rollbackRef.current.set(token, {
                    comments: { postId, items: prev.commentsByPost[postId] ?? [] },
                });
            }
            return {
                ...prev,
                commentsByPost: {
                    ...prev.commentsByPost,
                    [postId]: (prev.commentsByPost[postId] ?? []).filter((c) => c.id !== commentId),
                },
            };
        });
        return () => {
            const snap = rollbackRef.current.get(token);
            rollbackRef.current.delete(token);
            if (!snap?.comments) return;
            setState((prev) => ({
                ...prev,
                commentsByPost: { ...prev.commentsByPost, [snap.comments!.postId]: snap.comments!.items },
            }));
        };
    }, []);

    const appendPost = useCallback((post: CommunityPost) => {
        setState((prev) => ({ ...prev, posts: [post, ...prev.posts] }));
    }, []);

    const appendComment = useCallback((comment: CommunityComment) => {
        setState((prev) => ({
            ...prev,
            commentsByPost: {
                ...prev.commentsByPost,
                [comment.postId]: [...(prev.commentsByPost[comment.postId] ?? []), comment],
            },
            posts: prev.posts.map((p) =>
                p.id === comment.postId ? { ...p, commentCount: p.commentCount + 1 } : p,
            ),
        }));
    }, []);

    const updatePostInState = useCallback((post: CommunityPost) => {
        setState((prev) => ({ ...prev, posts: prev.posts.map((p) => (p.id === post.id ? post : p)) }));
    }, []);

    const memberNameMap = useMemo(
        () => Object.fromEntries(state.members.map((m) => [m.id, m.name])),
        [state.members],
    );

    return {
        ...state,
        isLoading,
        memberNameMap,
        refreshData,
        loadMore,
        loadComments,
        optimisticallyHidePost,
        optimisticallyHideComment,
        appendPost,
        appendComment,
        updatePostInState,
    };
};
