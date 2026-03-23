import React from 'react';
import { FileText, Upload } from 'lucide-react';
import { AppDialog } from '../../shared/AppDialog';

interface BulkImportPreviewRow {
  line: number;
  name: string;
  loginEmail: string | null;
  roleName: string | null;
  teamName: string | null;
}

interface BulkImportDialogProps {
  isOpen: boolean;
  csvText: string;
  importStatus: string | null;
  importErrors: string[];
  previewRows: BulkImportPreviewRow[];
  emailIncludedCount: number;
  isImporting: boolean;
  onClose: () => void;
  onChangeCsvText: (value: string) => void;
  onLoadSample: () => void;
  onReset: () => void;
  onFileChange: (event: React.ChangeEvent<HTMLInputElement>) => void;
  onExecuteImport: () => void;
}

export const BulkImportDialog: React.FC<BulkImportDialogProps> = ({
  isOpen,
  csvText,
  importStatus,
  importErrors,
  previewRows,
  emailIncludedCount,
  isImporting,
  onClose,
  onChangeCsvText,
  onLoadSample,
  onReset,
  onFileChange,
  onExecuteImport,
}) => (
  <AppDialog
    isOpen={isOpen}
    title="CSV 대량 등록"
    description="파일 업로드 또는 붙여넣기로 새 멤버 생성과 기존 멤버 갱신을 한 번에 처리합니다."
    size="xl"
    onClose={onClose}
  >
    <div className="grid gap-6 2xl:grid-cols-[minmax(0,1.2fr)_360px]">
      <div className="space-y-4">
        <div className="flex flex-wrap gap-2">
          <label className="inline-flex cursor-pointer items-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm font-medium text-slate-700 transition-colors hover:bg-slate-50">
            <Upload size={16} />
            CSV 파일 불러오기
            <input
              type="file"
              accept=".csv,text/csv"
              onChange={onFileChange}
              className="hidden"
            />
          </label>
          <button
            type="button"
            onClick={onLoadSample}
            className="inline-flex items-center gap-2 rounded-xl border border-indigo-200 bg-indigo-50 px-4 py-2 text-sm font-medium text-indigo-700 transition-colors hover:bg-indigo-100"
          >
            <FileText size={16} />
            예시 채우기
          </button>
          <button
            type="button"
            onClick={onReset}
            className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm font-medium text-slate-700 transition-colors hover:bg-slate-50"
          >
            초기화
          </button>
        </div>

        <textarea
          value={csvText}
          onChange={(event) => onChangeCsvText(event.target.value)}
          rows={12}
          placeholder="CSV를 붙여넣거나 파일을 불러오세요."
          className="w-full rounded-[24px] border border-slate-200 bg-slate-50 px-4 py-4 text-sm font-mono leading-6 outline-none transition-all focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500"
        />

        {importStatus && (
          <div className="rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700">
            {importStatus}
          </div>
        )}

        {importErrors.length > 0 && (
          <div className="rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
            {importErrors.join(' / ')}
          </div>
        )}

        <button
          type="button"
          onClick={onExecuteImport}
          disabled={previewRows.length === 0 || importErrors.length > 0 || isImporting}
          className="inline-flex items-center gap-2 rounded-2xl bg-indigo-600 px-5 py-3 text-sm font-semibold text-white transition-colors hover:bg-indigo-700 disabled:opacity-50"
        >
          <Upload size={16} />
          {isImporting ? '대량 등록 처리 중...' : '대량 등록 실행'}
        </button>
      </div>

      <div className="space-y-4">
        <div className="rounded-[24px] border border-slate-200 bg-slate-950 p-5 text-white">
          <div className="text-sm font-semibold text-slate-300">미리보기</div>
          <div className="mt-4 grid grid-cols-3 gap-3">
            <div className="rounded-2xl border border-white/10 bg-white/5 px-3 py-3">
              <div className="text-[11px] uppercase tracking-[0.18em] text-slate-400">행 수</div>
              <div className="mt-2 text-xl font-bold">{previewRows.length}</div>
            </div>
            <div className="rounded-2xl border border-white/10 bg-white/5 px-3 py-3">
              <div className="text-[11px] uppercase tracking-[0.18em] text-slate-400">오류</div>
              <div className="mt-2 text-xl font-bold">{importErrors.length}</div>
            </div>
            <div className="rounded-2xl border border-white/10 bg-white/5 px-3 py-3">
              <div className="text-[11px] uppercase tracking-[0.18em] text-slate-400">이메일 포함</div>
              <div className="mt-2 text-xl font-bold">{emailIncludedCount}</div>
            </div>
          </div>
        </div>

        <div className="rounded-[24px] border border-slate-200 bg-slate-50 p-4">
          <div className="text-sm font-semibold text-slate-900">처리 규칙</div>
          <div className="mt-3 space-y-2 text-sm leading-6 text-slate-600">
            <div>새 멤버는 `name`으로 생성되고, `login_email`이 있으면 로그인 준비까지 바로 이어집니다.</div>
            <div>기존 멤버는 `login_email` 우선, 없으면 `name` 기준으로 찾아 업데이트합니다.</div>
            <div>`role`, `team`은 현재 시스템에 이미 등록된 이름과 정확히 맞아야 반영됩니다.</div>
            <div>`status`는 `active`, `dormant`, `inactive` 또는 한글 값으로 넣을 수 있습니다.</div>
          </div>
        </div>

        <div className="space-y-3 rounded-[24px] border border-slate-200 bg-white p-4">
          {previewRows.slice(0, 5).map((row) => (
            <div key={`${row.line}-${row.name}`} className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3">
              <div className="flex items-center justify-between gap-3">
                <div className="font-medium text-slate-900">{row.name}</div>
                <div className="text-xs font-semibold text-slate-400">{row.line}행</div>
              </div>
              <div className="mt-2 text-sm text-slate-600">
                {row.loginEmail ?? '이메일 없음'}
                <span className="text-slate-300"> · </span>
                {row.roleName ?? '직책 미지정'}
                <span className="text-slate-300"> · </span>
                {row.teamName ?? '팀 미지정'}
              </div>
            </div>
          ))}

          {previewRows.length === 0 && (
            <div className="rounded-2xl border border-dashed border-slate-300 bg-slate-50 px-4 py-8 text-center text-sm text-slate-500">
              CSV를 불러오면 여기서 상위 5개 행을 먼저 확인할 수 있습니다.
            </div>
          )}
        </div>
      </div>
    </div>
  </AppDialog>
);
