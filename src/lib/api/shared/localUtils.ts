export const createLocalId = (prefix: string) => `${prefix}_${Math.random().toString(36).slice(2, 10)}`;

export const createTemporaryPassword = () => {
    const base = Math.random().toString(36).slice(2, 8);
    const suffix = Math.random().toString(36).slice(2, 6).toUpperCase();
    return `Ban!${base}${suffix}`;
};

export const normalizeLoginEmail = (value?: string | null) => {
    const normalized = value?.trim().toLowerCase() ?? '';
    return normalized.length > 0 ? normalized : null;
};
