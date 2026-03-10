import { useState } from 'react';
import { Layout } from './components/layout/Layout';
import type { TabType } from './components/layout/Sidebar';
import { DashboardTab } from './components/dashboard/DashboardTab';
import { SettingsTab } from './components/settings/SettingsTab';
import { StatsTab } from './components/stats/StatsTab';

function App() {
  const [activeTab, setActiveTab] = useState<TabType>('dashboard');

  return (
    <Layout activeTab={activeTab} setActiveTab={setActiveTab}>
      {activeTab === 'dashboard' && <DashboardTab />}
      {activeTab === 'settings' && <SettingsTab />}
      {activeTab === 'stats' && <StatsTab />}
    </Layout>
  );
}

export default App;
