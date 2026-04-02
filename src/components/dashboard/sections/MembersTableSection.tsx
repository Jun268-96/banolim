import React, { useState } from 'react';
import { ArrowUpDown, ChevronDown, ChevronUp, KeyRound, Search, Trash2 } from 'lucide-react';
import type { Member, MemberStatus, RoleSummary, TeamSummary } from '../../../types';

type MemberSortMode = 'name-asc' | 'name-desc' | 'joined-desc' | 'role-order';
type MemberStatusFilter = 'all' | MemberStatus;
type MemberAccountFilter = 'all' | 'needs-email' | 'needs-account' | 'password-reset' | 'ready';
type MemberFilterPanel = 'team' | 'role' | 'status' | 'account' | null;

interface FilterOption<T extends string> {
  id: T;
  label: string;
  count: number;
}

interface MembersTableSectionProps {
  canManageMembers: boolean;
  members: Member[];
  filteredMembers: Member[];
  roles: RoleSummary[];
  teams: TeamSummary[];
  memberNameSuggestions: string[];
  searchQuery: string;
  searchQueryNormalized: string;
  sortMode: MemberSortMode;
  selectedRoleFilter: string;
  selectedTeamFilter: string;
  selectedStatusFilter: MemberStatusFilter;
  selectedAccountFilter: MemberAccountFilter;
  openFilterPanel: MemberFilterPanel;
  historyMemberId: string | null;
  savingMemberId: string | null;
  provisioningMemberId: string | null;
  roleFilterOptions: Array<FilterOption<string>>;
  teamFilterOptions: Array<FilterOption<string>>;
  statusFilterOptions: Array<FilterOption<MemberStatus>>;
  accountFilterOptions: Array<FilterOption<Exclude<MemberAccountFilter, 'all'>>>;
  memberStatusOptions: MemberStatus[];
  memberStatusLabels: Record<MemberStatus, string>;
  memberAccountFilterLabels: Record<Exclude<MemberAccountFilter, 'all'>, string>;
  matchesMemberFilters: (
    member: Member,
    filters: {
      query: string;
      roleFilter: string;
      teamFilter: string;
      statusFilter: MemberStatusFilter;
      accountFilter: MemberAccountFilter;
    },
  ) => boolean;
  normalizeLoginEmail: (value: string) => string | null;
  formatDate: (value?: string | null) => string;
  formatDateTime: (value?: string | null) => string;
  onChangeSearchQuery: (value: string) => void;
  onChangeSortMode: (value: MemberSortMode) => void;
  onChangeRoleFilter: (value: string) => void;
  onChangeTeamFilter: (value: string) => void;
  onChangeStatusFilter: (value: MemberStatusFilter) => void;
  onChangeAccountFilter: (value: MemberAccountFilter) => void;
  onChangeOpenFilterPanel: (value: MemberFilterPanel | ((current: MemberFilterPanel) => MemberFilterPanel)) => void;
  onResetFilters: () => void;
  onSelectHistoryMember: (memberId: string) => void;
  onUpdateMember: (memberId: string, updates: Partial<Pick<Member, 'loginEmail' | 'roleId' | 'status'>>) => void;
  onProvisionMemberAccount: (member: Member) => void;
  onDeleteMember: (memberId: string) => void;
}

const getLevelInfo = (score: number) => {
  const level = Math.max(0, Math.floor(score / 100));

  if (level >= 2) return { level, color: 'bg-amber-100 text-amber-700 border-amber-200' };
  if (level >= 1) return { level, color: 'bg-emerald-100 text-emerald-700 border-emerald-200' };
  return { level, color: 'bg-slate-100 text-slate-700 border-slate-200' };
};

const getStatusInfo = (member: Member) => {
  switch (member.status) {
    case 'active':
      return { label: '활동 중', className: 'bg-emerald-50 text-emerald-700 border-emerald-200' };
    case 'dormant':
      return { label: '휴면', className: 'bg-sky-50 text-sky-700 border-sky-200' };
    case 'inactive':
      return { label: '비활성', className: 'bg-slate-100 text-slate-600 border-slate-200' };
    default:
      return { label: '알 수 없음', className: 'bg-slate-100 text-slate-600 border-slate-200' };
  }
};

const getAccountProvisionLabel = (member: Member) => {
  if (!member.loginEmail) {
    return { label: '이메일 필요', className: 'bg-slate-100 text-slate-600 border-slate-200' };
  }

  if (!member.authUserId) {
    return { label: '계정 미발급', className: 'bg-amber-50 text-amber-700 border-amber-200' };
  }

  if (member.passwordResetRequired) {
    return { label: '첫 로그인 대기', className: 'bg-sky-50 text-sky-700 border-sky-200' };
  }

  return { label: '계정 활성', className: 'bg-emerald-50 text-emerald-700 border-emerald-200' };
};

export const MembersTableSection: React.FC<MembersTableSectionProps> = ({
  canManageMembers,
  members,
  filteredMembers,
  roles,
  teams,
  memberNameSuggestions,
  searchQuery,
  searchQueryNormalized,
  sortMode,
  selectedRoleFilter,
  selectedTeamFilter,
  selectedStatusFilter,
  selectedAccountFilter,
  openFilterPanel,
  historyMemberId,
  savingMemberId,
  provisioningMemberId,
  roleFilterOptions,
  teamFilterOptions,
  statusFilterOptions,
  accountFilterOptions,
  memberStatusOptions,
  memberStatusLabels,
  memberAccountFilterLabels,
  matchesMemberFilters,
  normalizeLoginEmail,
  formatDate,
  formatDateTime,
  onChangeSearchQuery,
  onChangeSortMode,
  onChangeRoleFilter,
  onChangeTeamFilter,
  onChangeStatusFilter,
  onChangeAccountFilter,
  onChangeOpenFilterPanel,
  onResetFilters,
  onSelectHistoryMember,
  onUpdateMember,
  onProvisionMemberAccount,
  onDeleteMember,
}) => {
  const [isSearchOpen, setIsSearchOpen] = useState(false);
  const hasActiveSearch = searchQuery.trim().length > 0;

  return (
  <div className="max-w-full">
    <div className="border-b border-slate-100 px-5 py-3 sm:px-6">
      <div className="flex flex-wrap items-center gap-2">
        <button
          type="button"
          onClick={() => setIsSearchOpen((prev) => !prev)}
          className={`inline-flex items-center gap-2 rounded-full px-4 py-2 text-sm font-semibold transition-colors ${
            isSearchOpen
              ? 'bg-slate-900 text-white'
              : 'border border-slate-200 bg-white text-slate-600 shadow-sm hover:bg-slate-50'
          }`}
        >
          <Search size={15} />
          검색 · 정렬
          {hasActiveSearch && !isSearchOpen && (
            <span className="h-2 w-2 rounded-full bg-indigo-500" />
          )}
          {isSearchOpen ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
        </button>
        <div className="h-4 w-px bg-slate-200" />
        <button
          type="button"
          onClick={onResetFilters}
          className={`rounded-full px-3 py-2 text-sm font-semibold transition-colors ${
            selectedRoleFilter === 'all' && selectedTeamFilter === 'all' && selectedStatusFilter === 'all' && selectedAccountFilter === 'all'
              ? 'bg-indigo-600 text-white'
              : 'border border-slate-200 bg-white text-slate-600 hover:bg-slate-50'
          }`}
        >
          전체 {filteredMembers.length}
        </button>
        {([
          {
            id: 'team' as const,
            label: `팀별${selectedTeamFilter !== 'all' ? `: ${teams.find((team) => team.id === selectedTeamFilter)?.name ?? '전체'}` : ''}`,
          },
          {
            id: 'role' as const,
            label: `직책별${selectedRoleFilter !== 'all' ? `: ${roles.find((role) => role.id === selectedRoleFilter)?.name ?? '전체'}` : ''}`,
          },
          {
            id: 'status' as const,
            label: `상태별${selectedStatusFilter !== 'all' ? `: ${memberStatusLabels[selectedStatusFilter]}` : ''}`,
          },
          {
            id: 'account' as const,
            label: `계정상태${selectedAccountFilter !== 'all' ? `: ${memberAccountFilterLabels[selectedAccountFilter]}` : ''}`,
          },
        ]).map((option) => (
          <button
            key={option.id}
            type="button"
            onClick={() => onChangeOpenFilterPanel((current) => (current === option.id ? null : option.id))}
            className={`rounded-full px-3 py-2 text-sm font-semibold transition-colors ${
              openFilterPanel === option.id
                ? 'bg-slate-900 text-white'
                : 'border border-slate-200 bg-white text-slate-600 hover:bg-slate-50'
            }`}
          >
            {option.label} ▾
          </button>
        ))}
      </div>
    </div>

    {isSearchOpen && (
      <div className="border-b border-slate-100 px-5 py-4 sm:px-6">
        <div className="grid gap-3 xl:grid-cols-[minmax(0,1.2fr)_220px_120px]">
          <label className="relative block">
            <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              list="member-name-suggestions"
              placeholder="이름으로 멤버 검색"
              value={searchQuery}
              onChange={(event) => onChangeSearchQuery(event.target.value)}
              className="w-full rounded-xl border border-slate-200 bg-white py-2.5 pl-9 pr-3 text-sm outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500"
            />
            <datalist id="member-name-suggestions">
              {memberNameSuggestions.map((name) => (
                <option key={name} value={name} />
              ))}
            </datalist>
          </label>

          <label className="flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm text-slate-600">
            <ArrowUpDown size={16} className="text-slate-400" />
            <select
              value={sortMode}
              onChange={(event) => onChangeSortMode(event.target.value as MemberSortMode)}
              className="w-full bg-transparent outline-none"
            >
              <option value="role-order">직책 순 정렬</option>
              <option value="name-asc">이름 오름차순</option>
              <option value="name-desc">이름 내림차순</option>
              <option value="joined-desc">최근 가입 순</option>
            </select>
          </label>

          <button
            type="button"
            onClick={onResetFilters}
            className="inline-flex items-center justify-center rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-semibold text-slate-700 transition-colors hover:bg-slate-50"
          >
            초기화
          </button>
        </div>
      </div>
    )}

    {openFilterPanel !== null && (
    <div className="border-b border-slate-100 px-5 py-3 sm:px-6">
        {openFilterPanel === 'team' && (
          <div className="rounded-[20px] border border-slate-200 bg-white p-3">
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                onClick={() => onChangeTeamFilter('all')}
                className={`rounded-full px-3 py-1.5 text-sm font-semibold transition-colors ${
                  selectedTeamFilter === 'all'
                    ? 'bg-indigo-600 text-white'
                    : 'border border-slate-200 bg-white text-slate-600 hover:bg-slate-50'
                }`}
              >
                전체({members.filter((member) => matchesMemberFilters(member, {
                  query: searchQueryNormalized,
                  roleFilter: selectedRoleFilter,
                  teamFilter: 'all',
                  statusFilter: selectedStatusFilter,
                  accountFilter: selectedAccountFilter,
                })).length})
              </button>
              {teamFilterOptions.map((team) => (
                <button
                  key={team.id}
                  type="button"
                  onClick={() => onChangeTeamFilter(team.id)}
                  className={`rounded-full px-3 py-1.5 text-sm font-semibold transition-colors ${
                    selectedTeamFilter === team.id
                      ? 'bg-indigo-600 text-white'
                      : 'border border-slate-200 bg-white text-slate-600 hover:bg-slate-50'
                  }`}
                >
                  {team.label}({team.count})
                </button>
              ))}
            </div>
          </div>
        )}

        {openFilterPanel === 'role' && (
          <div className="rounded-[20px] border border-slate-200 bg-white p-3">
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                onClick={() => onChangeRoleFilter('all')}
                className={`rounded-full px-3 py-1.5 text-sm font-semibold transition-colors ${
                  selectedRoleFilter === 'all'
                    ? 'bg-indigo-600 text-white'
                    : 'border border-slate-200 bg-white text-slate-600 hover:bg-slate-50'
                }`}
              >
                전체({members.filter((member) => matchesMemberFilters(member, {
                  query: searchQueryNormalized,
                  roleFilter: 'all',
                  teamFilter: selectedTeamFilter,
                  statusFilter: selectedStatusFilter,
                  accountFilter: selectedAccountFilter,
                })).length})
              </button>
              {roleFilterOptions.map((role) => (
                <button
                  key={role.id}
                  type="button"
                  onClick={() => onChangeRoleFilter(role.id)}
                  className={`rounded-full px-3 py-1.5 text-sm font-semibold transition-colors ${
                    selectedRoleFilter === role.id
                      ? 'bg-indigo-600 text-white'
                      : 'border border-slate-200 bg-white text-slate-600 hover:bg-slate-50'
                  }`}
                >
                  {role.label}({role.count})
                </button>
              ))}
            </div>
          </div>
        )}

        {openFilterPanel === 'status' && (
          <div className="rounded-[20px] border border-slate-200 bg-white p-3">
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                onClick={() => onChangeStatusFilter('all')}
                className={`rounded-full px-3 py-1.5 text-sm font-semibold transition-colors ${
                  selectedStatusFilter === 'all'
                    ? 'bg-indigo-600 text-white'
                    : 'border border-slate-200 bg-white text-slate-600 hover:bg-slate-50'
                }`}
              >
                전체({members.filter((member) => matchesMemberFilters(member, {
                  query: searchQueryNormalized,
                  roleFilter: selectedRoleFilter,
                  teamFilter: selectedTeamFilter,
                  statusFilter: 'all',
                  accountFilter: selectedAccountFilter,
                })).length})
              </button>
              {statusFilterOptions.map((status) => (
                <button
                  key={status.id}
                  type="button"
                  onClick={() => onChangeStatusFilter(status.id)}
                  className={`rounded-full px-3 py-1.5 text-sm font-semibold transition-colors ${
                    selectedStatusFilter === status.id
                      ? 'bg-indigo-600 text-white'
                      : 'border border-slate-200 bg-white text-slate-600 hover:bg-slate-50'
                  }`}
                >
                  {status.label}({status.count})
                </button>
              ))}
            </div>
          </div>
        )}

        {openFilterPanel === 'account' && (
          <div className="rounded-[20px] border border-slate-200 bg-white p-3">
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                onClick={() => onChangeAccountFilter('all')}
                className={`rounded-full px-3 py-1.5 text-sm font-semibold transition-colors ${
                  selectedAccountFilter === 'all'
                    ? 'bg-indigo-600 text-white'
                    : 'border border-slate-200 bg-white text-slate-600 hover:bg-slate-50'
                }`}
              >
                전체({members.filter((member) => matchesMemberFilters(member, {
                  query: searchQueryNormalized,
                  roleFilter: selectedRoleFilter,
                  teamFilter: selectedTeamFilter,
                  statusFilter: selectedStatusFilter,
                  accountFilter: 'all',
                })).length})
              </button>
              {accountFilterOptions.map((status) => (
                <button
                  key={status.id}
                  type="button"
                  onClick={() => onChangeAccountFilter(status.id)}
                  className={`rounded-full px-3 py-1.5 text-sm font-semibold transition-colors ${
                    selectedAccountFilter === status.id
                      ? 'bg-indigo-600 text-white'
                      : 'border border-slate-200 bg-white text-slate-600 hover:bg-slate-50'
                  }`}
                >
                  {status.label}({status.count})
                </button>
              ))}
            </div>
          </div>
        )}
    </div>
    )}
    <div className="flex items-center justify-between gap-3 border-b border-slate-100 px-5 py-3 text-xs font-medium text-slate-500 sm:px-6">
      <span>표 영역 안에서 좌우로 이동할 수 있습니다.</span>
      {canManageMembers && (
        <span className="rounded-full border border-slate-200 bg-slate-50 px-3 py-1 text-[11px] font-semibold text-slate-600">
          관리 열 고정
        </span>
      )}
    </div>
    <div className="max-w-full overflow-x-auto overscroll-x-contain pb-3 [scrollbar-gutter:stable]">
      <table className={`${canManageMembers ? 'min-w-[980px]' : 'min-w-[760px]'} min-w-full w-max border-collapse text-left`}>
        <thead>
          <tr className="border-b border-slate-200 bg-slate-50 text-sm font-semibold text-slate-600">
            <th className="min-w-[76px] whitespace-nowrap px-6 py-4">레벨</th>
            <th className="min-w-[84px] whitespace-nowrap px-6 py-4">이름</th>
            {canManageMembers && (
              <th className="min-w-[240px] whitespace-nowrap px-6 py-4">로그인 이메일</th>
            )}
            <th className="min-w-[148px] whitespace-nowrap px-6 py-4">직책</th>
            <th className="min-w-[140px] whitespace-nowrap px-6 py-4">상태</th>
            <th className="min-w-[132px] whitespace-nowrap px-6 py-4">가입일</th>
            <th className={`min-w-[112px] whitespace-nowrap px-6 py-4 text-center ${canManageMembers ? 'sticky right-0 z-20 border-l border-slate-200 bg-slate-50 shadow-[-12px_0_24px_-20px_rgba(15,23,42,0.35)]' : ''}`}>
              {canManageMembers ? '관리' : '조회'}
            </th>
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-100">
          {filteredMembers.map((member) => {
            const levelInfo = getLevelInfo(member.score);
            const statusInfo = getStatusInfo(member);
            const isSavingRow = savingMemberId === member.id;

            return (
              <tr
                key={member.id}
                className={`group transition-colors ${historyMemberId === member.id ? 'bg-indigo-50/70' : 'hover:bg-slate-50/50'}`}
                onClick={() => onSelectHistoryMember(member.id)}
              >
                <td className="whitespace-nowrap px-6 py-4 align-middle">
                  <span className={`inline-flex min-w-[56px] items-center justify-center rounded-full border px-2.5 py-1 text-[11px] font-semibold uppercase tracking-[0.14em] ${levelInfo.color}`}>
                    lv.{levelInfo.level}
                  </span>
                </td>
                <td className="whitespace-nowrap px-6 py-4 align-middle">
                  <span className="font-medium text-slate-900">{member.name}</span>
                </td>
                {canManageMembers && (
                  <td className="whitespace-nowrap px-6 py-4 align-middle">
                    {(() => {
                      const accountProvision = getAccountProvisionLabel(member);

                      return (
                        <>
                          <input
                            key={`${member.id}-${member.loginEmail ?? ''}`}
                            type="email"
                            defaultValue={member.loginEmail ?? ''}
                            placeholder="example@school.kr"
                            disabled={isSavingRow}
                            onClick={(event) => event.stopPropagation()}
                            onBlur={(event) => {
                              const nextValue = normalizeLoginEmail(event.target.value);
                              if ((member.loginEmail ?? null) === nextValue) {
                                event.target.value = member.loginEmail ?? '';
                                return;
                              }
                              event.target.value = nextValue ?? '';
                              onUpdateMember(member.id, { loginEmail: nextValue });
                            }}
                            onKeyDown={(event) => {
                              if (event.key === 'Enter') {
                                event.preventDefault();
                                event.currentTarget.blur();
                              }
                            }}
                            className="min-w-[220px] rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500"
                          />
                          <div className="mt-2 flex items-center gap-2">
                            <span className={`inline-flex rounded-full border px-2.5 py-1 text-[11px] font-semibold ${accountProvision.className}`}>
                              {accountProvision.label}
                            </span>
                            {member.authProvisionedAt && (
                              <span className="text-[11px] text-slate-500">
                                발급 {formatDateTime(member.authProvisionedAt)}
                              </span>
                            )}
                          </div>
                        </>
                      );
                    })()}
                  </td>
                )}
                <td className="whitespace-nowrap px-6 py-4 align-middle">
                  {canManageMembers ? (
                    <div onClick={(event) => event.stopPropagation()}>
                      <select
                        value={member.roleId ?? ''}
                        disabled={isSavingRow}
                        onChange={(event) => {
                          const value = event.target.value || null;
                          onUpdateMember(member.id, { roleId: value });
                        }}
                        className="min-w-[160px] rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500"
                      >
                        <option value="">미지정</option>
                        {roles.map((role) => (
                          <option key={role.id} value={role.id}>
                            {role.name}
                          </option>
                        ))}
                      </select>
                    </div>
                  ) : (
                    <div className="whitespace-nowrap text-slate-700">{member.roleName || '미지정'}</div>
                  )}
                </td>
                <td className="whitespace-nowrap px-6 py-4 align-middle">
                  {canManageMembers ? (
                    <select
                      value={member.status ?? 'active'}
                      disabled={isSavingRow}
                      onClick={(event) => event.stopPropagation()}
                      onChange={(event) => {
                        const value = event.target.value as MemberStatus;
                        onUpdateMember(member.id, { status: value });
                      }}
                      className="min-w-[128px] rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500"
                    >
                      {memberStatusOptions.map((status) => (
                        <option key={status} value={status}>
                          {memberStatusLabels[status]}
                        </option>
                      ))}
                    </select>
                  ) : (
                    <span className={`inline-flex whitespace-nowrap rounded-full border px-2.5 py-1 text-xs font-semibold ${statusInfo.className}`}>
                      {statusInfo.label}
                    </span>
                  )}
                </td>
                <td className="whitespace-nowrap px-6 py-4 align-middle text-sm text-slate-600">{formatDate(member.joinedAt)}</td>
                <td className={`whitespace-nowrap px-6 py-4 text-center align-middle ${canManageMembers ? 'sticky right-0 z-10 border-l border-slate-100 bg-white shadow-[-12px_0_24px_-20px_rgba(15,23,42,0.2)] group-hover:bg-slate-50/95' : ''}`}>
                  {canManageMembers ? (
                    <div
                      className="flex items-center justify-center gap-1"
                      onClick={(event) => event.stopPropagation()}
                    >
                      <button
                        type="button"
                        disabled={!member.loginEmail || provisioningMemberId === member.id}
                        onClick={() => onProvisionMemberAccount(member)}
                        className="inline-flex items-center gap-1 rounded-lg border border-slate-200 bg-white px-2.5 py-2 text-xs font-semibold text-slate-700 transition-colors hover:bg-slate-50 disabled:cursor-not-allowed disabled:border-slate-100 disabled:text-slate-300"
                        title={member.authUserId ? '임시 비밀번호 재발급' : '계정 발급'}
                      >
                        <KeyRound size={14} />
                        {provisioningMemberId === member.id
                          ? '발급 중'
                          : member.authUserId
                            ? '재발급'
                            : '계정 발급'}
                      </button>
                      <button
                        onClick={() => onDeleteMember(member.id)}
                        className="rounded-lg p-2 text-slate-400 opacity-0 transition-colors hover:bg-rose-50 hover:text-rose-600 group-hover:opacity-100"
                        title="멤버 숨기기"
                      >
                        <Trash2 size={16} />
                      </button>
                    </div>
                  ) : (
                    <span className="text-xs text-slate-400">-</span>
                  )}
                </td>
              </tr>
            );
          })}

          {filteredMembers.length === 0 && (
            <tr>
              <td colSpan={canManageMembers ? 7 : 6} className="py-12 text-center text-slate-500">
                검색 조건에 맞는 멤버가 없습니다.
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  </div>
  );
};
