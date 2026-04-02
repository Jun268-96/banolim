import React from 'react';
import { Settings, BarChart3, Users, ClipboardList, House, UserRound, X } from 'lucide-react';
import clsx from 'clsx';
import { isAuthBypassed, isSupabaseConfigured } from '../../lib/supabase';
import { useAuth } from '../auth/auth-context';
import { roleLabels } from '../../lib/permissions';

const didiLogoUrl = new URL('../../../디디.png', import.meta.url).href;

export type TabType = 'home' | 'dashboard' | 'activities' | 'settings' | 'stats';

interface SidebarProps {
    activeTab: TabType;
    setActiveTab: (tab: TabType) => void;
    isOpen: boolean;
    onClose: () => void;
}

export const Sidebar: React.FC<SidebarProps> = ({ activeTab, setActiveTab, isOpen, onClose }) => {
    const { permissions, profile, role, signOut } = useAuth();

    const navItems = [
        { id: 'home', label: role === 'member' ? '내 상태' : '홈', icon: role === 'member' ? UserRound : House, visible: permissions.canViewHome },
        { id: 'dashboard', label: '멤버', icon: Users, visible: permissions.canViewMembers },
        { id: 'activities', label: '활동', icon: ClipboardList, visible: permissions.canViewActivities },
        { id: 'settings', label: '설정', icon: Settings, visible: permissions.canManageSettings },
        { id: 'stats', label: '통계', icon: BarChart3, visible: permissions.canViewStats },
    ] as const;

    const visibleItems = navItems.filter((item) => item.visible);

    const accountPanel = (compact: boolean) => (
        <div className={clsx('border-t border-slate-100', compact ? 'px-3 py-4 xl:px-4' : 'px-4 py-4')}>
            <div className={clsx('rounded-3xl border border-slate-200 bg-white px-4 py-4 shadow-sm', compact && 'xl:px-4')}>
                <div className={clsx('min-w-0', compact ? 'text-center xl:text-left' : 'text-left')}>
                    <div className="truncate text-sm font-semibold text-slate-900">
                        {profile?.displayName || profile?.email || '로그인 사용자'}
                    </div>
                    <div className="mt-1 text-xs text-slate-500">{roleLabels[role]}</div>
                </div>

                <div className={clsx('mt-3 flex flex-col gap-2', compact ? 'xl:flex-col' : '')}>
                    {isAuthBypassed ? (
                        <div className="rounded-2xl border border-amber-200 bg-amber-50 px-3 py-2 text-center text-xs font-medium text-amber-800">
                            개발용 관리자 우회
                        </div>
                    ) : null}
                    <button
                        type="button"
                        onClick={() => void signOut()}
                        className="rounded-2xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm font-medium text-slate-700 transition-colors hover:bg-slate-100"
                    >
                        로그아웃
                    </button>
                </div>
            </div>

            <div className="mt-3 text-center text-xs text-slate-400">
                <div className={clsx(compact && 'hidden xl:block')}>반올림 플랫폼 v0.5</div>
                <div className="mt-1">{isSupabaseConfigured ? 'Supabase' : '로컬 mock'}</div>
            </div>
        </div>
    );

    const renderNav = (compact: boolean) => (
        <nav className={clsx('flex-1 space-y-2', compact ? 'px-3 py-4' : 'p-4')}>
            {visibleItems.map((item) => {
                const Icon = item.icon;
                const isActive = activeTab === item.id;
                return (
                    <button
                        key={item.id}
                        type="button"
                        onClick={() => setActiveTab(item.id)}
                        title={compact ? item.label : undefined}
                        className={clsx(
                            'w-full rounded-2xl text-sm font-medium transition-all duration-200',
                            compact ? 'flex justify-center px-3 py-3 xl:justify-start xl:px-4' : 'flex items-center gap-3 px-4 py-3',
                            isActive
                                ? 'bg-indigo-50 text-indigo-700 shadow-sm ring-1 ring-indigo-100'
                                : 'text-slate-600 hover:bg-slate-50 hover:text-slate-900',
                        )}
                    >
                        <Icon size={18} className={clsx(isActive ? 'text-indigo-600' : 'text-slate-400')} />
                        {compact ? <span className="hidden xl:inline">{item.label}</span> : <span>{item.label}</span>}
                    </button>
                );
            })}
        </nav>
    );

    return (
        <>
            <div
                className={clsx(
                    'fixed inset-0 z-40 bg-slate-950/45 backdrop-blur-sm transition-opacity lg:hidden',
                    isOpen ? 'pointer-events-auto opacity-100' : 'pointer-events-none opacity-0',
                )}
                onClick={onClose}
                aria-hidden="true"
            />

            <aside
                className={clsx(
                    'fixed inset-y-0 left-0 z-50 flex w-[19rem] max-w-[85vw] flex-col border-r border-slate-200 bg-white shadow-2xl transition-transform lg:hidden',
                    isOpen ? 'translate-x-0' : '-translate-x-full',
                )}
            >
                <div className="flex items-center justify-between border-b border-slate-100 px-5 py-5">
                    <div className="flex items-center gap-3">
                        <img src={didiLogoUrl} alt="디디 로고" className="h-10 w-10 rounded-xl object-contain" />
                        <div>
                            <div className="text-lg font-bold text-transparent bg-gradient-to-r from-indigo-600 to-sky-500 bg-clip-text">반올림</div>
                            <div className="text-xs text-slate-400">운영 플랫폼</div>
                        </div>
                    </div>
                    <button
                        type="button"
                        onClick={onClose}
                        className="inline-flex h-10 w-10 items-center justify-center rounded-2xl border border-slate-200 text-slate-600 transition-colors hover:bg-slate-50"
                        aria-label="탭 메뉴 닫기"
                    >
                        <X size={18} />
                    </button>
                </div>
                {renderNav(false)}
                {accountPanel(false)}
            </aside>

            <aside className="sticky top-0 hidden min-h-screen flex-col border-r border-slate-200 bg-white shadow-sm lg:flex">
                <div className="border-b border-slate-100 px-4 py-5 xl:px-6">
                    <div className="flex items-center justify-center gap-3 xl:justify-start">
                        <img src={didiLogoUrl} alt="디디 로고" className="h-10 w-10 rounded-xl object-contain" />
                        <div className="hidden xl:block">
                            <div className="text-xl font-bold text-transparent bg-gradient-to-r from-indigo-600 to-sky-500 bg-clip-text">
                                반올림
                            </div>
                            <div className="text-xs text-slate-400">운영 플랫폼</div>
                        </div>
                    </div>
                </div>

                {renderNav(true)}
                {accountPanel(true)}
            </aside>
        </>
    );
};
