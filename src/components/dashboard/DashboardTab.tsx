import React, { useState, useEffect } from 'react';
import { Users, Plus, Award, Shield, Trash2 } from 'lucide-react';
import type { Member, Category } from '../../types';
import { getMembers, getCategories, addMember, deleteMember, awardPoints } from '../../lib/db';

const getLevelInfo = (score: number) => {
    if (score >= 200) return { level: 3, title: '수석', color: 'bg-amber-100 text-amber-700 border-amber-200' };
    if (score >= 100) return { level: 2, title: '선임', color: 'bg-emerald-100 text-emerald-700 border-emerald-200' };
    return { level: 1, title: '일반', color: 'bg-slate-100 text-slate-700 border-slate-200' };
};

export const DashboardTab: React.FC = () => {
    const [members, setMembers] = useState<Member[]>([]);
    const [categories, setCategories] = useState<Category[]>([]);
    const [newMemberName, setNewMemberName] = useState('');
    const [isLoading, setIsLoading] = useState(true);

    const loadData = async () => {
        setIsLoading(true);
        const [membersData, categoriesData] = await Promise.all([
            getMembers(),
            getCategories()
        ]);
        setMembers(membersData);
        setCategories(categoriesData);
        setIsLoading(false);
    };

    useEffect(() => {
        loadData();
    }, []);

    const handleAddMember = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!newMemberName.trim()) return;
        await addMember(newMemberName.trim());
        setNewMemberName('');
        loadData();
    };

    const handleDeleteMember = async (id: string) => {
        if (confirm('정말로 이 회원을 삭제하시겠습니까?')) {
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
                    <div className="text-indigo-600 font-medium">데이터를 불러오는 중...</div>
                </div>
            </div>
        );
    }

    return (
        <div className="space-y-6 animate-in fade-in duration-500">
            <header className="flex items-center justify-between">
                <div>
                    <h2 className="text-2xl font-bold text-slate-900 flex items-center gap-2">
                        <Users className="text-indigo-600" />
                        대시보드
                    </h2>
                    <p className="text-slate-500 mt-1">연구회 회원들의 점수와 등급을 관리합니다.</p>
                </div>

                <form onSubmit={handleAddMember} className="flex items-center gap-2 bg-white p-2 rounded-xl shadow-sm border border-slate-200">
                    <input
                        type="text"
                        placeholder="새 회원 이름..."
                        value={newMemberName}
                        onChange={(e) => setNewMemberName(e.target.value)}
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
            </header>

            <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
                <div className="overflow-x-auto">
                    <table className="w-full text-left border-collapse">
                        <thead>
                            <tr className="bg-slate-50 border-b border-slate-200 text-sm font-semibold text-slate-600">
                                <th className="py-4 px-6 w-24">등급</th>
                                <th className="py-4 px-6 w-32">이름</th>
                                <th className="py-4 px-6 w-24">총점</th>
                                <th className="py-4 px-6">보상 / 감점 부여</th>
                                <th className="py-4 px-6 w-20 text-center">관리</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100">
                            {members.map(member => {
                                const levelInfo = getLevelInfo(member.score);
                                return (
                                    <tr key={member.id} className="hover:bg-slate-50/50 transition-colors group">
                                        <td className="py-4 px-6">
                                            <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold border ${levelInfo.color}`}>
                                                {levelInfo.level >= 2 ? <Shield size={12} /> : <Award size={12} />}
                                                Lv.{levelInfo.level} {levelInfo.title}
                                            </span>
                                        </td>
                                        <td className="py-4 px-6 font-medium text-slate-900">
                                            {member.name}
                                        </td>
                                        <td className="py-4 px-6">
                                            <div className="font-bold text-lg text-indigo-600">
                                                {member.score}<span className="text-sm font-normal text-slate-400 ml-1">pt</span>
                                            </div>
                                        </td>
                                        <td className="py-4 px-6">
                                            <div className="flex flex-wrap gap-2">
                                                {categories.map(category => (
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
                                                            {category.pointValue > 0 ? '+' : ''}{category.pointValue}
                                                        </span>
                                                    </button>
                                                ))}
                                            </div>
                                        </td>
                                        <td className="py-4 px-6 text-center">
                                            <button
                                                onClick={() => handleDeleteMember(member.id)}
                                                className="p-2 text-slate-400 hover:bg-rose-50 hover:text-rose-600 rounded-lg transition-colors opacity-0 group-hover:opacity-100"
                                                title="회원 삭제"
                                            >
                                                <Trash2 size={16} />
                                            </button>
                                        </td>
                                    </tr>
                                );
                            })}

                            {members.length === 0 && (
                                <tr>
                                    <td colSpan={5} className="py-12 text-center text-slate-500">
                                        등록된 회원이 없습니다. 상단의 입력창에서 회원을 추가해보세요.
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
