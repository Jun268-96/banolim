import React from 'react';
import { useAuth } from './AuthProvider';
import { AuthScreen } from './AuthScreen';

export const AuthShell: React.FC<{ children: React.ReactNode }> = ({ children }) => {
    const { isLoading, isAuthenticated } = useAuth();

    if (isLoading) {
        return (
            <div className="min-h-screen bg-slate-50 flex items-center justify-center">
                <div className="animate-pulse flex flex-col items-center gap-4">
                    <div className="w-12 h-12 rounded-full bg-indigo-100" />
                    <div className="text-indigo-600 font-medium">Checking access...</div>
                </div>
            </div>
        );
    }

    if (!isAuthenticated) {
        return <AuthScreen />;
    }

    return <>{children}</>;
};
