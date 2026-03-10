import React, { useEffect, useMemo, useState } from 'react';
import { CheckSquare, Coins, Square, Users } from 'lucide-react';
import type { Category, Member } from '../../types';
import { createBatchActivityEntries, getCategories, getMembers } from '../../lib/db';

export const PointsTab: React.FC = () => {
    const [members, setMembers] = useState<Member[]>([]);
    const [categories, setCategories] = useState<Category[]>([]);
    const [selectedCategoryId, setSelectedCategoryId] = useState('');
    const [selectedMemberIds, setSelectedMemberIds] = useState<string[]>([]);
    const [note, setNote] = useState('');
    const [isLoading, setIsLoading] = useState(true);
    const [isSaving, setIsSaving] = useState(false);

    const loadData = async () => {
        setIsLoading(true);
        const [membersData, categoriesData] = await Promise.all([getMembers(), getCategories()]);
        const availableMembers = membersData.filter((member) => member.status !== 'inactive');
        setMembers(availableMembers);
        setCategories(categoriesData);
        setSelectedCategoryId((current) => current || categoriesData[0]?.id || '');
        setIsLoading(false);
    };

    useEffect(() => {
        void loadData();
    }, []);

    const selectedCategory = useMemo(
        () => categories.find((category) => category.id === selectedCategoryId) ?? null,
        [categories, selectedCategoryId],
    );

    const groupedMembers = useMemo(
        () =>
            members.reduce<Record<string, Member[]>>((groups, member) => {
                const key = member.teamName || 'Unassigned';
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
        await createBatchActivityEntries(selectedMemberIds, selectedCategoryId, note);
        setNote('');
        setSelectedMemberIds([]);
        setIsSaving(false);
    };

    if (isLoading) {
        return (
            <div className="flex h-64 items-center justify-center">
                <div className="animate-pulse flex flex-col items-center gap-4">
                    <div className="h-12 w-12 rounded-full bg-indigo-100"></div>
                    <div className="font-medium text-indigo-600">Loading point management...</div>
                </div>
            </div>
        );
    }

    return (
        <div className="animate-in fade-in space-y-6 duration-500">
            <header>
                <h2 className="flex items-center gap-2 text-2xl font-bold text-slate-900">
                    <Coins className="text-indigo-600" />
                    Point management
                </h2>
                <p className="mt-1 text-slate-500">Apply the same activity rule to several members at once.</p>
            </header>

            <div className="grid grid-cols-1 gap-6 xl:grid-cols-[360px_minmax(0,1fr)]">
                <section className="space-y-5 rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
                    <div>
                        <div className="text-sm font-semibold text-slate-900">Batch record</div>
                        <p className="mt-1 text-sm text-slate-500">Choose a rule, select members, and save in one action.</p>
                    </div>

                    <form className="space-y-4" onSubmit={handleSubmit}>
                        <label className="block space-y-1.5">
                            <span className="text-xs font-medium text-slate-600">Rule</span>
                            <select
                                value={selectedCategoryId}
                                onChange={(event) => setSelectedCategoryId(event.target.value)}
                                className="w-full rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm outline-none transition-all focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500"
                            >
                                {categories.map((category) => (
                                    <option key={category.id} value={category.id}>
                                        {category.categoryName} ({category.pointValue > 0 ? '+' : ''}
                                        {category.pointValue})
                                    </option>
                                ))}
                            </select>
                        </label>

                        <label className="block space-y-1.5">
                            <span className="text-xs font-medium text-slate-600">Shared note</span>
                            <textarea
                                value={note}
                                onChange={(event) => setNote(event.target.value)}
                                rows={4}
                                placeholder="Example: Weekly attendance, study session, team contribution"
                                className="w-full resize-none rounded-xl border border-slate-200 px-4 py-3 text-sm outline-none transition-all focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500"
                            />
                        </label>

                        <div className="space-y-2 rounded-2xl border border-slate-200 bg-slate-50 p-4">
                            <div className="flex items-center justify-between text-sm">
                                <span className="text-slate-500">Selected members</span>
                                <span className="font-semibold text-slate-900">{selectedMemberIds.length}</span>
                            </div>
                            <div className="flex items-center justify-between text-sm">
                                <span className="text-slate-500">Rule delta</span>
                                <span className="font-semibold text-slate-900">
                                    {(selectedCategory?.pointValue ?? 0) > 0 ? '+' : ''}
                                    {selectedCategory?.pointValue ?? 0} each
                                </span>
                            </div>
                            <div className="flex items-center justify-between text-sm">
                                <span className="text-slate-500">Estimated total</span>
                                <span className={`font-semibold ${estimatedDelta >= 0 ? 'text-emerald-700' : 'text-rose-700'}`}>
                                    {estimatedDelta > 0 ? '+' : ''}
                                    {estimatedDelta}
                                </span>
                            </div>
                        </div>

                        <button
                            type="submit"
                            disabled={!selectedCategoryId || selectedMemberIds.length === 0 || isSaving}
                            className="w-full rounded-xl bg-indigo-600 px-4 py-3 font-semibold text-white transition-colors hover:bg-indigo-700 disabled:opacity-50"
                        >
                            {isSaving ? 'Saving...' : 'Apply batch activity'}
                        </button>
                    </form>
                </section>

                <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
                    <div className="flex flex-col gap-3 border-b border-slate-100 px-6 py-4 md:flex-row md:items-center md:justify-between">
                        <div>
                            <div className="font-semibold text-slate-900">Member selection</div>
                            <div className="mt-1 text-sm text-slate-500">Grouped by current team assignment.</div>
                        </div>
                        <div className="flex items-center gap-2">
                            <button
                                type="button"
                                onClick={selectAll}
                                className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm transition-colors hover:bg-slate-50"
                            >
                                Select all
                            </button>
                            <button
                                type="button"
                                onClick={clearSelection}
                                className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm transition-colors hover:bg-slate-50"
                            >
                                Clear
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
                                                            {member.roleName || 'No role'} · {member.status || 'Unknown'}
                                                        </div>
                                                        <div className="mt-2 text-sm font-semibold text-indigo-600">{member.score}pt</div>
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
