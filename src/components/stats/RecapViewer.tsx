import React, { useState, useEffect } from 'react';
import { X, ChevronRight, ChevronLeft, Award, Zap, CalendarDays, Maximize2 } from 'lucide-react';
import type { Member, Category, ActivityLog } from '../../types';

interface RecapViewerProps {
    members: Member[];
    categories: Category[];
    logs: ActivityLog[];
    onClose: () => void;
}

export const RecapViewer: React.FC<RecapViewerProps> = ({ members, logs, onClose }) => {
    const [currentSlide, setCurrentSlide] = useState(0);

    // Data pre-processing for slides
    const totalActivities = logs.length;

    // Find top attendance
    const attendanceLogs = logs.filter(l => l.pointDelta === 10); // Assuming 10 is attendance, simplified for demo
    const memberLogCounts: Record<string, number> = {};
    attendanceLogs.forEach(l => {
        memberLogCounts[l.memberId] = (memberLogCounts[l.memberId] || 0) + 1;
    });
    const topAttenderId = Object.keys(memberLogCounts).sort((a, b) => memberLogCounts[b] - memberLogCounts[a])[0];
    const topAttender = members.find(m => m.id === topAttenderId);

    // Find most active month
    const monthCounts: Record<string, number> = {};
    logs.forEach(l => {
        const month = new Date(l.timestamp).getMonth() + 1;
        monthCounts[month] = (monthCounts[month] || 0) + 1;
    });
    const topMonth = Object.keys(monthCounts).sort((a, b) => monthCounts[Number(b)] - monthCounts[Number(a)])[0];

    // Find level up master
    const topScorer = [...members].sort((a, b) => b.score - a.score)[0];

    const slides = [
        {
            id: 'intro',
            color: 'from-violet-600 via-indigo-700 to-blue-800',
            icon: <Zap size={80} className="text-yellow-400 mb-8" />,
            title: '2026년 반올림 연구회',
            desc: '올해 우리는 얼마나 성장했을까요?',
        },
        {
            id: 'activities',
            color: 'from-rose-500 via-pink-600 to-purple-700',
            icon: <CalendarDays size={80} className="text-white mb-8" />,
            title: '함께한 빛나는 순간들',
            desc: `올해 반올림은 총 <span class="bg-white text-pink-600 px-3 py-1 rounded-xl font-black text-4xl mx-2 shadow-lg">${totalActivities}</span> 번의 활동을 함께했어요!`,
        },
        {
            id: 'month',
            color: 'from-amber-400 via-orange-500 to-red-600',
            icon: <Maximize2 size={80} className="text-white mb-8" />,
            title: '가장 불타올랐던 달',
            desc: `우리의 열정이 가장 뜨거웠던 달은 <br/><span class="text-6xl font-black text-yellow-200 block mt-6">${topMonth}월</span> 이네요! 🔥`,
        },
        {
            id: 'attendance',
            color: 'from-emerald-400 via-teal-600 to-cyan-700',
            icon: <Award size={80} className="text-yellow-300 mb-8" />,
            title: '올해의 출석왕',
            desc: topAttender ? `<span class="text-5xl font-black text-white px-4 py-2 bg-black/20 rounded-2xl block mt-4">${topAttender.name} 선생님</span><br/><span class="text-2xl mt-4 block text-emerald-100">성실함의 표본! 정말 감사합니다 🏆</span>` : '아직 활동 기록이 부족해요!',
        },
        {
            id: 'growth',
            color: 'from-fuchsia-600 via-purple-700 to-indigo-800',
            icon: <Rocket size={80} className="text-pink-300 mb-8" />,
            title: '레벨업 마스터',
            desc: topScorer ? `<span class="text-5xl font-black text-white px-4 py-2 bg-white/20 rounded-2xl block mt-4">${topScorer.name} 선생님</span><br/><span class="text-2xl mt-4 block text-fuchsia-200">가장 많이 성장한 연구원입니다 🚀</span>` : '아직 대상자가 없어요!',
        },
    ];

    useEffect(() => {
        // Auto advance slides every 5 seconds
        const timer = setInterval(() => {
            setCurrentSlide(p => (p < slides.length - 1 ? p + 1 : p));
        }, 5000);
        return () => clearInterval(timer);
    }, [slides.length]);

    const nextSlide = () => setCurrentSlide(p => Math.min(slides.length - 1, p + 1));
    const prevSlide = () => setCurrentSlide(p => Math.max(0, p - 1));

    const current = slides[currentSlide];

    return (
        <div className="fixed inset-0 z-50 bg-black/90 backdrop-blur-md flex items-center justify-center animate-in fade-in duration-300">
            <button
                onClick={onClose}
                className="absolute top-6 right-6 text-white/50 hover:text-white p-2 bg-white/10 hover:bg-white/20 rounded-full transition-all"
            >
                <X size={24} />
            </button>

            <div className="w-full max-w-md h-[80vh] md:h-[700px] relative rounded-3xl overflow-hidden shadow-2xl flex flex-col group">

                {/* Progress Bars */}
                <div className="absolute top-4 left-4 right-4 flex gap-1.5 z-20">
                    {slides.map((_, idx) => (
                        <div key={idx} className="h-1 bg-white/30 rounded-full flex-1 overflow-hidden">
                            <div
                                className={`h-full bg-white transition-all duration-[5000ms] ease-linear ${idx === currentSlide ? 'w-full' : idx < currentSlide ? 'w-full' : 'w-0'}`}
                                style={idx === currentSlide ? {} : { transitionDuration: '0ms' }}
                            />
                        </div>
                    ))}
                </div>

                {/* Slide Content */}
                <div
                    className={`absolute inset-0 bg-gradient-to-br ${current.color} p-8 flex flex-col items-center justify-center text-center transition-all duration-700`}
                >
                    <div className="animate-in slide-in-from-bottom-8 zoom-in-95 duration-700 fade-in flex flex-col items-center">
                        {current.icon}
                        <h3 className="text-2xl md:text-3xl font-bold text-white/90 mb-4">{current.title}</h3>
                        <p
                            className="text-xl md:text-2xl text-white font-medium leading-relaxed"
                            dangerouslySetInnerHTML={{ __html: current.desc }}
                        />
                    </div>
                </div>

                {/* Navigation Areas (invisible) */}
                <div className="absolute inset-y-0 left-0 w-1/3 z-10 cursor-pointer" onClick={prevSlide} />
                <div className="absolute inset-y-0 right-0 w-2/3 z-10 cursor-pointer" onClick={nextSlide} />

                {/* Desktop Controls (invisible until hover) */}
                <button
                    onClick={(e) => { e.stopPropagation(); prevSlide(); }}
                    className={`absolute left-4 top-1/2 -translate-y-1/2 p-3 bg-black/20 text-white rounded-full backdrop-blur-sm transition-all opacity-0 group-hover:opacity-100 ${currentSlide === 0 ? 'hidden' : 'block'} z-20 hover:bg-black/40`}
                >
                    <ChevronLeft size={24} />
                </button>
                <button
                    onClick={(e) => { e.stopPropagation(); nextSlide(); }}
                    className={`absolute right-4 top-1/2 -translate-y-1/2 p-3 bg-black/20 text-white rounded-full backdrop-blur-sm transition-all opacity-0 group-hover:opacity-100 ${currentSlide === slides.length - 1 ? 'hidden' : 'block'} z-20 hover:bg-black/40`}
                >
                    <ChevronRight size={24} />
                </button>
            </div>
        </div>
    );
};

// Simple rocket icon component for the last slide
const Rocket = ({ size, className }: { size: number, className: string }) => (
    <svg
        xmlns="http://www.w3.org/2000/svg"
        width={size}
        height={size}
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
        className={className}
    >
        <path d="M4.5 16.5c-1.5 1.26-2 5-2 5s3.74-.5 5-2c.71-.84.7-2.13-.09-2.91a2.18 2.18 0 0 0-2.91-.09z" />
        <path d="m12 15-3-3a22 22 0 0 1 2-3.95A12.88 12.88 0 0 1 22 2c0 2.72-.78 7.5-6 11a22.35 22.35 0 0 1-4 2z" />
        <path d="M9 12H4s.55-3.03 2-4c1.62-1.08 5 0 5 0" />
        <path d="M12 15v5s3.03-.55 4-2c1.08-1.62 0-5 0-5" />
    </svg>
);
