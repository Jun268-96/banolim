import { getErrorMessage } from './errors';

export type DataFallbackState = {
    id: string;
    task: string;
    message: string;
};

let latestDataFallbackState: DataFallbackState | null = null;
const dataFallbackListeners = new Set<() => void>();
const siteBannerListeners = new Set<() => void>();

const notifyDataFallbackListeners = () => {
    dataFallbackListeners.forEach((listener) => listener());
};

export const notifySiteBannerListeners = () => {
    siteBannerListeners.forEach((listener) => listener());
};

export const reportDataFallback = (task: string, error: unknown) => {
    latestDataFallbackState = {
        id: `${task}-${Date.now()}`,
        task,
        message: getErrorMessage(error),
    };
    notifyDataFallbackListeners();
};

export const getLatestDataFallbackState = () => latestDataFallbackState;

export const subscribeToDataFallbackState = (listener: () => void) => {
    dataFallbackListeners.add(listener);
    return () => {
        dataFallbackListeners.delete(listener);
    };
};

export const clearLatestDataFallbackState = () => {
    latestDataFallbackState = null;
    notifyDataFallbackListeners();
};

export const subscribeToSiteBannerChanges = (listener: () => void) => {
    siteBannerListeners.add(listener);
    return () => {
        siteBannerListeners.delete(listener);
    };
};
