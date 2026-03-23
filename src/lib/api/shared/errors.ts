export const getErrorMessage = (error: unknown) => {
  if (error instanceof Error) {
    return error.message;
  }

  if (typeof error === 'string') {
    return error;
  }

  if (error && typeof error === 'object') {
    const message = 'message' in error && typeof error.message === 'string' ? error.message : null;
    const details = 'details' in error && typeof error.details === 'string' ? error.details : null;
    const hint = 'hint' in error && typeof error.hint === 'string' ? error.hint : null;
    return [message, details, hint].filter(Boolean).join(' · ') || '알 수 없는 오류';
  }

  return '알 수 없는 오류';
};

export const isNetworkFetchError = (error: unknown) => {
  const message = getErrorMessage(error).toLowerCase();
  return message.includes('failed to fetch') || message.includes('networkerror');
};

export const isMissingSupabaseRelationError = (error: unknown, relationNames: string[]) => {
  const message = getErrorMessage(error).toLowerCase();
  const code = error && typeof error === 'object' && 'code' in error && typeof error.code === 'string'
    ? error.code.toUpperCase()
    : '';

  const mentionsRelation = relationNames.some((relationName) => {
    const normalizedName = relationName.toLowerCase();
    return message.includes(`public.${normalizedName}`) || message.includes(`'${normalizedName}'`);
  });

  return mentionsRelation && (
    code === 'PGRST205'
    || message.includes('schema cache')
    || message.includes('could not find the table')
    || message.includes('does not exist')
  );
};
