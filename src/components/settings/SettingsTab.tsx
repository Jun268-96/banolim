import React, { useState, useEffect } from 'react';
import { Settings, Plus, Trash2 } from 'lucide-react';
import type { Category } from '../../types';
import { getCategories, addCategory, deleteCategory } from '../../lib/db';

export const SettingsTab: React.FC = () => {
    const [categories, setCategories] = useState<Category[]>([]);
    const [newCatName, setNewCatName] = useState('');
    const [newCatValue, setNewCatValue] = useState<number>(10);
    const [isLoading, setIsLoading] = useState(true);

    const loadData = async () => {
        setIsLoading(true);
        const categoriesData = await getCategories();
        setCategories(categoriesData);
        setIsLoading(false);
    };

    useEffect(() => {
        loadData();
    }, []);

    const handleAddCategory = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!newCatName.trim()) return;
        await addCategory(newCatName.trim(), newCatValue);
        setNewCatName('');
        setNewCatValue(10);
        loadData();
    };

    const handleDeleteCategory = async (id: string) => {
        if (confirm('이 보상 항목을 삭제하시겠습니까? (기존 점수 내역은 유지됩니다)')) {
            await deleteCategory(id);
            loadData();
        }
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
                        <Settings className="text-indigo-600" />
                        보상 항목 설정
                    </h2>
                    <p className="text-slate-500 mt-1">대시보드에 표시될 점수 부여/차감 항목을 관리합니다.</p>
                </div>
            </header>

            <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
                <div className="p-6 border-b border-slate-200 bg-slate-50/50">
                    <h3 className="text-sm font-semibold text-slate-900 mb-4">새 항목 추가</h3>
                    <form onSubmit={handleAddCategory} className="flex items-end gap-4">
                        <div className="flex-1 space-y-1.5">
                            <label htmlFor="catName" className="text-xs font-medium text-slate-600">항목명</label>
                            <input
                                id="catName"
                                type="text"
                                placeholder="예: 정기모임 출석, 과제 제출 등"
                                value={newCatName}
                                onChange={(e) => setNewCatName(e.target.value)}
                                className="w-full px-4 py-2 border border-slate-200 rounded-xl outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 transition-all text-sm"
                            />
                        </div>
                        <div className="w-32 space-y-1.5">
                            <label htmlFor="catValue" className="text-xs font-medium text-slate-600">점수 (+/-)</label>
                            <input
                                id="catValue"
                                type="number"
                                value={newCatValue}
                                onChange={(e) => setNewCatValue(parseInt(e.target.value))}
                                className="w-full px-4 py-2 border border-slate-200 rounded-xl outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 transition-all text-sm"
                            />
                        </div>
                        <button
                            type="submit"
                            disabled={!newCatName.trim()}
                            className="px-6 py-2 bg-indigo-600 text-white font-medium rounded-xl hover:bg-indigo-700 disabled:opacity-50 transition-colors flex items-center gap-2 h-10"
                        >
                            <Plus size={18} />
                            추가
                        </button>
                    </form>
                </div>

                <div>
                    <table className="w-full text-left border-collapse">
                        <thead>
                            <tr className="bg-white border-b border-slate-100 text-sm font-semibold text-slate-600">
                                <th className="py-4 px-6">항목명</th>
                                <th className="py-4 px-6 w-32">점수 설정</th>
                                <th className="py-4 px-6 w-20 text-center">관리</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100">
                            {categories.map(category => (
                                <tr key={category.id} className="hover:bg-slate-50 transition-colors group">
                                    <td className="py-4 px-6 font-medium text-slate-900">
                                        {category.categoryName}
                                    </td>
                                    <td className="py-4 px-6">
                                        <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-bold border ${category.pointValue > 0
                                                ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                                                : 'bg-rose-50 text-rose-700 border-rose-200'
                                            }`}>
                                            {category.pointValue > 0 ? '+' : ''}{category.pointValue}pt
                                        </span>
                                    </td>
                                    <td className="py-4 px-6 text-center">
                                        <button
                                            onClick={() => handleDeleteCategory(category.id)}
                                            className="p-2 text-slate-400 hover:bg-rose-50 hover:text-rose-600 rounded-lg transition-colors opacity-0 group-hover:opacity-100"
                                            title="항목 삭제"
                                        >
                                            <Trash2 size={16} />
                                        </button>
                                    </td>
                                </tr>
                            ))}

                            {categories.length === 0 && (
                                <tr>
                                    <td colSpan={3} className="py-12 text-center text-slate-500">
                                        등록된 항목이 없습니다. 상단에서 새로운 항목을 추가해보세요.
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
