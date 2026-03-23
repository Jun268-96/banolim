import React, { useMemo } from 'react';
import type { Member } from '../../../types';

interface OrganizationSectionProps {
  members: Member[];
  selectedMemberId: string | null;
  onSelectMember: (memberId: string) => void;
}

interface OrganizationNodeProps {
  member: Member;
  selected: boolean;
  onSelect: () => void;
}

const OrganizationNode: React.FC<OrganizationNodeProps> = ({
  member,
  selected,
  onSelect,
}) => (
  <button
    type="button"
    onClick={onSelect}
    className={`relative flex min-h-[72px] w-full flex-col items-center justify-center rounded-xl border px-3 py-2.5 text-center transition-all ${
      selected
        ? 'border-blue-700 bg-blue-700 text-white shadow-lg shadow-blue-200'
        : 'border-blue-500 bg-blue-500 text-white hover:border-blue-600 hover:bg-blue-600 hover:shadow-md hover:shadow-blue-100'
    }`}
  >
    <div className="text-sm font-bold sm:text-[15px]">{member.name}</div>
    <div className={`mt-0.5 text-[11px] font-medium ${selected ? 'text-blue-100' : 'text-blue-50'}`}>
      {member.roleName ?? '직책 미지정'}
    </div>
  </button>
);

export const OrganizationSection: React.FC<OrganizationSectionProps> = ({
  members,
  selectedMemberId,
  onSelectMember,
}) => {
  const organizationGroups = useMemo(() => {
    const sortByRoleThenName = (left: Member, right: Member) => {
      const roleCompare = (left.roleName ?? '').localeCompare(right.roleName ?? '');
      return roleCompare || left.name.localeCompare(right.name);
    };

    const developerAdmins: Member[] = [];
    const chairs: Member[] = [];
    const viceChairs: Member[] = [];
    const leaders: Member[] = [];
    const generalMembers: Member[] = [];

    members.forEach((member) => {
      const roleName = member.roleName ?? '';

      if (roleName.includes('개발 관리자')) {
        developerAdmins.push(member);
        return;
      }

      if (roleName === '회장') {
        chairs.push(member);
        return;
      }

      if (roleName === '부회장') {
        viceChairs.push(member);
        return;
      }

      if (/(팀장|스터디장)/.test(roleName)) {
        leaders.push(member);
        return;
      }

      generalMembers.push(member);
    });

    return {
      developerAdmins: developerAdmins.sort(sortByRoleThenName),
      chairs: chairs.sort(sortByRoleThenName),
      viceChairs: viceChairs.sort(sortByRoleThenName),
      leaders: leaders.sort(sortByRoleThenName),
      generalMembers: generalMembers.sort(sortByRoleThenName),
    };
  }, [members]);

  return (
    <div className="px-4 py-6 sm:px-6">
      {members.length > 0 ? (
        <div className="rounded-[28px] border border-slate-200 bg-white px-6 py-8 shadow-sm sm:px-8">
          <div className="space-y-8">
            <div className="flex flex-col items-center gap-4">
              {organizationGroups.chairs.map((member) => (
                <div key={member.id} className="w-full max-w-[200px]">
                  <OrganizationNode
                    member={member}
                    selected={selectedMemberId === member.id}
                    onSelect={() => onSelectMember(member.id)}
                  />
                </div>
              ))}
              {organizationGroups.chairs.length > 0 && <div className="h-7 w-px bg-blue-300" />}
              {organizationGroups.viceChairs.map((member) => (
                <div key={member.id} className="w-full max-w-[200px]">
                  <OrganizationNode
                    member={member}
                    selected={selectedMemberId === member.id}
                    onSelect={() => onSelectMember(member.id)}
                  />
                </div>
              ))}
            </div>

            <div className="space-y-4">
              <div className="mx-auto h-px w-full max-w-6xl bg-blue-200" />
              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4 xl:grid-cols-5">
                {organizationGroups.leaders.map((member) => (
                  <OrganizationNode
                    key={member.id}
                    member={member}
                    selected={selectedMemberId === member.id}
                    onSelect={() => onSelectMember(member.id)}
                  />
                ))}
              </div>
            </div>

            <div className="space-y-4">
              <div className="flex items-center gap-3">
                <div className="h-px flex-1 bg-slate-200" />
                <div className="text-xs font-semibold uppercase tracking-[0.24em] text-slate-400">일반 회원</div>
                <div className="h-px flex-1 bg-slate-200" />
              </div>
              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4 xl:grid-cols-5 2xl:grid-cols-6">
                {organizationGroups.generalMembers.map((member) => (
                  <OrganizationNode
                    key={member.id}
                    member={member}
                    selected={selectedMemberId === member.id}
                    onSelect={() => onSelectMember(member.id)}
                  />
                ))}
              </div>
            </div>

            {organizationGroups.developerAdmins.length > 0 && (
              <div className="space-y-4">
                <div className="flex items-center gap-3">
                  <div className="h-px flex-1 bg-slate-200" />
                  <div className="text-xs font-semibold uppercase tracking-[0.24em] text-slate-400">개발 관리자</div>
                  <div className="h-px flex-1 bg-slate-200" />
                </div>
                <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
                  {organizationGroups.developerAdmins.map((member) => (
                    <OrganizationNode
                      key={member.id}
                      member={member}
                      selected={selectedMemberId === member.id}
                      onSelect={() => onSelectMember(member.id)}
                    />
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      ) : (
        <div className="rounded-[28px] border border-dashed border-slate-300 bg-slate-50 px-6 py-12 text-center text-slate-500">
          검색 조건에 맞는 멤버가 없습니다.
        </div>
      )}
    </div>
  );
};
