import { Suspense, lazy, useMemo, useState } from 'react';
import { Layout } from './components/layout/Layout';
import type { TabType } from './components/layout/Sidebar';
import { AuthShell } from './components/auth/AuthShell';
import { useAuth } from './components/auth/auth-context';

const DashboardTab = lazy(() => import('./components/dashboard/DashboardTab').then((module) => ({ default: module.DashboardTab })));
const SettingsTab = lazy(() => import('./components/settings/SettingsTab').then((module) => ({ default: module.SettingsTab })));
const StatsTab = lazy(() => import('./components/stats/StatsTab').then((module) => ({ default: module.StatsTab })));
const ActivitiesTab = lazy(() => import('./components/activities/ActivitiesTab').then((module) => ({ default: module.ActivitiesTab })));
const HomeTab = lazy(() => import('./components/home/HomeTab').then((module) => ({ default: module.HomeTab })));
const MemberHomeTab = lazy(() => import('./components/home/MemberHomeTab').then((module) => ({ default: module.MemberHomeTab })));

const AppTabFallback = () => (
  <div className="flex h-64 items-center justify-center">
    <div className="animate-pulse flex flex-col items-center gap-4">
      <div className="h-12 w-12 rounded-full bg-indigo-100" />
      <div className="font-medium text-indigo-600">탭 화면을 불러오는 중...</div>
    </div>
  </div>
);

const getFirstAllowedTab = (permissions: ReturnType<typeof useAuth>['permissions']): TabType => {
  if (permissions.canViewHome) return 'home';
  if (permissions.canViewMembers) return 'dashboard';
  if (permissions.canViewActivities) return 'activities';
  if (permissions.canManageSettings) return 'settings';
  return 'stats';
};

function AppBody() {
  const { permissions, role } = useAuth();
  const [activeTab, setActiveTab] = useState<TabType>(getFirstAllowedTab(permissions));

  const allowedTabs = useMemo<TabType[]>(
    () => [
      ...(permissions.canViewHome ? ['home' as const] : []),
      ...(permissions.canViewMembers ? ['dashboard' as const] : []),
      ...(permissions.canViewActivities ? ['activities' as const] : []),
      ...(permissions.canManageSettings ? ['settings' as const] : []),
      ...(permissions.canViewStats ? ['stats' as const] : []),
    ],
    [permissions],
  );

  const resolvedActiveTab = allowedTabs.includes(activeTab)
    ? activeTab
    : (allowedTabs[0] ?? 'home');

  return (
    <Layout activeTab={resolvedActiveTab} setActiveTab={setActiveTab}>
      <Suspense fallback={<AppTabFallback />}>
        {resolvedActiveTab === 'home' && (role === 'member' ? <MemberHomeTab /> : <HomeTab onNavigate={setActiveTab} />)}
        {resolvedActiveTab === 'dashboard' && <DashboardTab />}
        {resolvedActiveTab === 'activities' && <ActivitiesTab />}
        {resolvedActiveTab === 'settings' && <SettingsTab />}
        {resolvedActiveTab === 'stats' && <StatsTab />}
      </Suspense>
    </Layout>
  );
}

function App() {
  return (
    <AuthShell>
      <AppBody />
    </AuthShell>
  );
}

export default App;
