import React from 'react';
import { Pencil, Trash2, UserPlus } from 'lucide-react';
import type { Member, TeamSummary, TeamType } from '../../../types';

interface TeamsSectionProps {
  teams: TeamSummary[];
  members: Member[];
  hiddenMembers: Member[];
  teamTypeLabels: Record<TeamType, string>;
  onAddTeam: () => void;
  onOpenTeamAssignment: (team: TeamSummary) => void;
  onEditTeam: (team: TeamSummary) => void;
  onDeleteTeam: (teamId: string) => void;
}

export const TeamsSection: React.FC<TeamsSectionProps> = ({
  teams,
  members,
  hiddenMembers,
  teamTypeLabels,
  onAddTeam,
  onOpenTeamAssignment,
  onEditTeam,
  onDeleteTeam,
}) => (
  <div className="space-y-5 p-5 sm:p-6">
    <div className="flex flex-col gap-4 rounded-[28px] border border-slate-200 bg-slate-950 p-5 text-white lg:flex-row lg:items-end lg:justify-between">
      <div>
        <div className="text-sm font-semibold text-slate-300">팀 지정</div>
        <div className="mt-2 text-sm leading-6 text-slate-300">
          각 팀 카드를 눌러 팀원을 추가하거나 제외할 수 있습니다. 한 멤버는 여러 팀에 동시에 소속될 수 있고, 첫 번째 팀이 대표 소속으로 표시됩니다.
        </div>
      </div>
      <button
        type="button"
        onClick={onAddTeam}
        className="inline-flex items-center justify-center gap-2 rounded-2xl bg-indigo-500 px-4 py-3 text-sm font-semibold text-white transition-colors hover:bg-indigo-400"
      >
        <UserPlus size={16} />
        팀 추가
      </button>
    </div>

    <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
      {teams.map((team) => {
        const visibleAssignedMembers = members.filter((member) => (member.teamIds ?? []).includes(team.id) || member.teamId === team.id);
        const hiddenAssignedCount = hiddenMembers.filter((member) => (member.teamIds ?? []).includes(team.id) || member.teamId === team.id).length;
        const assignedCount = visibleAssignedMembers.length + hiddenAssignedCount;

        return (
          <div
            key={team.id}
            className="rounded-[24px] border border-slate-200 bg-white px-5 py-5 text-left shadow-sm transition-all hover:-translate-y-0.5 hover:border-indigo-300 hover:shadow-md"
          >
            <div className="flex items-start justify-between gap-3">
              <button
                type="button"
                onClick={() => onOpenTeamAssignment(team)}
                className="min-w-0 flex-1 text-left"
              >
                <div className="font-semibold text-slate-900">{team.name}</div>
                <div className="mt-1 text-sm text-slate-500">{teamTypeLabels[team.type]}</div>
              </button>
              <div className="flex items-center gap-2">
                <span className="rounded-full border border-slate-200 bg-slate-50 px-3 py-1 text-xs font-semibold text-slate-600">
                  {assignedCount}명
                </span>
                <button
                  type="button"
                  onClick={() => onEditTeam(team)}
                  className="inline-flex h-10 w-10 items-center justify-center rounded-2xl border border-slate-200 bg-white text-slate-500 transition-colors hover:bg-slate-50 hover:text-slate-900"
                  title="팀 수정"
                >
                  <Pencil size={16} />
                </button>
                <button
                  type="button"
                  onClick={() => onDeleteTeam(team.id)}
                  className="inline-flex h-10 w-10 items-center justify-center rounded-2xl border border-slate-200 bg-white text-slate-500 transition-colors hover:bg-rose-50 hover:text-rose-600"
                  title="팀 삭제"
                >
                  <Trash2 size={16} />
                </button>
              </div>
            </div>
            <button
              type="button"
              onClick={() => onOpenTeamAssignment(team)}
              className="mt-4 block w-full text-left"
            >
              <div className="flex flex-wrap gap-2">
                {visibleAssignedMembers
                  .slice(0, 5)
                  .map((member) => (
                    <span
                      key={`${team.id}-${member.id}`}
                      className="rounded-full border border-indigo-200 bg-indigo-50 px-3 py-1 text-xs font-semibold text-indigo-700"
                    >
                      {member.name}
                    </span>
                  ))}
                {assignedCount > 5 && (
                  <span className="rounded-full border border-slate-200 bg-slate-50 px-3 py-1 text-xs font-semibold text-slate-500">
                    +{assignedCount - 5}명
                  </span>
                )}
                {hiddenAssignedCount > 0 && (
                  <span className="rounded-full border border-amber-200 bg-amber-50 px-3 py-1 text-xs font-semibold text-amber-700">
                    숨김 {hiddenAssignedCount}명
                  </span>
                )}
              </div>
            </button>
          </div>
        );
      })}
    </div>
  </div>
);
