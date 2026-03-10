import React from 'react';
import { Settings, BarChart3, Users, ClipboardList, Coins, House, UserRound } from 'lucide-react';
import clsx from 'clsx';
import { isSupabaseConfigured } from '../../lib/supabase';
import { useAuth } from '../auth/auth-context';

export type TabType = 'home' | 'dashboard' | 'activities' | 'points' | 'settings' | 'stats';

interface SidebarProps {
    activeTab: TabType;
    setActiveTab: (tab: TabType) => void;
}

export const Sidebar: React.FC<SidebarProps> = ({ activeTab, setActiveTab }) => {
    const { permissions, role } = useAuth();

    const navItems = [
        { id: 'home', label: role === 'member' ? '내 상태' : '홈', icon: role === 'member' ? UserRound : House, visible: permissions.canViewHome },
        { id: 'dashboard', label: '멤버', icon: Users, visible: permissions.canViewMembers },
        { id: 'activities', label: '활동', icon: ClipboardList, visible: permissions.canViewActivities },
        { id: 'points', label: '점수', icon: Coins, visible: permissions.canManagePoints },
        { id: 'settings', label: '설정', icon: Settings, visible: permissions.canManageSettings },
        { id: 'stats', label: '통계 · 리캡', icon: BarChart3, visible: permissions.canViewStats },
    ] as const;

    return (
        <aside className="w-64 bg-white border-r border-slate-200 min-h-screen flex flex-col sticky top-0 shadow-sm z-10">
            <div className="p-6 border-b border-slate-100 flex items-center gap-3">
                <div className="w-8 h-8 rounded-lg bg-indigo-600 flex items-center justify-center text-white font-bold">
                    반
                </div>
                <h1 className="text-xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-indigo-600 to-sky-500">
                    반올림
                </h1>
            </div>

            <nav className="flex-1 p-4 space-y-2">
                {navItems.filter((item) => item.visible).map((item) => {
                    const Icon = item.icon;
                    const isActive = activeTab === item.id;
                    return (
                        <button
                            key={item.id}
                            onClick={() => setActiveTab(item.id)}
                            className={clsx(
                                'w-full flex items-center gap-3 px-4 py-3 rounded-xl transition-all duration-200 text-sm font-medium',
                                isActive
                                    ? 'bg-indigo-50 text-indigo-700 shadow-sm ring-1 ring-indigo-100'
                                    : 'text-slate-600 hover:bg-slate-50 hover:text-slate-900',
                            )}
                        >
                            <Icon size={18} className={clsx(isActive ? 'text-indigo-600' : 'text-slate-400')} />
                            {item.label}
                        </button>
                    );
                })}
            </nav>

            <div className="p-4 border-t border-slate-100 text-xs text-slate-400 text-center space-y-1">
                <div>반올림 플랫폼 v0.5</div>
                <div>{isSupabaseConfigured ? '데이터 소스: Supabase' : '데이터 소스: 로컬 mock'}</div>
            </div>
        </aside>
    );
};
