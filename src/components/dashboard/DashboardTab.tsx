import React, { useEffect, useMemo, useState } from 'react';
import { Users, Plus, Award, Shield, Trash2, Search } from 'lucide-react';
import type { Category, Member } from '../../types';
import { addMember, awardPoints, deleteMember, getCategories, getMembers } from '../../lib/db';
import { useAuth } from '../auth/AuthProvider';

const getLevelInfo = (score: number) => {
    if (score >= 200) return { level: 3, title: 'Core team', color: 'bg-amber-100 text-amber-700 border-amber-200' };
    if (score >= 100) return { level: 2, title: 'Top contributor', color: 'bg-emerald-100 text-emerald-700 border-emerald-200' };
    return { level: 1, title: 'Member', color: 'bg-slate-100 text-slate-700 border-slate-200' };
};

const getStatusInfo = (member: Member) => {
    if (!member.isApproved) {
        return {
            label: 'Pending approval',
            className: 'bg-amber-50 text-amber-700 border-amber-200',
        };
    }

    switch (member.status) {
        case 'active':
            return { label: 'Active', className: 'bg-emerald-50 text-emerald-700 border-emerald-200' };
        case 'dormant':
            return { label: 'Dormant', className: 'bg-sky-50 text-sky-700 border-sky-200' };
        case 'inactive':
            return { label: 'Inactive', className: 'bg-slate-100 text-slate-600 border-slate-200' };
        default:
            return { label: 'Unknown', className: 'bg-slate-100 text-slate-600 border-slate-200' };
    }
};

const formatDate = (value?: string | null) => {
    if (!value) return '-';
    return new Intl.DateTimeFormat('en-US', { dateStyle: 'medium' }).format(new Date(value));
};

export const DashboardTab: React.FC = () => {
    const { permissions } = useAuth();
    const [members, setMembers] = useState<Member[]>([]);
    const [categories, setCategories] = useState<Category[]>([]);
    const [newMemberName, setNewMemberName] = useState('');
    const [searchQuery, setSearchQuery] = useState('');
    const [isLoading, setIsLoading] = useState(true);

    const loadData = async () => {
        setIsLoading(true);
        const [membersData, categoriesData] = await Promise.all([getMembers(), getCategories()]);
        setMembers(membersData);
        setCategories(categoriesData);
        setIsLoading(false);
    };

    useEffect(() => {
        loadData();
    }, []);

    const filteredMembers = useMemo(() => {
        const query = searchQuery.trim().toLowerCase();
        if (!query) return members;

        return members.filter((member) =>
            [member.name, member.roleName ?? '', member.teamName ?? '', member.status ?? '']
                .join(' ')
                .toLowerCase()
                .includes(query),
        );
    }, [members, searchQuery]);

    const handleAddMember = async (event: React.FormEvent) => {
        event.preventDefault();
        if (!newMemberName.trim()) return;

        await addMember(newMemberName.trim());
        setNewMemberName('');
        loadData();
    };

    const handleDeleteMember = async (id: string) => {
        if (confirm('Hide this member from the directory?')) {
            await deleteMember(id);
            loadData();
        }
    };

    const handleAward = async (memberId: string, categoryId: string) => {
        await awardPoints(memberId, categoryId);
        loadData();
    };

    if (isLoading) {
        return (
            <div className="flex items-center justify-center h-64">
                <div className="animate-pulse flex flex-col items-center gap-4">
                    <div className="w-12 h-12 bg-indigo-100 rounded-full"></div>
                    <div className="text-indigo-600 font-medium">Loading member directory...</div>
                </div>
            </div>
        );
    }

    return (
        <div className="space-y-6 animate-in fade-in duration-500">
            <header className="flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
                <div>
                    <h2 className="text-2xl font-bold text-slate-900 flex items-center gap-2">
                        <Users className="text-indigo-600" />
                        Member directory
                    </h2>
                    <p className="text-slate-500 mt-1">Track role, team, status, and score in one operating view.</p>
                </div>

                <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
                    <label className="relative block">
                        <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                        <input
                            type="text"
                            placeholder="Search members"
                            value={searchQuery}
                            onChange={(event) => setSearchQuery(event.target.value)}
                            className="pl-9 pr-3 py-2.5 rounded-xl border border-slate-200 bg-white text-sm outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 w-56"
                        />
                    </label>

                    {permissions.canManageMembers && (
                        <form onSubmit={handleAddMember} className="flex items-center gap-2 bg-white p-2 rounded-xl shadow-sm border border-slate-200">
                            <input
                                type="text"
                                placeholder="New member name"
                                value={newMemberName}
                                onChange={(event) => setNewMemberName(event.target.value)}
                                className="px-3 py-1.5 outline-none text-sm w-48 bg-transparent"
                            />
                            <button
                                type="submit"
                                disabled={!newMemberName.trim()}
                                className="p-1.5 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 disabled:opacity-50 transition-colors"
                            >
                                <Plus size={18} />
                            </button>
                        </form>
                    )}
                </div>
            </header>

            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm">
                    <div className="text-sm text-slate-500">Visible members</div>
                    <div className="mt-2 text-3xl font-bold text-slate-900">{members.length}</div>
                </div>
                <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm">
                    <div className="text-sm text-slate-500">Approved</div>
                    <div className="mt-2 text-3xl font-bold text-slate-900">{members.filter((member) => member.isApproved).length}</div>
                </div>
                <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm">
                    <div className="text-sm text-slate-500">Active members</div>
                    <div className="mt-2 text-3xl font-bold text-slate-900">{members.filter((member) => member.status === 'active').length}</div>
                </div>
                <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm">
                    <div className="text-sm text-slate-500">Teams represented</div>
                    <div className="mt-2 text-3xl font-bold text-slate-900">{new Set(members.map((member) => member.teamName).filter(Boolean)).size}</div>
                </div>
            </div>

            <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
                <div className="overflow-x-auto">
                    <table className="w-full text-left border-collapse">
                        <thead>
                            <tr className="bg-slate-50 border-b border-slate-200 text-sm font-semibold text-slate-600">
                                <th className="py-4 px-6 w-28">Level</th>
                                <th className="py-4 px-6 w-40">Name</th>
                                <th className="py-4 px-6 w-40">Role</th>
                                <th className="py-4 px-6 w-36">Team</th>
                                <th className="py-4 px-6 w-36">Status</th>
                                <th className="py-4 px-6 w-36">Joined</th>
                                <th className="py-4 px-6 w-24">Score</th>
                                <th className="py-4 px-6 min-w-80">
                                    {permissions.canManagePoints ? 'Quick actions' : 'Activity access'}
                                </th>
                                <th className="py-4 px-6 w-20 text-center">
                                    {permissions.canManageMembers ? 'Manage' : 'View'}
                                </th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100">
                            {filteredMembers.map((member) => {
                                const levelInfo = getLevelInfo(member.score);
                                const statusInfo = getStatusInfo(member);

                                return (
                                    <tr key={member.id} className="hover:bg-slate-50/50 transition-colors group">
                                        <td className="py-4 px-6">
                                            <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold border ${levelInfo.color}`}>
                                                {levelInfo.level >= 2 ? <Shield size={12} /> : <Award size={12} />}
                                                Lv.{levelInfo.level} {levelInfo.title}
                                            </span>
                                        </td>
                                        <td className="py-4 px-6">
                                            <div className="font-medium text-slate-900">{member.name}</div>
                                            <div className="text-xs text-slate-500 mt-1">{member.id.slice(0, 8)}</div>
                                        </td>
                                        <td className="py-4 px-6 text-slate-700">{member.roleName || 'Unassigned'}</td>
                                        <td className="py-4 px-6 text-slate-700">{member.teamName || 'Unassigned'}</td>
                                        <td className="py-4 px-6">
                                            <span className={`inline-flex px-2.5 py-1 rounded-full text-xs font-semibold border ${statusInfo.className}`}>
                                                {statusInfo.label}
                                            </span>
                                        </td>
                                        <td className="py-4 px-6 text-slate-600 text-sm">{formatDate(member.joinedAt)}</td>
                                        <td className="py-4 px-6">
                                            <div className="font-bold text-lg text-indigo-600">
                                                {member.score}
                                                <span className="text-sm font-normal text-slate-400 ml-1">pt</span>
                                            </div>
                                        </td>
                                        <td className="py-4 px-6">
                                            {permissions.canManagePoints ? (
                                                <div className="flex flex-wrap gap-2">
                                                    {categories.map((category) => (
                                                        <button
                                                            key={category.id}
                                                            onClick={() => handleAward(member.id, category.id)}
                                                            className={`px-3 py-1.5 text-xs font-medium rounded-lg border transition-all active:scale-95 flex items-center gap-1 ${category.pointValue > 0
                                                                ? 'border-indigo-200 text-indigo-700 bg-indigo-50 hover:bg-indigo-100 hover:border-indigo-300'
                                                                : 'border-rose-200 text-rose-700 bg-rose-50 hover:bg-rose-100 hover:border-rose-300'
                                                                }`}
                                                        >
                                                            <span>{category.categoryName}</span>
                                                            <span className="font-bold">
                                                                {category.pointValue > 0 ? '+' : ''}
                                                                {category.pointValue}
                                                            </span>
                                                        </button>
                                                    ))}
                                                </div>
                                            ) : (
                                                <div className="text-sm text-slate-500">View-only access for this role.</div>
                                            )}
                                        </td>
                                        <td className="py-4 px-6 text-center">
                                            {permissions.canManageMembers ? (
                                                <button
                                                    onClick={() => handleDeleteMember(member.id)}
                                                    className="p-2 text-slate-400 hover:bg-rose-50 hover:text-rose-600 rounded-lg transition-colors opacity-0 group-hover:opacity-100"
                                                    title="Hide member"
                                                >
                                                    <Trash2 size={16} />
                                                </button>
                                            ) : (
                                                <span className="text-xs text-slate-400">-</span>
                                            )}
                                        </td>
                                    </tr>
                                );
                            })}

                            {filteredMembers.length === 0 && (
                                <tr>
                                    <td colSpan={9} className="py-12 text-center text-slate-500">
                                        No members match the current search.
                                    </td>
                                </tr>
                            )}
                        </tbody>
                    </table>
                </div>
            </div>
        </div>
    );
};
