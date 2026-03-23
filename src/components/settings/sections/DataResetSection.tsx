import { Trash2 } from 'lucide-react';
import { SectionHeader } from '../SettingsSectionPrimitives';

interface ResetConfigItem {
  title: string;
  description: string;
}

interface DataResetSectionProps<TAction extends string> {
  activeSeasonName: string | null;
  resetConfigEntries: Array<[TAction, ResetConfigItem]>;
  resetStatus: string | null;
  onOpenResetDialog: (action: TAction) => void;
}

export const DataResetSection = <TAction extends string>({
  activeSeasonName,
  resetConfigEntries,
  resetStatus,
  onOpenResetDialog,
}: DataResetSectionProps<TAction>) => (
  <section className="overflow-hidden rounded-[32px] border border-rose-200 bg-white shadow-sm">
    <SectionHeader
      icon={<Trash2 size={18} className="text-rose-600" />}
      title="데이터 초기화"
      description={activeSeasonName ? `${activeSeasonName} 시즌 기준으로만 초기화됩니다. 실제 삭제는 서버 함수에서 처리됩니다.` : '진행 중인 시즌이 있어야 초기화할 수 있습니다.'}
    />
    <div className="space-y-4 p-5 sm:p-6">
      <div className="grid gap-4 xl:grid-cols-3">
        {resetConfigEntries.map(([action, config]) => (
          <div key={action} className="rounded-[28px] border border-slate-200 bg-slate-50 p-5">
            <div className="font-semibold text-slate-900">{config.title}</div>
            <div className="mt-2 text-sm leading-6 text-slate-600">{config.description}</div>
            <button
              type="button"
              onClick={() => onOpenResetDialog(action)}
              disabled={!activeSeasonName}
              className="mt-4 inline-flex h-11 items-center justify-center rounded-2xl bg-rose-600 px-4 text-sm font-semibold text-white transition-colors hover:bg-rose-700 disabled:cursor-not-allowed disabled:bg-slate-300"
            >
              {config.title}
            </button>
          </div>
        ))}
      </div>

      {resetStatus && (
        <div className="rounded-[24px] border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
          {resetStatus}
        </div>
      )}
    </div>
  </section>
);
