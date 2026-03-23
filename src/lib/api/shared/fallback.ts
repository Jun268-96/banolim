import { reportDataFallback } from './fallbackState';

export const fallback = <T>(task: string, getLocalValue: () => T, error?: unknown): T => {
    if (error) {
        reportDataFallback(task, error);
        console.warn(`[data] ${task} failed, using local fallback instead.`, error);
    }

    return getLocalValue();
};
