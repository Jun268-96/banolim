import React from 'react';
import { TriangleAlert } from 'lucide-react';
import type { AttendanceSession, Category, Member } from '../../../types';
import { AppDialog } from '../../shared/AppDialog';

type RecordDraftRow = {
    selected: boolean;
    categoryId: string;
    note: string;
};

type RecordPreviewRow = {
    member: Member;
    row: RecordDraftRow;
    category: Category | null;
    attendanceEntry: AttendanceSession['entries'][number] | null;
};

interface ActivityRecordDialogProps {
    isOpen: boolean;
    onClose: () => void;
    recordSourceMode: 'attendance' | 'manual';
    selectedAttendanceSession: AttendanceSession | null;
    selectedManualTeamFilter: string;
    onSelectedManualTeamFilterChange: (value: string) => void;
    teamOptions: Array<{ id: string; name: string }>;
    recordDate: string;
    onRecordDateChange: (value: string) => void;
    recordTitle: string;
    onRecordTitleChange: (value: string) => void;
    recordBulkCategoryId: string;
    onRecordBulkCategoryIdChange: (value: string) => void;
    recordCategories: Category[];
    onApplyBulkCategoryToVisibleMembers: () => void;
    onClearRecordSourceMembers: () => void;
    selectedRecordRowsCount: number;
    recordExpectedDelta: number;
    recordNote: string;
    onRecordNoteChange: (value: string) => void;
    recordEvidenceUrl: string;
    onRecordEvidenceUrlChange: (value: string) => void;
    incompleteRecordRows: Array<{ member: Member }>;
    recordSourceMembersCount: number;
    recordDraftRows: RecordPreviewRow[];
    onRecordMemberToggle: (memberId: string) => void;
    onRecordCategoryChange: (memberId: string, categoryId: string) => void;
    onRecordNoteRowChange: (memberId: string, value: string) => void;
    onSubmit: (event: React.FormEvent) => void;
    isSaving: boolean;
    canSubmit: boolean;
}

const formatDateTime = (value: string) =>
    new Intl.DateTimeFormat('ko-KR', {
        dateStyle: 'medium',
        timeStyle: 'short',
    }).format(new Date(value));

export const ActivityRecordDialog: React.FC<ActivityRecordDialogProps> = ({
    isOpen,
    onClose,
    recordSourceMode,
    selectedAttendanceSession,
    selectedManualTeamFilter,
    onSelectedManualTeamFilterChange,
    teamOptions,
    recordDate,
    onRecordDateChange,
    recordTitle,
    onRecordTitleChange,
    recordBulkCategoryId,
    onRecordBulkCategoryIdChange,
    recordCategories,
    onApplyBulkCategoryToVisibleMembers,
    onClearRecordSourceMembers,
    selectedRecordRowsCount,
    recordExpectedDelta,
    recordNote,
    onRecordNoteChange,
    recordEvidenceUrl,
    onRecordEvidenceUrlChange,
    incompleteRecordRows,
    recordSourceMembersCount,
    recordDraftRows,
    onRecordMemberToggle,
    onRecordCategoryChange,
    onRecordNoteRowChange,
    onSubmit,
    isSaving,
    canSubmit,
}) => (
    <AppDialog
        isOpen={isOpen}
        onClose={onClose}
        size="xl"
        title={recordSourceMode === 'attendance' ? (selectedAttendanceSession?.title ?? '기록 세션') : '직접 활동 기록'}
        description={recordSourceMode === 'attendance'
            ? `${selectedAttendanceSession?.targetGroupLabel ?? '대상 그룹'} · ${selectedAttendanceSession ? formatDateTime(selectedAttendanceSession.startsAt) : ''}`
            : '출석 세션 없이 직접 대상을 골라 활동 기록을 남깁니다.'}
    >
        <form className="space-y-5" onSubmit={onSubmit}>
            {recordSourceMode === 'manual' ? (
                <label className="block space-y-1.5">
                    <span className="text-xs font-medium text-slate-600">대상 그룹</span>
                    <select
                        value={selectedManualTeamFilter}
                        onChange={(event) => onSelectedManualTeamFilterChange(event.target.value)}
                        className="w-full rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm outline-none transition-all focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500"
                    >
                        <option value="all">전체 멤버</option>
                        <option value="ungrouped">팀 미지정</option>
                        {teamOptions.map((team) => (
                            <option key={team.id} value={team.id}>
                                {team.name}
                            </option>
                        ))}
                    </select>
                </label>
            ) : null}

            <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                <label className="space-y-1.5">
                    <span className="text-xs font-medium text-slate-600">기록 날짜</span>
                    <input
                        type="date"
                        value={recordDate}
                        onChange={(event) => onRecordDateChange(event.target.value)}
                        className="w-full rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm outline-none transition-all focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500"
                    />
                </label>
                <label className="space-y-1.5">
                    <span className="text-xs font-medium text-slate-600">기록 제목</span>
                    <input
                        type="text"
                        value={recordTitle}
                        onChange={(event) => onRecordTitleChange(event.target.value)}
                        placeholder="예: 3월 정기모임 발표 기록"
                        className="w-full rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm outline-none transition-all focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500"
                    />
                </label>
            </div>

            <div className="grid grid-cols-1 gap-4 md:grid-cols-[minmax(0,240px)_minmax(0,1fr)]">
                <label className="space-y-1.5">
                    <span className="text-xs font-medium text-slate-600">공통 규칙</span>
                    <select
                        value={recordBulkCategoryId}
                        onChange={(event) => onRecordBulkCategoryIdChange(event.target.value)}
                        className="w-full rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm outline-none transition-all focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500"
                    >
                        {recordCategories.map((category) => (
                            <option key={category.id} value={category.id}>
                                {category.categoryName} ({category.pointValue > 0 ? '+' : ''}{category.pointValue})
                            </option>
                        ))}
                    </select>
                </label>
                <div className="flex flex-wrap items-end gap-2">
                    <button
                        type="button"
                        onClick={onApplyBulkCategoryToVisibleMembers}
                        className="inline-flex items-center gap-2 rounded-xl border border-indigo-200 bg-indigo-50 px-3 py-2 text-sm font-medium text-indigo-700 transition-colors hover:bg-indigo-100"
                    >
                        전체 적용
                    </button>
                    <button
                        type="button"
                        onClick={onClearRecordSourceMembers}
                        className="inline-flex items-center gap-2 rounded-xl border border-slate-200 px-3 py-2 text-sm font-medium text-slate-600 transition-colors hover:bg-slate-50"
                    >
                        초기화
                    </button>
                    <div className="ml-auto rounded-full bg-slate-100 px-3 py-2 text-sm font-semibold text-slate-700">
                        선택 {selectedRecordRowsCount}명 · 예상 {recordExpectedDelta > 0 ? '+' : ''}{recordExpectedDelta}점
                    </div>
                </div>
            </div>

            <label className="block space-y-1.5">
                <span className="text-xs font-medium text-slate-600">공통 메모</span>
                <textarea
                    value={recordNote}
                    onChange={(event) => onRecordNoteChange(event.target.value)}
                    rows={3}
                    placeholder="예: 발표 2건, 운영지원 1건, 현장 정리 반영"
                    className="w-full resize-none rounded-xl border border-slate-200 px-4 py-3 text-sm outline-none transition-all focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500"
                />
            </label>

            <label className="block space-y-1.5">
                <span className="text-xs font-medium text-slate-600">증빙 링크</span>
                <input
                    type="url"
                    value={recordEvidenceUrl}
                    onChange={(event) => onRecordEvidenceUrlChange(event.target.value)}
                    placeholder="예: 회의록, 발표 자료, 결과물 링크"
                    className="w-full rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm outline-none transition-all focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500"
                />
            </label>

            {incompleteRecordRows.length > 0 ? (
                <div className="rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-800">
                    <div className="flex items-start gap-2">
                        <TriangleAlert size={18} className="mt-0.5" />
                        <div>
                            <div className="font-semibold">아직 규칙이 비어 있는 선택 항목이 있습니다.</div>
                            <div className="mt-1">{incompleteRecordRows.map((row) => row.member.name).join(', ')} 항목의 규칙을 지정해 주세요.</div>
                        </div>
                    </div>
                </div>
            ) : null}

            <div className="rounded-3xl border border-slate-200 bg-slate-50 p-4 sm:p-5">
                <div className="mb-4 flex items-center justify-between gap-3">
                    <div>
                        <div className="font-semibold text-slate-900">기록 대상 선택</div>
                        <div className="mt-1 text-sm text-slate-500">카드를 눌러 대상을 고르고, 필요한 경우에만 규칙과 메모를 덮어씁니다.</div>
                    </div>
                    <div className="rounded-full bg-white px-3 py-1 text-sm font-semibold text-slate-700">{recordSourceMembersCount}명</div>
                </div>

                <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
                    {recordDraftRows.map((preview) => {
                        const isSelected = preview.row.selected;
                        return (
                            <button
                                key={preview.member.id}
                                type="button"
                                onClick={() => onRecordMemberToggle(preview.member.id)}
                                className={`rounded-2xl border px-3 py-3 text-center text-sm font-semibold transition-all ${
                                    isSelected
                                        ? 'border-indigo-300 bg-indigo-50 text-indigo-700 shadow-sm'
                                        : 'border-slate-200 bg-white text-slate-700 hover:bg-slate-50'
                                }`}
                            >
                                {preview.member.name}
                            </button>
                        );
                    })}
                </div>

                <div className="mt-5 max-h-[320px] space-y-3 overflow-auto pr-1">
                    {recordDraftRows.filter((preview) => preview.row.selected).map((preview) => (
                        <div key={preview.member.id} className="rounded-2xl border border-slate-200 bg-white p-4">
                            <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
                                <div>
                                    <div className="font-semibold text-slate-900">{preview.member.name}</div>
                                    <div className="mt-1 text-sm text-slate-500">
                                        {(preview.member.teamNames?.join(', ') || preview.member.teamName) || '팀 미지정'}
                                    </div>
                                </div>
                                {preview.attendanceEntry ? (
                                    <span className="rounded-full border border-slate-200 bg-slate-50 px-3 py-1 text-xs font-semibold text-slate-700">
                                        출석 상태 {preview.attendanceEntry.status === 'present' ? '출석' : preview.attendanceEntry.status === 'late' ? '지각' : '결석'}
                                    </span>
                                ) : null}
                            </div>

                            <div className="mt-4 grid grid-cols-1 gap-3 lg:grid-cols-[minmax(0,240px)_minmax(0,1fr)]">
                                <label className="space-y-1.5">
                                    <span className="text-xs font-medium text-slate-600">개별 규칙</span>
                                    <select
                                        value={preview.row.categoryId}
                                        onChange={(event) => onRecordCategoryChange(preview.member.id, event.target.value)}
                                        className="w-full rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm outline-none transition-all focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500"
                                    >
                                        <option value="">규칙 선택</option>
                                        {recordCategories.map((categoryOption) => (
                                            <option key={categoryOption.id} value={categoryOption.id}>
                                                {categoryOption.categoryName} ({categoryOption.pointValue > 0 ? '+' : ''}{categoryOption.pointValue})
                                            </option>
                                        ))}
                                    </select>
                                </label>
                                <label className="space-y-1.5">
                                    <span className="text-xs font-medium text-slate-600">개별 메모</span>
                                    <input
                                        type="text"
                                        value={preview.row.note}
                                        onChange={(event) => onRecordNoteRowChange(preview.member.id, event.target.value)}
                                        placeholder="예: 발표 담당, 운영 지원"
                                        className="w-full rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm outline-none transition-all focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500"
                                    />
                                </label>
                            </div>
                        </div>
                    ))}
                </div>
            </div>

            <div className="flex flex-wrap items-center justify-end gap-3 border-t border-slate-200 pt-4">
                <button
                    type="button"
                    onClick={onClose}
                    className="rounded-2xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-medium text-slate-600 transition-colors hover:bg-slate-50"
                >
                    닫기
                </button>
                <button
                    type="submit"
                    disabled={!canSubmit || isSaving}
                    className="rounded-2xl bg-indigo-600 px-4 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-indigo-700 disabled:opacity-50"
                >
                    {isSaving ? '저장 중...' : '기록 저장'}
                </button>
            </div>
        </form>
    </AppDialog>
);
