import React, { useEffect, useMemo, useState } from 'react';
import { CheckSquare, Coins, Square, Users } from 'lucide-react';
import type { Category, Member } from '../../types';
import { createBatchActivityEntries, getCategories, getMembers } from '../../lib/db';

const memberStatusLabels: Record<string, string> = {
    active: '활동 중',
    dormant: '휴면',
    inactive: '비활성',
};

export const PointsTab: React.FC = () => {
    const [members, setMembers] = useState<Member[]>([]);
    const [categories, setCategories] = useState<Category[]>([]);
    const [selectedCategoryId, setSelectedCategoryId] = useState('');
    const [selectedMemberIds, setSelectedMemberIds] = useState<string[]>([]);
    const [note, setNote] = useState('');
    const [evidenceUrl, setEvidenceUrl] = useState('');
    const [isLoading, setIsLoading] = useState(true);
    const [isSaving, setIsSaving] = useState(false);

    const refreshData = async () => {
        setIsLoading(true);
        const [membersData, categoriesData] = await Promise.all([getMembers(), getCategories()]);
        const availableMembers = membersData.filter((member) => member.status !== 'inactive');
        setMembers(availableMembers);
        setCategories(categoriesData);
        setSelectedCategoryId((current) => current || categoriesData[0]?.id || '');
        setIsLoading(false);
    };

    useEffect(() => {
        let isMounted = true;

        const initialize = async () => {
            const [membersData, categoriesData] = await Promise.all([getMembers(), getCategories()]);
            const availableMembers = membersData.filter((member) => member.status !== 'inactive');

            if (!isMounted) {
                return;
            }

            setMembers(availableMembers);
            setCategories(categoriesData);
            setSelectedCategoryId((current) => current || categoriesData[0]?.id || '');
            setIsLoading(false);
        };

        void initialize();

        return () => {
            isMounted = false;
        };
    }, []);

    const selectedCategory = useMemo(
        () => categories.find((category) => category.id === selectedCategoryId) ?? null,
        [categories, selectedCategoryId],
    );

    const groupedMembers = useMemo(
        () =>
            members.reduce<Record<string, Member[]>>((groups, member) => {
                const key = member.teamName || '미지정';
                groups[key] = groups[key] ? [...groups[key], member] : [member];
                return groups;
            }, {}),
        [members],
    );

    const estimatedDelta = (selectedCategory?.pointValue ?? 0) * selectedMemberIds.length;

    const toggleMember = (memberId: string) => {
        setSelectedMemberIds((current) =>
            current.includes(memberId)
                ? current.filter((id) => id !== memberId)
                : [...current, memberId],
        );
    };

    const selectAll = () => {
        setSelectedMemberIds(members.map((member) => member.id));
    };

    const clearSelection = () => {
        setSelectedMemberIds([]);
    };

    const handleSubmit = async (event: React.FormEvent) => {
        event.preventDefault();
        if (!selectedCategoryId || selectedMemberIds.length === 0) {
            return;
        }

        setIsSaving(true);
        await createBatchActivityEntries(selectedMemberIds, selectedCategoryId, note, {
            evidenceUrl,
        });
        setNote('');
        setEvidenceUrl('');
        setSelectedMemberIds([]);
        await refreshData();
        setIsSaving(false);
    };

    if (isLoading) {
        return (
            <div className="flex h-64 items-center justify-center">
                <div className="animate-pulse flex flex-col items-center gap-4">
                    <div className="h-12 w-12 rounded-full bg-indigo-100"></div>
                    <div className="font-medium text-indigo-600">점수 관리 화면을 불러오는 중...</div>
                </div>
            </div>
        );
    }

    return (
        <div className="animate-in fade-in space-y-6 duration-500">
            <header>
                <h2 className="flex items-center gap-2 text-2xl font-bold text-slate-900">
                    <Coins className="text-indigo-600" />
                    점수 관리
                </h2>
                <p className="mt-1 text-slate-500">같은 활동 규칙을 여러 회원에게 한 번에 반영합니다.</p>
            </header>

            <div className="grid grid-cols-1 gap-6 xl:grid-cols-[360px_minmax(0,1fr)]">
                <section className="space-y-5 rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
                    <div>
                        <div className="text-sm font-semibold text-slate-900">일괄 기록</div>
                        <p className="mt-1 text-sm text-slate-500">규칙을 고르고 멤버를 선택한 뒤 한 번에 저장합니다.</p>
                    </div>

                    <form className="space-y-4" onSubmit={handleSubmit}>
                        <label className="block space-y-1.5">
                            <span className="text-xs font-medium text-slate-600">규칙</span>
                            <select
                                value={selectedCategoryId}
                                onChange={(event) => setSelectedCategoryId(event.target.value)}
                                className="w-full rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm outline-none transition-all focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500"
                            >
                                {categories.map((category) => (
                                    <option key={category.id} value={category.id}>
                                        {category.categoryName} ({category.pointValue > 0 ? '+' : ''}
                                        {category.pointValue}) · v{category.version ?? 1}
                                    </option>
                                ))}
                            </select>
                        </label>

                        <label className="block space-y-1.5">
                            <span className="text-xs font-medium text-slate-600">공통 메모</span>
                            <textarea
                                value={note}
                                onChange={(event) => setNote(event.target.value)}
                                rows={4}
                                placeholder="예: 주간 출석, 스터디 참여, 팀 기여"
                                className="w-full resize-none rounded-xl border border-slate-200 px-4 py-3 text-sm outline-none transition-all focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500"
                            />
                        </label>

                        <label className="block space-y-1.5">
                            <span className="text-xs font-medium text-slate-600">증빙 링크</span>
                            <input
                                type="url"
                                value={evidenceUrl}
                                onChange={(event) => setEvidenceUrl(event.target.value)}
                                placeholder="예: 회의록, 제출물, 참고 문서 링크"
                                className="w-full rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm outline-none transition-all focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500"
                            />
                        </label>

                        <div className="space-y-2 rounded-2xl border border-slate-200 bg-slate-50 p-4">
                            <div className="flex items-center justify-between text-sm">
                                <span className="text-slate-500">선택한 멤버</span>
                                <span className="font-semibold text-slate-900">{selectedMemberIds.length}</span>
                            </div>
                            <div className="flex items-center justify-between text-sm">
                                <span className="text-slate-500">규칙 점수</span>
                                <span className="font-semibold text-slate-900">
                                    {(selectedCategory?.pointValue ?? 0) > 0 ? '+' : ''}
                                    {selectedCategory?.pointValue ?? 0}점
                                </span>
                            </div>
                            <div className="flex items-center justify-between text-sm">
                                <span className="text-slate-500">규칙 버전</span>
                                <span className="font-semibold text-slate-900">v{selectedCategory?.version ?? 1}</span>
                            </div>
                            <div className="flex items-center justify-between text-sm">
                                <span className="text-slate-500">감점 규칙</span>
                                <span className="font-semibold text-slate-900">{selectedCategory?.penaltyPoint ?? 0}점</span>
                            </div>
                            <div className="flex items-center justify-between text-sm">
                                <span className="text-slate-500">예상 총합</span>
                                <span className={`font-semibold ${estimatedDelta >= 0 ? 'text-emerald-700' : 'text-rose-700'}`}>
                                    {estimatedDelta > 0 ? '+' : ''}
                                    {estimatedDelta}점
                                </span>
                            </div>
                        </div>

                        <button
                            type="submit"
                            disabled={!selectedCategoryId || selectedMemberIds.length === 0 || isSaving}
                            className="w-full rounded-xl bg-indigo-600 px-4 py-3 font-semibold text-white transition-colors hover:bg-indigo-700 disabled:opacity-50"
                        >
                            {isSaving ? '저장 중...' : '일괄 활동 반영'}
                        </button>
                    </form>
                </section>

                <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
                    <div className="flex flex-col gap-3 border-b border-slate-100 px-6 py-4 md:flex-row md:items-center md:justify-between">
                        <div>
                            <div className="font-semibold text-slate-900">멤버 선택</div>
                            <div className="mt-1 text-sm text-slate-500">현재 팀 기준으로 묶어서 보여줍니다.</div>
                        </div>
                        <div className="flex items-center gap-2">
                            <button
                                type="button"
                                onClick={selectAll}
                                className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm transition-colors hover:bg-slate-50"
                            >
                                전체 선택
                            </button>
                            <button
                                type="button"
                                onClick={clearSelection}
                                className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm transition-colors hover:bg-slate-50"
                            >
                                선택 해제
                            </button>
                        </div>
                    </div>

                    <div className="max-h-[680px] space-y-6 overflow-auto p-6">
                        {Object.entries(groupedMembers).map(([teamName, teamMembers]) => (
                            <div key={teamName} className="space-y-3">
                                <div className="flex items-center gap-2 text-sm font-semibold text-slate-900">
                                    <Users size={16} className="text-indigo-500" />
                                    {teamName}
                                    <span className="font-normal text-slate-400">({teamMembers.length})</span>
                                </div>

                                <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
                                    {teamMembers.map((member) => {
                                        const isSelected = selectedMemberIds.includes(member.id);

                                        return (
                                            <button
                                                key={member.id}
                                                type="button"
                                                onClick={() => toggleMember(member.id)}
                                                className={`rounded-2xl border p-4 text-left transition-all ${isSelected
                                                    ? 'border-indigo-300 bg-indigo-50 shadow-sm'
                                                    : 'border-slate-200 bg-white hover:bg-slate-50'
                                                    }`}
                                            >
                                                <div className="flex items-start justify-between gap-3">
                                                    <div>
                                                        <div className="font-medium text-slate-900">{member.name}</div>
                                                        <div className="mt-1 text-sm text-slate-500">
                                                            {member.roleName || '역할 없음'} · {member.status ? memberStatusLabels[member.status] ?? member.status : '상태 미확인'}
                                                        </div>
                                                        <div className="mt-2 text-sm font-semibold text-indigo-600">{member.score}점</div>
                                                    </div>
                                                    <div className="text-indigo-600">
                                                        {isSelected ? <CheckSquare size={18} /> : <Square size={18} />}
                                                    </div>
                                                </div>
                                            </button>
                                        );
                                    })}
                                </div>
                            </div>
                        ))}
                    </div>
                </section>
            </div>
        </div>
    );
};
