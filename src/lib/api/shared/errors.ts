const translatePostgresError = (error: object): string | null => {
  const code = 'code' in error && typeof error.code === 'string' ? error.code : null;
  const constraintName = 'message' in error && typeof error.message === 'string' ? error.message : '';

  if (code === '23505') {
    if (constraintName.includes('login_email')) return '이미 다른 회원에게 등록된 이메일입니다.';
    if (constraintName.includes('name')) return '이미 사용 중인 이름입니다.';
    return '이미 사용 중인 값입니다. 다른 값을 입력해 주세요.';
  }
  if (code === '23503') return '연결된 데이터가 있어 삭제할 수 없습니다.';
  if (code === '23502') return '필수 항목이 비어 있습니다.';
  if (code === '42501') return '권한이 없습니다.';

  return null;
};

export const getErrorMessage = (error: unknown) => {
  if (error instanceof Error) {
    return error.message;
  }

  if (typeof error === 'string') {
    return error;
  }

  if (error && typeof error === 'object') {
    const translated = translatePostgresError(error);
    if (translated) return translated;

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
