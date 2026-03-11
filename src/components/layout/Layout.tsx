import React, { useState } from 'react';
import { Menu } from 'lucide-react';
import { Sidebar, type TabType } from './Sidebar';
import { useAuth } from '../auth/auth-context';
import { roleLabels } from '../../lib/permissions';
import { isAuthBypassed } from '../../lib/supabase';

interface LayoutProps {
    activeTab: TabType;
    setActiveTab: (tab: TabType) => void;
    children: React.ReactNode;
}

export const Layout: React.FC<LayoutProps> = ({ activeTab, setActiveTab, children }) => {
    const { profile, role, signOut } = useAuth();
    const [isSidebarOpen, setIsSidebarOpen] = useState(false);

    const handleSelectTab = (tab: TabType) => {
        setActiveTab(tab);
        setIsSidebarOpen(false);
    };

    return (
        <div className="min-h-screen bg-slate-50 font-sans text-slate-900 lg:grid lg:grid-cols-[5.5rem_minmax(0,1fr)] xl:grid-cols-[16rem_minmax(0,1fr)]">
            <Sidebar
                activeTab={activeTab}
                setActiveTab={handleSelectTab}
                isOpen={isSidebarOpen}
                onClose={() => setIsSidebarOpen(false)}
            />
            <main className="relative min-w-0 overflow-x-visible">
                <div className="min-h-full w-full px-4 py-4 sm:px-5 sm:py-5 lg:px-6 lg:py-6 xl:px-8">
                    <div className="mb-5 flex flex-wrap items-start justify-between gap-3 lg:items-center">
                        <div className="flex items-center gap-3 lg:hidden">
                            <button
                                type="button"
                                onClick={() => setIsSidebarOpen(true)}
                                className="inline-flex h-11 w-11 items-center justify-center rounded-2xl border border-slate-200 bg-white text-slate-700 shadow-sm transition-colors hover:bg-slate-50"
                                aria-label="탭 메뉴 열기"
                            >
                                <Menu size={20} />
                            </button>
                            <div>
                                <div className="text-xs font-semibold uppercase tracking-[0.24em] text-slate-400">Banollim</div>
                                <div className="text-lg font-bold text-slate-900">반올림 운영 공간</div>
                            </div>
                        </div>

                        <div className="ml-auto flex flex-wrap items-center justify-end gap-2 sm:gap-3">
                            <div className="min-w-[180px] rounded-2xl border border-slate-200 bg-white px-4 py-2 text-right shadow-sm sm:min-w-[220px]">
                                <div className="truncate text-sm font-semibold text-slate-900">{profile?.displayName || profile?.email || '로그인 사용자'}</div>
                                <div className="text-xs text-slate-500">{roleLabels[role]}</div>
                            </div>
                            {isAuthBypassed ? (
                                <div className="rounded-2xl border border-amber-200 bg-amber-50 px-4 py-2 text-sm font-medium text-amber-800 shadow-sm">
                                    개발용 관리자 우회
                                </div>
                            ) : (
                                <button
                                    type="button"
                                    onClick={() => void signOut()}
                                    className="rounded-2xl border border-slate-200 bg-white px-4 py-2 text-sm font-medium text-slate-700 transition-colors hover:bg-slate-50"
                                >
                                    로그아웃
                                </button>
                            )}
                        </div>
                    </div>
                    <div className="min-w-0">{children}</div>
                </div>
            </main>
        </div>
    );
};
