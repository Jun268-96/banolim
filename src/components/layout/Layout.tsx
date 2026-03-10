import React from 'react';
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

    return (
        <div className="flex bg-slate-50 text-slate-900 font-sans min-h-screen">
            <Sidebar activeTab={activeTab} setActiveTab={setActiveTab} />
            <main className="flex-1 overflow-auto relative">
                <div className="min-h-full w-full px-5 py-6 lg:px-6 xl:px-8">
                    <div className="mb-5 flex items-center justify-end gap-3">
                        <div className="rounded-2xl border border-slate-200 bg-white px-4 py-2 text-right shadow-sm">
                            <div className="text-sm font-semibold text-slate-900">{profile?.displayName || profile?.email || '로그인 사용자'}</div>
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
                                className="rounded-2xl border border-slate-200 bg-white px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 transition-colors"
                            >
                                로그아웃
                            </button>
                        )}
                    </div>
                    {children}
                </div>
            </main>
        </div>
    );
};
