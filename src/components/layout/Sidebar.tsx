import React from 'react';
import { Settings, BarChart3, Users, ClipboardList, Coins, House } from 'lucide-react';
import clsx from 'clsx';
import { isSupabaseConfigured } from '../../lib/supabase';
import { useAuth } from '../auth/AuthProvider';

export type TabType = 'home' | 'dashboard' | 'activities' | 'points' | 'settings' | 'stats';

interface SidebarProps {
    activeTab: TabType;
    setActiveTab: (tab: TabType) => void;
}

export const Sidebar: React.FC<SidebarProps> = ({ activeTab, setActiveTab }) => {
    const { permissions } = useAuth();

    const navItems = [
        { id: 'home', label: 'Home', icon: House, visible: permissions.canViewHome },
        { id: 'dashboard', label: 'Members', icon: Users, visible: permissions.canViewMembers },
        { id: 'activities', label: 'Activities', icon: ClipboardList, visible: permissions.canViewActivities },
        { id: 'points', label: 'Points', icon: Coins, visible: permissions.canManagePoints },
        { id: 'settings', label: 'Settings', icon: Settings, visible: permissions.canManageSettings },
        { id: 'stats', label: 'Stats & Recap', icon: BarChart3, visible: permissions.canViewStats },
    ] as const;

    return (
        <aside className="w-64 bg-white border-r border-slate-200 min-h-screen flex flex-col sticky top-0 shadow-sm z-10">
            <div className="p-6 border-b border-slate-100 flex items-center gap-3">
                <div className="w-8 h-8 rounded-lg bg-indigo-600 flex items-center justify-center text-white font-bold">
                    R
                </div>
                <h1 className="text-xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-indigo-600 to-sky-500">
                    Banollim
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
                <div>Banollim Platform v0.5</div>
                <div>{isSupabaseConfigured ? 'Data source: Supabase' : 'Data source: Local mock'}</div>
            </div>
        </aside>
    );
};
