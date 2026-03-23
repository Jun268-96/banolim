import React from 'react';
import { Clock3 } from 'lucide-react';
import type { RecapSnapshot } from '../../../types';

interface SnapshotCardListProps {
    snapshots: RecapSnapshot[];
    emptyMessage: string;
    onSelectSnapshot: (snapshot: RecapSnapshot) => void;
}

export const SnapshotCardList: React.FC<SnapshotCardListProps> = ({
    snapshots,
    emptyMessage,
    onSelectSnapshot,
}) => {
    if (snapshots.length === 0) {
        return (
            <div className="rounded-[24px] border border-dashed border-slate-300 bg-slate-50 px-5 py-6 text-sm leading-7 text-slate-500">
                {emptyMessage}
            </div>
        );
    }

    return (
        <div className="space-y-3">
            {snapshots.map((snapshot) => (
                <button
                    key={snapshot.id}
                    type="button"
                    onClick={() => onSelectSnapshot(snapshot)}
                    className="flex w-full flex-col gap-3 rounded-[24px] border border-slate-200 bg-gradient-to-r from-white via-white to-slate-50 px-5 py-5 text-left shadow-sm transition-transform hover:-translate-y-0.5"
                >
                    <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                        <div>
                            <div className="inline-flex items-center gap-2 rounded-full border border-slate-200 bg-white px-3 py-1 text-xs font-semibold text-slate-500">
                                {snapshot.periodType === 'month' ? '월간 저장본' : '시즌 저장본'}
                            </div>
                            <div className="mt-3 text-lg font-bold text-slate-900">{snapshot.title}</div>
                            <div className="mt-1 text-sm text-slate-500">{snapshot.subtitle}</div>
                        </div>
                        <div className="inline-flex items-center gap-2 text-xs font-semibold text-slate-400">
                            <Clock3 size={14} />
                            {new Intl.DateTimeFormat('ko-KR', { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(snapshot.createdAt))}
                        </div>
                    </div>
                    <p className="text-sm leading-7 text-slate-600">{snapshot.summary}</p>
                </button>
            ))}
        </div>
    );
};
