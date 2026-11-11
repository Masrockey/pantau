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
import {
    Button as AntButton,
    Card as AntCard,
    Input as AntInput,
    Pagination as AntPagination,
    Progress as AntProgress,
    Segmented as AntSegmented,
    Select as AntSelect,
    Statistic as AntStatistic,
    Tag as AntTag,
} from 'antd';
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
import {
    TypeDealerFilterSelect,
    matchesTypeDealerSelection,
    useTypeDealerFilter,
} from '@/components/dashboard/type-dealer-filter';

export interface DealerOverviewItem {
    id: number;
    kode_dealer: string;
    nama_dealer: string;
    type_dealer?: string | null;
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
    availableTypeDealers?: string[];
    selectedTypeDealers?: string[];
}

type SortKey = keyof DealerOverviewItem;

function formatMonthLabel(ym: string): string {
    if (!ym) return '';
    if (ym === 'all' || ym.toLowerCase() === 'all') return 'All Tanggal';
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
    availableTypeDealers = [],
    selectedTypeDealers = [],
}: DealerOverviewProps) {
    const [search, setSearch] = React.useState('');
    const [viewMode, setViewMode] = React.useState<'table' | 'chart'>('table');
    const [sortKey, setSortKey] = React.useState<SortKey>('review_monthly');
    const [sortDir, setSortDir] = React.useState<'asc' | 'desc'>('desc');
    const [pageSize, setPageSize] = React.useState<number | 'all'>('all');
    const [currentPage, setCurrentPage] = React.useState(1);

    const {
        typeDealerFilter,
        typeDealerOptions,
        handleTypeDealerChange,
        buildNavigationParams,
    } = useTypeDealerFilter(
        dealers,
        availableTypeDealers,
        selectedTypeDealers,
        () => setCurrentPage(1),
    );

    const handleMonthChange = (nextMonth: string) => {
        const nextParams = buildNavigationParams();
        if (nextMonth && nextMonth !== 'all') {
            nextParams.month = nextMonth;
        } else if (nextMonth === 'all') {
            nextParams.month = 'all';
        } else {
            delete nextParams.month;
        }
        router.get(
            window.location.pathname,
            nextParams,
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
        const selectedSet = new Set(typeDealerFilter);

        return dealers.filter((d) => {
            if (!matchesTypeDealerSelection(d.type_dealer, selectedSet)) {
                return false;
            }

            if (!query) return true;
            return (
                d.nama_dealer.toLowerCase().includes(query) ||
                d.kode_dealer.toLowerCase().includes(query) ||
                (d.type_dealer || '').toLowerCase().includes(query)
            );
        });
    }, [dealers, search, typeDealerFilter]);

    const effectiveSummary = React.useMemo<DealerOverviewSummary | null>(() => {
        if (!summary) return null;
        if (typeDealerFilter.length === 0 && search.trim() === '') {
            return summary;
        }

        const totalReviewAll = filteredDealers.reduce(
            (acc, d) => acc + d.total_review_all,
            0,
        );
        const reviewMonthly = filteredDealers.reduce(
            (acc, d) => acc + d.review_monthly,
            0,
        );
        const validScores = filteredDealers
            .map((d) => d.gmb_score)
            .filter((s): s is number => s !== null && s !== undefined);
        const avgGmb =
            validScores.length > 0
                ? Math.round(
                      (validScores.reduce((a, b) => a + b, 0) /
                          validScores.length) *
                          100,
                  ) / 100
                : null;
        const r1 = filteredDealers.reduce((acc, d) => acc + d.rating_1, 0);
        const r2 = filteredDealers.reduce((acc, d) => acc + d.rating_2, 0);
        const r3 = filteredDealers.reduce((acc, d) => acc + d.rating_3, 0);
        const r4 = filteredDealers.reduce((acc, d) => acc + d.rating_4, 0);
        const r5 = filteredDealers.reduce((acc, d) => acc + d.rating_5, 0);
        const jmlFeedback = filteredDealers.reduce(
            (acc, d) => acc + d.jumlah_feedback,
            0,
        );
        const belumFeedback = filteredDealers.reduce(
            (acc, d) => acc + d.belum_feedback,
            0,
        );
        const cont13 =
            reviewMonthly > 0
                ? Math.round(((r1 + r2 + r3) / reviewMonthly) * 10000) / 100
                : 0;
        const cont45 =
            reviewMonthly > 0
                ? Math.round(((r4 + r5) / reviewMonthly) * 10000) / 100
                : 0;
        const achFeedback =
            reviewMonthly > 0
                ? Math.round((jmlFeedback / reviewMonthly) * 10000) / 100
                : 0;
        const validLts = filteredDealers
            .map((d) => d.lt_days)
            .filter((l): l is number => l !== null && l !== undefined);
        const avgLt =
            validLts.length > 0
                ? Math.round(
                      (validLts.reduce((a, b) => a + b, 0) / validLts.length) *
                          10,
                  ) / 10
                : null;

        return {
            total_review_all: totalReviewAll,
            review_monthly: reviewMonthly,
            gmb_score: avgGmb,
            rating_1: r1,
            rating_2: r2,
            rating_3: r3,
            rating_4: r4,
            rating_5: r5,
            cont_rating_1_3: cont13,
            cont_rating_4_5: cont45,
            jumlah_feedback: jmlFeedback,
            belum_feedback: belumFeedback,
            ach_feedback: achFeedback,
            lt_days: avgLt,
        };
    }, [summary, filteredDealers, typeDealerFilter, search]);

    const sortedDealers = React.useMemo(() => {
        const list = [...filteredDealers];
        list.sort((a, b) => {
            const valA = a[sortKey];
            const valB = b[sortKey];

            const emptyA = valA === null || valA === undefined || valA === '';
            const emptyB = valB === null || valB === undefined || valB === '';

            if (emptyA && emptyB) {
                return a.nama_dealer.localeCompare(b.nama_dealer);
            }
            if (emptyA) return 1;
            if (emptyB) return -1;

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
            'TYPE DEALER',
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
            d.type_dealer ? `"${d.type_dealer.replace(/"/g, '""')}"` : '',
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

        if (effectiveSummary) {
            rows.push([
                '"TOTAL"',
                '""',
                '',
                effectiveSummary.total_review_all,
                effectiveSummary.review_monthly,
                effectiveSummary.gmb_score !== null ? effectiveSummary.gmb_score.toFixed(2) : '',
                effectiveSummary.rating_1,
                effectiveSummary.rating_2,
                effectiveSummary.rating_3,
                effectiveSummary.rating_4,
                effectiveSummary.rating_5,
                `${effectiveSummary.cont_rating_1_3.toFixed(2)}%`,
                `${effectiveSummary.cont_rating_4_5.toFixed(2)}%`,
                effectiveSummary.jumlah_feedback,
                effectiveSummary.belum_feedback,
                `${effectiveSummary.ach_feedback.toFixed(2)}%`,
                effectiveSummary.lt_days !== null ? effectiveSummary.lt_days : '',
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
                        <AntSelect
                            value={activeMonth ?? 'all'}
                            onChange={(val) => handleMonthChange(val)}
                            className="w-36 sm:w-44"
                            options={[
                                { value: 'all', label: 'All Tanggal' },
                                ...availableMonths.map((m) => ({
                                    value: m,
                                    label: formatMonthLabel(m),
                                })),
                            ]}
                        />
                    )}

                    {/* Filter Type Dealer */}
                    <TypeDealerFilterSelect
                        value={typeDealerFilter}
                        options={typeDealerOptions}
                        onChange={handleTypeDealerChange}
                    />

                    {/* Search */}
                    <AntInput
                        placeholder="Cari dealer..."
                        value={search}
                        prefix={<Search className="size-3.5 text-muted-foreground" />}
                        onChange={(e) => {
                            setSearch(e.target.value);
                            setCurrentPage(1);
                        }}
                        allowClear
                        className="w-36 sm:w-44"
                    />

                    {/* Toggle View Mode */}
                    <AntSegmented
                        value={viewMode}
                        onChange={(val) => setViewMode(val as 'table' | 'chart')}
                        options={[
                            {
                                value: 'table',
                                label: (
                                    <span className="flex items-center gap-1">
                                        <TableIcon className="size-3.5" />
                                        <span className="hidden sm:inline">Tabel</span>
                                    </span>
                                ),
                            },
                            {
                                value: 'chart',
                                label: (
                                    <span className="flex items-center gap-1">
                                        <BarChart3 className="size-3.5" />
                                        <span className="hidden sm:inline">Grafik</span>
                                    </span>
                                ),
                            },
                        ]}
                    />

                    {/* Export CSV */}
                    <AntButton
                        icon={<Download className="size-3.5" />}
                        onClick={handleExportCsv}
                        title="Download file Excel / CSV"
                    >
                        <span className="hidden md:inline">Export CSV</span>
                    </AntButton>
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
                                        onClick={() => handleSort('type_dealer')}
                                        className="bg-slate-900 px-2.5 py-2.5 text-center cursor-pointer hover:bg-slate-800 transition-colors border-r border-slate-700/60"
                                    >
                                        TYPE DEALER {renderSortArrow('type_dealer')}
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
                                        {activeMonth === 'all' ? 'REVIEW (ALL TANGGAL)' : 'REVIEW MONTHLY'} {renderSortArrow('review_monthly')}
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
                                        <td colSpan={17} className="text-center py-8 text-muted-foreground text-xs">
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

                                                {/* Type Dealer */}
                                                <td className="px-2.5 py-1.5 text-center border-r border-border/30">
                                                    {d.type_dealer ? (
                                                        <AntTag color="blue" className="m-0 text-[10px] font-medium">
                                                            {d.type_dealer}
                                                        </AntTag>
                                                    ) : (
                                                        <span className="text-muted-foreground italic">-</span>
                                                    )}
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
                            {effectiveSummary && (
                                <tfoot>
                                    <tr className="bg-slate-950 text-white font-bold text-center border-t-2 border-slate-700">
                                        <td className="px-3 py-2 text-left sticky left-0 z-10 bg-slate-950 border-r border-slate-800">
                                            Total
                                        </td>
                                        <td className="px-3 py-2 text-left text-muted-foreground text-[10px] border-r border-slate-800">
                                            {filteredDealers.length} Showroom
                                        </td>
                                        <td className="px-2.5 py-2 text-center text-slate-400 border-r border-slate-800">
                                            -
                                        </td>
                                        <td className="px-2.5 py-2 text-center font-mono border-r border-slate-800">
                                            {effectiveSummary.total_review_all.toLocaleString('id-ID')}
                                        </td>
                                        <td className="px-2.5 py-2 text-center font-mono border-r border-slate-800">
                                            {effectiveSummary.review_monthly.toLocaleString('id-ID')}
                                        </td>
                                        <td className="px-2.5 py-2 text-center border-r border-slate-800">
                                            <GmbScoreBadge score={effectiveSummary.gmb_score} />
                                        </td>
                                        <td className="px-2 py-2 text-center font-mono border-r border-slate-800">
                                            {effectiveSummary.rating_1}
                                        </td>
                                        <td className="px-2 py-2 text-center font-mono border-r border-slate-800">
                                            {effectiveSummary.rating_2}
                                        </td>
                                        <td className="px-2 py-2 text-center font-mono border-r border-slate-800">
                                            {effectiveSummary.rating_3}
                                        </td>
                                        <td className="px-2 py-2 text-center font-mono border-r border-slate-800">
                                            {effectiveSummary.rating_4}
                                        </td>
                                        <td className="px-2 py-2 text-center font-mono border-r border-slate-800">
                                            {effectiveSummary.rating_5}
                                        </td>
                                        <td className="bg-rose-900 text-white px-2.5 py-2 text-center font-mono border-r border-rose-950">
                                            {effectiveSummary.cont_rating_1_3.toFixed(2)}%
                                        </td>
                                        <td className="bg-emerald-900 text-white px-2.5 py-2 text-center font-mono border-r border-emerald-950">
                                            {effectiveSummary.cont_rating_4_5.toFixed(2)}%
                                        </td>
                                        <td className="px-2 py-2 text-center font-mono border-r border-slate-800">
                                            {effectiveSummary.jumlah_feedback}
                                        </td>
                                        <td className="px-2 py-2 text-center font-mono border-r border-slate-800">
                                            {effectiveSummary.belum_feedback}
                                        </td>
                                        <td className="bg-blue-600 text-white px-2.5 py-2 text-center font-mono border-r border-blue-700">
                                            {effectiveSummary.ach_feedback.toFixed(2)}%
                                        </td>
                                        <td className="bg-amber-700 text-white px-2.5 py-2 text-center font-mono">
                                            {effectiveSummary.lt_days !== null ? effectiveSummary.lt_days : '-'}
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
                            <AntCard size="small" className="rounded-xl shadow-2xs border">
                                <AntStatistic
                                    title={activeMonth === 'all' ? 'Total Ulasan (All Tanggal)' : 'Total Ulasan Bulan Ini'}
                                    value={effectiveSummary?.review_monthly ?? 0}
                                    formatter={(val) => Number(val).toLocaleString('id-ID')}
                                />
                                <div className="text-[11px] text-muted-foreground mt-1">
                                    Dari total {effectiveSummary?.total_review_all.toLocaleString('id-ID') ?? 0} ulasan keseluruhan
                                </div>
                            </AntCard>

                            {/* Summary Card 2 */}
                            <AntCard size="small" className="rounded-xl shadow-2xs border">
                                <AntStatistic
                                    title="Tingkat Pencapaian Feedback"
                                    value={effectiveSummary?.ach_feedback ?? 0}
                                    precision={1}
                                    suffix="%"
                                    valueStyle={{ color: '#1677ff' }}
                                />
                                <div className="text-[11px] text-muted-foreground mt-1">
                                    {effectiveSummary?.jumlah_feedback ?? 0} direspons, {effectiveSummary?.belum_feedback ?? 0} menunggu
                                </div>
                            </AntCard>

                            {/* Summary Card 3 */}
                            <AntCard size="small" className="rounded-xl shadow-2xs border">
                                <AntStatistic
                                    title="Rata-rata GMB Score"
                                    value={effectiveSummary?.gmb_score ?? 0}
                                    precision={2}
                                    prefix="★"
                                    valueStyle={{ color: '#faad14' }}
                                />
                                <div className="text-[11px] text-muted-foreground mt-1">
                                    Kontribusi Bintang 4-5: <strong>{effectiveSummary?.cont_rating_4_5.toFixed(1) ?? 0}%</strong>
                                </div>
                            </AntCard>
                        </div>

                        {/* Top Showrooms by Activity */}
                        <div className="space-y-3">
                            <h4 className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
                                Performa Showroom Berdasarkan Volume Ulasan & Respons
                            </h4>
                            <div className="space-y-2">
                                {sortedDealers.slice(0, 10).map((d) => {
                                    const maxMonthly = Math.max(...sortedDealers.map((x) => x.review_monthly), 1);
                                    const pctWidth = Math.round((d.review_monthly / maxMonthly) * 100);

                                    return (
                                        <div
                                            key={d.id}
                                            className="rounded-lg border p-3 bg-card hover:bg-muted/30 transition-colors space-y-2"
                                        >
                                            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1 text-xs">
                                                <div className="flex flex-wrap items-center gap-2">
                                                    <AntTag className="font-mono text-[11px] font-semibold">
                                                        {d.kode_dealer}
                                                    </AntTag>
                                                    <span className="font-semibold text-foreground">
                                                        {d.nama_dealer}
                                                    </span>
                                                    {d.type_dealer && (
                                                        <AntTag color="blue" className="m-0 text-[10px] font-medium">
                                                            {d.type_dealer}
                                                        </AntTag>
                                                    )}
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
                                                <AntProgress
                                                    percent={pctWidth}
                                                    showInfo={false}
                                                    strokeColor="#e60012"
                                                    size="small"
                                                />
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
