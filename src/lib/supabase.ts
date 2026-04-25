import { createClient } from '@supabase/supabase-js';
import type { Database } from '../types/database';

export const supabaseUrl = import.meta.env.VITE_SUPABASE_URL?.trim();
export const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY?.trim();
const bypassAuthValue = import.meta.env.VITE_BYPASS_AUTH?.trim().toLowerCase();
const hasSupabaseCredentials = Boolean(supabaseUrl && supabaseAnonKey);

export const isAuthBypassed = bypassAuthValue === 'true';

// ANALYSIS.md P0: 프로덕션 빌드가 BYPASS 모드로 배포되는 것을 원천 차단.
// BYPASS 모드는 로컬 mock 데이터 + 고정 super_admin 프로필이므로 프로덕션에 유출되면 사고.
if (import.meta.env.PROD && isAuthBypassed) {
    throw new Error(
        '[반올림] VITE_BYPASS_AUTH=true 상태로 프로덕션 번들이 로드되었습니다. ' +
        '배포 환경 변수에서 이 값을 false로 설정한 뒤 다시 빌드하세요.',
    );
}

export const isSupabaseConfigured = hasSupabaseCredentials && !isAuthBypassed;

export const supabase = isSupabaseConfigured
    ? createClient<Database>(supabaseUrl!, supabaseAnonKey!, {
        auth: {
            autoRefreshToken: true,
            persistSession: true,
            // PKCE는 verifier가 [재발급] 누른 그 기기 localStorage에만 있어, 카톡 등으로
            // 다른 기기에 링크를 전달하면 코드 교환이 실패한다. invite/recovery 링크가 어떤
            // 기기에서 열려도 동작하도록 implicit flow로 전환해 hash 토큰만으로 세션을 만든다.
            flowType: 'implicit',
            detectSessionInUrl: true,
        },
    })
    : null;
