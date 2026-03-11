import React, { useMemo, useRef, useState } from 'react';
import { Copy, Download, Sparkles, X } from 'lucide-react';
import { toPng } from 'html-to-image';

interface ShareRecapStat {
    label: string;
    value: string;
}

interface ShareRecapCardProps {
    title: string;
    subtitle: string;
    summary: string;
    badge: string;
    note: string;
    mascotUrl: string;
    fileName: string;
    stats: ShareRecapStat[];
    onClose: () => void;
}

const banollimSchoolLogoUrl = new URL('../../../반디스쿨 로고1.png', import.meta.url).href;

export const ShareRecapCard: React.FC<ShareRecapCardProps> = ({
    title,
    subtitle,
    summary,
    badge,
    note,
    mascotUrl,
    fileName,
    stats,
    onClose,
}) => {
    const cardRef = useRef<HTMLDivElement | null>(null);
    const [statusMessage, setStatusMessage] = useState<string | null>(null);
    const [isExporting, setIsExporting] = useState(false);

    const shareText = useMemo(
        () =>
            [
                `[${badge}] ${title}`,
                subtitle,
                summary,
                ...stats.map((stat) => `${stat.label}: ${stat.value}`),
                note,
            ].join('\n'),
        [badge, note, stats, subtitle, summary, title],
    );

    const showStatus = (message: string) => {
        setStatusMessage(message);
        window.setTimeout(() => {
            setStatusMessage((current) => (current === message ? null : current));
        }, 2200);
    };

    const handleCopy = async () => {
        try {
            await navigator.clipboard.writeText(shareText);
            showStatus('리캡 요약을 복사했습니다.');
        } catch (error) {
            console.error(error);
            showStatus('복사에 실패했습니다.');
        }
    };

    const handleDownload = async () => {
        if (!cardRef.current) {
            return;
        }

        setIsExporting(true);

        try {
            const dataUrl = await toPng(cardRef.current, {
                cacheBust: true,
                pixelRatio: 2,
            });

            const link = document.createElement('a');
            link.href = dataUrl;
            link.download = `${fileName}.png`;
            link.click();
            showStatus('공유 카드 이미지를 저장했습니다.');
        } catch (error) {
            console.error(error);
            showStatus('이미지 저장에 실패했습니다.');
        } finally {
            setIsExporting(false);
        }
    };

    return (
        <div className="fixed inset-0 z-[70] flex items-center justify-center bg-slate-950/78 px-4 py-6 backdrop-blur-xl animate-in fade-in duration-300">
            <button
                type="button"
                onClick={onClose}
                className="absolute right-5 top-5 rounded-full border border-white/10 bg-white/10 p-2 text-white/70 transition-colors hover:bg-white/20 hover:text-white"
            >
                <X size={22} />
            </button>

            <div className="flex w-full max-w-[1080px] flex-col gap-5 lg:flex-row">
                <div
                    ref={cardRef}
                    className="relative w-full overflow-hidden rounded-[36px] border border-white/10 bg-[radial-gradient(circle_at_top_left,_rgba(125,211,252,0.35),_transparent_32%),linear-gradient(145deg,_#0f172a_0%,_#312e81_48%,_#0f172a_100%)] p-7 shadow-[0_40px_120px_rgba(15,23,42,0.45)] lg:max-w-[760px]"
                >
                    <img
                        src={banollimSchoolLogoUrl}
                        alt="반디스쿨 로고"
                        className="pointer-events-none absolute right-6 top-6 h-20 w-auto opacity-10 saturate-0"
                    />

                    <div className="relative flex min-h-[520px] flex-col justify-between gap-10">
                        <div className="space-y-5">
                            <div className="inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/10 px-4 py-2 text-xs font-semibold uppercase tracking-[0.18em] text-white/85">
                                <Sparkles size={14} />
                                {badge}
                            </div>

                            <div className="space-y-3">
                                <div className="text-sm font-semibold text-sky-100/80">{subtitle}</div>
                                <h3 className="max-w-[520px] text-[2.25rem] font-black leading-[1.04] tracking-tight text-white">
                                    {title}
                                </h3>
                                <p className="max-w-[560px] text-base leading-7 text-white/82">{summary}</p>
                            </div>

                            <div className="grid gap-3 sm:grid-cols-2">
                                {stats.map((stat) => (
                                    <div key={stat.label} className="rounded-[24px] border border-white/12 bg-white/10 px-4 py-4 backdrop-blur-sm">
                                        <div className="text-xs uppercase tracking-[0.16em] text-white/45">{stat.label}</div>
                                        <div className="mt-2 text-2xl font-black text-white">{stat.value}</div>
                                    </div>
                                ))}
                            </div>
                        </div>

                        <div className="flex items-end justify-between gap-4">
                            <div className="max-w-[420px] rounded-[28px] border border-white/10 bg-black/20 px-5 py-4 text-sm leading-7 text-white/76 backdrop-blur-sm">
                                {note}
                            </div>

                            <img
                                src={mascotUrl}
                                alt="리캡 마스코트"
                                className="h-32 w-auto drop-shadow-[0_26px_56px_rgba(15,23,42,0.35)] sm:h-40"
                            />
                        </div>
                    </div>
                </div>

                <div className="flex flex-1 flex-col justify-between rounded-[32px] border border-white/10 bg-slate-950/85 p-6 text-white shadow-[0_30px_80px_rgba(15,23,42,0.35)]">
                    <div className="space-y-5">
                        <div>
                            <div className="text-sm font-semibold uppercase tracking-[0.16em] text-white/45">공유 카드</div>
                            <h4 className="mt-3 text-2xl font-black tracking-tight">요약 한 장으로 내보내기</h4>
                        </div>

                        <div className="space-y-3 text-sm leading-7 text-white/72">
                            <p>현재 리캡의 핵심 수치와 요약 문장을 한 장 카드로 압축했습니다.</p>
                            <p>운영진 공유, 스터디 회고, 개인 성장 공유에 바로 쓸 수 있습니다.</p>
                        </div>

                        <div className="rounded-3xl border border-white/10 bg-white/5 px-4 py-4 text-sm leading-7 text-white/76">
                            <div className="font-semibold text-white/92">내보내기 구성</div>
                            <ul className="mt-3 space-y-2">
                                <li>브랜드 헤더와 캐릭터</li>
                                <li>핵심 지표 4개</li>
                                <li>요약 문장과 운영 메모</li>
                            </ul>
                        </div>
                    </div>

                    <div className="space-y-3">
                        <button
                            type="button"
                            onClick={handleDownload}
                            disabled={isExporting}
                            className="flex w-full items-center justify-center gap-2 rounded-2xl bg-gradient-to-r from-sky-500 to-indigo-500 px-5 py-3 font-bold text-white transition-transform active:scale-[0.98] disabled:cursor-wait disabled:opacity-70"
                        >
                            <Download size={18} />
                            {isExporting ? '이미지 생성 중...' : 'PNG 저장'}
                        </button>

                        <button
                            type="button"
                            onClick={handleCopy}
                            className="flex w-full items-center justify-center gap-2 rounded-2xl border border-white/10 bg-white/5 px-5 py-3 font-semibold text-white transition-colors hover:bg-white/10"
                        >
                            <Copy size={18} />
                            요약 복사
                        </button>

                        {statusMessage && (
                            <div className="rounded-2xl border border-emerald-400/20 bg-emerald-400/10 px-4 py-3 text-sm font-medium text-emerald-100">
                                {statusMessage}
                            </div>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
};
