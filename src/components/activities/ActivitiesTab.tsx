import React, { useEffect, useMemo, useState } from 'react';
import { ClipboardList, PlusCircle, CalendarClock } from 'lucide-react';
import type { ActivityLog, Category, Member } from '../../types';
import { createActivityEntry, getCategories, getLogs, getMembers } from '../../lib/db';

const formatDateTime = (value: string) =>
    new Intl.DateTimeFormat('en-US', {
        dateStyle: 'medium',
        timeStyle: 'short',
    }).format(new Date(value));

export const ActivitiesTab: React.FC = () => {
    const [members, setMembers] = useState<Member[]>([]);
    const [categories, setCategories] = useState<Category[]>([]);
    const [logs, setLogs] = useState<ActivityLog[]>([]);
    const [selectedMemberId, setSelectedMemberId] = useState('');
    const [selectedCategoryId, setSelectedCategoryId] = useState('');
    const [note, setNote] = useState('');
    const [isLoading, setIsLoading] = useState(true);
    const [isSaving, setIsSaving] = useState(false);

    const loadData = async () => {
        setIsLoading(true);
        const [membersData, categoriesData, logsData] = await Promise.all([
            getMembers(),
            getCategories(),
            getLogs(),
        ]);
        setMembers(membersData);
        setCategories(categoriesData);
        setLogs(logsData);
        setSelectedMemberId((current) => current || membersData[0]?.id || '');
        setSelectedCategoryId((current) => current || categoriesData[0]?.id || '');
        setIsLoading(false);
    };

    useEffect(() => {
        loadData();
    }, []);

    const activeMembers = useMemo(
        () => members.filter((member) => member.status !== 'inactive'),
        [members],
    );

    const handleSubmit = async (event: React.FormEvent) => {
        event.preventDefault();
        if (!selectedMemberId || !selectedCategoryId) return;

        setIsSaving(true);
        await createActivityEntry(selectedMemberId, selectedCategoryId, note);
        setNote('');
        await loadData();
        setIsSaving(false);
    };

    if (isLoading) {
        return (
            <div className="flex items-center justify-center h-64">
                <div className="animate-pulse flex flex-col items-center gap-4">
                    <div className="w-12 h-12 bg-indigo-100 rounded-full"></div>
                    <div className="text-indigo-600 font-medium">Loading activity data...</div>
                </div>
            </div>
        );
    }

    return (
        <div className="space-y-6 animate-in fade-in duration-500">
            <header className="flex items-center justify-between">
                <div>
                    <h2 className="text-2xl font-bold text-slate-900 flex items-center gap-2">
                        <ClipboardList className="text-indigo-600" />
                        Activity records
                    </h2>
                    <p className="text-slate-500 mt-1">Record real activities first, then let points follow the log.</p>
                </div>
            </header>

            <div className="grid grid-cols-1 xl:grid-cols-[360px_minmax(0,1fr)] gap-6">
                <section className="bg-white rounded-2xl shadow-sm border border-slate-200 p-6">
                    <div className="flex items-center gap-2 text-slate-900 font-semibold mb-5">
                        <PlusCircle size={18} className="text-indigo-600" />
                        New activity entry
                    </div>

                    <form className="space-y-4" onSubmit={handleSubmit}>
                        <label className="block space-y-1.5">
                            <span className="text-xs font-medium text-slate-600">Member</span>
                            <select
                                value={selectedMemberId}
                                onChange={(event) => setSelectedMemberId(event.target.value)}
                                className="w-full px-4 py-2 border border-slate-200 rounded-xl outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 transition-all text-sm bg-white"
                            >
                                {activeMembers.map((member) => (
                                    <option key={member.id} value={member.id}>
                                        {member.name} {member.roleName ? `- ${member.roleName}` : ''}
                                    </option>
                                ))}
                            </select>
                        </label>

                        <label className="block space-y-1.5">
                            <span className="text-xs font-medium text-slate-600">Activity rule</span>
                            <select
                                value={selectedCategoryId}
                                onChange={(event) => setSelectedCategoryId(event.target.value)}
                                className="w-full px-4 py-2 border border-slate-200 rounded-xl outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 transition-all text-sm bg-white"
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
                            <span className="text-xs font-medium text-slate-600">Note</span>
                            <textarea
                                value={note}
                                onChange={(event) => setNote(event.target.value)}
                                rows={4}
                                placeholder="What happened? Add context for future review."
                                className="w-full px-4 py-3 border border-slate-200 rounded-xl outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 transition-all text-sm resize-none"
                            />
                        </label>

                        <button
                            type="submit"
                            disabled={!selectedMemberId || !selectedCategoryId || isSaving}
                            className="w-full px-4 py-3 bg-indigo-600 text-white rounded-xl font-semibold hover:bg-indigo-700 disabled:opacity-50 transition-colors"
                        >
                            {isSaving ? 'Saving...' : 'Save activity record'}
                        </button>
                    </form>
                </section>

                <section className="space-y-4">
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm">
                            <div className="text-sm text-slate-500">Recorded activities</div>
                            <div className="mt-2 text-3xl font-bold text-slate-900">{logs.length}</div>
                        </div>
                        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm">
                            <div className="text-sm text-slate-500">Active members</div>
                            <div className="mt-2 text-3xl font-bold text-slate-900">{activeMembers.length}</div>
                        </div>
                        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm">
                            <div className="text-sm text-slate-500">Available rules</div>
                            <div className="mt-2 text-3xl font-bold text-slate-900">{categories.length}</div>
                        </div>
                    </div>

                    <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
                        <div className="px-6 py-4 border-b border-slate-100 flex items-center gap-2 text-slate-900 font-semibold">
                            <CalendarClock size={18} className="text-indigo-600" />
                            Recent activity feed
                        </div>
                        <div className="overflow-x-auto">
                            <table className="w-full text-left border-collapse">
                                <thead>
                                    <tr className="bg-slate-50 border-b border-slate-200 text-sm font-semibold text-slate-600">
                                        <th className="py-4 px-6 w-44">When</th>
                                        <th className="py-4 px-6 w-44">Member</th>
                                        <th className="py-4 px-6">Rule</th>
                                        <th className="py-4 px-6 w-24">Points</th>
                                        <th className="py-4 px-6">Note</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-slate-100">
                                    {logs.map((log) => (
                                        <tr key={log.id} className="hover:bg-slate-50/60 transition-colors">
                                            <td className="py-4 px-6 text-sm text-slate-600">{formatDateTime(log.timestamp)}</td>
                                            <td className="py-4 px-6 font-medium text-slate-900">{log.memberName ?? log.memberId}</td>
                                            <td className="py-4 px-6">
                                                <div className="font-medium text-slate-900">{log.categoryName ?? log.categoryId}</div>
                                                {log.reason && <div className="text-xs text-slate-500 mt-1">{log.reason}</div>}
                                            </td>
                                            <td className="py-4 px-6">
                                                <span className={`inline-flex px-2.5 py-1 rounded-full text-xs font-semibold border ${log.pointDelta >= 0
                                                    ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                                                    : 'bg-rose-50 text-rose-700 border-rose-200'
                                                    }`}>
                                                    {log.pointDelta > 0 ? '+' : ''}
                                                    {log.pointDelta}
                                                </span>
                                            </td>
                                            <td className="py-4 px-6 text-sm text-slate-600">{log.note || '-'}</td>
                                        </tr>
                                    ))}

                                    {logs.length === 0 && (
                                        <tr>
                                            <td colSpan={5} className="py-12 text-center text-slate-500">
                                                No activity records yet. Add the first one from the form on the left.
                                            </td>
                                        </tr>
                                    )}
                                </tbody>
                            </table>
                        </div>
                    </div>
                </section>
            </div>
        </div>
    );
};
