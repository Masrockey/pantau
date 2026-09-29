import { Link } from '@inertiajs/react';
import {
    AlertCircle,
    AlertTriangle,
    CheckCircle2,
    Download,
    ExternalLink,
    Filter,
    Search,
    XCircle,
} from 'lucide-react';
import React from 'react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import reviewsRoute from '@/routes/reviews';

export type ClusterZoneType =
    | 'EXCELLENT ZONE'
    | 'VOLUME ZONE'
    | 'QUALITY ZONE'
    | 'IMPROVEMENT ZONE';

export interface GmbClusterDealerItem {
    id: number;
    kode_dealer: string;
    nama_dealer: string;
    region: string;
    gmb_score: number | null;
    total_review: number;
    cluster_zone: ClusterZoneType;
}

export interface GmbClusterSummary {
    total_dealers: number;
    avg_gmb_score: number;
    total_review_sum: number;
    zones: Record<ClusterZoneType, { count: number; percentage: number }>;
}

interface GmbClusterProps {
    dealers: GmbClusterDealerItem[];
    summary: GmbClusterSummary | null;
}

const ZONE_CONFIG: Record<
    ClusterZoneType,
    {
        name: string;
        color: string;
        dotColor: string;
        watermarkColor: string;
        bgColor: string;
        textColor: string;
        borderColor: string;
        icon: React.ComponentType<{ className?: string }>;
    }
> = {
    'EXCELLENT ZONE': {
        name: 'EXCELLENT ZONE',
        color: '#0f766e',
        dotColor: '#10b981',
        watermarkColor: '#0f766e',
        bgColor: 'bg-emerald-50 dark:bg-emerald-950/40',
        textColor: 'text-emerald-700 dark:text-emerald-300',
        borderColor: 'border-emerald-200 dark:border-emerald-800',
        icon: CheckCircle2,
    },
    'VOLUME ZONE': {
        name: 'VOLUME ZONE',
        color: '#1d4ed8',
        dotColor: '#0284c7',
        watermarkColor: '#1d4ed8',
        bgColor: 'bg-blue-50 dark:bg-blue-950/40',
        textColor: 'text-blue-700 dark:text-blue-300',
        borderColor: 'border-blue-200 dark:border-blue-800',
        icon: AlertCircle,
    },
    'IMPROVEMENT ZONE': {
        name: 'IMPROVEMENT ZONE',
        color: '#991b1b',
        dotColor: '#ef4444',
        watermarkColor: '#991b1b',
        bgColor: 'bg-rose-50 dark:bg-rose-950/40',
        textColor: 'text-rose-700 dark:text-rose-300',
        borderColor: 'border-rose-200 dark:border-rose-800',
        icon: XCircle,
    },
    'QUALITY ZONE': {
        name: 'QUALITY ZONE',
        color: '#b45309',
        dotColor: '#d97706',
        watermarkColor: '#b45309',
        bgColor: 'bg-amber-50 dark:bg-amber-950/40',
        textColor: 'text-amber-800 dark:text-amber-300',
        borderColor: 'border-amber-200 dark:border-amber-800',
        icon: AlertTriangle,
    },
};

export function GmbCluster({ dealers = [], summary = null }: GmbClusterProps) {
    const [searchQuery, setSearchQuery] = React.useState('');
    const [selectedZoneFilter, setSelectedZoneFilter] = React.useState<ClusterZoneType | 'ALL'>('ALL');
    const [hoveredDealer, setHoveredDealer] = React.useState<GmbClusterDealerItem | null>(null);
    const [activeDealerId, setActiveDealerId] = React.useState<number | null>(null);

    // Filter dealers based on search and zone filter
    const filteredDealers = React.useMemo(() => {
        return dealers.filter((d) => {
            const matchesSearch =
                searchQuery.trim() === '' ||
                d.nama_dealer.toLowerCase().includes(searchQuery.toLowerCase()) ||
                d.kode_dealer.toLowerCase().includes(searchQuery.toLowerCase());

            const matchesZone =
                selectedZoneFilter === 'ALL' || d.cluster_zone === selectedZoneFilter;

            return matchesSearch && matchesZone;
        });
    }, [dealers, searchQuery, selectedZoneFilter]);

    // Sorting: default descending by total reviews
    const [sortKey, setSortKey] = React.useState<'nama_dealer' | 'gmb_score' | 'total_review' | 'cluster_zone'>('total_review');
    const [sortDir, setSortDir] = React.useState<'asc' | 'desc'>('desc');

    const sortedDealers = React.useMemo(() => {
        return [...filteredDealers].sort((a, b) => {
            let valA = a[sortKey];
            let valB = b[sortKey];

            if (valA === null || valA === undefined) valA = 0;
            if (valB === null || valB === undefined) valB = 0;

            if (typeof valA === 'string' && typeof valB === 'string') {
                return sortDir === 'asc'
                    ? valA.localeCompare(valB)
                    : valB.localeCompare(valA);
            }

            const numA = Number(valA);
            const numB = Number(valB);
            return sortDir === 'asc' ? numA - numB : numB - numA;
        });
    }, [filteredDealers, sortKey, sortDir]);

    // Summary numbers calculated or from props
    const computedSummary = React.useMemo(() => {
        if (summary) return summary;

        const totalDealers = dealers.length;
        const totalReviewSum = dealers.reduce((acc, d) => acc + (d.total_review || 0), 0);
        const validScores = dealers.filter((d) => d.gmb_score !== null);
        const avgScore =
            validScores.length > 0
                ? validScores.reduce((acc, d) => acc + (d.gmb_score || 0), 0) / validScores.length
                : 0;

        const counts: Record<ClusterZoneType, number> = {
            'IMPROVEMENT ZONE': 0,
            'VOLUME ZONE': 0,
            'EXCELLENT ZONE': 0,
            'QUALITY ZONE': 0,
        };

        for (const d of dealers) {
            counts[d.cluster_zone] = (counts[d.cluster_zone] || 0) + 1;
        }

        return {
            total_dealers: totalDealers,
            avg_gmb_score: round2(avgScore),
            total_review_sum: totalReviewSum,
            zones: {
                'IMPROVEMENT ZONE': {
                    count: counts['IMPROVEMENT ZONE'],
                    percentage: totalDealers > 0 ? round2((counts['IMPROVEMENT ZONE'] / totalDealers) * 100) : 0,
                },
                'VOLUME ZONE': {
                    count: counts['VOLUME ZONE'],
                    percentage: totalDealers > 0 ? round2((counts['VOLUME ZONE'] / totalDealers) * 100) : 0,
                },
                'EXCELLENT ZONE': {
                    count: counts['EXCELLENT ZONE'],
                    percentage: totalDealers > 0 ? round2((counts['EXCELLENT ZONE'] / totalDealers) * 100) : 0,
                },
                'QUALITY ZONE': {
                    count: counts['QUALITY ZONE'],
                    percentage: totalDealers > 0 ? round2((counts['QUALITY ZONE'] / totalDealers) * 100) : 0,
                },
            },
        };
    }, [dealers, summary]);

    function round2(num: number): number {
        return Math.round(num * 100) / 100;
    }

    // Export CSV handler
    const handleExportCsv = () => {
        const rows = [
            ['NAMA DEALER', 'REGION', 'GMB SCORE', 'J. REVIEW ALL', 'CLUSTER ZONE'],
            ...sortedDealers.map((d) => [
                `"${d.nama_dealer.replace(/"/g, '""')}"`,
                d.region,
                d.gmb_score !== null ? d.gmb_score.toFixed(2) : '',
                d.total_review,
                d.cluster_zone,
            ]),
            [
                'TOTAL',
                'NTB',
                computedSummary.avg_gmb_score.toFixed(2),
                computedSummary.total_review_sum,
                `${computedSummary.total_dealers} DEALERS`,
            ],
        ];

        const csvContent = rows.map((r) => r.join(',')).join('\n');
        const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `GMB_Cluster_Dealers_${new Date().toISOString().slice(0, 10)}.csv`;
        a.click();
        URL.revokeObjectURL(url);
    };

    // Scatter plot coordinate calculations (Logarithmic X, Linear Y)
    const svgWidth = 920;
    const svgHeight = 560;
    const plotMargin = { top: 35, right: 35, bottom: 55, left: 65 };
    const plotW = svgWidth - plotMargin.left - plotMargin.right;
    const plotH = svgHeight - plotMargin.top - plotMargin.bottom;

    // Log scale domain: 1 to 200,000 (log10(1) = 0, log10(100000) = 5, log10(200000) ~ 5.301)
    const maxLog = 5.301;
    const getXCoord = (reviews: number) => {
        const val = Math.max(reviews, 1);
        const logVal = Math.log10(val);
        const ratio = Math.min(Math.max(logVal / maxLog, 0), 1);
        return plotMargin.left + ratio * plotW;
    };

    // Y scale domain: 3.0 to 5.7 (giving nice headroom above 5.0 for 5.5 and 6.0 labels)
    const yMin = 3.0;
    const yMax = 5.6;
    const getYCoord = (rating: number | null) => {
        const score = rating !== null ? rating : 3.0;
        const clamped = Math.min(Math.max(score, yMin), yMax);
        const ratio = (clamped - yMin) / (yMax - yMin);
        return plotMargin.top + plotH - ratio * plotH;
    };

    // Threshold lines
    const thresholdX = getXCoord(1000); // 1000 reviews
    const thresholdY = getYCoord(4.7); // 4.7 rating

    // X-axis log ticks: 1, 10, 100, 1000, 10000, 100000
    const xTicks = [1, 10, 100, 1000, 10000, 100000];

    // Y-axis ticks: 3.0, 3.5, 4.0, 4.5, 5.0, 5.5, 6.0
    const yTicks = [3.0, 3.5, 4.0, 4.5, 5.0, 5.5, 6.0];

    return (
        <div className="flex flex-col gap-5">
            {/* Top Grid: Left Side Table & Bar Chart, Right Side Quadrant Scatter Plot */}
            <div className="grid grid-cols-1 gap-5 lg:grid-cols-12 items-start">
                {/* Left Column (5 Cols): Table + Cluster Dealer Bar Chart */}
                <div className="flex flex-col gap-5 lg:col-span-5">
                    {/* Part 1: Table - Exact Match with Reference Screenshot */}
                    <Card className="flex flex-col border shadow-sm overflow-hidden bg-background">
                        {/* Table Controls / Search & Zone Filters */}
                        <div className="flex flex-wrap items-center justify-between gap-2 p-2.5 bg-muted/20 border-b text-xs">
                            <div className="relative flex-1 min-w-[130px]">
                                <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 size-3 text-muted-foreground" />
                                <input
                                    type="text"
                                    placeholder="Cari dealer..."
                                    value={searchQuery}
                                    onChange={(e) => setSearchQuery(e.target.value)}
                                    className="h-7 w-full rounded border bg-background pl-7 pr-2 text-xs focus:outline-none focus:ring-1 focus:ring-primary"
                                />
                                {searchQuery && (
                                    <button
                                        onClick={() => setSearchQuery('')}
                                        className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground cursor-pointer"
                                    >
                                        ×
                                    </button>
                                )}
                            </div>

                            {/* Zone Filter Pill */}
                            <select
                                value={selectedZoneFilter}
                                onChange={(e) => setSelectedZoneFilter(e.target.value as ClusterZoneType | 'ALL')}
                                className="h-7 rounded border bg-background px-2 text-xs font-medium cursor-pointer focus:outline-none focus:ring-1 focus:ring-primary"
                            >
                                <option value="ALL">Semua Cluster</option>
                                <option value="EXCELLENT ZONE">Excellent Zone</option>
                                <option value="VOLUME ZONE">Volume Zone</option>
                                <option value="IMPROVEMENT ZONE">Improvement Zone</option>
                                <option value="QUALITY ZONE">Quality Zone</option>
                            </select>

                            <Button
                                variant="outline"
                                size="sm"
                                onClick={handleExportCsv}
                                className="h-7 px-2 text-xs gap-1 cursor-pointer"
                                title="Download CSV"
                            >
                                <Download className="size-3" />
                            </Button>
                        </div>

                        {/* Scrollable Table Content */}
                        <div className="relative overflow-x-auto max-h-[380px] overflow-y-auto">
                            <table className="w-full text-[11px] border-collapse text-foreground select-text whitespace-nowrap">
                                <thead className="sticky top-0 z-20">
                                    <tr className="bg-[#0b3b6f] text-white text-center font-bold tracking-wider uppercase">
                                        <th
                                            onClick={() => {
                                                setSortKey('nama_dealer');
                                                setSortDir(sortDir === 'asc' ? 'desc' : 'asc');
                                            }}
                                            className="px-2.5 py-2 text-left cursor-pointer hover:bg-[#092e57] transition-colors border-r border-blue-900/40"
                                        >
                                            NAMA DEALER
                                        </th>
                                        <th className="px-2 py-2 text-center border-r border-blue-900/40 w-14">
                                            REGION
                                        </th>
                                        <th
                                            onClick={() => {
                                                setSortKey('gmb_score');
                                                setSortDir(sortDir === 'asc' ? 'desc' : 'asc');
                                            }}
                                            className="px-2 py-2 text-center cursor-pointer hover:bg-[#092e57] transition-colors border-r border-blue-900/40 w-18"
                                        >
                                            GMB SCORE
                                        </th>
                                        <th
                                            onClick={() => {
                                                setSortKey('total_review');
                                                setSortDir(sortDir === 'asc' ? 'desc' : 'asc');
                                            }}
                                            className="px-2 py-2 text-center cursor-pointer hover:bg-[#092e57] transition-colors border-r border-blue-900/40 w-20"
                                        >
                                            J. REVIEW ALL
                                        </th>
                                        <th
                                            onClick={() => {
                                                setSortKey('cluster_zone');
                                                setSortDir(sortDir === 'asc' ? 'desc' : 'asc');
                                            }}
                                            className="px-2.5 py-2 text-left cursor-pointer hover:bg-[#092e57] transition-colors"
                                        >
                                            Cluster Zone
                                        </th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-border/60 font-mono text-[11px]">
                                    {sortedDealers.length === 0 ? (
                                        <tr>
                                            <td colSpan={5} className="p-6 text-center text-muted-foreground font-sans">
                                                Tidak ada dealer yang cocok dengan kriteria pencarian.
                                            </td>
                                        </tr>
                                    ) : (
                                        sortedDealers.map((d) => {
                                            const config = ZONE_CONFIG[d.cluster_zone];
                                            const Icon = config.icon;
                                            const isSelected = activeDealerId === d.id || hoveredDealer?.id === d.id;

                                            return (
                                                <tr
                                                    key={d.id}
                                                    onMouseEnter={() => setHoveredDealer(d)}
                                                    onMouseLeave={() => setHoveredDealer(null)}
                                                    onClick={() => setActiveDealerId(activeDealerId === d.id ? null : d.id)}
                                                    className={`transition-colors cursor-pointer ${
                                                        isSelected
                                                            ? 'bg-blue-50/80 dark:bg-blue-950/40 font-semibold'
                                                            : 'hover:bg-muted/40'
                                                    }`}
                                                >
                                                    <td className="px-2.5 py-1.5 font-sans font-medium text-foreground truncate max-w-[170px]" title={d.nama_dealer}>
                                                        {d.nama_dealer}
                                                    </td>
                                                    <td className="px-2 py-1.5 text-center text-muted-foreground font-sans">
                                                        {d.region}
                                                    </td>
                                                    <td className="px-2 py-1.5 text-center font-bold text-foreground">
                                                        {d.gmb_score !== null ? d.gmb_score.toFixed(2) : '-'}
                                                    </td>
                                                    <td className="px-2 py-1.5 text-right pr-4 font-bold text-foreground">
                                                        {d.total_review.toLocaleString('id-ID')}
                                                    </td>
                                                    <td className="px-2.5 py-1.5 font-sans">
                                                        <div className="flex items-center gap-1.5">
                                                            <Icon className={`size-3.5 shrink-0 ${config.textColor}`} />
                                                            <span
                                                                className={`text-[10px] font-bold tracking-tight uppercase ${config.textColor}`}
                                                            >
                                                                {d.cluster_zone}
                                                            </span>
                                                        </div>
                                                    </td>
                                                </tr>
                                            );
                                        })
                                    )}
                                </tbody>
                                {/* Total Row */}
                                <tfoot className="sticky bottom-0 z-10 bg-slate-900 text-white font-bold text-[11px] shadow-sm">
                                    <tr className="border-t border-slate-700">
                                        <td className="px-2.5 py-2 font-sans">Total</td>
                                        <td className="px-2 py-2 text-center font-sans">NTB</td>
                                        <td className="px-2 py-2 text-center font-mono text-amber-400">
                                            {computedSummary.avg_gmb_score.toFixed(2)}
                                        </td>
                                        <td className="px-2 py-2 text-right pr-4 font-mono text-emerald-400">
                                            {computedSummary.total_review_sum.toLocaleString('id-ID')}
                                        </td>
                                        <td className="px-2.5 py-2 font-sans text-slate-300">
                                            {computedSummary.total_dealers} Dealer
                                        </td>
                                    </tr>
                                </tfoot>
                            </table>
                        </div>
                    </Card>

                    {/* Part 2: CLUSTER DEALER Bar Chart - Exact Match to Screenshot */}
                    <Card className="flex flex-col border shadow-sm overflow-hidden bg-background">
                        {/* Header Banner */}
                        <div className="bg-[#0b3b6f] py-2 px-4 text-center select-none shadow-xs">
                            <h3 className="text-white text-sm font-bold tracking-wider uppercase font-sans">
                                CLUSTER DEALER
                            </h3>
                        </div>

                        {/* Legend */}
                        <div className="flex items-center gap-4 px-4 py-2 bg-muted/20 border-b text-[11px] text-muted-foreground font-medium">
                            <div className="flex items-center gap-1.5">
                                <span className="size-2.5 rounded-full bg-[#60a5fa] inline-block" />
                                <span>JUMLAH DEALER</span>
                            </div>
                            <div className="flex items-center gap-1.5">
                                <span className="size-2.5 rounded-full bg-slate-700 dark:bg-slate-300 inline-block" />
                                <span>%CONT</span>
                            </div>
                        </div>

                        {/* Horizontal Bars */}
                        <CardContent className="p-4 space-y-3.5">
                            {(
                                [
                                    'IMPROVEMENT ZONE',
                                    'VOLUME ZONE',
                                    'EXCELLENT ZONE',
                                    'QUALITY ZONE',
                                ] as ClusterZoneType[]
                            ).map((zoneKey) => {
                                const zoneData = computedSummary.zones[zoneKey];
                                const maxCount = Math.max(
                                    ...Object.values(computedSummary.zones).map((z) => z.count),
                                    1
                                );
                                const barWidthPct = Math.max((zoneData.count / maxCount) * 100, 2);
                                const isSelected = selectedZoneFilter === zoneKey;

                                return (
                                    <div
                                        key={zoneKey}
                                        onClick={() =>
                                            setSelectedZoneFilter(
                                                selectedZoneFilter === zoneKey ? 'ALL' : zoneKey
                                            )
                                        }
                                        className={`group cursor-pointer p-1.5 rounded transition-colors ${
                                            isSelected ? 'bg-muted/80 ring-1 ring-primary' : 'hover:bg-muted/30'
                                        }`}
                                    >
                                        <div className="flex items-center justify-between text-xs mb-1">
                                            <span className="font-bold text-foreground tracking-tight text-[11px] uppercase">
                                                {zoneKey}
                                            </span>
                                        </div>

                                        <div className="flex items-center gap-3">
                                            {/* Bar Track */}
                                            <div className="flex-1 bg-muted/50 rounded-sm h-6 relative overflow-hidden flex items-center">
                                                <div
                                                    className="bg-[#60a5fa] h-full rounded-sm transition-all duration-500 flex items-center px-2"
                                                    style={{ width: `${barWidthPct}%` }}
                                                />
                                                {/* Percentage text */}
                                                <span className="absolute left-2 text-[11px] font-bold text-slate-900 drop-shadow-2xs select-none">
                                                    {zoneData.percentage.toFixed(2)}%
                                                </span>
                                            </div>

                                            {/* Count Number on Right */}
                                            <span className="text-xs font-bold text-foreground w-8 text-right font-mono">
                                                {zoneData.count}
                                            </span>
                                        </div>
                                    </div>
                                );
                            })}
                        </CardContent>
                    </Card>
                </div>

                {/* Right Column (7 Cols): GMB CLUSTER Scatter Plot Quadrant Matrix */}
                <Card className="flex flex-col border shadow-sm overflow-hidden bg-background lg:col-span-7">
                    {/* Header Banner */}
                    <div className="bg-[#0b3b6f] py-2 px-4 text-center select-none shadow-xs">
                        <h3 className="text-white text-sm sm:text-base font-bold tracking-wider uppercase font-sans">
                            GMB CLUSTER
                        </h3>
                    </div>

                    {/* Legend Banner */}
                    <div className="flex flex-wrap items-center gap-x-4 gap-y-1.5 px-4 py-2 border-b bg-muted/20 text-xs">
                        <span className="font-bold text-muted-foreground text-[11px]">Cluster Zone:</span>
                        <div className="flex items-center gap-1.5 text-[11px]">
                            <span className="size-2.5 rounded-full bg-[#10b981] inline-block" />
                            <span className="font-semibold text-emerald-700 dark:text-emerald-400">
                                EXCELLENT ZONE
                            </span>
                        </div>
                        <div className="flex items-center gap-1.5 text-[11px]">
                            <span className="size-2.5 rounded-full bg-[#ef4444] inline-block" />
                            <span className="font-semibold text-rose-700 dark:text-rose-400">
                                IMPROVEMENT ZONE
                            </span>
                        </div>
                        <div className="flex items-center gap-1.5 text-[11px]">
                            <span className="size-2.5 rounded-full bg-[#d97706] inline-block" />
                            <span className="font-semibold text-amber-700 dark:text-amber-400">
                                QUALITY ZONE
                            </span>
                        </div>
                        <div className="flex items-center gap-1.5 text-[11px]">
                            <span className="size-2.5 rounded-full bg-[#0284c7] inline-block" />
                            <span className="font-semibold text-blue-700 dark:text-blue-400">
                                VOLUME ZONE
                            </span>
                        </div>
                    </div>

                    {/* Scatter Plot SVG Area */}
                    <CardContent className="p-2 relative flex-1 min-h-[520px] bg-white dark:bg-card overflow-hidden">
                        <svg
                            viewBox={`0 0 ${svgWidth} ${svgHeight}`}
                            className="w-full h-auto select-none"
                            style={{ fontFeatureSettings: '"tnum"' }}
                        >
                            {/* Grid Lines - Horizontal */}
                            {yTicks.map((tick) => {
                                const y = getYCoord(tick);
                                return (
                                    <g key={`y-grid-${tick}`}>
                                        <line
                                            x1={plotMargin.left}
                                            y1={y}
                                            x2={plotMargin.left + plotW}
                                            y2={y}
                                            stroke="#e2e8f0"
                                            strokeDasharray="2 3"
                                            strokeWidth={1}
                                        />
                                        <text
                                            x={plotMargin.left - 10}
                                            y={y + 4}
                                            textAnchor="end"
                                            fontSize={11}
                                            fill="#64748b"
                                            fontWeight={600}
                                            fontFamily="monospace"
                                        >
                                            {tick.toFixed(1)}
                                        </text>
                                    </g>
                                );
                            })}

                            {/* Grid Lines - Vertical (Logarithmic) */}
                            {xTicks.map((tick) => {
                                const x = getXCoord(tick);
                                return (
                                    <g key={`x-grid-${tick}`}>
                                        <line
                                            x1={x}
                                            y1={plotMargin.top}
                                            x2={x}
                                            y2={plotMargin.top + plotH}
                                            stroke="#e2e8f0"
                                            strokeDasharray="2 3"
                                            strokeWidth={1}
                                        />
                                        <text
                                            x={x}
                                            y={plotMargin.top + plotH + 18}
                                            textAnchor="middle"
                                            fontSize={11}
                                            fill="#64748b"
                                            fontWeight={600}
                                            fontFamily="monospace"
                                        >
                                            {tick}
                                        </text>
                                    </g>
                                );
                            })}

                            {/* Quadrant Watermark Labels & Counts - Exactly as in Screenshot */}
                            {/* Top Left: VOLUME ZONE (Blue) */}
                            <g transform={`translate(${plotMargin.left + plotW * 0.22}, ${plotMargin.top + plotH * 0.12})`}>
                                <text
                                    x={0}
                                    y={0}
                                    fill="#2563eb"
                                    fontSize={22}
                                    fontWeight={900}
                                    letterSpacing="0.05em"
                                    fontFamily="system-ui, sans-serif"
                                >
                                    VOLUME
                                </text>
                                <text
                                    x={0}
                                    y={22}
                                    fill="#2563eb"
                                    fontSize={22}
                                    fontWeight={900}
                                    letterSpacing="0.05em"
                                    fontFamily="system-ui, sans-serif"
                                >
                                    ZONE
                                </text>
                                <text
                                    x={105}
                                    y={20}
                                    fill="#2563eb"
                                    fontSize={42}
                                    fontWeight={800}
                                    fontFamily="system-ui, sans-serif"
                                >
                                    {computedSummary.zones['VOLUME ZONE'].count}
                                </text>
                            </g>

                            {/* Top Right: EXCELLENT ZONE (Green) */}
                            <g transform={`translate(${plotMargin.left + plotW * 0.70}, ${plotMargin.top + plotH * 0.12})`}>
                                <text
                                    x={0}
                                    y={0}
                                    fill="#047857"
                                    fontSize={22}
                                    fontWeight={900}
                                    letterSpacing="0.05em"
                                    fontFamily="system-ui, sans-serif"
                                >
                                    EXCELLENT
                                </text>
                                <text
                                    x={30}
                                    y={22}
                                    fill="#047857"
                                    fontSize={22}
                                    fontWeight={900}
                                    letterSpacing="0.05em"
                                    fontFamily="system-ui, sans-serif"
                                >
                                    ZONE
                                </text>
                                <text
                                    x={125}
                                    y={20}
                                    fill="#047857"
                                    fontSize={42}
                                    fontWeight={800}
                                    fontFamily="system-ui, sans-serif"
                                >
                                    {computedSummary.zones['EXCELLENT ZONE'].count}
                                </text>
                            </g>

                            {/* Bottom Left: IMPROVEMENT ZONE (Red) */}
                            <g transform={`translate(${plotMargin.left + plotW * 0.18}, ${plotMargin.top + plotH * 0.74})`}>
                                <text
                                    x={0}
                                    y={0}
                                    fill="#991b1b"
                                    fontSize={22}
                                    fontWeight={900}
                                    letterSpacing="0.05em"
                                    fontFamily="system-ui, sans-serif"
                                >
                                    IMPROVEMENT
                                </text>
                                <text
                                    x={45}
                                    y={22}
                                    fill="#991b1b"
                                    fontSize={22}
                                    fontWeight={900}
                                    letterSpacing="0.05em"
                                    fontFamily="system-ui, sans-serif"
                                >
                                    ZONE
                                </text>
                                <text
                                    x={150}
                                    y={20}
                                    fill="#991b1b"
                                    fontSize={42}
                                    fontWeight={800}
                                    fontFamily="system-ui, sans-serif"
                                >
                                    {computedSummary.zones['IMPROVEMENT ZONE'].count}
                                </text>
                            </g>

                            {/* Bottom Right: QUALITY ZONE (Brown) */}
                            <g transform={`translate(${plotMargin.left + plotW * 0.72}, ${plotMargin.top + plotH * 0.74})`}>
                                <text
                                    x={0}
                                    y={0}
                                    fill="#b45309"
                                    fontSize={22}
                                    fontWeight={900}
                                    letterSpacing="0.05em"
                                    fontFamily="system-ui, sans-serif"
                                >
                                    QUALITY
                                </text>
                                <text
                                    x={15}
                                    y={22}
                                    fill="#b45309"
                                    fontSize={22}
                                    fontWeight={900}
                                    letterSpacing="0.05em"
                                    fontFamily="system-ui, sans-serif"
                                >
                                    ZONE
                                </text>
                                <text
                                    x={105}
                                    y={20}
                                    fill="#b45309"
                                    fontSize={42}
                                    fontWeight={800}
                                    fontFamily="system-ui, sans-serif"
                                >
                                    {computedSummary.zones['QUALITY ZONE'].count}
                                </text>
                            </g>

                            {/* Quadrant Divider Dashed Lines */}
                            {/* Vertical Line at 1000 reviews */}
                            <line
                                x1={thresholdX}
                                y1={plotMargin.top}
                                x2={thresholdX}
                                y2={plotMargin.top + plotH}
                                stroke="#1e293b"
                                strokeDasharray="5 5"
                                strokeWidth={1.75}
                            />
                            {/* Horizontal Line at 4.7 rating */}
                            <line
                                x1={plotMargin.left}
                                y1={thresholdY}
                                x2={plotMargin.left + plotW}
                                y2={thresholdY}
                                stroke="#1e293b"
                                strokeDasharray="5 5"
                                strokeWidth={1.75}
                            />

                            {/* Axis Labels */}
                            <text
                                x={plotMargin.left + plotW / 2}
                                y={svgHeight - 12}
                                textAnchor="middle"
                                fontSize={13}
                                fontWeight={800}
                                fill="#0f172a"
                                letterSpacing="0.05em"
                            >
                                JUMLAH REVIEW
                            </text>

                            <text
                                transform={`rotate(-90) translate(-${plotMargin.top + plotH / 2}, 18)`}
                                textAnchor="middle"
                                fontSize={13}
                                fontWeight={800}
                                fill="#0f172a"
                                letterSpacing="0.05em"
                            >
                                RATING
                            </text>

                            {/* Data Points (Dealers) */}
                            {dealers.map((dealer) => {
                                const cx = getXCoord(dealer.total_review);
                                const cy = getYCoord(dealer.gmb_score);
                                const config = ZONE_CONFIG[dealer.cluster_zone];
                                const isHovered = hoveredDealer?.id === dealer.id;
                                const isSelected = activeDealerId === dealer.id;
                                const isDimmed =
                                    selectedZoneFilter !== 'ALL' && dealer.cluster_zone !== selectedZoneFilter;

                                return (
                                    <g
                                        key={dealer.id}
                                        className="cursor-pointer transition-all duration-150"
                                        opacity={isDimmed ? 0.2 : 1}
                                        onMouseEnter={() => setHoveredDealer(dealer)}
                                        onMouseLeave={() => setHoveredDealer(null)}
                                        onClick={() =>
                                            setActiveDealerId(activeDealerId === dealer.id ? null : dealer.id)
                                        }
                                    >
                                        {/* Point Circle */}
                                        <circle
                                            cx={cx}
                                            cy={cy}
                                            r={isHovered || isSelected ? 6.5 : 4.5}
                                            fill={config.dotColor}
                                            stroke="#ffffff"
                                            strokeWidth={1.5}
                                            className="transition-all duration-150"
                                        />

                                        {/* Highlight Ring */}
                                        {(isHovered || isSelected) && (
                                            <circle
                                                cx={cx}
                                                cy={cy}
                                                r={11}
                                                fill="none"
                                                stroke={config.dotColor}
                                                strokeWidth={2}
                                                opacity={0.6}
                                                className="animate-pulse"
                                            />
                                        )}

                                        {/* Dealer Name Pill Tag - Sesuai Gambar */}
                                        <g transform={`translate(${cx}, ${cy - 8})`}>
                                            <rect
                                                x={-Math.min(dealer.nama_dealer.length * 2.8 + 6, 65)}
                                                y={-12}
                                                width={Math.min(dealer.nama_dealer.length * 5.6 + 12, 130)}
                                                height={13}
                                                rx={2}
                                                fill="#f1f5f9"
                                                fillOpacity={0.88}
                                                stroke="#cbd5e1"
                                                strokeWidth={0.5}
                                            />
                                            <text
                                                x={0}
                                                y={-3}
                                                textAnchor="middle"
                                                fontSize={8.5}
                                                fontWeight={600}
                                                fill="#334155"
                                                fontFamily="system-ui, sans-serif"
                                            >
                                                {dealer.nama_dealer.length > 20
                                                    ? dealer.nama_dealer.slice(0, 19) + '…'
                                                    : dealer.nama_dealer}
                                            </text>
                                        </g>
                                    </g>
                                );
                            })}

                            {/* Active/Hovered Tooltip Popover */}
                            {hoveredDealer && (
                                <g
                                    transform={`translate(${getXCoord(hoveredDealer.total_review)}, ${
                                        getYCoord(hoveredDealer.gmb_score) - 25
                                    })`}
                                    className="pointer-events-none"
                                >
                                    <g transform="translate(-110, -56)">
                                        <rect
                                            width={220}
                                            height={52}
                                            rx={6}
                                            fill="#1e293b"
                                            filter="drop-shadow(0 4px 8px rgba(0,0,0,0.3))"
                                        />
                                        <polygon points="105,52 115,52 110,58" fill="#1e293b" />
                                        <text
                                            x={10}
                                            y={18}
                                            fill="#f8fafc"
                                            fontSize={11}
                                            fontWeight={700}
                                            fontFamily="system-ui, sans-serif"
                                        >
                                            {hoveredDealer.nama_dealer.length > 26
                                                ? hoveredDealer.nama_dealer.slice(0, 25) + '…'
                                                : hoveredDealer.nama_dealer}
                                        </text>
                                        <text
                                            x={10}
                                            y={34}
                                            fill="#94a3b8"
                                            fontSize={10}
                                            fontFamily="monospace"
                                        >
                                            Rating: {hoveredDealer.gmb_score?.toFixed(2) ?? '-'} | Review: {hoveredDealer.total_review.toLocaleString('id-ID')}
                                        </text>
                                        <text
                                            x={10}
                                            y={46}
                                            fill={ZONE_CONFIG[hoveredDealer.cluster_zone].dotColor}
                                            fontSize={9}
                                            fontWeight={700}
                                            letterSpacing="0.05em"
                                        >
                                            {hoveredDealer.cluster_zone}
                                        </text>
                                    </g>
                                </g>
                            )}
                        </svg>
                    </CardContent>
                </Card>
            </div>
        </div>
    );
}

export default GmbCluster;
