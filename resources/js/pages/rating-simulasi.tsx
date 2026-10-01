import { Head, Link, router } from '@inertiajs/react';
import {
    AlertCircle,
    ArrowDown,
    Building2,
    Calculator,
    CheckCircle2,
    Copy,
    ExternalLink,
    HelpCircle,
    MapPin,
    RefreshCw,
    Sparkles,
    Star,
} from 'lucide-react';
import React, { useMemo, useState } from 'react';
import { Select as AntSelect, Button as AntButton, Tag as AntTag } from 'antd';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { dashboard } from '@/routes';
import ratingSimulasi from '@/routes/rating-simulasi';
import reviewsRoute from '@/routes/reviews';

interface DealerItem {
    id: number;
    kode_dealer: string;
    nama_dealer: string;
    star_rate: number | null;
    total_review: number;
    link_google_maps: string | null;
    pos_code: string | null;
    current_zone?: string;
}

interface RatingSimulasiProps {
    dealers: DealerItem[];
    currentDealer: DealerItem | null;
    initialTargetRating?: number;
    isGlobal?: boolean;
}

export default function RatingSimulasi({
    dealers = [],
    currentDealer,
    initialTargetRating = 4.8,
    isGlobal = false,
}: RatingSimulasiProps) {
    const [selectedDealerId, setSelectedDealerId] = useState<number>(
        currentDealer?.id ?? (dealers[0]?.id || 0)
    );

    const activeDealer = useMemo(() => {
        return dealers.find((d) => d.id === selectedDealerId) ?? currentDealer ?? dealers[0] ?? null;
    }, [dealers, selectedDealerId, currentDealer]);

    const [targetRating, setTargetRating] = useState<number>(initialTargetRating);
    const [copied, setCopied] = useState(false);

    // Current condition
    const currentReviews = activeDealer ? activeDealer.total_review : 0;
    const currentRating = activeDealer && activeDealer.star_rate !== null ? activeDealer.star_rate : 0.0;

    // Simulation calculation:
    // x = ceil( N * (R_target - R_cur) / (5.0 - R_target) )
    const simulationResult = useMemo(() => {
        if (!activeDealer || currentReviews <= 0 || currentRating <= 0) {
            return {
                neededFiveStars: 0,
                totalTargetReviews: currentReviews,
                projectedZone: 'NEED IMPROVEMENT',
                isReached: true,
            };
        }

        if (targetRating <= currentRating) {
            const projectedZone = getZone(targetRating, currentReviews);
            return {
                neededFiveStars: 0,
                totalTargetReviews: currentReviews,
                projectedZone,
                isReached: true,
            };
        }

        // If target is 5.0, Google Maps rounds >= 4.95 to 5.0
        const effectiveTarget = targetRating >= 5.0 ? 4.95 : targetRating;
        const denominator = 5.0 - effectiveTarget;

        let needed = 0;
        if (denominator > 0) {
            needed = Math.ceil(
                (currentReviews * (effectiveTarget - currentRating)) / denominator
            );
        }
        if (needed < 0) needed = 0;

        const totalTarget = currentReviews + needed;
        const projectedZone = getZone(targetRating, totalTarget);

        return {
            neededFiveStars: needed,
            totalTargetReviews: totalTarget,
            projectedZone,
            isReached: false,
        };
    }, [activeDealer, currentReviews, currentRating, targetRating]);

    function getZone(rating: number, reviews: number): string {
        if (rating >= 4.7 && reviews >= 1000) return 'EXCELLENT';
        if (rating >= 4.7 && reviews < 1000) return 'VOLUME';
        if (rating < 4.7 && reviews >= 1000) return 'QUALITY';
        return 'NEED IMPROVEMENT';
    }

    const currentZone = useMemo(() => {
        return getZone(currentRating, currentReviews);
    }, [currentRating, currentReviews]);

    const handleDealerChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
        const id = Number(e.target.value);
        setSelectedDealerId(id);
    };

    const handleCopyLink = () => {
        if (!activeDealer?.link_google_maps) return;
        navigator.clipboard.writeText(activeDealer.link_google_maps);
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
    };

    const getZoneColorClass = (zone: string) => {
        switch (zone) {
            case 'EXCELLENT':
                return 'text-emerald-600 dark:text-emerald-400';
            case 'VOLUME':
                return 'text-rose-500 dark:text-rose-400';
            case 'QUALITY':
                return 'text-amber-600 dark:text-amber-400';
            default:
                return 'text-rose-600 dark:text-rose-400';
        }
    };

    return (
        <>
            <Head title="Rating Simulasi" />

            <div className="flex flex-col gap-5 p-4 sm:p-6 max-w-7xl mx-auto w-full">
                {/* Header Banner - Matching Screenshot */}
                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 bg-[#e2eaf5] dark:bg-slate-900 border border-border/60 py-3.5 px-6 rounded-md shadow-2xs">
                    <h1 className="text-xl sm:text-2xl font-black tracking-tight text-[#1e293b] dark:text-white uppercase font-sans">
                        RATING SIMULATION
                    </h1>

                    {/* Dealer Dropdown Picker for Global Role */}
                    {isGlobal && dealers.length > 0 && (
                        <div className="flex items-center gap-2">
                            <span className="text-xs font-semibold text-muted-foreground whitespace-nowrap hidden md:inline">
                                Pilih Dealer:
                            </span>
                            <AntSelect
                                showSearch
                                optionFilterProp="label"
                                value={selectedDealerId}
                                onChange={(val) => {
                                    if (val) setSelectedDealerId(Number(val));
                                }}
                                className="w-[280px] sm:w-[340px]"
                                options={dealers.map((d) => ({
                                    value: d.id,
                                    label: `${d.nama_dealer} (${d.kode_dealer})`,
                                }))}
                            />
                        </div>
                    )}
                </div>

                {/* Top Section: Graphic & Dealer Information - 2 Cards */}
                <div className="grid grid-cols-1 md:grid-cols-12 gap-5 items-stretch">

                    {/* Right Card: Dealer Information */}
                    <Card className="md:col-span-15 flex flex-col justify-between border shadow-sm p-6 bg-white dark:bg-card">
                        <div>
                            {/* Card Header */}
                            <h2 className="text-base sm:text-lg font-black tracking-tight text-[#1e293b] dark:text-white uppercase font-sans mb-4">
                                DEALER INFORMATION
                            </h2>

                            {/* Dealer Code, Channel, and Name */}
                            <div className="flex flex-wrap items-baseline justify-between gap-4 mb-5">
                                <div className="flex items-center gap-6">
                                    <span className="text-xl sm:text-2xl font-black text-[#0f172a] dark:text-white font-mono">
                                        {activeDealer?.kode_dealer || '-'}
                                    </span>
                                </div>
                                <span className="text-xl sm:text-2xl font-black text-[#0f172a] dark:text-white truncate max-w-md">
                                    {activeDealer?.nama_dealer || 'Pilih Showroom Dealer'}
                                </span>
                            </div>

                            {/* GMB Link Box */}
                            <div className="rounded border border-slate-700/60 overflow-hidden bg-[#232738] text-white p-2.5 mb-4 shadow-2xs">
                                <div className="flex items-center justify-between text-[11px] font-bold tracking-wider uppercase text-slate-300 mb-1">
                                    <span>GMB LINK</span>
                                    {activeDealer?.link_google_maps && (
                                        <button
                                            onClick={handleCopyLink}
                                            className="inline-flex items-center gap-1 text-[10px] text-slate-400 hover:text-white transition-colors cursor-pointer"
                                            title="Salin Link Google Maps"
                                        >
                                            <Copy className="size-3" />
                                            <span>{copied ? 'Tersalin!' : 'Copy'}</span>
                                        </button>
                                    )}
                                </div>
                                {activeDealer?.link_google_maps ? (
                                    <a
                                        href={activeDealer.link_google_maps}
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        className="text-xs text-sky-400 hover:text-sky-300 hover:underline break-all line-clamp-1 inline-flex items-center gap-1.5"
                                    >
                                        <span>{activeDealer.link_google_maps}</span>
                                        <ExternalLink className="size-3 shrink-0" />
                                    </a>
                                ) : (
                                    <span className="text-xs text-slate-400 italic">
                                        Belum ada link Google Maps yang tersimpan untuk dealer ini.
                                    </span>
                                )}
                            </div>
                        </div>

                        {/* Current Cluster Zone Display */}
                        <div className="pt-2">
                            <div className="border-t-2 border-emerald-400/70 mb-3" />
                            <div className="text-center py-1">
                                <span
                                    className={`text-2xl sm:text-3xl font-black tracking-wider uppercase ${getZoneColorClass(
                                        currentZone
                                    )}`}
                                >
                                    {currentZone}
                                </span>
                            </div>
                            <div className="border-b-2 border-emerald-400/70 mt-3" />
                        </div>
                    </Card>
                </div>

                {/* Bottom Section: 4 Metric & Simulation Cards */}
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5 items-stretch">
                    {/* Card 1: CURRENT CONDITION */}
                    <Card className="flex flex-col items-center justify-between border shadow-sm p-6 text-center bg-white dark:bg-card min-h-[300px]">
                        <h3 className="text-base font-black text-[#1e293b] dark:text-white uppercase tracking-tight mb-4">
                            CURRENT CONDITION
                        </h3>

                        <div className="my-auto space-y-6 w-full">
                            <div>
                                <div className="text-3xl sm:text-4xl font-black text-[#0f172a] dark:text-white font-mono">
                                    {currentReviews.toLocaleString('id-ID')}
                                </div>
                                <div className="text-[11px] font-bold text-muted-foreground uppercase tracking-wider mt-1">
                                    JUMLAH REVIEW
                                </div>
                            </div>

                            <div>
                                <div className="text-3xl sm:text-4xl font-black text-[#0f172a] dark:text-white font-mono">
                                    {currentRating.toFixed(2)}
                                </div>
                                <div className="text-[11px] font-bold text-muted-foreground uppercase tracking-wider mt-1">
                                    LAST RATING
                                </div>
                            </div>
                        </div>

                        <div className="pt-2 text-[10px] text-muted-foreground">
                            Data Google Maps saat ini
                        </div>
                    </Card>

                    {/* Card 2: SET TARGET */}
                    <Card className="flex flex-col items-center justify-between border shadow-sm p-6 text-center bg-white dark:bg-card min-h-[300px]">
                        <h3 className="text-base font-black text-[#1e293b] dark:text-white uppercase tracking-tight mb-4">
                            SET TARGET
                        </h3>

                        <div className="my-auto w-full space-y-4">
                            {/* Mint/Turquoise Target Rating Box */}
                            <div className="bg-[#99f6e4] dark:bg-teal-950/60 border border-teal-300 dark:border-teal-800 rounded-md p-4 shadow-inner">
                                <div className="text-4xl font-black text-teal-950 dark:text-teal-100 font-mono tracking-tight">
                                    {targetRating.toFixed(2)}
                                </div>

                                {/* Slider Input */}
                                <div className="pt-3 px-1">
                                    <input
                                        type="range"
                                        min="1.0"
                                        max="5.0"
                                        step="0.05"
                                        value={targetRating}
                                        onChange={(e) => setTargetRating(parseFloat(e.target.value))}
                                        className="w-full accent-teal-600 cursor-pointer h-2 bg-teal-300/80 rounded-lg"
                                    />
                                    <div className="flex justify-between text-[10px] font-mono text-teal-900 dark:text-teal-300 pt-1">
                                        <span>1.0</span>
                                        <span>3.0</span>
                                        <span>4.7</span>
                                        <span>5.0</span>
                                    </div>
                                </div>
                            </div>

                            {/* Quick Presets */}
                            <div className="flex flex-wrap items-center justify-center gap-1.5 pt-1">
                                {[4.7, 4.8, 4.85, 4.9, 5.0].map((val) => (
                                    <button
                                        key={val}
                                        type="button"
                                        onClick={() => setTargetRating(val)}
                                        className={`px-2 py-0.5 text-[11px] font-bold rounded border transition-colors cursor-pointer ${
                                            targetRating === val
                                                ? 'bg-teal-600 text-white border-teal-600 shadow-2xs'
                                                : 'bg-muted/40 hover:bg-muted text-muted-foreground border-border'
                                        }`}
                                    >
                                        {val.toFixed(2)}
                                    </button>
                                ))}
                            </div>
                        </div>

                        {/* Italic Instruction - Sesuai Gambar */}
                        <div className="pt-2">
                            <span className="text-xs font-bold italic text-rose-500 tracking-wide uppercase">
                                SILAHKAN DI INPUTKAN TARGET GMB NYA
                            </span>
                        </div>
                    </Card>

                    {/* Card 3: SIMULATION */}
                    <Card className="flex flex-col items-center justify-between border shadow-sm p-6 text-center bg-white dark:bg-card min-h-[300px]">
                        <h3 className="text-base font-black text-[#1e293b] dark:text-white uppercase tracking-tight mb-2">
                            SIMULATION
                        </h3>

                        <div className="my-auto w-full space-y-2">
                            {/* Kebutuhan Bintang 5 */}
                            <div>
                                <div className="text-4xl sm:text-5xl font-black text-[#f43f5e] font-mono">
                                    {simulationResult.neededFiveStars.toLocaleString('id-ID')}
                                </div>
                                <div className="text-[11px] font-bold text-muted-foreground uppercase tracking-wider mt-1">
                                    KEBUTUHAN BINTANG 5
                                </div>
                            </div>

                            {/* Explanation sentence */}
                            <p className="text-[11px] text-muted-foreground italic px-2 leading-relaxed">
                                {simulationResult.isReached
                                    ? 'Target rating saat ini sudah tercapai atau melampaui target yang ditetapkan.'
                                    : 'Berikut adalah jumlah Bintang 5 yang wajib di tambahkan agar sesuai target'}
                            </p>

                            {/* Downward Arrow */}
                            <div className="flex justify-center py-1">
                                <div className="size-8 rounded-full bg-teal-50 dark:bg-teal-950 flex items-center justify-center">
                                    <ArrowDown className="size-5 text-teal-600 dark:text-teal-400 stroke-[3]" />
                                </div>
                            </div>

                            {/* Total Rating Target */}
                            <div>
                                <div className="text-3xl sm:text-4xl font-black text-[#0f766e] dark:text-emerald-400 font-mono">
                                    {simulationResult.totalTargetReviews.toLocaleString('id-ID')}
                                </div>
                                <div className="text-[11px] font-bold text-muted-foreground uppercase tracking-wider mt-0.5">
                                    TOTAL RATING TARGET
                                </div>
                            </div>
                        </div>

                        <div className="pt-2 text-[10px] text-muted-foreground">
                            Akumulasi review setelah target
                        </div>
                    </Card>

                    {/* Card 4: CLUSTER ZONE SIMULATION */}
                    <Card className="flex flex-col items-center justify-between border shadow-sm p-6 text-center bg-white dark:bg-card min-h-[300px]">
                        <h3 className="text-base font-black text-[#1e293b] dark:text-white uppercase tracking-tight mb-4">
                            CLUSTER ZONE SIMULATION
                        </h3>

                        <div className="my-auto w-full flex flex-col items-center justify-center space-y-4">
                            {/* Downward Arrow */}
                            <div className="size-12 rounded-full bg-teal-50 dark:bg-teal-950 flex items-center justify-center">
                                <ArrowDown className="size-7 text-teal-600 dark:text-teal-400 stroke-[3]" />
                            </div>

                            {/* Projected Zone */}
                            <div>
                                <div
                                    className={`text-2xl sm:text-3xl font-black tracking-wider uppercase ${getZoneColorClass(
                                        simulationResult.projectedZone
                                    )}`}
                                >
                                    {simulationResult.projectedZone}
                                </div>
                                <div className="text-xs text-muted-foreground mt-2 max-w-[220px] mx-auto leading-relaxed">
                                    {simulationResult.projectedZone === 'EXCELLENT ZONE' ? (
                                        <span className="text-emerald-600 font-semibold">
                                            ✓ Memenuhi standar tertinggi rating ≥ 4.70 &amp; review ≥ 1.000
                                        </span>
                                    ) : simulationResult.projectedZone === 'VOLUME ZONE' ? (
                                        <span>
                                            Rating memenuhi target ≥ 4.70. Perbanyak ulasan hingga 1.000 untuk mencapai Excellent Zone.
                                        </span>
                                    ) : (
                                        <span>
                                            Tingkatkan rating hingga minimal 4.70 untuk keluar dari zona perbaikan.
                                        </span>
                                    )}
                                </div>
                            </div>
                        </div>

                        <div className="pt-2">
                            <Button
                                variant="outline"
                                size="sm"
                                asChild
                                className="h-7 text-xs gap-1 text-primary hover:text-primary cursor-pointer"
                            >
                                <Link href={reviewsRoute.index.url({ query: { search: activeDealer?.nama_dealer } })}>
                                    Lihat Ulasan Showroom <ExternalLink className="size-3" />
                                </Link>
                            </Button>
                        </div>
                    </Card>
                </div>
            </div>
        </>
    );
}

RatingSimulasi.layout = {
    breadcrumbs: [
        {
            title: 'Dashboard GBP',
            href: dashboard(),
        },
        {
            title: 'Rating Simulasi',
            href: ratingSimulasi.index(),
        },
    ],
};
