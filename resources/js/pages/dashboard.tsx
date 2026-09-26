import { Head, Link, router } from '@inertiajs/react';
import {
    AlertCircle,
    ArrowRight,
    ArrowUpRight,
    Building2,
    CheckCircle2,
    Clock,
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
} from 'lucide-react';
import React from 'react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { dashboard } from '@/routes';
import dealersRoute from '@/routes/dealers';
import reviewsRoute from '@/routes/reviews';
import syncRoute from '@/routes/reviews/sync';

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
    selectedDealerId,
    isGlobal,
    userRole,
}: DashboardProps) {
    const handleDealerChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
        const value = e.target.value;
        router.get(
            dashboard(),
            value ? { dealer_id: value } : {},
            { preserveState: true, preserveScroll: true }
        );
    };

    const totalCalculated = metrics.total_reviews > 0 ? metrics.total_reviews : 1;
    const posPct = Math.round((metrics.positive_reviews / totalCalculated) * 100);
    const neuPct = Math.round((metrics.neutral_reviews / totalCalculated) * 100);
    const critPct = Math.round((metrics.critical_reviews / totalCalculated) * 100);

    const isSuperAdmin = userRole === 'super_admin';

    const getRoleBadge = (role: string) => {
        switch (role) {
            case 'super_admin':
                return <Badge className="bg-purple-600 hover:bg-purple-700">Super Admin</Badge>;
            case 'main_dealer':
                return <Badge className="bg-blue-600 hover:bg-blue-700">Main Dealer</Badge>;
            case 'dealer':
                return <Badge variant="secondary">Dealer</Badge>;
            default:
                return <Badge variant="outline">{role}</Badge>;
        }
    };

    return (
        <>
            <Head title="Dashboard - Pantau Review" />

            <div className="flex h-full flex-1 flex-col gap-6 p-4 md:p-6">
                {/* Header Section */}
                <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                    <div>
                        <div className="flex items-center gap-2">
                            <h1 className="text-2xl font-bold tracking-tight">Dashboard Monitoring</h1>
                            {getRoleBadge(userRole)}
                        </div>
                        <p className="mt-1 text-sm text-muted-foreground">
                            {currentDealer
                                ? `Memantau ulasan dan performa ${currentDealer.kode_dealer} - ${currentDealer.nama_dealer}`
                                : 'Ringkasan performa ulasan pelanggan Google Maps, rating showroom, dan respons owner.'}
                        </p>
                    </div>

                    <div className="flex flex-wrap items-center gap-2">
                        {isGlobal && dealersList.length > 0 && (
                            <div className="flex items-center gap-2">
                                <Filter className="size-4 text-muted-foreground" />
                                <select
                                    value={selectedDealerId}
                                    onChange={handleDealerChange}
                                    className={`${selectClass} w-52 sm:w-64 text-xs font-medium`}
                                >
                                    <option value="">Semua Showroom ({dealersList.length})</option>
                                    {dealersList.map((d) => (
                                        <option key={d.id} value={String(d.id)}>
                                            {d.kode_dealer} - {d.nama_dealer}
                                        </option>
                                    ))}
                                </select>
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

                {/* KPI Metrics Summary Cards */}
                <div className="grid grid-cols-2 gap-3 sm:grid-cols-2 lg:grid-cols-4 md:gap-4">
                    {/* Total Reviews */}
                    <Card>
                        <CardHeader className="flex flex-row items-center justify-between pb-2">
                            <CardTitle className="text-xs font-medium text-muted-foreground">
                                Total Ulasan Masuk
                            </CardTitle>
                            <MessageSquare className="size-4 text-muted-foreground" />
                        </CardHeader>
                        <CardContent>
                            <div className="text-2xl font-bold tracking-tight">
                                {metrics.total_reviews.toLocaleString('id-ID')}
                            </div>
                            <div className="mt-1 flex items-center gap-1.5 text-xs text-emerald-600 dark:text-emerald-400">
                                <TrendingUp className="size-3.5" />
                                <span>{posPct}% sentimen positif</span>
                            </div>
                        </CardContent>
                    </Card>

                    {/* Google Star Rating */}
                    <Card>
                        <CardHeader className="flex flex-row items-center justify-between pb-2">
                            <CardTitle className="text-xs font-medium text-muted-foreground">
                                Rata-rata Rating Google
                            </CardTitle>
                            <Star className="size-4 fill-amber-400 text-amber-500" />
                        </CardHeader>
                        <CardContent>
                            <div className="flex items-baseline gap-1">
                                <div className="text-2xl font-bold tracking-tight text-amber-500">
                                    ★ {metrics.avg_rating > 0 ? metrics.avg_rating.toFixed(1) : '-'}
                                </div>
                                <span className="text-xs text-muted-foreground">/ 5.0</span>
                            </div>
                            <p className="mt-1 text-xs text-muted-foreground">
                                Dari total ulasan Google Maps
                            </p>
                        </CardContent>
                    </Card>

                    {/* Response Rate */}
                    <Card>
                        <CardHeader className="flex flex-row items-center justify-between pb-2">
                            <CardTitle className="text-xs font-medium text-muted-foreground">
                                Respons Owner Dealer
                            </CardTitle>
                            <CheckCircle2 className="size-4 text-emerald-500" />
                        </CardHeader>
                        <CardContent>
                            <div className="text-2xl font-bold tracking-tight text-emerald-600 dark:text-emerald-400">
                                {metrics.response_rate}%
                            </div>
                            <p className="mt-1 text-xs text-muted-foreground">
                                {metrics.responded_count.toLocaleString('id-ID')} ulasan telah dijawab
                            </p>
                        </CardContent>
                    </Card>

                    {/* Pending Response (Action Required) */}
                    <Card className={metrics.unresponded_count > 0 ? 'border-amber-500/40 bg-amber-500/5 dark:bg-amber-950/10' : ''}>
                        <CardHeader className="flex flex-row items-center justify-between pb-2">
                            <CardTitle className="text-xs font-medium text-muted-foreground">
                                Belum Ditanggapi
                            </CardTitle>
                            <AlertCircle className={`size-4 ${metrics.unresponded_count > 0 ? 'text-amber-500' : 'text-muted-foreground'}`} />
                        </CardHeader>
                        <CardContent>
                            <div className="flex items-center justify-between">
                                <div className={`text-2xl font-bold tracking-tight ${metrics.unresponded_count > 0 ? 'text-amber-600 dark:text-amber-400' : ''}`}>
                                    {metrics.unresponded_count.toLocaleString('id-ID')}
                                </div>
                                {metrics.unresponded_count > 0 && (
                                    <Button variant="ghost" size="sm" asChild className="h-7 px-2 text-xs gap-1 text-amber-600 hover:text-amber-700 dark:text-amber-400">
                                        <Link href={reviewsRoute.index.url({ query: { respon_from_owner: 'false' } })}>
                                            Balas <ArrowRight className="size-3" />
                                        </Link>
                                    </Button>
                                )}
                            </div>
                            <p className="mt-1 text-xs text-muted-foreground">
                                {metrics.unresponded_count > 0 ? 'Perlu tindakan tanggapan dealer' : 'Semua ulasan telah direspons'}
                            </p>
                        </CardContent>
                    </Card>
                </div>

                {/* Middle Grid: Rating Breakdown & Response SLA */}
                <div className="grid grid-cols-1 gap-6 lg:grid-cols-12">
                    {/* Rating Distribution (7 Columns) */}
                    <Card className="lg:col-span-7 flex flex-col">
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
                                    const barColor =
                                        star >= 4
                                            ? 'bg-emerald-500'
                                            : star === 3
                                              ? 'bg-amber-400'
                                              : 'bg-rose-500';

                                    return (
                                        <div key={star} className="flex items-center gap-3 text-xs">
                                            <div className="flex w-14 items-center gap-1 font-medium shrink-0">
                                                <span>{star}</span>
                                                <Star className="size-3 fill-amber-400 text-amber-500" />
                                            </div>
                                            <div className="relative h-2.5 w-full overflow-hidden rounded-full bg-muted">
                                                <div
                                                    className={`h-full rounded-full transition-all duration-500 ${barColor}`}
                                                    style={{ width: `${percentage}%` }}
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
                    <Card className="lg:col-span-5 flex flex-col">
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
                                    <div className="h-3 w-full overflow-hidden rounded-full bg-muted">
                                        <div
                                            className="h-full bg-emerald-500 transition-all duration-500"
                                            style={{ width: `${metrics.response_rate}%` }}
                                        />
                                    </div>
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

                {/* Leaderboard / Performa Showroom (Only if Global and all showrooms selected) */}
                {isGlobal && !selectedDealerId && topDealers.length > 0 && (
                    <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
                        {/* Top Rated Dealers */}
                        <Card>
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
                            <CardContent className="p-0">
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

                        {/* Dealers Needing Attention */}
                        <Card>
                            <CardHeader className="flex flex-row items-center justify-between pb-3">
                                <div>
                                    <CardTitle className="text-base flex items-center gap-2">
                                        <AlertCircle className="size-4 text-rose-500" />
                                        Showroom Perlu Perhatian
                                    </CardTitle>
                                    <CardDescription>
                                        Showroom dengan rating terendah atau respons ulasan tertunda.
                                    </CardDescription>
                                </div>
                                <Button variant="ghost" size="sm" asChild className="text-xs gap-1">
                                    <Link href={reviewsRoute.index.url({ query: { star_rate: 1 } })}>
                                        Ulasan Kritis <ArrowUpRight className="size-3.5" />
                                    </Link>
                                </Button>
                            </CardHeader>
                            <CardContent className="p-0">
                                <div className="divide-y text-xs">
                                    {needsAttentionDealers.map((d) => (
                                        <div key={d.id} className="flex items-center justify-between p-3.5 hover:bg-muted/30 transition-colors">
                                            <div>
                                                <div className="font-semibold text-foreground flex items-center gap-2">
                                                    <span>{d.nama_dealer}</span>
                                                    <span className="text-[10px] text-muted-foreground font-mono">({d.kode_dealer})</span>
                                                </div>
                                                <div className="text-[11px] text-amber-600 dark:text-amber-400 font-medium">
                                                    {d.unresponded_count ?? 0} ulasan belum direspons
                                                </div>
                                            </div>
                                            <div className="text-right flex items-center gap-2">
                                                <Badge variant="outline" className="font-mono text-amber-600 border-amber-500/30">
                                                    ★ {d.star_rate ?? '-'}
                                                </Badge>
                                                <Button size="sm" variant="ghost" asChild className="h-7 px-2">
                                                    <Link href={reviewsRoute.index.url({ query: { dealer_id: d.id } })}>
                                                        <ArrowRight className="size-3.5" />
                                                    </Link>
                                                </Button>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            </CardContent>
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
            title: 'Dashboard',
            href: dashboard(),
        },
    ],
};

