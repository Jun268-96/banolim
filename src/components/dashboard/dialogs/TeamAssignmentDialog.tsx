import React from 'react';
import { Check, Search } from 'lucide-react';
import type { Member, TeamSummary, TeamType } from '../../../types';
import { AppDialog } from '../../shared/AppDialog';

interface TeamAssignmentDialogProps {
  isOpen: boolean;
  selectedTeam: TeamSummary | null;
  teamTypeLabels: Record<TeamType, string>;
  actualAssignedCount: number;
  teamAssignmentQuery: string;
  draftTeamMemberIds: string[];
  hiddenTeamMembers: Member[];
  teamMembers: Member[];
  assignableMembers: Member[];
  hasTeamAssignmentChanges: boolean;
  isSavingTeamAssignment: boolean;
  onClose: () => void;
  onChangeQuery: (value: string) => void;
  onToggleMember: (memberId: string) => void;
  onResetDraft: () => void;
  onSave: () => void;
  getMemberTeamLabels: (member: Member) => string[];
}

export const TeamAssignmentDialog: React.FC<TeamAssignmentDialogProps> = ({
  isOpen,
  selectedTeam,
  teamTypeLabels,
  actualAssignedCount,
  teamAssignmentQuery,
  draftTeamMemberIds,
  hiddenTeamMembers,
  teamMembers,
  assignableMembers,
  hasTeamAssignmentChanges,
  isSavingTeamAssignment,
  onClose,
  onChangeQuery,
  onToggleMember,
  onResetDraft,
  onSave,
  getMemberTeamLabels,
}) => (
  <AppDialog
    isOpen={isOpen && Boolean(selectedTeam)}
    title={selectedTeam ? `${selectedTeam.name} 팀원 지정` : '팀원 지정'}
    description="카드를 눌러 선택한 뒤 저장할 때만 실제 팀 배정에 반영됩니다."
    size="xl"
    onClose={onClose}
  >
    {selectedTeam && (
      <div className="space-y-5">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <div className="text-sm font-semibold text-indigo-600">팀 지정</div>
            <div className="mt-1 text-xl font-bold text-slate-900">{selectedTeam.name}</div>
            <div className="mt-2 text-sm text-slate-500">
              {teamTypeLabels[selectedTeam.type]} · 현재 {actualAssignedCount}명 배정
            </div>
          </div>
          <label className="relative block lg:w-[320px]">
            <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              value={teamAssignmentQuery}
              onChange={(event) => onChangeQuery(event.target.value)}
              placeholder="이름 또는 직책으로 검색"
              className="w-full rounded-xl border border-slate-200 bg-white py-2.5 pl-9 pr-3 text-sm outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500"
            />
          </label>
        </div>

        <div className="rounded-[24px] border border-slate-200 bg-slate-50 px-4 py-4">
          <div className="flex flex-wrap items-center gap-2">
            <span className="rounded-full border border-indigo-200 bg-indigo-50 px-3 py-1 text-xs font-semibold text-indigo-700">
              선택 {draftTeamMemberIds.length}명
            </span>
            <span className="rounded-full border border-slate-200 bg-white px-3 py-1 text-xs font-semibold text-slate-600">
              숨김 유지 {hiddenTeamMembers.length}명
            </span>
            {hasTeamAssignmentChanges && (
              <span className="rounded-full border border-amber-200 bg-amber-50 px-3 py-1 text-xs font-semibold text-amber-700">
                저장 전 변경 사항 있음
              </span>
            )}
          </div>
          <div className="mt-3 flex flex-wrap gap-2">
            {teamMembers.length > 0 ? teamMembers.map((member) => (
              <span
                key={`${selectedTeam.id}-${member.id}`}
                className="rounded-full border border-indigo-200 bg-indigo-50 px-3 py-1 text-xs font-semibold text-indigo-700"
              >
                {member.name}
              </span>
            )) : (
              <span className="text-sm text-slate-400">현재 공개 멤버 중 배정된 인원이 없습니다.</span>
            )}
            {hiddenTeamMembers.map((member) => (
              <span
                key={`${selectedTeam.id}-hidden-${member.id}`}
                className="rounded-full border border-amber-200 bg-amber-50 px-3 py-1 text-xs font-semibold text-amber-700"
              >
                숨김 · {member.name}
              </span>
            ))}
          </div>
        </div>

        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4 2xl:grid-cols-5">
          {assignableMembers.map((member) => {
            const memberTeams = getMemberTeamLabels(member);
            const isChecked = draftTeamMemberIds.includes(member.id);

            return (
              <button
                key={member.id}
                type="button"
                onClick={() => onToggleMember(member.id)}
                className={`rounded-[24px] border px-4 py-4 text-left transition-all ${
                  isChecked
                    ? 'border-indigo-400 bg-indigo-50 shadow-sm shadow-indigo-100'
                    : 'border-slate-200 bg-white hover:border-slate-300 hover:shadow-sm'
                }`}
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <div>
                      <div className="font-semibold text-slate-900">{member.name}</div>
                      <div className="mt-1 text-sm text-slate-500">{member.roleName ?? '직책 미지정'}</div>
                    </div>
                  </div>
                  <span className={`inline-flex h-7 w-7 items-center justify-center rounded-full border ${isChecked ? 'border-indigo-300 bg-indigo-600 text-white' : 'border-slate-200 bg-white text-slate-300'}`}>
                    <Check size={15} />
                  </span>
                </div>
                <div className="mt-4 flex flex-wrap gap-2">
                  {memberTeams.length > 0 ? memberTeams.map((teamName) => (
                    <span
                      key={`${member.id}-${teamName}`}
                      className={`rounded-full border px-3 py-1 text-xs font-semibold ${teamName === selectedTeam.name && isChecked ? 'border-indigo-200 bg-white text-indigo-700' : 'border-slate-200 bg-slate-50 text-slate-600'}`}
                    >
                      {teamName}
                    </span>
                  )) : (
                    <span className="rounded-full border border-dashed border-slate-200 bg-slate-50 px-3 py-1 text-xs font-semibold text-slate-400">
                      팀 미지정
                    </span>
                  )}
                </div>
              </button>
            );
          })}
        </div>

        {assignableMembers.length === 0 && (
          <div className="rounded-[24px] border border-dashed border-slate-300 bg-slate-50 px-6 py-10 text-center text-sm text-slate-500">
            검색 조건에 맞는 공개 멤버가 없습니다.
          </div>
        )}

        <div className="flex flex-wrap items-center justify-between gap-3 border-t border-slate-200 pt-4">
          <div className="text-sm text-slate-500">
            숨김 멤버 {hiddenTeamMembers.length}명은 이 모달에서 노출되지 않지만 저장 시 그대로 유지됩니다.
          </div>
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={onResetDraft}
              className="rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-medium text-slate-700 transition-colors hover:bg-slate-50"
            >
              초기화
            </button>
            <button
              type="button"
              onClick={onClose}
              className="rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-medium text-slate-700 transition-colors hover:bg-slate-50"
            >
              취소
            </button>
            <button
              type="button"
              onClick={onSave}
              disabled={isSavingTeamAssignment || !hasTeamAssignmentChanges}
              className="rounded-xl bg-indigo-600 px-4 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-indigo-700 disabled:opacity-50"
            >
              {isSavingTeamAssignment ? '저장 중...' : '저장'}
            </button>
          </div>
        </div>
      </div>
    )}
  </AppDialog>
);
