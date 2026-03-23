export const toRecord = (value: unknown): Record<string, unknown> =>
  value && typeof value === 'object' && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};

export const getStringField = (value: unknown, key: string) => {
  const record = toRecord(value);
  return typeof record[key] === 'string' ? record[key] : '';
};

export const getNumberField = (value: unknown, key: string) => {
  const record = toRecord(value);
  return typeof record[key] === 'number' ? record[key] : 0;
};

export const getOptionalNumberField = (value: unknown, key: string) => {
  const record = toRecord(value);
  return typeof record[key] === 'number' ? record[key] : undefined;
};

export const getBooleanField = (value: unknown, key: string) => {
  const record = toRecord(value);
  return Boolean(record[key]);
};
