import { Head, Link, router } from '@inertiajs/react';
import {
    Activity,
    AlertCircle,
    ArrowRight,
    ArrowUpRight,
    BarChart3,
    Building2,
    Calendar,
    CheckCircle2,
    ChevronDown,
    ChevronLeft,
    ChevronRight,
    Clock,
    Compass,
    ExternalLink,
    Filter,
    HelpCircle,
    LayoutGrid,
    MessageSquare,
    RefreshCw,
    Shield,
    Star,
    TrendingUp,
    Users,
    X,
} from 'lucide-react';
import React from 'react';
import DealerMap, { MapDealer } from '@/components/dashboard/dealer-map';
import type {
    DealerOverviewItem,
    DealerOverviewSummary,
} from '@/components/dashboard/dealer-overview';
import type {
    GmbClusterDealerItem,
    GmbClusterSummary,
} from '@/components/dashboard/gmb-cluster';
import type {
    MonitoringFeedbackItem,
    MonitoringFeedbackSummary,
} from '@/components/dashboard/monitoring-feedback';
import {
    ReviewWordCloud,
    WordCloudItem,
} from '@/components/dashboard/review-word-cloud';
import {
    Card as AntCard,
    Pagination as AntPagination,
    Progress as AntProgress,
    Rate as AntRate,
    Select as AntSelect,
    Statistic,
    Tag as AntTag,
    Tooltip as AntTooltip,
} from 'antd';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { dashboard } from '@/routes';
import dealerOverviewRoute from '@/routes/dealer-overview';
import dealersRoute from '@/routes/dealers';
import gmbClusterRoute from '@/routes/gmb-cluster';
import monitoringFeedbackRoute from '@/routes/monitoring-feedback';
import reviewsRoute from '@/routes/reviews';
import syncRoute from '@/routes/reviews/sync';

function formatMonthLabel(ym: string | null): string {
    if (!ym) return '';
    if (ym === 'all' || ym.toLowerCase() === 'all') return 'Semua Tanggal';
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

function formatDateShort(dateStr?: string | null): string {
    if (!dateStr) return '';
    const parts = dateStr.split('-');
    if (parts.length !== 3) return dateStr;
    const [y, m, d] = parts;
    const monthNames = [
        'Jan', 'Feb', 'Mar', 'Apr', 'Mei', 'Jun',
        'Jul', 'Agu', 'Sep', 'Okt', 'Nov', 'Des',
    ];
    const mIdx = parseInt(m, 10) - 1;
    return `${parseInt(d, 10)} ${monthNames[mIdx] ?? m} ${y}`;
}

interface DealerSummary {
    id: number;
    kode_dealer: string;
    nama_dealer: string;
    star_rate: number | null;
    total_review: number | null;
    reviews_count?: number;
    unresponded_count?: number;
    link_google_maps: string | null;
}

interface ReviewSummary {
    id: number;
    dealer_id: number;
    nama_reviewer: string;
    tanggal_publish_review: string;
    star_rate: number;
    review: string | null;
    respon_from_owner: boolean;
    tanggal_respon: string | null;
    respon: string | null;
    google_review_url: string | null;
    dealer?: {
        id: number;
        kode_dealer: string;
        nama_dealer: string;
    };
}

interface DashboardMetrics {
    total_reviews: number;
    avg_rating: number;
    responded_count: number;
    unresponded_count: number;
    response_rate: number;
    positive_reviews: number;
    neutral_reviews: number;
    critical_reviews: number;
    total_dealers: number;
    dealers_with_maps: number;
}

interface DashboardProps {
    metrics: DashboardMetrics;
    ratingCounts: {
        5: number;
        4: number;
        3: number;
        2: number;
        1: number;
    };
    topDealers: DealerSummary[];
    needsAttentionDealers: DealerSummary[];
    currentDealer: DealerSummary | null;
    latestReviews: ReviewSummary[];
    criticalUnresponded: ReviewSummary[];
    dealersList: { id: number; kode_dealer: string; nama_dealer: string }[];
    mapDealers?: MapDealer[];
    dealerOverview?: DealerOverviewItem[];
    overviewSummary?: DealerOverviewSummary | null;
    monitoringFeedback?: MonitoringFeedbackItem[];
    monitoringSummary?: MonitoringFeedbackSummary | null;
    wordCloudData?: WordCloudItem[];
    wordCloudAllTime?: WordCloudItem[];
    gmbClusterDealers?: GmbClusterDealerItem[];
    gmbClusterSummary?: GmbClusterSummary | null;
    availableMonths?: string[];
    activeMonth?: string | null;
    prevMonth?: string | null;
    startDate?: string | null;
    endDate?: string | null;
    activeRangeLabel?: string;
    prevStartDate?: string | null;
    prevEndDate?: string | null;
    selectedDealerId: string;
    isGlobal: boolean;
    userRole: string;
}

const selectClass =
    'h-9 rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-xs transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring dark:bg-background';

export default function Dashboard({
    metrics,
    ratingCounts,
    topDealers,
    needsAttentionDealers,
    currentDealer,
    latestReviews,
    criticalUnresponded,
    dealersList,
    mapDealers = [],
    dealerOverview = [],
    overviewSummary = null,
    monitoringFeedback = [],
    monitoringSummary = null,
    wordCloudData = [],
    wordCloudAllTime = [],
    gmbClusterDealers = [],
    gmbClusterSummary = null,
    availableMonths = [],
    activeMonth = null,
    prevMonth = null,
    startDate = null,
    endDate = null,
    activeRangeLabel = 'Semua Tanggal',
    prevStartDate = null,
    prevEndDate = null,
    selectedDealerId,
    isGlobal,
    userRole,
}: DashboardProps) {
    // Date range popover state
    const [isDatePickerOpen, setIsDatePickerOpen] = React.useState(false);
    const datePickerRef = React.useRef<HTMLDivElement>(null);
    const [customStart, setCustomStart] = React.useState(startDate || '');
    const [customEnd, setCustomEnd] = React.useState(endDate || '');

    React.useEffect(() => {
        if (startDate) setCustomStart(startDate);
        if (endDate) setCustomEnd(endDate);
    }, [startDate, endDate]);

    React.useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (datePickerRef.current && !datePickerRef.current.contains(event.target as Node)) {
                setIsDatePickerOpen(false);
            }
        };
        if (isDatePickerOpen) {
            document.addEventListener('mousedown', handleClickOutside);
        }
        return () => {
            document.removeEventListener('mousedown', handleClickOutside);
        };
    }, [isDatePickerOpen]);

    const formatDateToYMD = (d: Date): string => {
        const year = d.getFullYear();
        const month = String(d.getMonth() + 1).padStart(2, '0');
        const day = String(d.getDate()).padStart(2, '0');
        return `${year}-${month}-${day}`;
    };

    const applyDateFilter = (params: {
        start_date?: string | null;
        end_date?: string | null;
        month?: string | null;
    }) => {
        const currentParams = new URLSearchParams(window.location.search);

        if (params.month) {
            currentParams.set('month', params.month);
            currentParams.delete('start_date');
            currentParams.delete('end_date');
        } else if (params.start_date && params.end_date) {
            currentParams.set('start_date', params.start_date);
            currentParams.set('end_date', params.end_date);
            currentParams.delete('month');
        } else {
            currentParams.delete('start_date');
            currentParams.delete('end_date');
            currentParams.delete('month');
        }

        setIsDatePickerOpen(false);
        router.get(
            dashboard(),
            Object.fromEntries(currentParams.entries()),
            { preserveState: true, preserveScroll: true }
        );
    };

    const handleSelectAll = () => {
        applyDateFilter({ month: 'all' });
    };

    const handleSelectPreset = (preset: 'today' | '7days' | '30days' | 'thisMonth' | 'lastMonth') => {
        const now = new Date();
        if (preset === 'today') {
            const todayStr = formatDateToYMD(now);
            applyDateFilter({ start_date: todayStr, end_date: todayStr });
        } else if (preset === '7days') {
            const d = new Date();
            d.setDate(d.getDate() - 6);
            applyDateFilter({ start_date: formatDateToYMD(d), end_date: formatDateToYMD(now) });
        } else if (preset === '30days') {
            const d = new Date();
            d.setDate(d.getDate() - 29);
            applyDateFilter({ start_date: formatDateToYMD(d), end_date: formatDateToYMD(now) });
        } else if (preset === 'thisMonth') {
            const start = new Date(now.getFullYear(), now.getMonth(), 1);
            const end = new Date(now.getFullYear(), now.getMonth() + 1, 0);
            applyDateFilter({ start_date: formatDateToYMD(start), end_date: formatDateToYMD(end) });
        } else if (preset === 'lastMonth') {
            const start = new Date(now.getFullYear(), now.getMonth() - 1, 1);
            const end = new Date(now.getFullYear(), now.getMonth(), 0);
            applyDateFilter({ start_date: formatDateToYMD(start), end_date: formatDateToYMD(end) });
        }
    };

    const handleSelectMonth = (m: string) => {
        applyDateFilter({ month: m });
    };

    const handleApplyCustomRange = () => {
        if (!customStart || !customEnd) return;
        applyDateFilter({ start_date: customStart, end_date: customEnd });
    };

    const isFilterActive = Boolean(startDate && endDate) || (Boolean(activeMonth) && activeMonth !== 'all');

    const displayDateLabel = React.useMemo(() => {
        if (activeRangeLabel) return activeRangeLabel;
        if (startDate && endDate) {
            return startDate === endDate
                ? formatDateShort(startDate)
                : `${formatDateShort(startDate)} - ${formatDateShort(endDate)}`;
        }
        if (activeMonth === 'all') return 'Semua Tanggal';
        if (activeMonth) return formatMonthLabel(activeMonth);
        return 'Semua Tanggal';
    }, [activeRangeLabel, startDate, endDate, activeMonth]);

    const handleDealerChange = (value: string) => {
        const currentParams = new URLSearchParams(window.location.search);
        if (value) {
            currentParams.set('dealer_id', value);
        } else {
            currentParams.delete('dealer_id');
        }
        router.get(
            dashboard(),
            Object.fromEntries(currentParams.entries()),
            { preserveState: true, preserveScroll: true }
        );
    };

    const [attentionPage, setAttentionPage] = React.useState(1);
    const attentionPageSize = 5;
    const totalAttentionPages = Math.ceil(needsAttentionDealers.length / attentionPageSize) || 1;
    const paginatedAttentionDealers = React.useMemo(() => {
        const start = (attentionPage - 1) * attentionPageSize;
        return needsAttentionDealers.slice(start, start + attentionPageSize);
    }, [needsAttentionDealers, attentionPage]);

    React.useEffect(() => {
        setAttentionPage(1);
    }, [needsAttentionDealers.length]);

    const totalCalculated = metrics.total_reviews > 0 ? metrics.total_reviews : 1;
    const posPct = Math.round((metrics.positive_reviews / totalCalculated) * 100);
    const neuPct = Math.round((metrics.neutral_reviews / totalCalculated) * 100);
    const critPct = Math.round((metrics.critical_reviews / totalCalculated) * 100);

    const isSuperAdmin = userRole === 'super_admin';

    const getRoleBadge = (role: string) => {
        switch (role) {
            case 'super_admin':
                return <AntTag color="purple" className="font-semibold text-xs px-2.5 py-0.5 rounded-full border-0">Super Admin</AntTag>;
            case 'main_dealer':
                return <AntTag color="blue" className="font-semibold text-xs px-2.5 py-0.5 rounded-full border-0">Main Dealer</AntTag>;
            case 'dealer':
                return <AntTag color="default" className="font-semibold text-xs px-2.5 py-0.5 rounded-full">Dealer</AntTag>;
            default:
                return <AntTag className="font-semibold text-xs px-2.5 py-0.5 rounded-full">{role}</AntTag>;
        }
    };

    return (
        <>
            <Head title="Dashboard GBP - Pantau Review" />

            <div className="flex h-full flex-1 flex-col gap-6 p-4 md:p-6">
                {/* Header Section */}
                <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                    <div>
                        <div className="flex items-center gap-2">
                            <h1 className="text-2xl font-bold tracking-tight">Dashboard GBP</h1>
                            {getRoleBadge(userRole)}
                        </div>
                        <p className="mt-1 text-sm text-muted-foreground">
                            {currentDealer
                                ? `Memantau ulasan dan performa ${currentDealer.kode_dealer} - ${currentDealer.nama_dealer}`
                                : 'Ringkasan performa ulasan pelanggan Google Maps, rating showroom, dan respons owner.'}
                        </p>
                    </div>

                    <div className="flex flex-wrap items-center gap-2">
                        {/* Date Range Picker Popover */}
                        <div className="relative" ref={datePickerRef}>
                            <button
                                type="button"
                                onClick={() => setIsDatePickerOpen(!isDatePickerOpen)}
                                className={`flex items-center gap-1.5 h-8 px-2.5 rounded-md border text-xs font-medium shadow-2xs transition-colors cursor-pointer ${
                                    isFilterActive
                                        ? 'border-primary/60 bg-primary/10 text-primary hover:bg-primary/15'
                                        : 'border-input bg-background hover:bg-muted/40 text-foreground'
                                }`}
                                title="Pilih rentang tanggal atau bulan"
                            >
                                <Calendar className="size-3.5 text-primary" />
                                <span className="truncate max-w-[170px] sm:max-w-[240px] font-semibold">
                                    {displayDateLabel}
                                </span>
                                <ChevronDown
                                    className={`size-3 text-muted-foreground transition-transform duration-200 ${
                                        isDatePickerOpen ? 'rotate-180' : ''
                                    }`}
                                />
                            </button>

                            {isDatePickerOpen && (
                                <div className="absolute right-0 top-full mt-1.5 z-50 w-[320px] sm:w-[380px] rounded-xl border border-border bg-popover text-popover-foreground shadow-xl p-3.5 space-y-3">
                                    {/* Header */}
                                    <div className="flex items-center justify-between pb-2 border-b">
                                        <div className="flex items-center gap-1.5">
                                            <Calendar className="size-4 text-primary" />
                                            <span className="font-bold text-xs">Pilih Rentang Tanggal</span>
                                        </div>
                                        <button
                                            type="button"
                                            onClick={() => setIsDatePickerOpen(false)}
                                            className="rounded p-1 hover:bg-muted text-muted-foreground hover:text-foreground cursor-pointer transition-colors"
                                        >
                                            <X className="size-3.5" />
                                        </button>
                                    </div>

                                    {/* Quick Presets */}
                                    <div className="space-y-1.5">
                                        <span className="text-[11px] font-semibold text-muted-foreground">Pilihan Cepat:</span>
                                        <div className="grid grid-cols-2 sm:grid-cols-3 gap-1.5">
                                            <Button
                                                type="button"
                                                variant={!startDate && !endDate && (!activeMonth || activeMonth === 'all') ? 'default' : 'outline'}
                                                size="sm"
                                                onClick={handleSelectAll}
                                                className="h-7 text-[11px] px-2 justify-start truncate cursor-pointer"
                                            >
                                                Semua Tanggal
                                            </Button>
                                            <Button
                                                type="button"
                                                variant="outline"
                                                size="sm"
                                                onClick={() => handleSelectPreset('today')}
                                                className="h-7 text-[11px] px-2 justify-start truncate cursor-pointer"
                                            >
                                                Hari Ini
                                            </Button>
                                            <Button
                                                type="button"
                                                variant="outline"
                                                size="sm"
                                                onClick={() => handleSelectPreset('7days')}
                                                className="h-7 text-[11px] px-2 justify-start truncate cursor-pointer"
                                            >
                                                7 Hari Terakhir
                                            </Button>
                                            <Button
                                                type="button"
                                                variant="outline"
                                                size="sm"
                                                onClick={() => handleSelectPreset('30days')}
                                                className="h-7 text-[11px] px-2 justify-start truncate cursor-pointer"
                                            >
                                                30 Hari Terakhir
                                            </Button>
                                            <Button
                                                type="button"
                                                variant="outline"
                                                size="sm"
                                                onClick={() => handleSelectPreset('thisMonth')}
                                                className="h-7 text-[11px] px-2 justify-start truncate cursor-pointer"
                                            >
                                                Bulan Ini
                                            </Button>
                                            <Button
                                                type="button"
                                                variant="outline"
                                                size="sm"
                                                onClick={() => handleSelectPreset('lastMonth')}
                                                className="h-7 text-[11px] px-2 justify-start truncate cursor-pointer"
                                            >
                                                Bulan Lalu
                                            </Button>
                                        </div>
                                    </div>

                                    {/* Custom Date Range */}
                                    <div className="space-y-2 pt-2 border-t">
                                        <span className="text-[11px] font-semibold text-muted-foreground">Kustom Rentang Tanggal:</span>
                                        <div className="grid grid-cols-2 gap-2">
                                            <div className="space-y-1">
                                                <label className="text-[10px] text-muted-foreground font-medium">Dari Tanggal</label>
                                                <input
                                                    type="date"
                                                    value={customStart}
                                                    onChange={(e) => setCustomStart(e.target.value)}
                                                    className="w-full h-8 text-xs rounded-md border border-input bg-background px-2 text-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                                                />
                                            </div>
                                            <div className="space-y-1">
                                                <label className="text-[10px] text-muted-foreground font-medium">Sampai Tanggal</label>
                                                <input
                                                    type="date"
                                                    value={customEnd}
                                                    onChange={(e) => setCustomEnd(e.target.value)}
                                                    className="w-full h-8 text-xs rounded-md border border-input bg-background px-2 text-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                                                />
                                            </div>
                                        </div>
                                        <Button
                                            type="button"
                                            size="sm"
                                            onClick={handleApplyCustomRange}
                                            disabled={!customStart || !customEnd}
                                            className="w-full h-8 text-xs font-semibold cursor-pointer"
                                        >
                                            Terapkan Rentang Tanggal
                                        </Button>
                                    </div>

                                    {/* Specific Month */}
                                    {availableMonths.length > 0 && (
                                        <div className="space-y-1 pt-2 border-t">
                                            <span className="text-[11px] font-semibold text-muted-foreground">Pilih Bulan Spesifik:</span>
                                            <select
                                                value={!startDate && !endDate && activeMonth && activeMonth !== 'all' ? activeMonth : ''}
                                                onChange={(e) => {
                                                    if (e.target.value) {
                                                        handleSelectMonth(e.target.value);
                                                    }
                                                }}
                                                className="w-full h-8 text-xs rounded-md border border-input bg-background px-2 text-foreground cursor-pointer focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                                            >
                                                <option value="" disabled>-- Pilih Bulan --</option>
                                                {availableMonths.map((m) => (
                                                    <option key={m} value={m}>
                                                        {formatMonthLabel(m)}
                                                    </option>
                                                ))}
                                            </select>
                                        </div>
                                    )}
                                </div>
                            )}
                        </div>

                        {/* Showroom Selector */}
                        {isGlobal && dealersList.length > 0 && (
                            <div className="flex items-center gap-2">
                                <AntSelect
                                    showSearch
                                    value={selectedDealerId || ''}
                                    onChange={handleDealerChange}
                                    placeholder="Semua Showroom"
                                    className="w-56 sm:w-72"
                                    size="middle"
                                    filterOption={(input, option) =>
                                        (option?.label ?? '').toLowerCase().includes(input.toLowerCase())
                                    }
                                    options={[
                                        { value: '', label: `Semua Showroom (${dealersList.length})` },
                                        ...dealersList.map((d) => ({
                                            value: String(d.id),
                                            label: `${d.kode_dealer} - ${d.nama_dealer}`,
                                        })),
                                    ]}
                                />
                            </div>
                        )}

                        {isSuperAdmin && (
                            <Button asChild size="sm" className="gap-2">
                                <Link href={syncRoute.index.url()}>
                                    <RefreshCw className="size-3.5" />
                                    Sync Review
                                </Link>
                            </Button>
                        )}
                    </div>
                </div>

                {/* Active Filter Indicator Badge if filtered */}
                {isFilterActive && (
                    <div className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-primary/20 bg-primary/5 px-3 py-2 text-xs">
                        <div className="flex items-center gap-2 text-muted-foreground">
                            <Filter className="size-3.5 text-primary shrink-0" />
                            <span>
                                Memfilter data ulasan berdasarkan periode:{' '}
                                <strong className="text-foreground font-semibold">{displayDateLabel}</strong>
                            </span>
                        </div>
                        <Button
                            variant="ghost"
                            size="sm"
                            onClick={handleSelectAll}
                            className="h-6 px-2 text-xs text-primary hover:text-primary hover:bg-primary/10 gap-1 cursor-pointer"
                        >
                            <X className="size-3" />
                            Reset ke Semua Tanggal
                        </Button>
                    </div>
                )}

                {/* Showroom Scoped Context Banner if dealer role */}
                {!isGlobal && currentDealer && (
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 rounded-xl border bg-card p-4">
                        <div className="flex items-center gap-3">
                            <div className="flex size-10 items-center justify-center rounded-lg bg-primary/10 text-primary">
                                <Building2 className="size-5" />
                            </div>
                            <div>
                                <h3 className="font-semibold text-sm">
                                    {currentDealer.kode_dealer} - {currentDealer.nama_dealer}
                                </h3>
                                <p className="text-xs text-muted-foreground">
                                    {currentDealer.link_google_maps ? 'Google Maps terhubung' : 'Belum memiliki link Google Maps'}
                                </p>
                            </div>
                        </div>
                        <div className="flex items-center gap-2">
                            {currentDealer.link_google_maps && (
                                <Button variant="outline" size="sm" asChild className="gap-1.5 text-xs">
                                    <a href={currentDealer.link_google_maps} target="_blank" rel="noopener noreferrer">
                                        <ExternalLink className="size-3.5" />
                                        Buka Google Maps
                                    </a>
                                </Button>
                            )}
                            <Button size="sm" asChild className="gap-1.5 text-xs">
                                <Link href={reviewsRoute.index.url()}>
                                    Kelola Review Showroom
                                    <ArrowRight className="size-3.5" />
                                </Link>
                            </Button>
                        </div>
                    </div>
                )}

                {/* KPI Metrics Summary Cards - Ant Design Aesthetic */}
                <div className="grid grid-cols-2 gap-3 sm:grid-cols-2 lg:grid-cols-4 md:gap-4">
                    {/* Total Reviews */}
                    <AntCard size="small" hoverable className="ant-card">
                        <Statistic
                            title={
                                <span className="text-xs text-muted-foreground font-medium flex items-center justify-between">
                                    Total Ulasan Masuk
                                    <MessageSquare className="size-4 text-muted-foreground" />
                                </span>
                            }
                            value={metrics.total_reviews}
                            formatter={(val) => Number(val).toLocaleString('id-ID')}
                            valueStyle={{ fontWeight: 700, fontSize: '1.65rem' }}
                        />
                        <div className="mt-2 flex items-center gap-1.5 text-xs text-emerald-600 dark:text-emerald-400 font-medium">
                            <TrendingUp className="size-3.5" />
                            <span>{posPct}% sentimen positif</span>
                        </div>
                    </AntCard>

                    {/* Google Star Rating */}
                    <AntCard size="small" hoverable className="ant-card">
                        <Statistic
                            title={
                                <span className="text-xs text-muted-foreground font-medium flex items-center justify-between">
                                    Rata-rata Rating Google
                                    <Star className="size-4 fill-amber-400 text-amber-500" />
                                </span>
                            }
                            value={metrics.avg_rating > 0 ? metrics.avg_rating.toFixed(1) : '-'}
                            suffix={<span className="text-xs text-muted-foreground font-normal">/ 5.0</span>}
                            valueStyle={{ fontWeight: 700, fontSize: '1.65rem', color: '#f59e0b' }}
                        />
                        <p className="mt-2 text-xs text-muted-foreground">
                            Dari total ulasan Google Maps
                        </p>
                    </AntCard>

                    {/* Response Rate */}
                    <AntCard size="small" hoverable className="ant-card">
                        <Statistic
                            title={
                                <span className="text-xs text-muted-foreground font-medium flex items-center justify-between">
                                    Respons Owner Dealer
                                    <CheckCircle2 className="size-4 text-emerald-500" />
                                </span>
                            }
                            value={metrics.response_rate}
                            suffix={<span className="text-xs text-muted-foreground font-normal">%</span>}
                            valueStyle={{ fontWeight: 700, fontSize: '1.65rem', color: '#10b981' }}
                        />
                        <p className="mt-2 text-xs text-muted-foreground">
                            {metrics.responded_count.toLocaleString('id-ID')} ulasan telah dijawab
                        </p>
                    </AntCard>

                    {/* Pending Response (Action Required) */}
                    <AntCard
                        size="small"
                        hoverable
                        className={`ant-card ${metrics.unresponded_count > 0 ? 'border-amber-500/50 bg-amber-50/20 dark:bg-amber-950/10' : ''}`}
                    >
                        <div className="flex items-start justify-between">
                            <Statistic
                                title={
                                    <span className="text-xs text-muted-foreground font-medium">
                                        Belum Ditanggapi
                                    </span>
                                }
                                value={metrics.unresponded_count}
                                formatter={(val) => Number(val).toLocaleString('id-ID')}
                                valueStyle={{
                                    fontWeight: 700,
                                    fontSize: '1.65rem',
                                    color: metrics.unresponded_count > 0 ? '#d97706' : undefined,
                                }}
                            />
                            <AlertCircle className={`size-4 mt-1 ${metrics.unresponded_count > 0 ? 'text-amber-500' : 'text-muted-foreground'}`} />
                        </div>
                        <div className="mt-2 flex items-center justify-between">
                            <span className="text-xs text-muted-foreground">
                                {metrics.unresponded_count > 0 ? 'Perlu tindakan dealer' : 'Semua telah direspons'}
                            </span>
                            {metrics.unresponded_count > 0 && (
                                <Link
                                    href={reviewsRoute.index.url({ query: { respon_from_owner: 'false' } })}
                                    className="text-xs font-medium text-amber-600 dark:text-amber-400 hover:underline flex items-center gap-0.5"
                                >
                                    Balas <ArrowRight className="size-3" />
                                </Link>
                            )}
                        </div>
                    </AntCard>
                </div>

                {/* Dealer Pin Point Map Section */}
                {mapDealers.length > 0 && (
                    <DealerMap
                        dealers={mapDealers}
                        selectedDealerId={selectedDealerId}
                    />
                )}

                {/* Middle Grid: Rating Breakdown & Response SLA */}
                <div className="grid grid-cols-1 gap-6 lg:grid-cols-12">
                    {/* Rating Distribution (7 Columns) */}
                    <Card className="lg:col-span-7 flex flex-col ant-card">
                        <CardHeader>
                            <CardTitle className="text-base flex items-center gap-2">
                                <Star className="size-4 text-amber-500 fill-amber-400" />
                                Distribusi Rating Bintang
                            </CardTitle>
                            <CardDescription>
                                Sebaran kepuasan pelanggan dari bintang 5 hingga bintang 1.
                            </CardDescription>
                        </CardHeader>
                        <CardContent className="flex-1 flex flex-col justify-between gap-4">
                            <div className="space-y-2.5">
                                {[5, 4, 3, 2, 1].map((star) => {
                                    const count = ratingCounts[star as keyof typeof ratingCounts] || 0;
                                    const percentage = metrics.total_reviews > 0 ? Math.round((count / metrics.total_reviews) * 100) : 0;
                                    const strokeColor =
                                        star >= 4
                                            ? '#52c41a'
                                            : star === 3
                                              ? '#faad14'
                                              : '#ff4d4f';

                                    return (
                                        <div key={star} className="flex items-center gap-3 text-xs">
                                            <div className="flex w-14 items-center gap-1 font-medium shrink-0">
                                                <span>{star}</span>
                                                <Star className="size-3 fill-amber-400 text-amber-500" />
                                            </div>
                                            <div className="w-full">
                                                <AntProgress
                                                    percent={percentage}
                                                    strokeColor={strokeColor}
                                                    size="small"
                                                    showInfo={false}
                                                />
                                            </div>
                                            <div className="flex w-24 justify-end gap-1.5 font-mono text-muted-foreground shrink-0">
                                                <span>{count.toLocaleString('id-ID')}</span>
                                                <span className="text-[11px]">({percentage}%)</span>
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>

                            {/* Sentiment Badges */}
                            <div className="grid grid-cols-3 gap-2 pt-3 border-t text-center text-xs">
                                <div className="rounded-lg bg-emerald-500/10 p-2 text-emerald-700 dark:text-emerald-300">
                                    <div className="text-[11px] font-medium">Positif (4-5★)</div>
                                    <div className="text-base font-bold">{metrics.positive_reviews} <span className="text-xs font-normal">({posPct}%)</span></div>
                                </div>
                                <div className="rounded-lg bg-amber-500/10 p-2 text-amber-700 dark:text-amber-300">
                                    <div className="text-[11px] font-medium">Netral (3★)</div>
                                    <div className="text-base font-bold">{metrics.neutral_reviews} <span className="text-xs font-normal">({neuPct}%)</span></div>
                                </div>
                                <div className="rounded-lg bg-rose-500/10 p-2 text-rose-700 dark:text-rose-300">
                                    <div className="text-[11px] font-medium">Kritis (1-2★)</div>
                                    <div className="text-base font-bold">{metrics.critical_reviews} <span className="text-xs font-normal">({critPct}%)</span></div>
                                </div>
                            </div>
                        </CardContent>
                    </Card>

                    {/* Tanggapan Owner & Quick Links (5 Columns) */}
                    <Card className="lg:col-span-5 flex flex-col ant-card">
                        <CardHeader>
                            <CardTitle className="text-base flex items-center gap-2">
                                <CheckCircle2 className="size-4 text-primary" />
                                Status Layanan & Tanggapan
                            </CardTitle>
                            <CardDescription>
                                Respons owner dealer terhadap keluhan dan ulasan konsumen.
                            </CardDescription>
                        </CardHeader>
                        <CardContent className="flex-1 flex flex-col justify-between gap-4">
                            <div className="space-y-4">
                                <div className="rounded-xl border p-4 bg-muted/20">
                                    <div className="flex items-center justify-between text-xs font-medium mb-2">
                                        <span>Progres Penyelesaian Respons</span>
                                        <span className="font-mono text-emerald-600 dark:text-emerald-400 font-bold">
                                            {metrics.response_rate}%
                                        </span>
                                    </div>
                                    <AntProgress
                                        percent={metrics.response_rate}
                                        strokeColor="#52c41a"
                                        size={['100%', 10]}
                                        status="active"
                                    />
                                    <div className="mt-3 flex items-center justify-between text-xs text-muted-foreground">
                                        <span className="flex items-center gap-1.5">
                                            <span className="size-2 rounded-full bg-emerald-500" />
                                            Direspons: <strong>{metrics.responded_count}</strong>
                                        </span>
                                        <span className="flex items-center gap-1.5">
                                            <span className="size-2 rounded-full bg-amber-500" />
                                            Menunggu: <strong>{metrics.unresponded_count}</strong>
                                        </span>
                                    </div>
                                </div>

                                <div className="space-y-2">
                                    <Button asChild variant="outline" className="w-full justify-between text-xs">
                                        <Link href={reviewsRoute.index.url({ query: { respon_from_owner: 'false' } })}>
                                            <span className="flex items-center gap-2">
                                                <AlertCircle className="size-4 text-amber-500" />
                                                Review Belum Ditanggapi ({metrics.unresponded_count})
                                            </span>
                                            <ArrowRight className="size-3.5" />
                                        </Link>
                                    </Button>

                                    <Button asChild variant="outline" className="w-full justify-between text-xs">
                                        <Link href={reviewsRoute.index.url()}>
                                            <span className="flex items-center gap-2">
                                                <MessageSquare className="size-4 text-primary" />
                                                Buka Semua Review Ulasan
                                            </span>
                                            <ArrowRight className="size-3.5" />
                                        </Link>
                                    </Button>

                                    {isSuperAdmin && (
                                        <Button asChild variant="outline" className="w-full justify-between text-xs">
                                            <Link href={syncRoute.index.url()}>
                                                <span className="flex items-center gap-2">
                                                    <RefreshCw className="size-4 text-blue-500" />
                                                    Sinkronisasi Data Google Maps
                                                </span>
                                                <ArrowRight className="size-3.5" />
                                            </Link>
                                        </Button>
                                    )}
                                </div>
                            </div>
                        </CardContent>
                    </Card>
                </div>

                {/* Advanced Analytics Navigation Cards (Monitoring Feedback, Dealer Overview, GMB Cluster) */}
                {isGlobal && (
                    <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
                        {/* Monitoring Feedback Card */}
                        <Card className="flex flex-col justify-between transition-all hover:border-emerald-500/50 hover:shadow-sm">
                            <CardHeader className="pb-3">
                                <div className="flex items-center justify-between">
                                    <div className="flex items-center gap-2.5">
                                        <div className="rounded-lg bg-emerald-500/10 p-2 text-emerald-600 dark:text-emerald-400">
                                            <Activity className="size-5" />
                                        </div>
                                        <div>
                                            <CardTitle className="text-base font-semibold">Monitoring Feedback</CardTitle>
                                            <span className="text-[11px] text-muted-foreground">SLA & Respon Review</span>
                                        </div>
                                    </div>
                                    <Badge variant="outline" className="border-emerald-500/30 px-1.5 py-0 text-[10px] text-emerald-600 dark:text-emerald-400">
                                        Menu Khusus
                                    </Badge>
                                </div>
                                <CardDescription className="mt-2 line-clamp-2 text-xs">
                                    Pantau SLA respon review, pencapaian feedback (% Ach), dan lead time respon (LT Day) seluruh dealer.
                                </CardDescription>
                            </CardHeader>
                            <CardContent className="pb-3">
                                <div className="grid grid-cols-2 gap-2 rounded-lg border border-border/50 bg-muted/40 p-2.5 text-xs">
                                    <div>
                                        <span className="block text-[11px] text-muted-foreground">Ach Feedback</span>
                                        <span className="text-sm font-bold text-emerald-600 dark:text-emerald-400">
                                            {monitoringSummary?.ach_feedback ?? 0}%
                                        </span>
                                    </div>
                                    <div>
                                        <span className="block text-[11px] text-muted-foreground">Rata-rata LT</span>
                                        <span className="text-sm font-bold">
                                            {monitoringSummary?.lt_day !== null && monitoringSummary?.lt_day !== undefined ? `${monitoringSummary.lt_day} Hari` : '-'}
                                        </span>
                                    </div>
                                </div>
                            </CardContent>
                            <CardFooter className="pt-0">
                                <Button variant="outline" size="sm" asChild className="w-full gap-1.5 text-xs font-medium hover:border-emerald-500/40 hover:bg-emerald-500/10 hover:text-emerald-600">
                                    <Link href={monitoringFeedbackRoute.index()}>
                                        Buka Monitoring Feedback
                                        <ArrowUpRight className="size-3.5" />
                                    </Link>
                                </Button>
                            </CardFooter>
                        </Card>

                        {/* Dealer Overview Card */}
                        <Card className="flex flex-col justify-between transition-all hover:border-blue-500/50 hover:shadow-sm">
                            <CardHeader className="pb-3">
                                <div className="flex items-center justify-between">
                                    <div className="flex items-center gap-2.5">
                                        <div className="rounded-lg bg-blue-500/10 p-2 text-blue-600 dark:text-blue-400">
                                            <BarChart3 className="size-5" />
                                        </div>
                                        <div>
                                            <CardTitle className="text-base font-semibold">Dealer Overview</CardTitle>
                                            <span className="text-[11px] text-muted-foreground">Matriks & Kontribusi Rating</span>
                                        </div>
                                    </div>
                                    <Badge variant="outline" className="border-blue-500/30 px-1.5 py-0 text-[10px] text-blue-600 dark:text-blue-400">
                                        Menu Khusus
                                    </Badge>
                                </div>
                                <CardDescription className="mt-2 line-clamp-2 text-xs">
                                    Analisis matriks review bulanan, kontribusi rating bintang 1-5, dan komparasi performa dealer.
                                </CardDescription>
                            </CardHeader>
                            <CardContent className="pb-3">
                                <div className="grid grid-cols-2 gap-2 rounded-lg border border-border/50 bg-muted/40 p-2.5 text-xs">
                                    <div>
                                        <span className="block text-[11px] text-muted-foreground">Review Bulanan</span>
                                        <span className="text-sm font-bold text-blue-600 dark:text-blue-400">
                                            {overviewSummary?.review_monthly?.toLocaleString('id-ID') ?? 0}
                                        </span>
                                    </div>
                                    <div>
                                        <span className="block text-[11px] text-muted-foreground">Rata-rata Rating</span>
                                        <span className="text-sm font-bold">
                                            ★ {overviewSummary?.gmb_score ?? '-'}
                                        </span>
                                    </div>
                                </div>
                            </CardContent>
                            <CardFooter className="pt-0">
                                <Button variant="outline" size="sm" asChild className="w-full gap-1.5 text-xs font-medium hover:border-blue-500/40 hover:bg-blue-500/10 hover:text-blue-600">
                                    <Link href={dealerOverviewRoute.index()}>
                                        Buka Dealer Overview
                                        <ArrowUpRight className="size-3.5" />
                                    </Link>
                                </Button>
                            </CardFooter>
                        </Card>

                        {/* GMB Cluster Card */}
                        <Card className="flex flex-col justify-between transition-all hover:border-purple-500/50 hover:shadow-sm">
                            <CardHeader className="pb-3">
                                <div className="flex items-center justify-between">
                                    <div className="flex items-center gap-2.5">
                                        <div className="rounded-lg bg-purple-500/10 p-2 text-purple-600 dark:text-purple-400">
                                            <Compass className="size-5" />
                                        </div>
                                        <div>
                                            <CardTitle className="text-base font-semibold">GMB Cluster</CardTitle>
                                            <span className="text-[11px] text-muted-foreground">Analisis Kuadran & Zonasi</span>
                                        </div>
                                    </div>
                                    <Badge variant="outline" className="border-purple-500/30 px-1.5 py-0 text-[10px] text-purple-600 dark:text-purple-400">
                                        Menu Khusus
                                    </Badge>
                                </div>
                                <CardDescription className="mt-2 line-clamp-2 text-xs">
                                    Segmentasi kuadran 4 zona: Excellent, Volume, Quality, dan Improvement Zone untuk pembinaan dealer.
                                </CardDescription>
                            </CardHeader>
                            <CardContent className="pb-3">
                                <div className="grid grid-cols-2 gap-2 rounded-lg border border-border/50 bg-muted/40 p-2.5 text-xs">
                                    <div>
                                        <span className="block text-[11px] text-muted-foreground">Excellent Zone</span>
                                        <span className="text-sm font-bold text-emerald-600 dark:text-emerald-400">
                                            {gmbClusterSummary?.zones?.['EXCELLENT ZONE']?.count ?? 0} Dealer ({gmbClusterSummary?.zones?.['EXCELLENT ZONE']?.percentage ?? 0}%)
                                        </span>
                                    </div>
                                    <div>
                                        <span className="block text-[11px] text-muted-foreground">Improvement</span>
                                        <span className="text-sm font-bold text-rose-500">
                                            {gmbClusterSummary?.zones?.['IMPROVEMENT ZONE']?.count ?? 0} Dealer
                                        </span>
                                    </div>
                                </div>
                            </CardContent>
                            <CardFooter className="pt-0">
                                <Button variant="outline" size="sm" asChild className="w-full gap-1.5 text-xs font-medium hover:border-purple-500/40 hover:bg-purple-500/10 hover:text-purple-600">
                                    <Link href={gmbClusterRoute.index()}>
                                        Buka GMB Cluster
                                        <ArrowUpRight className="size-3.5" />
                                    </Link>
                                </Button>
                            </CardFooter>
                        </Card>
                    </div>
                )}

                {/* Review Text Word Cloud Visualization */}
                {(wordCloudData.length > 0 || wordCloudAllTime.length > 0) && (
                    <ReviewWordCloud
                        words={wordCloudData}
                        allTimeWords={wordCloudAllTime}
                        activeMonth={activeMonth}
                    />
                )}

                {/* Leaderboard / Performa Showroom (Only if Global and all showrooms selected) */}
                {isGlobal && !selectedDealerId && (topDealers.length > 0 || needsAttentionDealers.length > 0) && (
                    <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
                        {/* Top Rated Dealers */}
                        <Card className="flex flex-col">
                            <CardHeader className="flex flex-row items-center justify-between pb-3">
                                <div>
                                    <CardTitle className="text-base flex items-center gap-2">
                                        <Star className="size-4 text-amber-500 fill-amber-400" />
                                        Top Showroom Rating Tertinggi
                                    </CardTitle>
                                    <CardDescription>
                                        Showroom dengan reputasi Google Maps terbaik.
                                    </CardDescription>
                                </div>
                                <Button variant="ghost" size="sm" asChild className="text-xs gap-1">
                                    <Link href={dealersRoute.index.url()}>
                                        Semua <ArrowUpRight className="size-3.5" />
                                    </Link>
                                </Button>
                            </CardHeader>
                            <CardContent className="p-0 flex-1">
                                <div className="divide-y text-xs">
                                    {topDealers.map((d, index) => (
                                        <div key={d.id} className="flex items-center justify-between p-3.5 hover:bg-muted/30 transition-colors">
                                            <div className="flex items-center gap-3">
                                                <span className="flex size-6 items-center justify-center rounded-full bg-muted font-bold text-[11px] text-muted-foreground">
                                                    #{index + 1}
                                                </span>
                                                <div>
                                                    <div className="font-semibold text-foreground flex items-center gap-2">
                                                        <span>{d.nama_dealer}</span>
                                                        <span className="text-[10px] text-muted-foreground font-mono">({d.kode_dealer})</span>
                                                    </div>
                                                    <div className="text-[11px] text-muted-foreground">
                                                        {d.reviews_count ?? 0} ulasan di sistem
                                                    </div>
                                                </div>
                                            </div>
                                            <div className="text-right">
                                                <div className="inline-flex items-center gap-1 font-bold text-amber-500">
                                                    <Star className="size-3.5 fill-amber-400" />
                                                    {d.star_rate ?? '-'}
                                                </div>
                                                <div className="text-[11px] text-muted-foreground">
                                                    ({(d.total_review ?? 0).toLocaleString('id-ID')} ulasan Maps)
                                                </div>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            </CardContent>
                        </Card>

                        {/* Dealers with Rating < 4.8 */}
                        <Card className="flex flex-col justify-between">
                            <CardHeader className="flex flex-row items-center justify-between pb-3">
                                <div>
                                    <CardTitle className="text-base flex items-center gap-2">
                                        <AlertCircle className="size-4 text-rose-500" />
                                        Showroom Rating &lt; 4.8
                                        <Badge variant="secondary" className="ml-1 text-[11px] font-semibold text-rose-600 dark:text-rose-400 bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-900">
                                            {needsAttentionDealers.length} Showroom
                                        </Badge>
                                    </CardTitle>
                                    <CardDescription>
                                        Semua showroom dengan rating Google Maps di bawah 4.8.
                                    </CardDescription>
                                </div>
                                <Button variant="ghost" size="sm" asChild className="text-xs gap-1">
                                    <Link href={dealersRoute.index.url()}>
                                        Semua Showroom <ArrowUpRight className="size-3.5" />
                                    </Link>
                                </Button>
                            </CardHeader>
                            <CardContent className="p-0 flex-1">
                                {needsAttentionDealers.length === 0 ? (
                                    <div className="flex flex-col items-center justify-center p-8 text-center text-xs text-muted-foreground">
                                        <CheckCircle2 className="size-8 text-emerald-500 mb-2" />
                                        <p className="font-medium text-foreground">Semua showroom memiliki rating ≥ 4.8</p>
                                        <p className="mt-0.5 text-muted-foreground">Tidak ada showroom yang memiliki rating di bawah 4.8.</p>
                                    </div>
                                ) : (
                                    <div className="divide-y text-xs">
                                        {paginatedAttentionDealers.map((d) => (
                                            <div key={d.id} className="flex items-center justify-between p-3.5 hover:bg-muted/30 transition-colors">
                                                <div>
                                                    <div className="font-semibold text-foreground flex items-center gap-2">
                                                        <span>{d.nama_dealer}</span>
                                                        <span className="text-[10px] text-muted-foreground font-mono">({d.kode_dealer})</span>
                                                    </div>
                                                    <div className="text-[11px] text-muted-foreground flex items-center gap-2 mt-0.5">
                                                        <span className="text-amber-600 dark:text-amber-400 font-medium">
                                                            {d.unresponded_count ?? 0} ulasan belum direspons
                                                        </span>
                                                        <span>•</span>
                                                        <span>{(d.total_review ?? 0).toLocaleString('id-ID')} ulasan Maps</span>
                                                    </div>
                                                </div>
                                                <div className="text-right flex items-center gap-2">
                                                    <Badge variant="outline" className="font-mono text-amber-600 dark:text-amber-400 border-amber-500/30 bg-amber-500/10 font-bold">
                                                        ★ {d.star_rate !== null ? Number(d.star_rate).toFixed(1) : '-'}
                                                    </Badge>
                                                    <Button size="sm" variant="ghost" asChild className="h-7 px-2" title="Kelola Ulasan Showroom">
                                                        <Link href={reviewsRoute.index.url({ query: { dealer_id: d.id } })}>
                                                            <ArrowRight className="size-3.5" />
                                                        </Link>
                                                    </Button>
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                )}
                            </CardContent>
                            {needsAttentionDealers.length > attentionPageSize && (
                                <CardFooter className="flex items-center justify-between border-t px-4 py-2.5 bg-muted/10">
                                    <div className="text-[11px] text-muted-foreground">
                                        Menampilkan <span className="font-medium text-foreground">{(attentionPage - 1) * attentionPageSize + 1}</span>-
                                        <span className="font-medium text-foreground">{Math.min(attentionPage * attentionPageSize, needsAttentionDealers.length)}</span> dari{' '}
                                        <span className="font-medium text-foreground">{needsAttentionDealers.length}</span> showroom
                                    </div>
                                    <AntPagination
                                        size="small"
                                        current={attentionPage}
                                        onChange={(p) => setAttentionPage(p)}
                                        total={needsAttentionDealers.length}
                                        pageSize={attentionPageSize}
                                        showSizeChanger={false}
                                    />
                                </CardFooter>
                            )}
                        </Card>
                    </div>
                )}

                {/* Bottom Section: Ulasan Kritis Belum Direspons & Ulasan Terbaru */}
                <div className="grid grid-cols-1 gap-6 lg:grid-cols-12">
                    {/* Critical Unresponded Reviews (7 Cols) */}
                    <Card className="lg:col-span-7">
                        <CardHeader className="flex flex-row items-center justify-between pb-3">
                            <div>
                                <CardTitle className="text-base flex items-center gap-2">
                                    <Shield className="size-4 text-rose-500" />
                                    Ulasan Kritis Menunggu Respons
                                </CardTitle>
                                <CardDescription>
                                    Ulasan bintang 1-2 yang belum mendapatkan tanggapan dari dealer.
                                </CardDescription>
                            </div>
                            <Button variant="ghost" size="sm" asChild className="text-xs gap-1">
                                <Link href={reviewsRoute.index.url({ query: { star_rate: 1, respon_from_owner: 'false' } })}>
                                    Lihat Semua <ArrowRight className="size-3" />
                                </Link>
                            </Button>
                        </CardHeader>
                        <CardContent className="p-0">
                            {criticalUnresponded.length === 0 ? (
                                <div className="flex flex-col items-center justify-center p-8 text-center text-muted-foreground text-xs">
                                    <CheckCircle2 className="size-8 text-emerald-500 mb-2" />
                                    <p className="font-semibold text-foreground">Tidak Ada Ulasan Kritis Tertunda</p>
                                    <p className="mt-1">Seluruh keluhan pelanggan bintang 1-2 telah selesai ditanggapi.</p>
                                </div>
                            ) : (
                                <div className="divide-y text-xs">
                                    {criticalUnresponded.map((r) => (
                                        <div key={r.id} className="p-4 hover:bg-muted/20 transition-colors space-y-2">
                                            <div className="flex items-center justify-between">
                                                <div className="flex items-center gap-2">
                                                    <span className="font-semibold text-foreground">{r.nama_reviewer}</span>
                                                    {r.dealer && (
                                                        <Badge variant="outline" className="text-[10px] text-muted-foreground">
                                                            {r.dealer.nama_dealer}
                                                        </Badge>
                                                    )}
                                                </div>
                                                <div className="flex items-center gap-1 text-rose-500 font-bold">
                                                    <Star className="size-3 fill-rose-500" />
                                                    {r.star_rate}
                                                </div>
                                            </div>
                                            <p className="text-muted-foreground line-clamp-2 leading-relaxed">
                                                "{r.review || 'Tanpa komentar teks'}"
                                            </p>
                                            <div className="flex items-center justify-between pt-1 text-[11px] text-muted-foreground">
                                                <span>{r.tanggal_publish_review}</span>
                                                <Button size="sm" variant="outline" asChild className="h-6 px-2 text-[11px] text-primary">
                                                    <Link href={reviewsRoute.index.url({ query: { search: r.nama_reviewer } })}>
                                                        Tanggapi Review
                                                    </Link>
                                                </Button>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </CardContent>
                    </Card>

                    {/* Latest Reviews Feed (5 Cols) */}
                    <Card className="lg:col-span-5">
                        <CardHeader className="flex flex-row items-center justify-between pb-3">
                            <div>
                                <CardTitle className="text-base flex items-center gap-2">
                                    <Clock className="size-4 text-muted-foreground" />
                                    Ulasan Terbaru
                                </CardTitle>
                                <CardDescription>
                                    Ulasan terbaru yang ditarik dari Google Maps.
                                </CardDescription>
                            </div>
                            <Button variant="ghost" size="sm" asChild className="text-xs gap-1">
                                <Link href={reviewsRoute.index.url()}>
                                    Semua <ArrowRight className="size-3" />
                                </Link>
                            </Button>
                        </CardHeader>
                        <CardContent className="p-0">
                            {latestReviews.length === 0 ? (
                                <div className="p-8 text-center text-muted-foreground text-xs">
                                    Belum ada data review ulasan.
                                </div>
                            ) : (
                                <div className="divide-y text-xs">
                                    {latestReviews.map((r) => (
                                        <div key={r.id} className="p-3.5 hover:bg-muted/20 transition-colors space-y-1.5">
                                            <div className="flex items-center justify-between">
                                                <span className="font-medium text-foreground truncate max-w-[160px]">
                                                    {r.nama_reviewer}
                                                </span>
                                                <div className="flex items-center gap-1 font-semibold text-amber-500">
                                                    <Star className="size-3 fill-amber-400" />
                                                    {r.star_rate}
                                                </div>
                                            </div>
                                            <p className="text-muted-foreground line-clamp-1 text-[11px]">
                                                {r.review || '(Tanpa ulasan teks)'}
                                            </p>
                                            <div className="flex items-center justify-between text-[10px] text-muted-foreground pt-0.5">
                                                <span>{r.dealer?.nama_dealer ?? '-'}</span>
                                                {r.respon_from_owner ? (
                                                    <span className="text-emerald-600 font-medium">✓ Direspons</span>
                                                ) : (
                                                    <span className="text-amber-500">Menunggu respons</span>
                                                )}
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </CardContent>
                    </Card>
                </div>
            </div>
        </>
    );
}

Dashboard.layout = {
    breadcrumbs: [
        {
            title: 'Dashboard GBP',
            href: dashboard(),
        },
    ],
};

