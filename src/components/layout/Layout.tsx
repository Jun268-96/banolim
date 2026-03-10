import React from 'react';
import { Sidebar, type TabType } from './Sidebar';

interface LayoutProps {
    activeTab: TabType;
    setActiveTab: (tab: TabType) => void;
    children: React.ReactNode;
}

export const Layout: React.FC<LayoutProps> = ({ activeTab, setActiveTab, children }) => {
    return (
        <div className="flex bg-slate-50 text-slate-900 font-sans min-h-screen">
            <Sidebar activeTab={activeTab} setActiveTab={setActiveTab} />
            <main className="flex-1 overflow-auto relative">
                <div className="p-8 max-w-6xl mx-auto min-h-full">
                    {children}
                </div>
            </main>
        </div>
    );
};
