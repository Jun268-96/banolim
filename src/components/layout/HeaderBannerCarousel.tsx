import React, { useEffect, useMemo, useRef, useState } from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import type { SiteBanner } from '../../types';
import { getSiteBanners, subscribeToSiteBannerChanges } from '../../lib/db';

const fallbackBannerUrl = new URL('../../../반올림스쿨 배너.png', import.meta.url).href;

const fallbackBanner: SiteBanner = {
    id: 'default-banner',
    title: '반올림스쿨 기본 배너',
    imageUrl: fallbackBannerUrl,
    displayOrder: 0,
    isActive: true,
    createdAt: new Date(0).toISOString(),
};

export const HeaderBannerCarousel: React.FC = () => {
    const [banners, setBanners] = useState<SiteBanner[]>([]);
    const [currentIndex, setCurrentIndex] = useState(0);
    const dragStartXRef = useRef<number | null>(null);

    useEffect(() => {
        let isMounted = true;

        const loadBanners = async () => {
            const loadedBanners = await getSiteBanners();
            if (!isMounted) {
                return;
            }

            setBanners(loadedBanners);
            setCurrentIndex((previous) => {
                if (loadedBanners.length === 0) {
                    return 0;
                }

                return Math.min(previous, loadedBanners.length - 1);
            });
        };

        void loadBanners();
        const unsubscribe = subscribeToSiteBannerChanges(() => {
            void loadBanners();
        });

        return () => {
            isMounted = false;
            unsubscribe();
        };
    }, []);

    const activeBanners = useMemo(() => (banners.length > 0 ? banners : [fallbackBanner]), [banners]);

    useEffect(() => {
        if (activeBanners.length <= 1) {
            return undefined;
        }

        const intervalId = window.setInterval(() => {
            setCurrentIndex((previous) => (previous + 1) % activeBanners.length);
        }, 5000);

        return () => {
            window.clearInterval(intervalId);
        };
    }, [activeBanners.length]);

    const handleMove = (direction: 'prev' | 'next') => {
        setCurrentIndex((previous) => {
            if (direction === 'prev') {
                return previous === 0 ? activeBanners.length - 1 : previous - 1;
            }

            return (previous + 1) % activeBanners.length;
        });
    };

    const handlePointerDown = (event: React.PointerEvent<HTMLDivElement>) => {
        dragStartXRef.current = event.clientX;
    };

    const handlePointerUp = (event: React.PointerEvent<HTMLDivElement>) => {
        const startX = dragStartXRef.current;
        dragStartXRef.current = null;

        if (startX === null || activeBanners.length <= 1) {
            return;
        }

        const deltaX = event.clientX - startX;
        if (Math.abs(deltaX) < 40) {
            return;
        }

        handleMove(deltaX > 0 ? 'prev' : 'next');
    };

    return (
        <div className="relative min-w-0 flex-1 overflow-hidden">
            <div
                className="group relative h-32 w-full overflow-hidden rounded-[36px] bg-transparent sm:h-36 lg:h-40 xl:h-44 2xl:h-48"
                onPointerDown={handlePointerDown}
                onPointerUp={handlePointerUp}
            >
                <div
                    className="flex h-full transition-transform duration-500 ease-out"
                    style={{ transform: `translateX(-${currentIndex * 100}%)` }}
                >
                    {activeBanners.map((banner) => (
                        <div key={banner.id} className="h-full min-w-full">
                            <img
                                src={banner.imageUrl}
                                alt={banner.title || '반올림스쿨 배너'}
                                className="h-full w-full select-none object-contain object-left"
                                draggable={false}
                            />
                        </div>
                    ))}
                </div>

                {activeBanners.length > 1 ? (
                    <>
                        <button
                            type="button"
                            onClick={() => handleMove('prev')}
                            className="absolute left-3 top-1/2 inline-flex h-10 w-10 -translate-y-1/2 items-center justify-center rounded-full bg-slate-950/40 text-white opacity-0 transition-opacity hover:bg-slate-950/55 group-hover:opacity-100"
                            aria-label="이전 배너"
                        >
                            <ChevronLeft size={20} />
                        </button>
                        <button
                            type="button"
                            onClick={() => handleMove('next')}
                            className="absolute right-3 top-1/2 inline-flex h-10 w-10 -translate-y-1/2 items-center justify-center rounded-full bg-slate-950/40 text-white opacity-0 transition-opacity hover:bg-slate-950/55 group-hover:opacity-100"
                            aria-label="다음 배너"
                        >
                            <ChevronRight size={20} />
                        </button>
                        <div className="absolute bottom-3 left-1/2 flex -translate-x-1/2 items-center gap-2 rounded-full bg-slate-950/35 px-3 py-1.5 backdrop-blur-sm">
                            {activeBanners.map((banner, index) => (
                                <button
                                    key={banner.id}
                                    type="button"
                                    onClick={() => setCurrentIndex(index)}
                                    className={`h-2.5 rounded-full transition-all ${index === currentIndex ? 'w-6 bg-white' : 'w-2.5 bg-white/55 hover:bg-white/75'}`}
                                    aria-label={`${index + 1}번 배너 보기`}
                                />
                            ))}
                        </div>
                    </>
                ) : null}
            </div>
        </div>
    );
};
