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

export interface MonitoringFeedbackItem {
    id: number;
    kode_dealer: string;
    nama_dealer: string;
    gmb_score: number | null;
    rating_1_3: number;
    rating_4_5: number;
    feedback_done: number;
    not_yet_feedback: number;
    ach_feedback: number | null;
    lt_day: number | null;
    jumlah_review_m: number;
    jumlah_review_m1: number;
    growth_review: number | null;
}

export interface MonitoringFeedbackSummary {
    gmb_score: number | null;
    rating_1_3: number;
    rating_4_5: number;
    feedback_done: number;
    not_yet_feedback: number;
    ach_feedback: number;
    lt_day: number | null;
    jumlah_review_m: number;
    jumlah_review_m1: number;
    growth_review: number | null;
}

interface MonitoringFeedbackProps {
    dealers: MonitoringFeedbackItem[];
    summary: MonitoringFeedbackSummary | null;
    availableMonths: string[];
    activeMonth: string | null;
    prevMonth: string | null;
    selectedDealerId?: string;
}

type SortKey = keyof MonitoringFeedbackItem;

function formatMonthLabel(ym: string | null): string {
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

function AchFeedbackBadge({
    value,
    monthlyReviews,
    feedbackDone,
}: {
    value: number | null;
    monthlyReviews: number;
    feedbackDone: number;
}) {
    if (monthlyReviews === 0 || value === null || feedbackDone === 0) {
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

function GrowthBadge({
    growth,
    m,
    m1,
}: {
    growth: number | null;
    m: number;
    m1: number;
}) {
    if (m === 0 && m1 === 0) {
        return null;
    }

    if (growth === null) {
        return null;
    }

    if (growth > 0) {
        return (
            <span className="inline-flex items-center justify-center gap-1 font-semibold text-emerald-600 dark:text-emerald-400">
                <span className="size-2 rounded-full bg-emerald-500 shrink-0 inline-block" />
                <span>{growth}%</span>
            </span>
        );
    }

    if (growth === 0) {
        return (
            <span className="inline-flex items-center justify-center gap-1 font-semibold text-amber-500">
                <span className="text-[10px]">▲</span>
                <span>0%</span>
            </span>
        );
    }

    return (
        <span className="inline-flex items-center justify-center gap-1 font-semibold text-rose-600 dark:text-rose-400">
            <span className="text-[10px] text-rose-500 font-bold">♦</span>
            <span>{growth}%</span>
        </span>
    );
}

export function MonitoringFeedback({
    dealers = [],
    summary,
    availableMonths = [],
    activeMonth,
    prevMonth,
    selectedDealerId = '',
}: MonitoringFeedbackProps) {
    const [search, setSearch] = React.useState('');
    const [viewMode, setViewMode] = React.useState<'table' | 'chart'>('table');
    const [sortKey, setSortKey] = React.useState<SortKey>('gmb_score');
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
                return a.nama_dealer.localeCompare(b.nama_dealer);
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
            'NAMA DEALER',
            'GMB SCORE',
            'RATING 1-3',
            'RATING 4-5',
            'FEEDBACK DONE',
            'NOT YET FEEDBACK',
            '%ACH FEEDBACK',
            'LT (DAY)',
            `JUMLAH REVIEW (M: ${activeMonth ?? ''})`,
            `JUMLAH REVIEW (M-1: ${prevMonth ?? ''})`,
            'GROWTH REVIEW',
        ];

        const rows = sortedDealers.map((d) => [
            `"${d.nama_dealer.replace(/"/g, '""')}"`,
            d.gmb_score !== null ? d.gmb_score.toFixed(2) : '',
            d.rating_1_3,
            d.rating_4_5,
            d.feedback_done > 0 ? d.feedback_done : '',
            d.not_yet_feedback > 0 ? d.not_yet_feedback : '',
            d.ach_feedback !== null && d.feedback_done > 0
                ? `${d.ach_feedback.toFixed(2)}%`
                : '',
            d.lt_day !== null ? d.lt_day : '',
            d.jumlah_review_m > 0 ? d.jumlah_review_m : '',
            d.jumlah_review_m1 > 0 ? d.jumlah_review_m1 : '',
            d.growth_review !== null ? `${d.growth_review}%` : '',
        ]);

        if (summary) {
            rows.push([
                '"TOTAL"',
                summary.gmb_score !== null ? summary.gmb_score.toFixed(2) : '',
                summary.rating_1_3,
                summary.rating_4_5,
                summary.feedback_done,
                summary.not_yet_feedback,
                `${summary.ach_feedback.toFixed(2)}%`,
                summary.lt_day !== null ? summary.lt_day : '',
                summary.jumlah_review_m,
                summary.jumlah_review_m1,
                summary.growth_review !== null ? `${summary.growth_review}%` : '',
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
        a.download = `Monitoring_Feedback_${activeMonth || 'all'}.csv`;
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
        <Card className="flex flex-col border shadow-sm overflow-hidden">
            <CardHeader className="flex flex-col gap-3 pb-3 border-b sm:flex-row sm:items-center sm:justify-between bg-muted/10">
                <div>
                    <div className="flex items-center gap-2">
                        <CardTitle className="text-base font-bold tracking-tight">
                            Monitoring Feedback &amp; Pertumbuhan Ulasan
                        </CardTitle>
                        <Badge variant="secondary" className="font-semibold text-xs">
                            {filteredDealers.length} Showroom
                        </Badge>
                    </div>
                    <CardDescription className="text-xs mt-0.5">
                        Komparasi performa respons, rating ulasan, dan tren pertumbuhan ulasan bulan berjalan{' '}
                        <span className="font-semibold text-foreground">
                            (M: {formatMonthLabel(activeMonth)})
                        </span>{' '}
                        terhadap bulan sebelumnya{' '}
                        <span className="font-semibold text-foreground">
                            (M-1: {formatMonthLabel(prevMonth)})
                        </span>
                    </CardDescription>
                </div>

                <div className="flex flex-wrap items-center gap-2">
                    {/* Month Picker */}
                    {availableMonths.length > 0 && (
                        <div className="flex items-center gap-1.5 text-xs bg-background rounded-md border px-2 py-1 shadow-2xs">
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
                            className="h-8 w-36 sm:w-44 rounded-md border border-input bg-background pl-8 pr-2 text-xs shadow-2xs focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                        />
                    </div>

                    {/* View Mode Toggle */}
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
                        className="h-8 gap-1.5 text-xs cursor-pointer bg-background"
                        title="Download CSV"
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
                                        onClick={() => handleSort('nama_dealer')}
                                        className="bg-slate-900 px-3.5 py-2.5 text-left cursor-pointer hover:bg-slate-800 transition-colors border-r border-slate-700/60 min-w-[200px] sticky left-0 z-20"
                                    >
                                        NAMA DEALER {renderSortArrow('nama_dealer')}
                                    </th>
                                    <th
                                        onClick={() => handleSort('gmb_score')}
                                        className="bg-[#0e4d64] px-3 py-2.5 text-center cursor-pointer hover:bg-[#155b74] transition-colors border-r border-slate-700/60"
                                    >
                                        GMB SCORE {renderSortArrow('gmb_score')}
                                    </th>
                                    <th
                                        onClick={() => handleSort('rating_1_3')}
                                        className="bg-slate-900 px-2.5 py-2.5 text-center cursor-pointer hover:bg-slate-800 transition-colors border-r border-slate-700/60"
                                    >
                                        RATING 1-3 {renderSortArrow('rating_1_3')}
                                    </th>
                                    <th
                                        onClick={() => handleSort('rating_4_5')}
                                        className="bg-slate-900 px-2.5 py-2.5 text-center cursor-pointer hover:bg-slate-800 transition-colors border-r border-slate-700/60"
                                    >
                                        RATING 4-5 {renderSortArrow('rating_4_5')}
                                    </th>
                                    <th
                                        onClick={() => handleSort('feedback_done')}
                                        className="bg-slate-900 px-2.5 py-2.5 text-center cursor-pointer hover:bg-slate-800 transition-colors border-r border-slate-700/60"
                                    >
                                        FEEDBACK DONE {renderSortArrow('feedback_done')}
                                    </th>
                                    <th
                                        onClick={() => handleSort('not_yet_feedback')}
                                        className="bg-slate-900 px-2.5 py-2.5 text-center cursor-pointer hover:bg-slate-800 transition-colors border-r border-slate-700/60"
                                    >
                                        NOT YET FEEDBACK {renderSortArrow('not_yet_feedback')}
                                    </th>
                                    <th
                                        onClick={() => handleSort('ach_feedback')}
                                        className="bg-[#0284c7] text-white px-3 py-2.5 text-center cursor-pointer hover:bg-sky-700 transition-colors border-r border-sky-800"
                                    >
                                        %ACH FEEDBACK {renderSortArrow('ach_feedback')}
                                    </th>
                                    <th
                                        onClick={() => handleSort('lt_day')}
                                        className="bg-[#1d4ed8] text-white px-2.5 py-2.5 text-center cursor-pointer hover:bg-blue-800 transition-colors border-r border-blue-900"
                                    >
                                        LT (DAY) {renderSortArrow('lt_day')}
                                    </th>
                                    <th
                                        onClick={() => handleSort('jumlah_review_m')}
                                        className="bg-slate-900 px-3 py-2.5 text-center cursor-pointer hover:bg-slate-800 transition-colors border-r border-slate-700/60"
                                    >
                                        JUMLAH REVIEW (M) {renderSortArrow('jumlah_review_m')}
                                    </th>
                                    <th
                                        onClick={() => handleSort('jumlah_review_m1')}
                                        className="bg-slate-900 px-3 py-2.5 text-center cursor-pointer hover:bg-slate-800 transition-colors border-r border-slate-700/60"
                                    >
                                        JUMLAH REVIEW (M-1) {renderSortArrow('jumlah_review_m1')}
                                    </th>
                                    <th
                                        onClick={() => handleSort('growth_review')}
                                        className="bg-[#0d9488] text-white px-3 py-2.5 text-center cursor-pointer hover:bg-teal-700 transition-colors"
                                    >
                                        GROWTH REVIEW {renderSortArrow('growth_review')}
                                    </th>
                                </tr>
                            </thead>
                            <tbody>
                                {paginatedDealers.length === 0 ? (
                                    <tr>
                                        <td colSpan={11} className="text-center py-8 text-muted-foreground text-xs">
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
                                                {/* Nama Dealer */}
                                                <td className="px-3.5 py-1.5 text-left font-semibold text-foreground truncate max-w-[240px] sticky left-0 z-10 bg-inherit border-r border-border/30">
                                                    {d.nama_dealer}
                                                </td>

                                                {/* GMB Score */}
                                                <td className="px-3 py-1.5 text-center border-r border-border/30">
                                                    <GmbScoreBadge score={d.gmb_score} />
                                                </td>

                                                {/* Rating 1-3 */}
                                                <td className="px-2.5 py-1.5 text-center font-mono border-r border-border/30">
                                                    {d.rating_1_3}
                                                </td>

                                                {/* Rating 4-5 */}
                                                <td className="px-2.5 py-1.5 text-center font-mono border-r border-border/30">
                                                    {d.rating_4_5}
                                                </td>

                                                {/* Feedback Done */}
                                                <td className="px-2.5 py-1.5 text-center font-mono border-r border-border/30">
                                                    {d.feedback_done > 0 ? d.feedback_done : ''}
                                                </td>

                                                {/* Not Yet Feedback */}
                                                <td className="px-2.5 py-1.5 text-center font-mono border-r border-border/30">
                                                    {d.not_yet_feedback > 0 ? d.not_yet_feedback : ''}
                                                </td>

                                                {/* %Ach Feedback */}
                                                <td className="px-3 py-1.5 text-center font-mono border-r border-border/30">
                                                    <AchFeedbackBadge
                                                        value={d.ach_feedback}
                                                        monthlyReviews={d.jumlah_review_m}
                                                        feedbackDone={d.feedback_done}
                                                    />
                                                </td>

                                                {/* LT (Day) */}
                                                <td className="px-2.5 py-1.5 text-center font-mono border-r border-border/30">
                                                    {d.lt_day !== null ? d.lt_day : ''}
                                                </td>

                                                {/* Jumlah Review (M) */}
                                                <td className="px-3 py-1.5 text-center font-mono font-bold text-foreground border-r border-border/30">
                                                    {d.jumlah_review_m > 0 ? d.jumlah_review_m : ''}
                                                </td>

                                                {/* Jumlah Review (M-1) */}
                                                <td className="px-3 py-1.5 text-center font-mono border-r border-border/30 text-muted-foreground">
                                                    {d.jumlah_review_m1 > 0 ? d.jumlah_review_m1 : ''}
                                                </td>

                                                {/* Growth Review */}
                                                <td className="px-3 py-1.5 text-center font-mono">
                                                    <GrowthBadge
                                                        growth={d.growth_review}
                                                        m={d.jumlah_review_m}
                                                        m1={d.jumlah_review_m1}
                                                    />
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
                                        <td className="px-3.5 py-2 text-left sticky left-0 z-10 bg-slate-950 border-r border-slate-800">
                                            Total
                                        </td>
                                        <td className="bg-[#0e4d64] text-white px-3 py-2 text-center border-r border-slate-800">
                                            <GmbScoreBadge score={summary.gmb_score} />
                                        </td>
                                        <td className="px-2.5 py-2 text-center font-mono border-r border-slate-800">
                                            {summary.rating_1_3}
                                        </td>
                                        <td className="px-2.5 py-2 text-center font-mono border-r border-slate-800">
                                            {summary.rating_4_5}
                                        </td>
                                        <td className="px-2.5 py-2 text-center font-mono border-r border-slate-800">
                                            {summary.feedback_done}
                                        </td>
                                        <td className="px-2.5 py-2 text-center font-mono border-r border-slate-800">
                                            {summary.not_yet_feedback}
                                        </td>
                                        <td className="bg-[#0284c7] text-white px-3 py-2 text-center font-mono border-r border-blue-600">
                                            {summary.ach_feedback.toFixed(2)}%
                                        </td>
                                        <td className="bg-[#1d4ed8] text-white px-2.5 py-2 text-center font-mono border-r border-blue-800">
                                            {summary.lt_day !== null ? summary.lt_day : '-'}
                                        </td>
                                        <td className="px-3 py-2 text-center font-mono border-r border-slate-800">
                                            {summary.jumlah_review_m}
                                        </td>
                                        <td className="px-3 py-2 text-center font-mono border-r border-slate-800">
                                            {summary.jumlah_review_m1}
                                        </td>
                                        <td className="bg-[#0d9488] text-white px-3 py-2 text-center font-mono">
                                            {summary.growth_review !== null
                                                ? `${summary.growth_review > 0 ? '+' : ''}${summary.growth_review}%`
                                                : '-'}
                                        </td>
                                    </tr>
                                </tfoot>
                            )}
                        </table>
                    </div>
                ) : (
                    /* Graphical Performance View */
                    <div className="p-4 sm:p-6 space-y-6">
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                            {/* Summary Card 1 */}
                            <div className="rounded-xl border p-4 bg-muted/20">
                                <div className="text-xs text-muted-foreground font-medium">
                                    Pertumbuhan Ulasan (M vs M-1)
                                </div>
                                <div
                                    className={`text-2xl font-bold mt-1 ${
                                        (summary?.growth_review ?? 0) >= 0
                                            ? 'text-emerald-600 dark:text-emerald-400'
                                            : 'text-rose-600 dark:text-rose-400'
                                    }`}
                                >
                                    {summary?.growth_review !== null
                                        ? `${(summary?.growth_review ?? 0) > 0 ? '+' : ''}${summary?.growth_review}%`
                                        : '-'}
                                </div>
                                <div className="text-[11px] text-muted-foreground mt-1">
                                    {summary?.jumlah_review_m ?? 0} ulasan (M) vs {summary?.jumlah_review_m1 ?? 0} ulasan (M-1)
                                </div>
                            </div>

                            {/* Summary Card 2 */}
                            <div className="rounded-xl border p-4 bg-muted/20">
                                <div className="text-xs text-muted-foreground font-medium">
                                    Pencapaian Respons Ulasan (%ACH)
                                </div>
                                <div className="text-2xl font-bold mt-1 text-blue-600 dark:text-blue-400">
                                    {summary?.ach_feedback.toFixed(2) ?? 0}%
                                </div>
                                <div className="text-[11px] text-muted-foreground mt-1">
                                    {summary?.feedback_done ?? 0} terjawab | {summary?.not_yet_feedback ?? 0} menunggu respon
                                </div>
                            </div>

                            {/* Summary Card 3 */}
                            <div className="rounded-xl border p-4 bg-muted/20">
                                <div className="text-xs text-muted-foreground font-medium">
                                    Rata-rata Skor GMB
                                </div>
                                <div className="text-2xl font-bold mt-1 text-amber-500">
                                    ★ {summary?.gmb_score?.toFixed(2) ?? '-'}
                                </div>
                                <div className="text-[11px] text-muted-foreground mt-1">
                                    Bintang 4-5: {summary?.rating_4_5 ?? 0} | Kritis (1-3★): {summary?.rating_1_3 ?? 0}
                                </div>
                            </div>
                        </div>

                        {/* Top Showrooms Growth & Volume Comparison */}
                        <div className="space-y-3">
                            <h4 className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
                                Perbandingan Ulasan Bulan M ({formatMonthLabel(activeMonth)}) vs Bulan M-1 ({formatMonthLabel(prevMonth)})
                            </h4>
                            <div className="space-y-2.5">
                                {sortedDealers.slice(0, 10).map((d) => {
                                    const maxVal = Math.max(
                                        ...dealers.map((x) => Math.max(x.jumlah_review_m, x.jumlah_review_m1)),
                                        1
                                    );
                                    const pctM = Math.round((d.jumlah_review_m / maxVal) * 100);
                                    const pctM1 = Math.round((d.jumlah_review_m1 / maxVal) * 100);

                                    return (
                                        <div
                                            key={d.id}
                                            className="rounded-lg border p-3 bg-card hover:bg-muted/30 transition-colors space-y-2"
                                        >
                                            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1 text-xs">
                                                <div className="flex items-center gap-2">
                                                    <span className="font-semibold text-foreground">
                                                        {d.nama_dealer}
                                                    </span>
                                                    <GmbScoreBadge score={d.gmb_score} />
                                                </div>
                                                <div className="flex items-center gap-3 text-xs">
                                                    <span className="text-muted-foreground">
                                                        M-1: <strong>{d.jumlah_review_m1}</strong>
                                                    </span>
                                                    <span className="text-foreground">
                                                        M: <strong>{d.jumlah_review_m}</strong>
                                                    </span>
                                                    <GrowthBadge
                                                        growth={d.growth_review}
                                                        m={d.jumlah_review_m}
                                                        m1={d.jumlah_review_m1}
                                                    />
                                                </div>
                                            </div>

                                            {/* Dual bars: M vs M-1 */}
                                            <div className="space-y-1">
                                                <div className="flex items-center gap-2 text-[10px]">
                                                    <span className="w-8 font-medium text-muted-foreground shrink-0">M</span>
                                                    <div className="h-2 w-full bg-muted rounded-full overflow-hidden">
                                                        <div
                                                            className="h-full bg-primary rounded-full transition-all duration-300"
                                                            style={{ width: `${pctM}%` }}
                                                        />
                                                    </div>
                                                    <span className="w-6 text-right font-mono shrink-0">{d.jumlah_review_m}</span>
                                                </div>
                                                <div className="flex items-center gap-2 text-[10px]">
                                                    <span className="w-8 font-medium text-muted-foreground shrink-0">M-1</span>
                                                    <div className="h-2 w-full bg-muted rounded-full overflow-hidden">
                                                        <div
                                                            className="h-full bg-slate-400 dark:bg-slate-600 rounded-full transition-all duration-300"
                                                            style={{ width: `${pctM1}%` }}
                                                        />
                                                    </div>
                                                    <span className="w-6 text-right font-mono shrink-0">{d.jumlah_review_m1}</span>
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
