import React, { useEffect } from 'react';
import { X } from 'lucide-react';

interface AppDialogProps {
    isOpen: boolean;
    title: string;
    description?: string;
    size?: 'md' | 'lg' | 'xl';
    onClose: () => void;
    children: React.ReactNode;
}

const sizeClassByVariant: Record<NonNullable<AppDialogProps['size']>, string> = {
    md: 'max-w-xl',
    lg: 'max-w-2xl',
    xl: 'max-w-4xl',
};

export const AppDialog: React.FC<AppDialogProps> = ({
    isOpen,
    title,
    description,
    size = 'lg',
    onClose,
    children,
}) => {
    useEffect(() => {
        if (!isOpen) {
            return undefined;
        }

        const handleEscape = (event: KeyboardEvent) => {
            if (event.key === 'Escape') {
                onClose();
            }
        };

        const previousOverflow = document.body.style.overflow;
        document.body.style.overflow = 'hidden';
        window.addEventListener('keydown', handleEscape);

        return () => {
            document.body.style.overflow = previousOverflow;
            window.removeEventListener('keydown', handleEscape);
        };
    }, [isOpen, onClose]);

    if (!isOpen) {
        return null;
    }

    return (
        <div className="fixed inset-0 z-[90] flex items-end justify-center bg-slate-950/55 px-3 py-3 backdrop-blur-sm sm:items-center sm:px-6 sm:py-8">
            <button
                type="button"
                aria-label="창 닫기"
                className="absolute inset-0 cursor-default"
                onClick={onClose}
            />
            <div className={`relative flex max-h-[90vh] w-full flex-col overflow-hidden rounded-[30px] border border-slate-200 bg-white shadow-2xl ${sizeClassByVariant[size]}`}>
                <div className="flex items-start justify-between gap-4 border-b border-slate-200 px-5 py-5 sm:px-6">
                    <div>
                        <div className="text-xl font-bold text-slate-900">{title}</div>
                        {description && <div className="mt-1 text-sm leading-6 text-slate-500">{description}</div>}
                    </div>
                    <button
                        type="button"
                        onClick={onClose}
                        className="inline-flex h-10 w-10 items-center justify-center rounded-2xl border border-slate-200 text-slate-500 transition-colors hover:bg-slate-50 hover:text-slate-700"
                        aria-label="닫기"
                    >
                        <X size={18} />
                    </button>
                </div>
                <div className="overflow-y-auto px-5 py-5 sm:px-6">
                    {children}
                </div>
            </div>
        </div>
    );
};
