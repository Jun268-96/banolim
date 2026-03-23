import React, { useEffect, useState } from 'react';
import { Menu, TriangleAlert, X } from 'lucide-react';
import { Sidebar, type TabType } from './Sidebar';
import { HeaderBannerCarousel } from './HeaderBannerCarousel';
import { isSupabaseConfigured } from '../../lib/supabase';
import {
    clearLatestDataFallbackState,
    getLatestDataFallbackState,
    subscribeToDataFallbackState,
} from '../../lib/api/layout/site';

interface LayoutProps {
    activeTab: TabType;
    setActiveTab: (tab: TabType) => void;
    children: React.ReactNode;
}

export const Layout: React.FC<LayoutProps> = ({ activeTab, setActiveTab, children }) => {
    const [isSidebarOpen, setIsSidebarOpen] = useState(false);
    const [dataFallbackState, setDataFallbackState] = useState(() => getLatestDataFallbackState());
    const [dismissedFallbackId, setDismissedFallbackId] = useState<string | null>(null);

    useEffect(() => subscribeToDataFallbackState(() => {
        setDataFallbackState(getLatestDataFallbackState());
    }), []);

    const handleSelectTab = (tab: TabType) => {
        setActiveTab(tab);
        setIsSidebarOpen(false);
    };

    const visibleFallbackState =
        isSupabaseConfigured && dataFallbackState && dataFallbackState.id !== dismissedFallbackId
            ? dataFallbackState
            : null;

    const dismissFallbackState = () => {
        if (dataFallbackState) {
            setDismissedFallbackId(dataFallbackState.id);
        }
        clearLatestDataFallbackState();
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
                    {visibleFallbackState ? (
                        <div className="mb-4 flex items-start gap-3 rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900 shadow-sm">
                            <TriangleAlert size={18} className="mt-0.5 shrink-0 text-amber-600" />
                            <div className="min-w-0 flex-1">
                                <div className="font-semibold">일부 실데이터 조회가 실패했습니다.</div>
                                <div className="mt-1 text-amber-800">
                                    작업: {visibleFallbackState.task} · 원인: {visibleFallbackState.message}
                                </div>
                            </div>
                            <button
                                type="button"
                                onClick={dismissFallbackState}
                                className="inline-flex h-8 w-8 items-center justify-center rounded-xl border border-amber-200 bg-white/70 text-amber-700 transition-colors hover:bg-white"
                                aria-label="데이터 경고 닫기"
                            >
                                <X size={16} />
                            </button>
                        </div>
                    ) : null}
                    <div className="mb-5 flex items-start gap-3">
                        <div className="flex min-w-0 flex-1 items-center gap-3">
                            <button
                                type="button"
                                onClick={() => setIsSidebarOpen(true)}
                                className="inline-flex h-11 w-11 items-center justify-center rounded-2xl border border-slate-200 bg-white text-slate-700 shadow-sm transition-colors hover:bg-slate-50 lg:hidden"
                                aria-label="탭 메뉴 열기"
                            >
                                <Menu size={20} />
                            </button>
                            <HeaderBannerCarousel />
                        </div>
                    </div>
                    <div className="min-w-0">{children}</div>
                </div>
            </main>
        </div>
    );
};
