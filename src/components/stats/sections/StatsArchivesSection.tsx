import React from 'react';
import type { RecapSnapshot } from '../../../types';
import { SnapshotCardList } from './SnapshotCardList';

interface StatsArchivesSectionProps {
    recapSnapshots: RecapSnapshot[];
    onSelectSnapshot: (snapshot: RecapSnapshot) => void;
}

export const StatsArchivesSection: React.FC<StatsArchivesSectionProps> = ({
    recapSnapshots,
    onSelectSnapshot,
}) => (
    <section className="rounded-[28px] border border-slate-200 bg-white p-6 shadow-sm">
        <div className="flex items-center justify-between gap-4">
            <div>
                <h3 className="text-lg font-bold text-slate-900">저장된 운영 리캡</h3>
                <p className="mt-1 text-sm text-slate-500">생성된 저장본을 다시 열어보고 공유 카드로 내보낼 수 있습니다.</p>
            </div>
            <div className="rounded-full border border-slate-200 bg-slate-50 px-3 py-1 text-xs font-semibold text-slate-500">
                최근 {recapSnapshots.length}개
            </div>
        </div>
        <div className="mt-5">
            <SnapshotCardList
                snapshots={recapSnapshots}
                emptyMessage="아직 저장된 운영 리캡이 없습니다. 월간 또는 시즌 리캡을 한 번 생성하면 이후에는 같은 기간 저장본을 다시 열어볼 수 있습니다."
                onSelectSnapshot={onSelectSnapshot}
            />
        </div>
    </section>
);
