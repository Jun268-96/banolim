import React from 'react';
import { Network, ShieldAlert, TableProperties, Upload, UserPlus, Users } from 'lucide-react';

type MemberDisplayMode = 'table' | 'teams' | 'organization';

interface DashboardHeaderSectionProps {
  displayMode: MemberDisplayMode;
  canManageMembers: boolean;
  onChangeDisplayMode: (mode: MemberDisplayMode) => void;
  onOpenRoleSettings: () => void;
  onOpenAddMember: () => void;
  onOpenBulkImport: () => void;
}

export const DashboardHeaderSection: React.FC<DashboardHeaderSectionProps> = ({
  displayMode,
  canManageMembers,
  onChangeDisplayMode,
  onOpenRoleSettings,
  onOpenAddMember,
  onOpenBulkImport,
}) => (
  <header>
    <div className="flex items-center justify-between gap-4">
      <div className="flex items-center gap-2">
        {canManageMembers && (
          <>
            <button
              type="button"
              onClick={onOpenAddMember}
              className="inline-flex items-center gap-2 rounded-xl bg-indigo-600 px-4 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-indigo-700"
            >
              <UserPlus size={16} />
              새 멤버
            </button>
            <button
              type="button"
              onClick={onOpenBulkImport}
              className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-semibold text-slate-700 shadow-sm transition-colors hover:bg-slate-50"
            >
              <Upload size={16} className="text-indigo-600" />
              CSV 대량 등록
            </button>
          </>
        )}
      </div>

      <div className="flex items-center gap-2">
        <div className="grid grid-cols-3 gap-1 rounded-[24px] border border-slate-200 bg-white p-2 shadow-sm">
          {([
            { id: 'table' as const, label: '표 보기', icon: TableProperties },
            { id: 'teams' as const, label: '팀 지정', icon: Users },
            { id: 'organization' as const, label: '조직도 보기', icon: Network },
          ]).map((mode) => {
            const Icon = mode.icon;
            return (
              <button
                key={mode.id}
                type="button"
                onClick={() => onChangeDisplayMode(mode.id)}
                className={`inline-flex items-center justify-center gap-2 rounded-full px-4 py-2 text-sm font-semibold transition-colors ${
                  displayMode === mode.id
                    ? 'bg-slate-900 text-white shadow-sm'
                    : 'text-slate-600 hover:bg-slate-50'
                }`}
              >
                <Icon size={16} />
                {mode.label}
              </button>
            );
          })}
        </div>
        {canManageMembers && (
          <button
            type="button"
            onClick={onOpenRoleSettings}
            className="inline-flex items-center justify-center gap-2 rounded-full border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-700 shadow-sm transition-colors hover:bg-slate-50"
          >
            <ShieldAlert size={16} className="text-indigo-600" />
            역할 설정
          </button>
        )}
      </div>
    </div>
  </header>
);
