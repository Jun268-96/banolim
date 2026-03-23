import React from 'react';
import { Plus } from 'lucide-react';

interface SectionHeaderProps {
  icon: React.ReactNode;
  title: string;
  description: string;
  actionLabel?: string;
  onAction?: () => void;
}

export const SectionHeader: React.FC<SectionHeaderProps> = ({ icon, title, description, actionLabel, onAction }) => (
  <div className="flex flex-col gap-3 border-b border-slate-200 px-5 py-5 sm:flex-row sm:items-start sm:justify-between sm:px-6">
    <div>
      <div className="flex items-center gap-2 text-slate-900">
        {icon}
        <h3 className="text-lg font-semibold">{title}</h3>
      </div>
      <p className="mt-1 text-sm leading-6 text-slate-500">{description}</p>
    </div>
    {actionLabel && onAction && (
      <button
        type="button"
        onClick={onAction}
        className="inline-flex h-11 shrink-0 items-center justify-center gap-2 rounded-2xl border border-indigo-200 bg-indigo-50 px-4 text-sm font-semibold text-indigo-700 transition-colors hover:bg-indigo-100"
      >
        <Plus size={16} />
        {actionLabel}
      </button>
    )}
  </div>
);

export const EmptyState: React.FC<{ message: string }> = ({ message }) => (
  <div className="rounded-[28px] border border-dashed border-slate-200 px-4 py-10 text-center text-sm text-slate-500">
    {message}
  </div>
);
