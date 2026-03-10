import React, { useEffect, useState } from 'react';
import { CalendarDays, Plus, Settings, ShieldCheck, Users2, Trash2 } from 'lucide-react';
import type { Category, RoleSummary, SeasonStatus, SeasonSummary, TeamSummary, TeamType } from '../../types';
import {
    addCategory,
    addRole,
    addSeason,
    addTeam,
    deleteCategory,
    getCategories,
    getRoles,
    getSeasons,
    getTeams,
} from '../../lib/db';

const seasonStatusOptions: SeasonStatus[] = ['planned', 'active', 'closed'];
const teamTypeOptions: TeamType[] = ['core', 'study', 'project'];

const badgeClassByStatus: Record<SeasonStatus, string> = {
    planned: 'bg-amber-50 text-amber-700 border-amber-200',
    active: 'bg-emerald-50 text-emerald-700 border-emerald-200',
    closed: 'bg-slate-100 text-slate-700 border-slate-200',
};

export const SettingsTab: React.FC = () => {
    const [categories, setCategories] = useState<Category[]>([]);
    const [roles, setRoles] = useState<RoleSummary[]>([]);
    const [teams, setTeams] = useState<TeamSummary[]>([]);
    const [seasons, setSeasons] = useState<SeasonSummary[]>([]);

    const [newCatName, setNewCatName] = useState('');
    const [newCatValue, setNewCatValue] = useState<number>(10);

    const [newRoleName, setNewRoleName] = useState('');
    const [newRoleScope, setNewRoleScope] = useState('member');
    const [newRoleOrder, setNewRoleOrder] = useState<number>(100);

    const [newTeamName, setNewTeamName] = useState('');
    const [newTeamType, setNewTeamType] = useState<TeamType>('core');

    const [newSeasonName, setNewSeasonName] = useState('');
    const [newSeasonStartDate, setNewSeasonStartDate] = useState('');
    const [newSeasonEndDate, setNewSeasonEndDate] = useState('');
    const [newSeasonStatus, setNewSeasonStatus] = useState<SeasonStatus>('planned');

    const [isLoading, setIsLoading] = useState(true);

    const loadData = async () => {
        setIsLoading(true);
        const [categoriesData, rolesData, teamsData, seasonsData] = await Promise.all([
            getCategories(),
            getRoles(),
            getTeams(),
            getSeasons(),
        ]);
        setCategories(categoriesData);
        setRoles(rolesData);
        setTeams(teamsData);
        setSeasons(seasonsData);
        setIsLoading(false);
    };

    useEffect(() => {
        loadData();
    }, []);

    const handleAddCategory = async (event: React.FormEvent) => {
        event.preventDefault();
        if (!newCatName.trim()) return;

        await addCategory(newCatName.trim(), newCatValue);
        setNewCatName('');
        setNewCatValue(10);
        loadData();
    };

    const handleDeleteCategory = async (id: string) => {
        if (confirm('Disable this rule? Existing score history will remain.')) {
            await deleteCategory(id);
            loadData();
        }
    };

    const handleAddRole = async (event: React.FormEvent) => {
        event.preventDefault();
        if (!newRoleName.trim()) return;

        await addRole(newRoleName.trim(), newRoleScope.trim(), newRoleOrder);
        setNewRoleName('');
        setNewRoleScope('member');
        setNewRoleOrder(100);
        loadData();
    };

    const handleAddTeam = async (event: React.FormEvent) => {
        event.preventDefault();
        if (!newTeamName.trim()) return;

        await addTeam(newTeamName.trim(), newTeamType);
        setNewTeamName('');
        setNewTeamType('core');
        loadData();
    };

    const handleAddSeason = async (event: React.FormEvent) => {
        event.preventDefault();
        if (!newSeasonName.trim() || !newSeasonStartDate || !newSeasonEndDate) return;

        await addSeason(newSeasonName.trim(), newSeasonStartDate, newSeasonEndDate, newSeasonStatus);
        setNewSeasonName('');
        setNewSeasonStartDate('');
        setNewSeasonEndDate('');
        setNewSeasonStatus('planned');
        loadData();
    };

    if (isLoading) {
        return (
            <div className="flex items-center justify-center h-64">
                <div className="animate-pulse flex flex-col items-center gap-4">
                    <div className="w-12 h-12 bg-indigo-100 rounded-full"></div>
                    <div className="text-indigo-600 font-medium">Loading settings...</div>
                </div>
            </div>
        );
    }

    return (
        <div className="space-y-6 animate-in fade-in duration-500">
            <header>
                <h2 className="text-2xl font-bold text-slate-900 flex items-center gap-2">
                    <Settings className="text-indigo-600" />
                    Operations settings
                </h2>
                <p className="text-slate-500 mt-1">Manage rules, roles, teams, and seasons from one place.</p>
            </header>

            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm">
                    <div className="text-sm text-slate-500">Active rules</div>
                    <div className="mt-2 text-3xl font-bold text-slate-900">{categories.length}</div>
                </div>
                <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm">
                    <div className="text-sm text-slate-500">Roles</div>
                    <div className="mt-2 text-3xl font-bold text-slate-900">{roles.length}</div>
                </div>
                <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm">
                    <div className="text-sm text-slate-500">Teams</div>
                    <div className="mt-2 text-3xl font-bold text-slate-900">{teams.length}</div>
                </div>
                <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm">
                    <div className="text-sm text-slate-500">Seasons</div>
                    <div className="mt-2 text-3xl font-bold text-slate-900">{seasons.length}</div>
                </div>
            </div>

            <section className="grid grid-cols-1 xl:grid-cols-[1.1fr_0.9fr] gap-6">
                <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
                    <div className="p-6 border-b border-slate-200 bg-slate-50/50">
                        <div className="flex items-center gap-2 text-slate-900 font-semibold mb-4">
                            <Settings size={18} className="text-indigo-600" />
                            Point rules
                        </div>
                        <form onSubmit={handleAddCategory} className="flex flex-col gap-3 md:flex-row md:items-end">
                            <div className="flex-1 space-y-1.5">
                                <label htmlFor="catName" className="text-xs font-medium text-slate-600">Rule name</label>
                                <input
                                    id="catName"
                                    type="text"
                                    placeholder="Example: Presentation or Study participation"
                                    value={newCatName}
                                    onChange={(event) => setNewCatName(event.target.value)}
                                    className="w-full px-4 py-2 border border-slate-200 rounded-xl outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 transition-all text-sm"
                                />
                            </div>
                            <div className="w-full md:w-36 space-y-1.5">
                                <label htmlFor="catValue" className="text-xs font-medium text-slate-600">Base score</label>
                                <input
                                    id="catValue"
                                    type="number"
                                    value={newCatValue}
                                    onChange={(event) => setNewCatValue(Number(event.target.value) || 0)}
                                    className="w-full px-4 py-2 border border-slate-200 rounded-xl outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 transition-all text-sm"
                                />
                            </div>
                            <button
                                type="submit"
                                disabled={!newCatName.trim()}
                                className="px-6 py-2 bg-indigo-600 text-white font-medium rounded-xl hover:bg-indigo-700 disabled:opacity-50 transition-colors flex items-center justify-center gap-2 h-10"
                            >
                                <Plus size={18} />
                                Add
                            </button>
                        </form>
                    </div>

                    <div className="overflow-x-auto">
                        <table className="w-full text-left border-collapse">
                            <thead>
                                <tr className="bg-white border-b border-slate-100 text-sm font-semibold text-slate-600">
                                    <th className="py-4 px-6">Rule name</th>
                                    <th className="py-4 px-6 w-32">Score</th>
                                    <th className="py-4 px-6 w-20 text-center">Manage</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-100">
                                {categories.map((category) => (
                                    <tr key={category.id} className="hover:bg-slate-50 transition-colors group">
                                        <td className="py-4 px-6 font-medium text-slate-900">{category.categoryName}</td>
                                        <td className="py-4 px-6">
                                            <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-bold border ${category.pointValue > 0
                                                ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                                                : 'bg-rose-50 text-rose-700 border-rose-200'
                                                }`}>
                                                {category.pointValue > 0 ? '+' : ''}
                                                {category.pointValue}pt
                                            </span>
                                        </td>
                                        <td className="py-4 px-6 text-center">
                                            <button
                                                onClick={() => handleDeleteCategory(category.id)}
                                                className="p-2 text-slate-400 hover:bg-rose-50 hover:text-rose-600 rounded-lg transition-colors opacity-0 group-hover:opacity-100"
                                                title="Disable rule"
                                            >
                                                <Trash2 size={16} />
                                            </button>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </div>

                <div className="space-y-6">
                    <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-6">
                        <div className="flex items-center gap-2 text-slate-900 font-semibold mb-4">
                            <ShieldCheck size={18} className="text-indigo-600" />
                            Roles
                        </div>
                        <form onSubmit={handleAddRole} className="grid grid-cols-1 md:grid-cols-[1.2fr_1fr_120px_auto] gap-3 items-end">
                            <label className="space-y-1.5">
                                <span className="text-xs font-medium text-slate-600">Role name</span>
                                <input
                                    type="text"
                                    value={newRoleName}
                                    onChange={(event) => setNewRoleName(event.target.value)}
                                    className="w-full px-4 py-2 border border-slate-200 rounded-xl outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 text-sm"
                                    placeholder="Example: Study Lead"
                                />
                            </label>
                            <label className="space-y-1.5">
                                <span className="text-xs font-medium text-slate-600">Permission scope</span>
                                <input
                                    type="text"
                                    value={newRoleScope}
                                    onChange={(event) => setNewRoleScope(event.target.value)}
                                    className="w-full px-4 py-2 border border-slate-200 rounded-xl outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 text-sm"
                                    placeholder="member / operator"
                                />
                            </label>
                            <label className="space-y-1.5">
                                <span className="text-xs font-medium text-slate-600">Order</span>
                                <input
                                    type="number"
                                    value={newRoleOrder}
                                    onChange={(event) => setNewRoleOrder(Number(event.target.value) || 0)}
                                    className="w-full px-4 py-2 border border-slate-200 rounded-xl outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 text-sm"
                                />
                            </label>
                            <button
                                type="submit"
                                disabled={!newRoleName.trim()}
                                className="px-5 py-2 bg-indigo-600 text-white font-medium rounded-xl hover:bg-indigo-700 disabled:opacity-50 transition-colors h-10"
                            >
                                Add
                            </button>
                        </form>
                        <div className="mt-5 space-y-3">
                            {roles.map((role) => (
                                <div key={role.id} className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 flex items-center justify-between gap-4">
                                    <div>
                                        <div className="font-medium text-slate-900">{role.name}</div>
                                        <div className="text-sm text-slate-500 mt-1">{role.permissionScope}</div>
                                    </div>
                                    <div className="text-sm font-semibold text-slate-500">#{role.rankOrder}</div>
                                </div>
                            ))}
                        </div>
                    </div>

                    <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-6">
                        <div className="flex items-center gap-2 text-slate-900 font-semibold mb-4">
                            <Users2 size={18} className="text-indigo-600" />
                            Teams
                        </div>
                        <form onSubmit={handleAddTeam} className="grid grid-cols-1 md:grid-cols-[1.4fr_140px_auto] gap-3 items-end">
                            <label className="space-y-1.5">
                                <span className="text-xs font-medium text-slate-600">Team name</span>
                                <input
                                    type="text"
                                    value={newTeamName}
                                    onChange={(event) => setNewTeamName(event.target.value)}
                                    className="w-full px-4 py-2 border border-slate-200 rounded-xl outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 text-sm"
                                    placeholder="Example: Research Squad"
                                />
                            </label>
                            <label className="space-y-1.5">
                                <span className="text-xs font-medium text-slate-600">Type</span>
                                <select
                                    value={newTeamType}
                                    onChange={(event) => setNewTeamType(event.target.value as TeamType)}
                                    className="w-full px-4 py-2 border border-slate-200 rounded-xl outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 text-sm bg-white"
                                >
                                    {teamTypeOptions.map((type) => (
                                        <option key={type} value={type}>{type}</option>
                                    ))}
                                </select>
                            </label>
                            <button
                                type="submit"
                                disabled={!newTeamName.trim()}
                                className="px-5 py-2 bg-indigo-600 text-white font-medium rounded-xl hover:bg-indigo-700 disabled:opacity-50 transition-colors h-10"
                            >
                                Add
                            </button>
                        </form>
                        <div className="mt-5 space-y-3">
                            {teams.map((team) => (
                                <div key={team.id} className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 flex items-center justify-between gap-4">
                                    <div>
                                        <div className="font-medium text-slate-900">{team.name}</div>
                                        <div className="text-sm text-slate-500 mt-1">{team.type}</div>
                                    </div>
                                    <span className={`inline-flex px-2.5 py-1 rounded-full text-xs font-semibold border ${team.isActive
                                        ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                                        : 'bg-slate-100 text-slate-700 border-slate-200'
                                        }`}>
                                        {team.isActive ? 'Active' : 'Inactive'}
                                    </span>
                                </div>
                            ))}
                        </div>
                    </div>
                </div>
            </section>

            <section className="bg-white rounded-2xl shadow-sm border border-slate-200 p-6">
                <div className="flex items-center gap-2 text-slate-900 font-semibold mb-4">
                    <CalendarDays size={18} className="text-indigo-600" />
                    Seasons
                </div>

                <form onSubmit={handleAddSeason} className="grid grid-cols-1 lg:grid-cols-[1.4fr_160px_160px_140px_auto] gap-3 items-end">
                    <label className="space-y-1.5">
                        <span className="text-xs font-medium text-slate-600">Season name</span>
                        <input
                            type="text"
                            value={newSeasonName}
                            onChange={(event) => setNewSeasonName(event.target.value)}
                            className="w-full px-4 py-2 border border-slate-200 rounded-xl outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 text-sm"
                            placeholder="Example: 2026 Fall Season"
                        />
                    </label>
                    <label className="space-y-1.5">
                        <span className="text-xs font-medium text-slate-600">Start date</span>
                        <input
                            type="date"
                            value={newSeasonStartDate}
                            onChange={(event) => setNewSeasonStartDate(event.target.value)}
                            className="w-full px-4 py-2 border border-slate-200 rounded-xl outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 text-sm"
                        />
                    </label>
                    <label className="space-y-1.5">
                        <span className="text-xs font-medium text-slate-600">End date</span>
                        <input
                            type="date"
                            value={newSeasonEndDate}
                            onChange={(event) => setNewSeasonEndDate(event.target.value)}
                            className="w-full px-4 py-2 border border-slate-200 rounded-xl outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 text-sm"
                        />
                    </label>
                    <label className="space-y-1.5">
                        <span className="text-xs font-medium text-slate-600">Status</span>
                        <select
                            value={newSeasonStatus}
                            onChange={(event) => setNewSeasonStatus(event.target.value as SeasonStatus)}
                            className="w-full px-4 py-2 border border-slate-200 rounded-xl outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 text-sm bg-white"
                        >
                            {seasonStatusOptions.map((status) => (
                                <option key={status} value={status}>{status}</option>
                            ))}
                        </select>
                    </label>
                    <button
                        type="submit"
                        disabled={!newSeasonName.trim() || !newSeasonStartDate || !newSeasonEndDate}
                        className="px-5 py-2 bg-indigo-600 text-white font-medium rounded-xl hover:bg-indigo-700 disabled:opacity-50 transition-colors h-10"
                    >
                        Add
                    </button>
                </form>

                <div className="mt-6 grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
                    {seasons.map((season) => (
                        <div key={season.id} className="rounded-2xl border border-slate-200 bg-slate-50 p-5">
                            <div className="flex items-center justify-between gap-3">
                                <div className="font-semibold text-slate-900">{season.name}</div>
                                <span className={`inline-flex px-2.5 py-1 rounded-full text-xs font-semibold border ${badgeClassByStatus[season.status]}`}>
                                    {season.status}
                                </span>
                            </div>
                            <div className="text-sm text-slate-500 mt-3">
                                {season.startDate} to {season.endDate || '-'}
                            </div>
                        </div>
                    ))}
                </div>
            </section>
        </div>
    );
};
