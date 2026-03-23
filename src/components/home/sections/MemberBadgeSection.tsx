import React from 'react';
import { BadgeCheck, Medal } from 'lucide-react';
import type { Badge, MemberBadge } from '../../../types';
import { badgeScopeLabels, getBadgeArtworkUrl } from '../../../lib/badges';

interface BadgeRequirementEntry {
  key: string;
  label: string;
  current: number;
  target: number;
  unit: string;
  satisfied: boolean;
}

interface BadgeCard {
  badge: Badge;
  earnedBadge: MemberBadge | null;
  requirementEntries: BadgeRequirementEntry[];
}

interface MemberBadgeSectionProps {
  badgeCards: BadgeCard[];
  memberBadges: MemberBadge[];
  badgeChallengeCopy: string;
  badgeToneClasses: Record<NonNullable<MemberBadge['tone']>, string>;
  bandiMascotUrl: string;
  didiMascotUrl: string;
  banollimSchoolLogoUrl: string;
}

export const MemberBadgeSection: React.FC<MemberBadgeSectionProps> = ({
  badgeCards,
  memberBadges,
  badgeChallengeCopy,
  badgeToneClasses,
  bandiMascotUrl,
  didiMascotUrl,
  banollimSchoolLogoUrl,
}) => (
  <div className="space-y-6">
    <section className="overflow-hidden rounded-[28px] border border-slate-200 bg-white shadow-sm">
      <div className="relative border-b border-slate-100 bg-gradient-to-br from-amber-50 via-white to-rose-50 px-6 py-5">
        <img
          src={banollimSchoolLogoUrl}
          alt="반디스쿨 로고"
          className="pointer-events-none absolute right-4 top-4 h-16 w-auto opacity-20 saturate-50 sm:h-20"
        />
        <div className="relative flex items-start justify-between gap-4">
          <div>
            <div className="flex items-center gap-2 font-semibold text-slate-900">
              <Medal size={18} className="text-indigo-600" />
              공식 배지 컬렉션
            </div>
            <div className="mt-2 text-sm leading-6 text-slate-600">
              활성 배지는 현재 기록 기준으로 실시간 계산됩니다. 아직 잠긴 배지도 조건과 함께 미리 볼 수 있습니다.
            </div>
          </div>
          <img
            src={bandiMascotUrl}
            alt="반디 마스코트"
            className="h-16 w-auto shrink-0 drop-shadow-[0_12px_24px_rgba(15,23,42,0.18)] sm:h-20"
          />
        </div>
      </div>

      <div className="space-y-5 p-6">
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          {badgeCards.map(({ badge, earnedBadge, requirementEntries }) => (
            <div
              key={badge.id}
              className={`overflow-hidden rounded-[24px] border p-4 ${
                earnedBadge
                  ? badgeToneClasses[earnedBadge.tone ?? 'sky']
                  : 'border-slate-200 bg-slate-50 text-slate-700'
              }`}
            >
              <div className="flex items-start justify-between gap-4">
                <div className="flex items-center gap-3">
                  <div className={`flex h-14 w-14 items-center justify-center rounded-2xl border shadow-sm ${earnedBadge ? 'border-white/70 bg-white/80' : 'border-slate-200 bg-white'}`}>
                    <img
                      src={getBadgeArtworkUrl(earnedBadge ?? badge)}
                      alt={badge.name}
                      className="h-10 w-auto object-contain"
                    />
                  </div>
                  <div>
                    <div className="flex items-center gap-2 text-sm font-semibold">
                      <BadgeCheck size={16} />
                      {badge.name}
                    </div>
                    <div className="mt-1 text-xs opacity-80">
                      {earnedBadge
                        ? `${new Date(earnedBadge.awardedAt).toLocaleDateString('ko-KR')} 획득`
                        : `${badgeScopeLabels[badge.evaluationScope ?? 'season']} 잠금`}
                    </div>
                  </div>
                </div>
                <div className={`rounded-full border px-2.5 py-1 text-[11px] font-semibold uppercase tracking-[0.16em] ${earnedBadge ? 'border-white/70 bg-white/80 opacity-90' : 'border-slate-200 bg-white text-slate-500'}`}>
                  {(earnedBadge?.badgeCode ?? badge.code).replace(/_/g, ' ')}
                </div>
              </div>
              <div className="mt-4 text-sm leading-6">
                {badge.description}
              </div>
              <div className="mt-4 flex flex-wrap gap-2">
                {requirementEntries.map((entry) => (
                  <span
                    key={`${badge.id}-${entry.key}`}
                    className={`rounded-full border px-3 py-1 text-xs font-semibold ${
                      entry.satisfied
                        ? earnedBadge
                          ? 'border-white/70 bg-white/80'
                          : 'border-emerald-200 bg-emerald-50 text-emerald-700'
                        : 'border-slate-200 bg-white text-slate-500'
                    }`}
                  >
                    {entry.label} {entry.current}/{entry.target}{entry.unit}
                  </span>
                ))}
              </div>
            </div>
          ))}

          {badgeCards.length === 0 && (
            <div className="rounded-[24px] border border-dashed border-slate-200 bg-slate-50 px-5 py-8 text-center text-sm text-slate-500 sm:col-span-2">
              <img
                src={didiMascotUrl}
                alt="디디 마스코트"
                className="mx-auto h-16 w-auto opacity-90"
              />
              <div className="mt-4 font-medium text-slate-700">첫 배지를 기다리는 중입니다.</div>
              <div className="mt-2 leading-6">
                활동 기록이 누적되면 이곳에 실시간으로 획득 배지가 추가됩니다.
              </div>
            </div>
          )}
        </div>

        <div className="rounded-[24px] border border-slate-900 bg-slate-950 px-5 py-4 text-white">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <div className="text-xs uppercase tracking-[0.16em] text-slate-400">다음 챌린지</div>
              <div className="mt-2 text-lg font-semibold text-white">{memberBadges.length}개 배지 획득</div>
              <div className="mt-2 max-w-xl text-sm leading-6 text-slate-300">{badgeChallengeCopy}</div>
            </div>
            <img
              src={didiMascotUrl}
              alt="디디 마스코트"
              className="h-20 w-auto shrink-0 self-end drop-shadow-[0_14px_24px_rgba(0,0,0,0.25)]"
            />
          </div>
        </div>
      </div>
    </section>
  </div>
);
