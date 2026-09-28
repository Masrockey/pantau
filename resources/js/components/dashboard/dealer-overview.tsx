import { router } from '@inertiajs/react';
import {
    AlertCircle,
    ArrowDown,
    ArrowUp,
    ArrowUpDown,
    BarChart3,
    Calendar,
    CheckCircle2,
    Download,
    Search,
    Table as TableIcon,
    XCircle,
} from 'lucide-react';
import React from 'react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
    Card,
    CardContent,
    CardDescription,
    CardFooter,
    CardHeader,
    CardTitle,
} from '@/components/ui/card';
import { dashboard } from '@/routes';

export interface DealerOverviewItem {
    id: number;
    kode_dealer: string;
    nama_dealer: string;
    total_review_all: number;
    review_monthly: number;
    gmb_score: number | null;
    rating_1: number;
    rating_2: number;
    rating_3: number;
    rating_4: number;
    rating_5: number;
    cont_rating_1_3: number;
    cont_rating_4_5: number;
    jumlah_feedback: number;
    belum_feedback: number;
    ach_feedback: number | null;
    lt_days: number | null;
}

export interface DealerOverviewSummary {
    total_review_all: number;
    review_monthly: number;
    gmb_score: number | null;
    rating_1: number;
    rating_2: number;
    rating_3: number;
    rating_4: number;
    rating_5: number;
    cont_rating_1_3: number;
    cont_rating_4_5: number;
    jumlah_feedback: number;
    belum_feedback: number;
    ach_feedback: number;
    lt_days: number | null;
}

interface DealerOverviewProps {
    dealers: DealerOverviewItem[];
    summary: DealerOverviewSummary | null;
    availableMonths: string[];
    activeMonth: string | null;
    selectedDealerId?: string;
}

type SortKey = keyof DealerOverviewItem;

function formatMonthLabel(ym: string): string {
    if (!ym) return '';
    const parts = ym.split('-');
    if (parts.length !== 2) return ym;
    const [year, month] = parts;
    const monthNames = [
        'Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni',
        'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember',
    ];
    const monthIdx = parseInt(month, 10) - 1;
    return `${monthNames[monthIdx] ?? month} ${year}`;
}

function GmbScoreBadge({ score }: { score: number | null }) {
    if (score === null || score === undefined) {
        return <span className="text-muted-foreground">-</span>;
    }

    let Icon = AlertCircle;
    let iconClass = 'text-amber-500 fill-amber-500/20';

    if (score >= 4.8) {
        Icon = CheckCircle2;
        iconClass = 'text-emerald-500 fill-emerald-500/20';
    } else if (score < 4.6) {
        Icon = XCircle;
        iconClass = 'text-rose-500 fill-rose-500/20';
    }

    return (
        <span className="inline-flex items-center justify-center gap-1.5 font-medium">
            <Icon className={`size-3.5 shrink-0 ${iconClass}`} />
            <span>{score.toFixed(2)}</span>
        </span>
    );
}

function ContRating13Badge({ value }: { value: number }) {
    if (value > 0) {
        return (
            <span className="inline-flex items-center justify-center gap-1 font-semibold text-rose-600 dark:text-rose-400">
                <XCircle className="size-3.5 shrink-0 text-rose-500 fill-rose-500/20" />
                <span>{value.toFixed(2)}%</span>
            </span>
        );
    }
    return <span>0.00%</span>;
}

function ContRating45Badge({ value }: { value: number }) {
    return <span>{value.toFixed(2)}%</span>;
}

function AchFeedbackBadge({
    value,
    monthlyReviews,
    jumlahFeedback,
}: {
    value: number | null;
    monthlyReviews: number;
    jumlahFeedback: number;
}) {
    if (monthlyReviews === 0 || value === null || jumlahFeedback === 0) {
        return null;
    }

    const isGood = value >= 85;
    const Icon = isGood ? CheckCircle2 : XCircle;
    const textColor = isGood
        ? 'text-emerald-600 dark:text-emerald-400'
        : 'text-rose-600 dark:text-rose-400';
    const iconColor = isGood
        ? 'text-emerald-500 fill-emerald-500/20'
        : 'text-rose-500 fill-rose-500/20';

    return (
        <span className={`inline-flex items-center justify-center gap-1 font-semibold ${textColor}`}>
            <Icon className={`size-3.5 shrink-0 ${iconColor}`} />
            <span>{value.toFixed(2)}%</span>
        </span>
    );
}

export function DealerOverview({
    dealers = [],
    summary,
    availableMonths = [],
    activeMonth,
    selectedDealerId = '',
}: DealerOverviewProps) {
    const [search, setSearch] = React.useState('');
    const [viewMode, setViewMode] = React.useState<'table' | 'chart'>('table');
    const [sortKey, setSortKey] = React.useState<SortKey>('review_monthly');
    const [sortDir, setSortDir] = React.useState<'asc' | 'desc'>('desc');
    const [pageSize, setPageSize] = React.useState<number | 'all'>('all');
    const [currentPage, setCurrentPage] = React.useState(1);

    const handleMonthChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
        const nextMonth = e.target.value;
        const currentParams = new URLSearchParams(window.location.search);
        if (nextMonth) {
            currentParams.set('month', nextMonth);
        } else {
            currentParams.delete('month');
        }
        router.get(
            dashboard(),
            Object.fromEntries(currentParams.entries()),
            { preserveState: true, preserveScroll: true }
        );
    };

    const handleSort = (key: SortKey) => {
        if (sortKey === key) {
            setSortDir((prev) => (prev === 'asc' ? 'desc' : 'asc'));
        } else {
            setSortKey(key);
            setSortDir('desc');
        }
    };

    const filteredDealers = React.useMemo(() => {
        const query = search.trim().toLowerCase();
        if (!query) return dealers;
        return dealers.filter(
            (d) =>
                d.nama_dealer.toLowerCase().includes(query) ||
                d.kode_dealer.toLowerCase().includes(query)
        );
    }, [dealers, search]);

    const sortedDealers = React.useMemo(() => {
        const list = [...filteredDealers];
        list.sort((a, b) => {
            const valA = a[sortKey];
            const valB = b[sortKey];

            if (valA === null || valA === undefined) return 1;
            if (valB === null || valB === undefined) return -1;

            if (typeof valA === 'string' && typeof valB === 'string') {
                return sortDir === 'asc'
                    ? valA.localeCompare(valB)
                    : valB.localeCompare(valA);
            }

            const numA = Number(valA);
            const numB = Number(valB);

            if (numA === numB) {
                return b.total_review_all - a.total_review_all;
            }

            return sortDir === 'asc' ? numA - numB : numB - numA;
        });
        return list;
    }, [filteredDealers, sortKey, sortDir]);

    const paginatedDealers = React.useMemo(() => {
        if (pageSize === 'all') return sortedDealers;
        const start = (currentPage - 1) * pageSize;
        return sortedDealers.slice(start, start + pageSize);
    }, [sortedDealers, pageSize, currentPage]);

    const totalPages =
        pageSize === 'all'
            ? 1
            : Math.ceil(sortedDealers.length / pageSize) || 1;

    const handleExportCsv = () => {
        const headers = [
            'DEALER CODE',
            'NAMA DEALER',
            'J. REVIEW ALL',
            'REVIEW MONTHLY',
            'GMB SCORE',
            'RATING 1',
            'RATING 2',
            'RATING 3',
            'RATING 4',
            'RATING 5',
            '%CONT RATING 1-3',
            '%CONT RATING 4-5',
            'JUMLAH FEEDBACK',
            'BELUM FEEDBACK',
            '%ACH FEEDBACK',
            'LT (DAYS)',
        ];

        const rows = sortedDealers.map((d) => [
            `"${d.kode_dealer}"`,
            `"${d.nama_dealer.replace(/"/g, '""')}"`,
            d.total_review_all,
            d.review_monthly,
            d.gmb_score !== null ? d.gmb_score.toFixed(2) : '',
            d.rating_1,
            d.rating_2,
            d.rating_3,
            d.rating_4,
            d.rating_5,
            `${d.cont_rating_1_3.toFixed(2)}%`,
            `${d.cont_rating_4_5.toFixed(2)}%`,
            d.jumlah_feedback > 0 ? d.jumlah_feedback : '',
            d.belum_feedback > 0 ? d.belum_feedback : '',
            d.ach_feedback !== null && d.jumlah_feedback > 0
                ? `${d.ach_feedback.toFixed(2)}%`
                : '',
            d.lt_days !== null ? d.lt_days : '',
        ]);

        if (summary) {
            rows.push([
                '"TOTAL"',
                '""',
                summary.total_review_all,
                summary.review_monthly,
                summary.gmb_score !== null ? summary.gmb_score.toFixed(2) : '',
                summary.rating_1,
                summary.rating_2,
                summary.rating_3,
                summary.rating_4,
                summary.rating_5,
                `${summary.cont_rating_1_3.toFixed(2)}%`,
                `${summary.cont_rating_4_5.toFixed(2)}%`,
                summary.jumlah_feedback,
                summary.belum_feedback,
                `${summary.ach_feedback.toFixed(2)}%`,
                summary.lt_days !== null ? summary.lt_days : '',
            ]);
        }

        const csvContent =
            '\uFEFF' +
            [headers.join(','), ...rows.map((r) => r.join(','))].join('\n');
        const blob = new Blob([csvContent], {
            type: 'text/csv;charset=utf-8;',
        });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `Dealer_Overview_${activeMonth || 'all'}.csv`;
        a.click();
        URL.revokeObjectURL(url);
    };

    const renderSortArrow = (key: SortKey) => {
        if (sortKey !== key) {
            return <ArrowUpDown className="ml-1 size-3 opacity-40 inline" />;
        }
        return sortDir === 'asc' ? (
            <ArrowUp className="ml-1 size-3 text-white inline" />
        ) : (
            <ArrowDown className="ml-1 size-3 text-white inline" />
        );
    };

    return (
        <Card className="flex flex-col border shadow-sm">
            <CardHeader className="flex flex-col gap-3 pb-3 border-b sm:flex-row sm:items-center sm:justify-between">
                <div>
                    <div className="flex items-center gap-2">
                        <CardTitle className="text-base font-bold tracking-tight">
                            Dealer Overview
                        </CardTitle>
                        <Badge variant="secondary" className="font-semibold text-xs">
                            {filteredDealers.length} Showroom
                        </Badge>
                    </div>
                    <CardDescription className="text-xs mt-0.5">
                        Rekapitulasi performa Google Bisnis Profile, perolehan bintang ulasan, dan respons owner{' '}
                        {activeMonth && (
                            <span className="font-semibold text-foreground">
                                ({formatMonthLabel(activeMonth)})
                            </span>
                        )}
                    </CardDescription>
                </div>

                <div className="flex flex-wrap items-center gap-2">
                    {/* Month Picker */}
                    {availableMonths.length > 0 && (
                        <div className="flex items-center gap-1.5 text-xs bg-muted/50 rounded-md border px-2 py-1">
                            <Calendar className="size-3.5 text-muted-foreground" />
                            <select
                                value={activeMonth ?? ''}
                                onChange={handleMonthChange}
                                className="bg-transparent text-xs font-medium focus:outline-none cursor-pointer"
                            >
                                {availableMonths.map((m) => (
                                    <option key={m} value={m} className="bg-background text-foreground">
                                        {formatMonthLabel(m)}
                                    </option>
                                ))}
                            </select>
                        </div>
                    )}

                    {/* Search */}
                    <div className="relative">
                        <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 size-3.5 text-muted-foreground" />
                        <input
                            type="text"
                            placeholder="Cari dealer..."
                            value={search}
                            onChange={(e) => {
                                setSearch(e.target.value);
                                setCurrentPage(1);
                            }}
                            className="h-8 w-36 sm:w-44 rounded-md border border-input bg-transparent pl-8 pr-2 text-xs shadow-xs focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                        />
                    </div>

                    {/* Toggle View Mode */}
                    <div className="flex items-center rounded-md border bg-muted/40 p-0.5 text-xs">
                        <button
                            type="button"
                            onClick={() => setViewMode('table')}
                            className={`flex items-center gap-1 rounded px-2 py-1 font-medium transition-colors cursor-pointer ${
                                viewMode === 'table'
                                    ? 'bg-background shadow-xs text-foreground font-semibold'
                                    : 'text-muted-foreground hover:text-foreground'
                            }`}
                            title="Tampilan Matriks Tabel"
                        >
                            <TableIcon className="size-3.5" />
                            <span className="hidden sm:inline">Tabel</span>
                        </button>
                        <button
                            type="button"
                            onClick={() => setViewMode('chart')}
                            className={`flex items-center gap-1 rounded px-2 py-1 font-medium transition-colors cursor-pointer ${
                                viewMode === 'chart'
                                    ? 'bg-background shadow-xs text-foreground font-semibold'
                                    : 'text-muted-foreground hover:text-foreground'
                            }`}
                            title="Tampilan Grafik Performa"
                        >
                            <BarChart3 className="size-3.5" />
                            <span className="hidden sm:inline">Grafik</span>
                        </button>
                    </div>

                    {/* Export CSV */}
                    <Button
                        variant="outline"
                        size="sm"
                        onClick={handleExportCsv}
                        className="h-8 gap-1.5 text-xs cursor-pointer"
                        title="Download file Excel / CSV"
                    >
                        <Download className="size-3.5" />
                        <span className="hidden md:inline">Export CSV</span>
                    </Button>
                </div>
            </CardHeader>

            <CardContent className="p-0 flex-1">
                {viewMode === 'table' ? (
                    <div className="relative overflow-x-auto">
                        <table className="w-full text-[11px] border-collapse text-foreground select-text whitespace-nowrap">
                            <thead>
                                <tr className="text-white text-center font-bold tracking-wider uppercase">
                                    <th
                                        onClick={() => handleSort('kode_dealer')}
                                        className="bg-slate-900 px-3 py-2.5 text-center cursor-pointer hover:bg-slate-800 transition-colors border-r border-slate-700/60 sticky left-0 z-20"
                                    >
                                        DEALER CODE {renderSortArrow('kode_dealer')}
                                    </th>
                                    <th
                                        onClick={() => handleSort('nama_dealer')}
                                        className="bg-slate-900 px-3 py-2.5 text-left cursor-pointer hover:bg-slate-800 transition-colors border-r border-slate-700/60 min-w-[170px]"
                                    >
                                        NAMA DEALER {renderSortArrow('nama_dealer')}
                                    </th>
                                    <th
                                        onClick={() => handleSort('total_review_all')}
                                        className="bg-slate-900 px-2.5 py-2.5 text-center cursor-pointer hover:bg-slate-800 transition-colors border-r border-slate-700/60"
                                    >
                                        J. REVIEW ALL {renderSortArrow('total_review_all')}
                                    </th>
                                    <th
                                        onClick={() => handleSort('review_monthly')}
                                        className="bg-slate-900 px-2.5 py-2.5 text-center cursor-pointer hover:bg-slate-800 transition-colors border-r border-slate-700/60"
                                    >
                                        REVIEW MONTHLY {renderSortArrow('review_monthly')}
                                    </th>
                                    <th
                                        onClick={() => handleSort('gmb_score')}
                                        className="bg-slate-900 px-2.5 py-2.5 text-center cursor-pointer hover:bg-slate-800 transition-colors border-r border-slate-700/60"
                                    >
                                        GMB SCORE {renderSortArrow('gmb_score')}
                                    </th>
                                    <th
                                        onClick={() => handleSort('rating_1')}
                                        className="bg-slate-900 px-2 py-2.5 text-center cursor-pointer hover:bg-slate-800 transition-colors border-r border-slate-700/60"
                                    >
                                        RATING 1
                                    </th>
                                    <th
                                        onClick={() => handleSort('rating_2')}
                                        className="bg-slate-900 px-2 py-2.5 text-center cursor-pointer hover:bg-slate-800 transition-colors border-r border-slate-700/60"
                                    >
                                        RATING 2
                                    </th>
                                    <th
                                        onClick={() => handleSort('rating_3')}
                                        className="bg-slate-900 px-2 py-2.5 text-center cursor-pointer hover:bg-slate-800 transition-colors border-r border-slate-700/60"
                                    >
                                        RATING 3
                                    </th>
                                    <th
                                        onClick={() => handleSort('rating_4')}
                                        className="bg-slate-900 px-2 py-2.5 text-center cursor-pointer hover:bg-slate-800 transition-colors border-r border-slate-700/60"
                                    >
                                        RATING 4
                                    </th>
                                    <th
                                        onClick={() => handleSort('rating_5')}
                                        className="bg-slate-900 px-2 py-2.5 text-center cursor-pointer hover:bg-slate-800 transition-colors border-r border-slate-700/60"
                                    >
                                        RATING 5
                                    </th>
                                    <th
                                        onClick={() => handleSort('cont_rating_1_3')}
                                        className="bg-[#991b1b] text-white px-2.5 py-2.5 text-center cursor-pointer hover:bg-red-800 transition-colors border-r border-red-800"
                                    >
                                        %CONT RATING 1-3 {renderSortArrow('cont_rating_1_3')}
                                    </th>
                                    <th
                                        onClick={() => handleSort('cont_rating_4_5')}
                                        className="bg-[#065f46] text-white px-2.5 py-2.5 text-center cursor-pointer hover:bg-emerald-800 transition-colors border-r border-emerald-800"
                                    >
                                        %CONT RATING 4-5 {renderSortArrow('cont_rating_4_5')}
                                    </th>
                                    <th
                                        onClick={() => handleSort('jumlah_feedback')}
                                        className="bg-slate-900 px-2 py-2.5 text-center cursor-pointer hover:bg-slate-800 transition-colors border-r border-slate-700/60"
                                    >
                                        JUMLAH FEEDBACK
                                    </th>
                                    <th
                                        onClick={() => handleSort('belum_feedback')}
                                        className="bg-slate-900 px-2 py-2.5 text-center cursor-pointer hover:bg-slate-800 transition-colors border-r border-slate-700/60"
                                    >
                                        BELUM FEEDBACK
                                    </th>
                                    <th
                                        onClick={() => handleSort('ach_feedback')}
                                        className="bg-[#0369a1] text-white px-2.5 py-2.5 text-center cursor-pointer hover:bg-sky-700 transition-colors border-r border-sky-800"
                                    >
                                        %ACH FEEDBACK {renderSortArrow('ach_feedback')}
                                    </th>
                                    <th
                                        onClick={() => handleSort('lt_days')}
                                        className="bg-[#c2410c] text-white px-2.5 py-2.5 text-center cursor-pointer hover:bg-amber-700 transition-colors"
                                    >
                                        LT (DAYS)
                                    </th>
                                </tr>
                            </thead>
                            <tbody>
                                {paginatedDealers.length === 0 ? (
                                    <tr>
                                        <td colSpan={16} className="text-center py-8 text-muted-foreground text-xs">
                                            Tidak ada data dealer yang sesuai kriteria pencarian.
                                        </td>
                                    </tr>
                                ) : (
                                    paginatedDealers.map((d, index) => {
                                        const isEven = index % 2 === 1;
                                        return (
                                            <tr
                                                key={d.id}
                                                className={`border-b border-border/40 transition-colors hover:bg-muted/60 ${
                                                    isEven ? 'bg-muted/25' : 'bg-background'
                                                }`}
                                            >
                                                {/* Dealer Code */}
                                                <td className="px-3 py-1.5 text-center font-mono font-medium text-foreground sticky left-0 z-10 bg-inherit border-r border-border/30">
                                                    {d.kode_dealer}
                                                </td>

                                                {/* Nama Dealer */}
                                                <td className="px-3 py-1.5 text-left font-semibold text-foreground truncate max-w-[220px] border-r border-border/30">
                                                    {d.nama_dealer}
                                                </td>

                                                {/* J. Review All */}
                                                <td className="px-2.5 py-1.5 text-center font-mono border-r border-border/30">
                                                    {d.total_review_all > 0 ? d.total_review_all.toLocaleString('id-ID') : ''}
                                                </td>

                                                {/* Review Monthly */}
                                                <td className="px-2.5 py-1.5 text-center font-mono font-bold text-foreground border-r border-border/30">
                                                    {d.review_monthly > 0 ? d.review_monthly : ''}
                                                </td>

                                                {/* GMB Score */}
                                                <td className="px-2.5 py-1.5 text-center border-r border-border/30">
                                                    <GmbScoreBadge score={d.gmb_score} />
                                                </td>

                                                {/* Ratings 1 to 5 */}
                                                <td className="px-2 py-1.5 text-center font-mono border-r border-border/30">
                                                    {d.rating_1}
                                                </td>
                                                <td className="px-2 py-1.5 text-center font-mono border-r border-border/30">
                                                    {d.rating_2}
                                                </td>
                                                <td className="px-2 py-1.5 text-center font-mono border-r border-border/30">
                                                    {d.rating_3}
                                                </td>
                                                <td className="px-2 py-1.5 text-center font-mono border-r border-border/30">
                                                    {d.rating_4}
                                                </td>
                                                <td className="px-2 py-1.5 text-center font-mono font-medium border-r border-border/30">
                                                    {d.rating_5}
                                                </td>

                                                {/* %CONT Rating 1-3 */}
                                                <td className="px-2.5 py-1.5 text-center font-mono border-r border-border/30">
                                                    <ContRating13Badge value={d.cont_rating_1_3} />
                                                </td>

                                                {/* %CONT Rating 4-5 */}
                                                <td className="px-2.5 py-1.5 text-center font-mono border-r border-border/30">
                                                    <ContRating45Badge value={d.cont_rating_4_5} />
                                                </td>

                                                {/* Jumlah Feedback */}
                                                <td className="px-2 py-1.5 text-center font-mono border-r border-border/30">
                                                    {d.jumlah_feedback > 0 ? d.jumlah_feedback : ''}
                                                </td>

                                                {/* Belum Feedback */}
                                                <td className="px-2 py-1.5 text-center font-mono border-r border-border/30">
                                                    {d.belum_feedback > 0 ? d.belum_feedback : ''}
                                                </td>

                                                {/* %ACH Feedback */}
                                                <td className="px-2.5 py-1.5 text-center font-mono border-r border-border/30">
                                                    <AchFeedbackBadge
                                                        value={d.ach_feedback}
                                                        monthlyReviews={d.review_monthly}
                                                        jumlahFeedback={d.jumlah_feedback}
                                                    />
                                                </td>

                                                {/* LT (Days) */}
                                                <td className="px-2.5 py-1.5 text-center font-mono">
                                                    {d.lt_days !== null ? d.lt_days : ''}
                                                </td>
                                            </tr>
                                        );
                                    })
                                )}
                            </tbody>

                            {/* Total Row */}
                            {summary && (
                                <tfoot>
                                    <tr className="bg-slate-950 text-white font-bold text-center border-t-2 border-slate-700">
                                        <td className="px-3 py-2 text-left sticky left-0 z-10 bg-slate-950 border-r border-slate-800">
                                            Total
                                        </td>
                                        <td className="px-3 py-2 text-left text-muted-foreground text-[10px] border-r border-slate-800">
                                            {dealers.length} Showroom
                                        </td>
                                        <td className="px-2.5 py-2 text-center font-mono border-r border-slate-800">
                                            {summary.total_review_all.toLocaleString('id-ID')}
                                        </td>
                                        <td className="px-2.5 py-2 text-center font-mono border-r border-slate-800">
                                            {summary.review_monthly.toLocaleString('id-ID')}
                                        </td>
                                        <td className="px-2.5 py-2 text-center border-r border-slate-800">
                                            <GmbScoreBadge score={summary.gmb_score} />
                                        </td>
                                        <td className="px-2 py-2 text-center font-mono border-r border-slate-800">
                                            {summary.rating_1}
                                        </td>
                                        <td className="px-2 py-2 text-center font-mono border-r border-slate-800">
                                            {summary.rating_2}
                                        </td>
                                        <td className="px-2 py-2 text-center font-mono border-r border-slate-800">
                                            {summary.rating_3}
                                        </td>
                                        <td className="px-2 py-2 text-center font-mono border-r border-slate-800">
                                            {summary.rating_4}
                                        </td>
                                        <td className="px-2 py-2 text-center font-mono border-r border-slate-800">
                                            {summary.rating_5}
                                        </td>
                                        <td className="bg-rose-900 text-white px-2.5 py-2 text-center font-mono border-r border-rose-950">
                                            {summary.cont_rating_1_3.toFixed(2)}%
                                        </td>
                                        <td className="bg-emerald-900 text-white px-2.5 py-2 text-center font-mono border-r border-emerald-950">
                                            {summary.cont_rating_4_5.toFixed(2)}%
                                        </td>
                                        <td className="px-2 py-2 text-center font-mono border-r border-slate-800">
                                            {summary.jumlah_feedback}
                                        </td>
                                        <td className="px-2 py-2 text-center font-mono border-r border-slate-800">
                                            {summary.belum_feedback}
                                        </td>
                                        <td className="bg-blue-600 text-white px-2.5 py-2 text-center font-mono border-r border-blue-700">
                                            {summary.ach_feedback.toFixed(2)}%
                                        </td>
                                        <td className="bg-amber-700 text-white px-2.5 py-2 text-center font-mono">
                                            {summary.lt_days !== null ? summary.lt_days : '-'}
                                        </td>
                                    </tr>
                                </tfoot>
                            )}
                        </table>
                    </div>
                ) : (
                    /* Graphical Performance View */
                    <div className="p-4 sm:p-6 space-y-6">
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                            {/* Summary Card 1 */}
                            <div className="rounded-xl border p-4 bg-muted/20">
                                <div className="text-xs text-muted-foreground font-medium">Total Ulasan Bulan Ini</div>
                                <div className="text-2xl font-bold mt-1 text-foreground">
                                    {summary?.review_monthly.toLocaleString('id-ID') ?? 0}
                                </div>
                                <div className="text-[11px] text-muted-foreground mt-1">
                                    Dari total {summary?.total_review_all.toLocaleString('id-ID') ?? 0} ulasan keseluruhan
                                </div>
                            </div>

                            {/* Summary Card 2 */}
                            <div className="rounded-xl border p-4 bg-muted/20">
                                <div className="text-xs text-muted-foreground font-medium">Tingkat Pencapaian Feedback</div>
                                <div className="text-2xl font-bold mt-1 text-blue-600 dark:text-blue-400">
                                    {summary?.ach_feedback.toFixed(1) ?? 0}%
                                </div>
                                <div className="text-[11px] text-muted-foreground mt-1">
                                    {summary?.jumlah_feedback ?? 0} direspons, {summary?.belum_feedback ?? 0} menunggu
                                </div>
                            </div>

                            {/* Summary Card 3 */}
                            <div className="rounded-xl border p-4 bg-muted/20">
                                <div className="text-xs text-muted-foreground font-medium">Rata-rata GMB Score</div>
                                <div className="text-2xl font-bold mt-1 text-amber-500">
                                    ★ {summary?.gmb_score?.toFixed(2) ?? '-'}
                                </div>
                                <div className="text-[11px] text-muted-foreground mt-1">
                                    Kontribusi Bintang 4-5: <strong>{summary?.cont_rating_4_5.toFixed(1) ?? 0}%</strong>
                                </div>
                            </div>
                        </div>

                        {/* Top Showrooms by Activity */}
                        <div className="space-y-3">
                            <h4 className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
                                Performa Showroom Berdasarkan Volume Ulasan & Respons
                            </h4>
                            <div className="space-y-2">
                                {sortedDealers.slice(0, 10).map((d) => {
                                    const maxMonthly = Math.max(...dealers.map((x) => x.review_monthly), 1);
                                    const pctWidth = Math.round((d.review_monthly / maxMonthly) * 100);

                                    return (
                                        <div
                                            key={d.id}
                                            className="rounded-lg border p-3 bg-card hover:bg-muted/30 transition-colors space-y-2"
                                        >
                                            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1 text-xs">
                                                <div className="flex items-center gap-2">
                                                    <span className="font-mono text-[11px] font-semibold text-muted-foreground bg-muted px-1.5 py-0.5 rounded">
                                                        {d.kode_dealer}
                                                    </span>
                                                    <span className="font-semibold text-foreground">
                                                        {d.nama_dealer}
                                                    </span>
                                                </div>
                                                <div className="flex items-center gap-3 text-xs">
                                                    <GmbScoreBadge score={d.gmb_score} />
                                                    <span className="font-bold text-foreground">
                                                        {d.review_monthly} ulasan
                                                    </span>
                                                    {d.ach_feedback !== null && (
                                                        <span
                                                            className={`font-semibold ${
                                                                d.ach_feedback >= 85
                                                                    ? 'text-emerald-600'
                                                                    : 'text-rose-500'
                                                            }`}
                                                        >
                                                            {d.ach_feedback.toFixed(1)}% respons
                                                        </span>
                                                    )}
                                                </div>
                                            </div>

                                            {/* Progress bars */}
                                            <div className="space-y-1">
                                                <div className="h-2 w-full bg-muted rounded-full overflow-hidden">
                                                    <div
                                                        className="h-full bg-primary rounded-full transition-all duration-300"
                                                        style={{ width: `${pctWidth}%` }}
                                                    />
                                                </div>
                                                <div className="flex items-center justify-between text-[10px] text-muted-foreground pt-0.5">
                                                    <span>
                                                        Bintang 5: <strong>{d.rating_5}</strong> | Bintang 4:{' '}
                                                        <strong>{d.rating_4}</strong> | Kritis (1-3★):{' '}
                                                        <strong>{d.rating_1 + d.rating_2 + d.rating_3}</strong>
                                                    </span>
                                                    <span>
                                                        Feedback: <strong>{d.jumlah_feedback}</strong> /{' '}
                                                        {d.review_monthly}
                                                    </span>
                                                </div>
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>
                        </div>
                    </div>
                )}
            </CardContent>

            {viewMode === 'table' && sortedDealers.length > 15 && (
                <CardFooter className="flex flex-col sm:flex-row items-center justify-between gap-3 border-t px-4 py-2.5 bg-muted/10 text-xs">
                    <div className="flex items-center gap-2 text-muted-foreground">
                        <span>Menampilkan</span>
                        <select
                            value={String(pageSize)}
                            onChange={(e) => {
                                const val = e.target.value === 'all' ? 'all' : Number(e.target.value);
                                setPageSize(val);
                                setCurrentPage(1);
                            }}
                            className="bg-transparent border rounded px-1.5 py-0.5 text-xs text-foreground cursor-pointer focus:outline-none"
                        >
                            <option value="15">15</option>
                            <option value="30">30</option>
                            <option value="all">Semua ({sortedDealers.length})</option>
                        </select>
                        <span>showroom</span>
                    </div>

                    {pageSize !== 'all' && totalPages > 1 && (
                        <div className="flex items-center gap-1">
                            <Button
                                variant="outline"
                                size="sm"
                                onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                                disabled={currentPage === 1}
                                className="h-7 px-2 text-xs cursor-pointer"
                            >
                                Sebelumnya
                            </Button>
                            <span className="px-2 text-xs font-medium text-foreground">
                                {currentPage} / {totalPages}
                            </span>
                            <Button
                                variant="outline"
                                size="sm"
                                onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                                disabled={currentPage === totalPages}
                                className="h-7 px-2 text-xs cursor-pointer"
                            >
                                Selanjutnya
                            </Button>
                        </div>
                    )}
                </CardFooter>
            )}
        </Card>
    );
}
