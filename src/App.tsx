import { useMemo, useState } from 'react';
import { Layout } from './components/layout/Layout';
import type { TabType } from './components/layout/Sidebar';
import { DashboardTab } from './components/dashboard/DashboardTab';
import { SettingsTab } from './components/settings/SettingsTab';
import { StatsTab } from './components/stats/StatsTab';
import { ActivitiesTab } from './components/activities/ActivitiesTab';
import { PointsTab } from './components/points/PointsTab';
import { HomeTab } from './components/home/HomeTab';
import { MemberHomeTab } from './components/home/MemberHomeTab';
import { AuthShell } from './components/auth/AuthShell';
import { useAuth } from './components/auth/auth-context';

const getFirstAllowedTab = (permissions: ReturnType<typeof useAuth>['permissions']): TabType => {
  if (permissions.canViewHome) return 'home';
  if (permissions.canViewMembers) return 'dashboard';
  if (permissions.canViewActivities) return 'activities';
  if (permissions.canManagePoints) return 'points';
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
      ...(permissions.canManagePoints ? ['points' as const] : []),
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
      {resolvedActiveTab === 'home' && (role === 'member' ? <MemberHomeTab /> : <HomeTab onNavigate={setActiveTab} />)}
      {resolvedActiveTab === 'dashboard' && <DashboardTab />}
      {resolvedActiveTab === 'activities' && <ActivitiesTab />}
      {resolvedActiveTab === 'points' && <PointsTab />}
      {resolvedActiveTab === 'settings' && <SettingsTab />}
      {resolvedActiveTab === 'stats' && <StatsTab />}
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
