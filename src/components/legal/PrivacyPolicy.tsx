import React from 'react';
import { ArrowLeft, ShieldCheck } from 'lucide-react';

interface PrivacyPolicyProps {
    onBack?: () => void;
}

const Section: React.FC<{ title: string; children: React.ReactNode }> = ({ title, children }) => (
    <section className="space-y-3">
        <h2 className="text-xl font-bold text-slate-900">{title}</h2>
        <div className="space-y-2 text-sm leading-relaxed text-slate-700">{children}</div>
    </section>
);

export const PRIVACY_POLICY_VERSION = 1;
export const PRIVACY_POLICY_EFFECTIVE_DATE = '2026-04-26';

export const PrivacyPolicy: React.FC<PrivacyPolicyProps> = ({ onBack }) => {
    return (
        <div className="min-h-screen bg-slate-50 px-6 py-10">
            <div className="mx-auto w-full max-w-3xl">
                {onBack && (
                    <button
                        type="button"
                        onClick={onBack}
                        className="mb-6 inline-flex items-center gap-2 rounded-full border border-slate-200 bg-white px-4 py-2 text-sm font-medium text-slate-700 transition-colors hover:bg-slate-50"
                    >
                        <ArrowLeft size={14} />
                        이전으로
                    </button>
                )}

                <header className="space-y-3 rounded-3xl border border-slate-200 bg-white p-8 shadow-sm">
                    <div className="inline-flex items-center gap-2 rounded-full border border-indigo-200 bg-indigo-50 px-3 py-1 text-xs font-semibold text-indigo-700">
                        <ShieldCheck size={13} />
                        개인정보 처리방침
                    </div>
                    <h1 className="text-3xl font-bold text-slate-950">반올림스쿨 개인정보 처리방침</h1>
                    <p className="text-sm text-slate-600">
                        시행일: {PRIVACY_POLICY_EFFECTIVE_DATE} · 버전 v{PRIVACY_POLICY_VERSION}
                    </p>
                    <p className="text-sm text-slate-600">
                        반올림스쿨(이하 “단체”)은 「개인정보 보호법」을 비롯한 관련 법령을 준수하기 위해 본 개인정보
                        처리방침을 수립·공개합니다. 본 방침은 단체가 운영하는 회원 관리 시스템(이하 “서비스”)에
                        적용됩니다.
                    </p>
                </header>

                <main className="mt-6 space-y-8 rounded-3xl border border-slate-200 bg-white p-8 shadow-sm">
                    <Section title="1. 개인정보의 처리 목적">
                        <p>단체는 다음의 목적을 위하여 개인정보를 처리합니다.</p>
                        <ul className="list-disc space-y-1 pl-5">
                            <li>회원 가입·식별·계정 발급 및 인증</li>
                            <li>회원 활동 기록 관리(점수, 팀 소속, 직책, 출석, 활동 내역, 배지)</li>
                            <li>커뮤니티 게시·댓글 관리 및 운영진의 관리·중재</li>
                            <li>중요 공지·일정 안내 및 (동의 시) 푸시 알림 발송</li>
                            <li>서비스 부정 이용 방지 및 보안 로그 관리</li>
                        </ul>
                    </Section>

                    <Section title="2. 처리하는 개인정보의 항목">
                        <p>
                            <strong>가. 필수 항목</strong> (회원 가입·이용을 위해 반드시 처리)
                        </p>
                        <ul className="list-disc space-y-1 pl-5">
                            <li>이름</li>
                            <li>로그인 이메일</li>
                            <li>비밀번호(암호화 저장)</li>
                            <li>소속 팀, 직책</li>
                            <li>활동 기록(점수·출석·활동 내역·배지)</li>
                            <li>접속 로그(IP, User-Agent, 접속 시각, 변경 감사 로그)</li>
                        </ul>
                        <p>
                            <strong>나. 선택 항목</strong> (별도 동의 시에만 처리)
                        </p>
                        <ul className="list-disc space-y-1 pl-5">
                            <li>푸시 알림용 디바이스 토큰(endpoint, 암호화 키)</li>
                        </ul>
                    </Section>

                    <Section title="3. 개인정보의 보유 및 이용 기간">
                        <ul className="list-disc space-y-1 pl-5">
                            <li>회원 정보: 회원 탈퇴 또는 단체 해체 시까지</li>
                            <li>접속 로그·감사 로그: 마지막 활동일로부터 1년</li>
                            <li>법령상 별도 보존 의무가 있는 경우: 해당 법령에 정한 기간</li>
                            <li>
                                동의 철회 또는 회원 탈퇴 요청 시 지체 없이 파기. 단, 회계·분쟁 대응 등에 필요한
                                최소 정보는 분리 보관 후 보존 기간 종료 시 파기
                            </li>
                        </ul>
                    </Section>

                    <Section title="4. 개인정보의 제3자 제공">
                        <p>단체는 정보주체의 동의가 있거나 법령에 특별한 규정이 있는 경우를 제외하고는 개인정보를 제3자에게 제공하지 않습니다.</p>
                    </Section>

                    <Section title="5. 개인정보 처리의 위탁">
                        <p>
                            서비스 운영을 위해 다음과 같이 개인정보 처리를 위탁하고 있습니다. 위탁 처리자는 위탁받은
                            범위 내에서만 개인정보를 처리합니다.
                        </p>
                        <div className="mt-2 overflow-hidden rounded-2xl border border-slate-200">
                            <table className="w-full text-left text-xs">
                                <thead className="bg-slate-50 text-slate-700">
                                    <tr>
                                        <th className="px-3 py-2">위탁받는 자</th>
                                        <th className="px-3 py-2">위탁 업무</th>
                                        <th className="px-3 py-2">국가</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-slate-100">
                                    <tr>
                                        <td className="px-3 py-2 font-medium text-slate-800">Supabase Inc.</td>
                                        <td className="px-3 py-2">데이터베이스, 인증, 메일·푸시 알림 처리</td>
                                        <td className="px-3 py-2">미국</td>
                                    </tr>
                                    <tr>
                                        <td className="px-3 py-2 font-medium text-slate-800">Vercel Inc.</td>
                                        <td className="px-3 py-2">웹 서비스 호스팅 및 배포</td>
                                        <td className="px-3 py-2">미국</td>
                                    </tr>
                                    <tr>
                                        <td className="px-3 py-2 font-medium text-slate-800">Google LLC (Gmail SMTP)</td>
                                        <td className="px-3 py-2">계정 발급·비밀번호 재설정 메일 발송</td>
                                        <td className="px-3 py-2">미국</td>
                                    </tr>
                                </tbody>
                            </table>
                        </div>
                        <p className="mt-2 text-xs text-slate-500">
                            ※ 위탁받는 자가 변경되는 경우 본 방침을 갱신하여 사전에 공지합니다.
                        </p>
                    </Section>

                    <Section title="6. 개인정보의 국외 이전">
                        <p>
                            위 5항의 위탁 처리자(Supabase, Vercel, Google) 서버는 미국에 위치해 있어 회원 가입 시
                            개인정보가 국외로 이전됩니다. 이전되는 항목·목적·국가·수령자는 위 표와 같으며, 이전
                            방법은 인터넷 회선을 통한 전송, 보유·이용 기간은 위탁 계약 종료 시까지입니다. 회원은
                            국외 이전을 거부할 권리가 있으며, 거부 시 서비스 이용이 제한될 수 있습니다.
                        </p>
                    </Section>

                    <Section title="7. 정보주체의 권리·의무 및 행사 방법">
                        <p>회원은 단체에 대해 언제든지 다음 권리를 행사할 수 있습니다.</p>
                        <ul className="list-disc space-y-1 pl-5">
                            <li>개인정보 열람 요구</li>
                            <li>오류 정정·삭제 요구</li>
                            <li>처리 정지 요구</li>
                            <li>동의 철회</li>
                        </ul>
                        <p>
                            권리 행사는 서비스 내 마이페이지 또는 아래 개인정보 보호책임자 연락처로 요청하실 수
                            있으며, 단체는 지체 없이 조치하겠습니다.
                        </p>
                    </Section>

                    <Section title="8. 개인정보의 안전성 확보 조치">
                        <ul className="list-disc space-y-1 pl-5">
                            <li>접근 통제: Supabase Row Level Security(RLS) 기반 권한 분리</li>
                            <li>비밀번호 암호화: bcrypt 등 단방향 암호화 저장</li>
                            <li>전송 구간 암호화: HTTPS/TLS 적용</li>
                            <li>변경 감사 로그: 운영진 권한 작업 자동 기록</li>
                            <li>접근 권한 최소화: 직책별 역할 기반 권한 부여</li>
                        </ul>
                    </Section>

                    <Section title="9. 개인정보 보호책임자">
                        <div className="rounded-2xl bg-slate-50 p-4">
                            <p className="font-semibold text-slate-900">개인정보 보호책임자(CPO)</p>
                            <ul className="mt-2 space-y-1 text-slate-700">
                                <li>이름: 사이트 관리자</li>
                                <li>이메일: hhj96916@gmail.com</li>
                            </ul>
                            <p className="mt-3 text-xs text-slate-500">
                                ※ 회원 정보 열람·정정·삭제·처리정지·동의철회 등 모든 문의는 위 연락처로 보내 주세요.
                            </p>
                        </div>
                    </Section>

                    <Section title="10. 권익 침해 구제 방법">
                        <p>개인정보 침해로 인한 신고·상담이 필요한 경우 아래 기관에 문의할 수 있습니다.</p>
                        <ul className="list-disc space-y-1 pl-5">
                            <li>개인정보 침해신고센터: privacy.go.kr / 국번 없이 182</li>
                            <li>개인정보 분쟁조정위원회: kopico.go.kr / 1833-6972</li>
                            <li>대검찰청 사이버수사과: spo.go.kr / 국번 없이 1301</li>
                            <li>경찰청 사이버수사국: ecrm.cyber.go.kr / 국번 없이 182</li>
                        </ul>
                    </Section>

                    <Section title="11. 처리방침의 변경">
                        <p>
                            본 방침은 시행일로부터 적용되며, 법령 및 정책 변경 등에 따라 내용 추가·삭제·수정이 있을
                            경우 변경 사항의 시행 7일 전부터 서비스 내 공지사항을 통해 고지합니다. 중대한 변경(수집
                            항목·제공·이전 추가 등)은 회원에게 재동의를 요청합니다.
                        </p>
                    </Section>
                </main>

                <footer className="mt-6 text-center text-xs text-slate-400">
                    © 반올림스쿨 — 본 처리방침은 개인정보 보호법 제30조에 따라 공개됩니다.
                </footer>
            </div>
        </div>
    );
};
