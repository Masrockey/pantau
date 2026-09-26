import { Head, Link, router } from '@inertiajs/react';
import {
    AlertCircle,
    ArrowLeft,
    CheckCircle2,
    Clock,
    Copy,
    ExternalLink,
    HelpCircle,
    Info,
    Loader2,
    Play,
    RefreshCw,
    RotateCcw,
    Search,
    Shield,
    ShieldCheck,
    Square,
    Star,
    Terminal,
    Trash2,
} from 'lucide-react';
import React, { useEffect, useRef, useState } from 'react';
import { toast } from 'sonner';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Checkbox } from '@/components/ui/checkbox';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { dashboard } from '@/routes';
import dealersRoute from '@/routes/dealers';
import reviewsRoute from '@/routes/reviews';
import syncRoute from '@/routes/reviews/sync';

interface SyncDealer {
    id: number;
    kode_dealer: string;
    nama_dealer: string;
    link_google_maps: string | null;
    star_rate: number | null;
    total_review: number | null;
    reviews_count?: number;
}

interface SyncStats {
    total_dealers: number;
    dealers_with_maps: number;
    dealers_without_maps: number;
    total_reviews_db: number;
}

interface SyncServerStatus {
    status: 'idle' | 'starting' | 'running' | 'completed' | 'failed' | 'cancelled';
    syncMessage: string;
    syncError?: string | null;
    progressPercent: number;
    bulkProgress?: {
        current: number;
        total: number;
        currentDealerName: string;
        currentImported: number;
        currentUpdated: number;
    } | null;
    syncResult?: {
        imported: number;
        updated: number;
        total_scraped: number;
        dealer_nama?: string;
        dealer_rating?: number;
        dealer_total_review?: number;
    } | null;
    startedAt?: number | null;
    target?: string | null;
}

interface SyncPageProps {
    dealers: SyncDealer[];
    stats: SyncStats;
    serverStatus?: SyncServerStatus;
    serverLogs?: LogEntry[];
    canManageAll?: boolean;
}

interface LogEntry {
    id: string;
    time: string;
    type: 'info' | 'success' | 'warn' | 'error';
    message: string;
}

const selectClass =
    'h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-xs transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring dark:bg-background';

export default function SyncReviewsPage({
    dealers,
    stats,
    serverStatus,
    serverLogs = [],
    canManageAll = true,
}: SyncPageProps) {
    // Health and proxy state
    const [scraperOnline, setScraperOnline] = useState<boolean | null>(null);
    const [proxyInfo, setProxyInfo] = useState<{
        enabled: boolean;
        totalLoaded?: number;
        deadCount?: number;
    } | null>(null);
    const [isCheckingHealth, setIsCheckingHealth] = useState(false);

    // Form settings
    const defaultDealer = canManageAll
        ? 'all'
        : dealers[0]?.id
          ? String(dealers[0].id)
          : '';
    const [selectedDealerId, setSelectedDealerId] = useState<string>(defaultDealer);
    const [maxReviews, setMaxReviews] = useState<number | string>(50);
    const [sortBy, setSortBy] = useState<string>('newest');
    const [useProxy, setUseProxy] = useState<boolean>(true);

    // Server-driven execution & progress state
    const [syncState, setSyncState] = useState<
        'idle' | 'starting' | 'running' | 'completed' | 'failed' | 'cancelled'
    >(serverStatus?.status ?? 'idle');
    const [syncMessage, setSyncMessage] = useState<string>(serverStatus?.syncMessage ?? '');
    const [syncError, setSyncError] = useState<string | null>(serverStatus?.syncError ?? null);
    const [progressPercent, setProgressPercent] = useState<number>(serverStatus?.progressPercent ?? 0);
    const [bulkProgress, setBulkProgress] = useState(serverStatus?.bulkProgress ?? null);
    const [syncResult, setSyncResult] = useState(serverStatus?.syncResult ?? null);

    // Server activity logs
    const [logs, setLogs] = useState<LogEntry[]>(serverLogs);
    const logContainerRef = useRef<HTMLDivElement>(null);
    const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

    // Quick table search & filter
    const [tableSearch, setTableSearch] = useState('');
    const [filterMapsOnly, setFilterMapsOnly] = useState<'all' | 'with_maps' | 'without_maps'>('all');

    // Polling function: connects to server cache
    const startPolling = () => {
        if (pollRef.current) {
            clearInterval(pollRef.current);
        }

        pollRef.current = setInterval(async () => {
            try {
                const res = await fetch(syncRoute.progress.url(), {
                    headers: { Accept: 'application/json' },
                });
                if (!res.ok) return;

                const data = await res.json();
                const status: SyncServerStatus = data.status || {};
                const sLogs: LogEntry[] = data.logs || [];

                setSyncState(status.status);
                setSyncMessage(status.syncMessage || '');
                setSyncError(status.syncError ?? null);
                setProgressPercent(status.progressPercent ?? 0);
                setBulkProgress(status.bulkProgress ?? null);
                setSyncResult(status.syncResult ?? null);
                if (Array.isArray(sLogs)) {
                    setLogs(sLogs);
                }

                if (status.status === 'completed') {
                    if (pollRef.current) {
                        clearInterval(pollRef.current);
                        pollRef.current = null;
                    }
                    toast.success(status.syncMessage || 'Sinkronisasi ulasan selesai diproses di server.');
                    router.reload({ only: ['dealers', 'stats'] });
                } else if (status.status === 'failed') {
                    if (pollRef.current) {
                        clearInterval(pollRef.current);
                        pollRef.current = null;
                    }
                    toast.error(status.syncError || 'Sinkronisasi server mengalami kegagalan.');
                } else if (status.status === 'cancelled') {
                    if (pollRef.current) {
                        clearInterval(pollRef.current);
                        pollRef.current = null;
                    }
                    toast.info(status.syncMessage || 'Sinkronisasi server dihentikan.');
                }
            } catch {
                // Ignore transient network errors
            }
        }, 2000);
    };

    // Auto scroll logs
    useEffect(() => {
        if (logContainerRef.current) {
            logContainerRef.current.scrollTop = logContainerRef.current.scrollHeight;
        }
    }, [logs]);

    // Check scraper health
    const checkScraperHealth = async (silent = false) => {
        setIsCheckingHealth(true);
        try {
            const res = await fetch(reviewsRoute.scraperHealth.url());
            if (res.ok) {
                const data = await res.json();
                setScraperOnline(Boolean(data.online));
                setProxyInfo(data.proxy || null);
                if (!silent) {
                    if (data.online) {
                        toast.success('Scraper service aktif & terhubung di port 3000');
                    } else {
                        toast.error('Scraper service tidak merespon di port 3000');
                    }
                }
            } else {
                setScraperOnline(false);
                setProxyInfo(null);
                if (!silent) {
                    toast.error('Gagal menghubungi scraper service');
                }
            }
        } catch {
            setScraperOnline(false);
            setProxyInfo(null);
            if (!silent) {
                toast.error('Koneksi ke scraper service gagal');
            }
        } finally {
            setIsCheckingHealth(false);
        }
    };

    // On Mount: Check health and resume polling if server background job is running
    useEffect(() => {
        checkScraperHealth(true);

        if (serverStatus?.status === 'starting' || serverStatus?.status === 'running') {
            startPolling();
        }

        return () => {
            if (pollRef.current) {
                clearInterval(pollRef.current);
            }
        };
    }, []);

    // Start background sync on server
    const handleStartServerSync = async (dealerId: string, customLimit?: number) => {
        if (scraperOnline === false) {
            toast.error('Scraper service tidak aktif. Pastikan scraper di port 3000 berjalan.');
            return;
        }

        const actualLimit = customLimit ?? Math.max(1, Math.min(5000, Number(maxReviews) || 20));
        const target = dealerId === 'all' ? 'all' : dealers.find((d) => String(d.id) === String(dealerId));

        if (dealerId !== 'all') {
            if (!target || typeof target !== 'object') {
                toast.error('Data showroom tidak ditemukan.');
                return;
            }
            if (!target.link_google_maps) {
                toast.error(`Dealer "${target.nama_dealer}" belum memiliki link Google Maps.`);
                return;
            }
        }

        const csrfToken = (document.querySelector('meta[name="csrf-token"]') as HTMLMetaElement)?.content || '';

        setSyncState('starting');
        setSyncMessage('Mengirim perintah sinkronisasi ke background server...');
        setSyncError(null);
        setSyncResult(null);
        setProgressPercent(5);

        try {
            const res = await fetch(syncRoute.start.url(), {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'X-CSRF-TOKEN': csrfToken,
                    Accept: 'application/json',
                },
                body: JSON.stringify({
                    dealer_id: dealerId,
                    max_reviews: actualLimit,
                    sort_by: sortBy,
                    use_proxy: useProxy,
                }),
            });

            const data = await res.json();
            if (!res.ok || !data.success) {
                const errMsg = data.message || 'Gagal memulai proses di background server.';
                setSyncState('failed');
                setSyncError(errMsg);
                setSyncMessage(errMsg);
                toast.error(errMsg);
                return;
            }

            toast.success('Proses sinkronisasi telah berjalan di background server.');
            startPolling();
        } catch (err: unknown) {
            const errStr = err instanceof Error ? err.message : 'Terjadi kendala koneksi ke server.';
            setSyncState('failed');
            setSyncError(errStr);
            setSyncMessage(errStr);
            toast.error(errStr);
        }
    };

    // Form submit dispatcher
    const handleStartSync = (e: React.FormEvent) => {
        e.preventDefault();
        handleStartServerSync(selectedDealerId);
    };

    // Abort handler
    const handleCancelSync = async () => {
        const csrfToken = (document.querySelector('meta[name="csrf-token"]') as HTMLMetaElement)?.content || '';
        try {
            const res = await fetch(syncRoute.cancel.url(), {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'X-CSRF-TOKEN': csrfToken,
                    Accept: 'application/json',
                },
            });
            if (res.ok) {
                toast.info('Permintaan pembatalan telah dikirim ke server.');
                setSyncMessage('Mengirim sinyal pembatalan ke server...');
            }
        } catch {
            toast.error('Gagal mengirim sinyal pembatalan ke server.');
        }
    };

    // Reset monitor status to idle
    const handleResetMonitoring = async () => {
        const csrfToken = (document.querySelector('meta[name="csrf-token"]') as HTMLMetaElement)?.content || '';
        try {
            await fetch(syncRoute.reset.url(), {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'X-CSRF-TOKEN': csrfToken,
                    Accept: 'application/json',
                },
            });
            setSyncState('idle');
            setSyncMessage('');
            setSyncError(null);
            setProgressPercent(0);
            setBulkProgress(null);
            setSyncResult(null);
            toast.info('Status monitoring server direset ke Siap (Idle).');
        } catch {
            toast.error('Gagal mereset status monitoring di server.');
        }
    };

    // Copy logs
    const handleCopyLogs = () => {
        const text = logs.map((l) => `[${l.time}] [${l.type.toUpperCase()}] ${l.message}`).join('\n');
        navigator.clipboard.writeText(text);
        toast.success('Log aktivitas berhasil disalin ke clipboard');
    };

    // Clear logs from server
    const handleClearLogs = async () => {
        const csrfToken = (document.querySelector('meta[name="csrf-token"]') as HTMLMetaElement)?.content || '';
        try {
            await fetch(syncRoute.clearLogs.url(), {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'X-CSRF-TOKEN': csrfToken,
                    Accept: 'application/json',
                },
            });
            setLogs([]);
            toast.success('Log aktivitas di server dibersihkan.');
        } catch {
            toast.error('Gagal membersihkan log di server.');
        }
    };

    // Filtered Dealers for Quick Table
    const filteredDealers = dealers.filter((d) => {
        const matchesSearch =
            d.nama_dealer.toLowerCase().includes(tableSearch.toLowerCase()) ||
            d.kode_dealer.toLowerCase().includes(tableSearch.toLowerCase());

        if (!matchesSearch) return false;

        if (filterMapsOnly === 'with_maps') {
            return Boolean(d.link_google_maps);
        }
        if (filterMapsOnly === 'without_maps') {
            return !d.link_google_maps;
        }
        return true;
    });

    const isRunning = syncState === 'running' || syncState === 'starting';

    return (
        <>
            <Head title="Sync Review - Tarik Data Google Maps" />

            <div className="flex h-full flex-1 flex-col gap-6 p-4 md:p-6">
                {/* Header */}
                <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                    <div>
                        <div className="flex items-center gap-2">
                            <h1 className="text-2xl font-bold tracking-tight">Sync Review</h1>
                            <Badge variant="outline" className="text-xs">
                                Google Maps Scraper
                            </Badge>
                        </div>
                        <p className="mt-1 text-sm text-muted-foreground">
                            Tarik dan perbarui ulasan pelanggan, rating bintang, dan tanggapan owner secara real-time dari Google Maps.
                        </p>
                    </div>

                    <div className="flex flex-wrap items-center gap-2">
                        <Button
                            variant="outline"
                            size="sm"
                            onClick={() => checkScraperHealth(false)}
                            disabled={isCheckingHealth || isRunning}
                            className="gap-2"
                        >
                            <RefreshCw
                                className={`size-3.5 ${isCheckingHealth ? 'animate-spin' : ''}`}
                            />
                            Cek Scraper
                        </Button>
                        <Button variant="outline" size="sm" asChild className="gap-2">
                            <Link href={reviewsRoute.index.url()}>
                                <ArrowLeft className="size-3.5" />
                                Lihat Review
                            </Link>
                        </Button>
                    </div>
                </div>

                {/* Scraper Health Banner */}
                <div
                    className={`flex flex-col gap-3 rounded-xl border p-4 sm:flex-row sm:items-center sm:justify-between ${
                        scraperOnline === true
                            ? 'border-emerald-500/30 bg-emerald-500/5 dark:bg-emerald-950/20'
                            : scraperOnline === false
                              ? 'border-rose-500/30 bg-rose-500/5 dark:bg-rose-950/20'
                              : 'border-sidebar-border bg-card'
                    }`}
                >
                    <div className="flex items-center gap-3">
                        <div
                            className={`flex size-9 shrink-0 items-center justify-center rounded-lg ${
                                scraperOnline === true
                                    ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400'
                                    : scraperOnline === false
                                      ? 'bg-rose-500/10 text-rose-600 dark:text-rose-400'
                                      : 'bg-muted text-muted-foreground'
                            }`}
                        >
                            {scraperOnline === true ? (
                                <CheckCircle2 className="size-5" />
                            ) : scraperOnline === false ? (
                                <AlertCircle className="size-5" />
                            ) : (
                                <RefreshCw className="size-5 animate-spin" />
                            )}
                        </div>
                        <div>
                            <div className="flex items-center gap-2">
                                <span className="font-semibold text-sm">
                                    {scraperOnline === true
                                        ? 'Scraper Service Siap (Online)'
                                        : scraperOnline === false
                                          ? 'Scraper Service Tidak Aktif (Offline)'
                                          : 'Memeriksa Scraper Service...'}
                                </span>
                                {scraperOnline === true && (
                                    <span className="flex size-2 rounded-full bg-emerald-500 animate-pulse" />
                                )}
                            </div>
                            <p className="text-xs text-muted-foreground">
                                {scraperOnline === true
                                    ? 'API Scraper di localhost:3000 aktif dan siap mengekstrak data ulasan Playwright.'
                                    : scraperOnline === false
                                      ? 'Pastikan scraper service di port 3000 sudah dinyalakan sebelum memulai sinkronisasi.'
                                      : 'Mengecek ketersediaan port 3000 & konektivitas backend...'}
                            </p>
                        </div>
                    </div>

                    <div className="flex flex-wrap items-center gap-2 text-xs">
                        {proxyInfo && (
                            <div className="flex items-center gap-1.5 rounded-lg border bg-background/80 px-2.5 py-1 text-muted-foreground shadow-2xs">
                                <ShieldCheck className="size-3.5 text-emerald-500" />
                                <span>
                                    {proxyInfo.enabled
                                        ? `Proxy Rotasi (${proxyInfo.totalLoaded ?? 0} aktif)`
                                        : 'Koneksi Langsung (Tanpa Proxy)'}
                                </span>
                            </div>
                        )}
                        <Badge
                            variant={scraperOnline ? 'default' : 'secondary'}
                            className="font-mono text-[11px]"
                        >
                            {scraperOnline ? 'Port 3000 OK' : 'Port 3000 Down'}
                        </Badge>
                    </div>
                </div>

                {/* Server Background Process Guarantee Banner */}
                <div className="flex items-center gap-3 rounded-lg border border-blue-500/20 bg-blue-500/5 px-4 py-3 text-xs text-blue-700 dark:border-blue-500/30 dark:bg-blue-950/20 dark:text-blue-300">
                    <Info className="size-4 shrink-0 text-blue-500" />
                    <div>
                        <span className="font-semibold">Server Background Process: </span>
                        Proses scraping berjalan mandiri di latar belakang server. Jika browser ditutup atau PC dimatikan, proses tetap berjalan tanpa terputus dan progres dapat dipantau secara real-time dari PC atau perangkat mana saja.
                    </div>
                </div>

                {/* Metric Summary Cards */}
                <div className="grid grid-cols-2 gap-3 sm:grid-cols-4 md:gap-4">
                    <Card className="py-4">
                        <CardHeader className="flex flex-row items-center justify-between pb-2">
                            <CardTitle className="text-xs font-medium text-muted-foreground">
                                Total Showroom
                            </CardTitle>
                            <span className="text-muted-foreground">🏢</span>
                        </CardHeader>
                        <CardContent>
                            <div className="text-2xl font-bold">{stats.total_dealers}</div>
                            <p className="text-xs text-muted-foreground mt-0.5">
                                Showroom dalam jangkauan
                            </p>
                        </CardContent>
                    </Card>

                    <Card className="py-4">
                        <CardHeader className="flex flex-row items-center justify-between pb-2">
                            <CardTitle className="text-xs font-medium text-muted-foreground">
                                Siap Sinkronisasi
                            </CardTitle>
                            <CheckCircle2 className="size-4 text-emerald-500" />
                        </CardHeader>
                        <CardContent>
                            <div className="text-2xl font-bold text-emerald-600 dark:text-emerald-400">
                                {stats.dealers_with_maps}
                            </div>
                            <p className="text-xs text-muted-foreground mt-0.5">
                                Link Google Maps terisi
                            </p>
                        </CardContent>
                    </Card>

                    <Card className="py-4">
                        <CardHeader className="flex flex-row items-center justify-between pb-2">
                            <CardTitle className="text-xs font-medium text-muted-foreground">
                                Tanpa Google Maps
                            </CardTitle>
                            <AlertCircle className="size-4 text-amber-500" />
                        </CardHeader>
                        <CardContent>
                            <div className="text-2xl font-bold text-amber-600 dark:text-amber-400">
                                {stats.dealers_without_maps}
                            </div>
                            <p className="text-xs text-muted-foreground mt-0.5">
                                Perlu dilengkapi di Dealer
                            </p>
                        </CardContent>
                    </Card>

                    <Card className="py-4">
                        <CardHeader className="flex flex-row items-center justify-between pb-2">
                            <CardTitle className="text-xs font-medium text-muted-foreground">
                                Total Review di DB
                            </CardTitle>
                            <Star className="size-4 text-amber-400 fill-amber-400" />
                        </CardHeader>
                        <CardContent>
                            <div className="text-2xl font-bold">
                                {stats.total_reviews_db.toLocaleString('id-ID')}
                            </div>
                            <p className="text-xs text-muted-foreground mt-0.5">
                                Ulasan tersimpan di sistem
                            </p>
                        </CardContent>
                    </Card>
                </div>

                {/* Main Action Section: Configuration & Execution Panel */}
                <div className="grid grid-cols-1 gap-6 lg:grid-cols-12">
                    {/* Control Form Card */}
                    <div className="lg:col-span-5">
                        <Card className="h-full">
                            <CardHeader>
                                <CardTitle className="flex items-center gap-2 text-base">
                                    <Play className="size-4 text-primary fill-primary" />
                                    Konfigurasi Sinkronisasi
                                </CardTitle>
                                <CardDescription>
                                    Tentukan showroom dan opsi ekstraksi ulasan Google Maps.
                                </CardDescription>
                            </CardHeader>
                            <CardContent>
                                <form onSubmit={handleStartSync} className="space-y-4">
                                    {/* Target Showroom */}
                                    <div className="space-y-1.5">
                                        <Label htmlFor="dealer_id" className="text-xs font-medium">
                                            Target Showroom
                                        </Label>
                                        {canManageAll ? (
                                            <select
                                                id="dealer_id"
                                                value={selectedDealerId}
                                                onChange={(e) => setSelectedDealerId(e.target.value)}
                                                disabled={isRunning}
                                                className={selectClass}
                                            >
                                                <option value="all">
                                                    🔄 Semua Dealer ({stats.dealers_with_maps} siap sync)
                                                </option>
                                                {dealers.map((d) => (
                                                    <option
                                                        key={d.id}
                                                        value={String(d.id)}
                                                        disabled={!d.link_google_maps}
                                                    >
                                                        {d.kode_dealer} - {d.nama_dealer}{' '}
                                                        {!d.link_google_maps ? '(Tanpa Link Maps)' : ''}
                                                    </option>
                                                ))}
                                            </select>
                                        ) : (
                                            <div className="rounded-md border bg-muted/40 px-3 py-2 text-sm font-medium">
                                                {dealers[0]
                                                    ? `${dealers[0].kode_dealer} - ${dealers[0].nama_dealer}`
                                                    : 'Dealer Anda'}
                                                {!dealers[0]?.link_google_maps && (
                                                    <span className="ml-2 text-xs text-destructive">
                                                        (Link Google Maps belum diatur)
                                                    </span>
                                                )}
                                            </div>
                                        )}
                                        <p className="text-[11px] text-muted-foreground">
                                            {selectedDealerId === 'all'
                                                ? 'Sinkronisasi akan memproses seluruh dealer berurutan.'
                                                : 'Menarik ulasan spesifik untuk showroom yang dipilih.'}
                                        </p>
                                    </div>

                                    {/* Limit / Max Reviews */}
                                    <div className="space-y-2">
                                        <div className="flex items-center justify-between">
                                            <Label htmlFor="max_reviews" className="text-xs font-medium">
                                                Jumlah Ulasan Maksimal
                                            </Label>
                                            <span className="text-xs font-mono font-semibold text-primary">
                                                {maxReviews ? `${maxReviews} ulasan` : '-'}
                                            </span>
                                        </div>

                                        {/* Input Ketik Manual */}
                                        <div className="relative">
                                            <Input
                                                id="max_reviews"
                                                type="number"
                                                min={1}
                                                max={5000}
                                                value={maxReviews}
                                                onChange={(e) => {
                                                    const val = e.target.value;
                                                    if (val === '') {
                                                        setMaxReviews('');
                                                    } else {
                                                        const num = parseInt(val, 10);
                                                        setMaxReviews(isNaN(num) ? '' : Math.max(1, Math.min(5000, num)));
                                                    }
                                                }}
                                                placeholder="Ketik jumlah ulasan (cth: 50, 150, 500, 1000)..."
                                                disabled={isRunning}
                                                className="h-9 pr-16 text-sm"
                                            />
                                            <span className="pointer-events-none absolute right-3 top-2 text-xs text-muted-foreground">
                                                ulasan
                                            </span>
                                        </div>

                                        {/* Preset Cepat */}
                                        <div className="space-y-1">
                                            <div className="flex flex-wrap items-center gap-1.5">
                                                <span className="text-[11px] text-muted-foreground mr-1">Preset:</span>
                                                {[20, 50, 100, 250, 500, 1000].map((count) => (
                                                    <Button
                                                        key={count}
                                                        type="button"
                                                        variant={Number(maxReviews) === count ? 'default' : 'outline'}
                                                        size="sm"
                                                        disabled={isRunning}
                                                        onClick={() => setMaxReviews(count)}
                                                        className="h-7 px-2.5 text-xs rounded-md"
                                                    >
                                                        {count}
                                                    </Button>
                                                ))}
                                            </div>
                                            <p className="text-[11px] text-muted-foreground">
                                                Bisa ketik angka langsung (1 - 5.000 ulasan) atau klik tombol preset cepat di atas.
                                            </p>
                                        </div>
                                    </div>

                                    {/* Sort Order */}
                                    <div className="space-y-1.5">
                                        <Label htmlFor="sort_by" className="text-xs font-medium">
                                            Urutan Ulasan di Google Maps
                                        </Label>
                                        <select
                                            id="sort_by"
                                            value={sortBy}
                                            onChange={(e) => setSortBy(e.target.value)}
                                            disabled={isRunning}
                                            className={selectClass}
                                        >
                                            <option value="newest">Terbaru (Rekomendasi untuk update rutin)</option>
                                            <option value="relevant">Paling Relevan</option>
                                            <option value="highest">Rating Tertinggi</option>
                                            <option value="lowest">Rating Terendah (Keluhan Konsumen)</option>
                                        </select>
                                    </div>

                                    {/* Proxy Checkbox */}
                                    <div className="flex items-start space-x-2 rounded-lg border bg-muted/20 p-3">
                                        <Checkbox
                                            id="use_proxy"
                                            checked={useProxy}
                                            onCheckedChange={(checked) => setUseProxy(Boolean(checked))}
                                            disabled={isRunning}
                                            className="mt-0.5"
                                        />
                                        <div className="space-y-0.5 leading-none">
                                            <Label
                                                htmlFor="use_proxy"
                                                className="text-xs font-medium cursor-pointer"
                                            >
                                                Gunakan Rotating Proxy
                                            </Label>
                                            <p className="text-[11px] text-muted-foreground">
                                                Mencegah rate limiting / IP block dari Google saat scraping dalam jumlah banyak.
                                            </p>
                                        </div>
                                    </div>

                                    {/* Submit / Cancel Buttons */}
                                    <div className="pt-2">
                                        {isRunning ? (
                                            <Button
                                                type="button"
                                                variant="destructive"
                                                onClick={handleCancelSync}
                                                className="w-full gap-2"
                                            >
                                                <Square className="size-4" />
                                                Hentikan Sinkronisasi
                                            </Button>
                                        ) : (
                                            <Button
                                                type="submit"
                                                disabled={scraperOnline === false}
                                                className="w-full gap-2 shadow-sm"
                                            >
                                                <Play className="size-4 fill-current" />
                                                {selectedDealerId === 'all'
                                                    ? 'Mulai Sinkronisasi Semua Showroom'
                                                    : 'Mulai Sinkronisasi Showroom'}
                                            </Button>
                                        )}
                                    </div>
                                </form>
                            </CardContent>
                        </Card>
                    </div>

                    {/* Live Monitoring & Terminal Log Card */}
                    <div className="lg:col-span-7 flex flex-col gap-6">
                        {/* Status & Progress Box */}
                        <Card>
                            <CardHeader className="flex flex-row items-center justify-between pb-3">
                                <div>
                                    <CardTitle className="text-base flex items-center gap-2">
                                        <Clock className="size-4 text-primary" />
                                        Monitoring Proses
                                    </CardTitle>
                                    <CardDescription>
                                        Status pelaksanaan dan progres sinkronisasi langsung.
                                    </CardDescription>
                                </div>
                                <div className="flex items-center gap-2">
                                    {syncState !== 'idle' && !isRunning && (
                                        <Button
                                            type="button"
                                            variant="ghost"
                                            size="sm"
                                            onClick={handleResetMonitoring}
                                            className="h-7 px-2 text-xs text-muted-foreground hover:text-foreground gap-1"
                                            title="Kembalikan status monitoring ke Siap (Idle)"
                                        >
                                            <RotateCcw className="size-3" />
                                            Reset
                                        </Button>
                                    )}
                                    {syncState === 'idle' && (
                                        <Badge variant="outline">Siap (Idle)</Badge>
                                    )}
                                    {isRunning && (
                                        <Badge className="bg-blue-600 gap-1 animate-pulse">
                                            <Loader2 className="size-3 animate-spin" />
                                            Sedang Berjalan
                                        </Badge>
                                    )}
                                    {syncState === 'completed' && (
                                        <Badge className="bg-emerald-600 gap-1">
                                            <CheckCircle2 className="size-3" />
                                            Selesai
                                        </Badge>
                                    )}
                                    {syncState === 'failed' && (
                                        <Badge variant="destructive" className="gap-1">
                                            <AlertCircle className="size-3" />
                                            Gagal
                                        </Badge>
                                    )}
                                    {syncState === 'cancelled' && (
                                        <Badge variant="outline" className="text-amber-500 border-amber-500/40">
                                            Dibatalkan
                                        </Badge>
                                    )}
                                </div>
                            </CardHeader>
                            <CardContent className="space-y-4">
                                {/* Progress bar */}
                                <div className="space-y-1.5">
                                    <div className="flex items-center justify-between text-xs text-muted-foreground">
                                        <span>
                                            {bulkProgress
                                                ? `Showroom ${bulkProgress.current} dari ${bulkProgress.total}: ${bulkProgress.currentDealerName}`
                                                : isRunning
                                                  ? 'Sedang mengekstrak data dari Google Maps...'
                                                  : syncState === 'completed'
                                                    ? 'Proses sinkronisasi telah selesai'
                                                    : syncState === 'cancelled'
                                                      ? 'Proses sinkronisasi dihentikan'
                                                      : 'Menunggu perintah sinkronisasi'}
                                        </span>
                                        <span className="font-mono font-medium">{progressPercent}%</span>
                                    </div>
                                    <div className="h-2 w-full overflow-hidden rounded-full bg-muted">
                                        <div
                                            className={`h-full transition-all duration-300 ${
                                                syncState === 'failed'
                                                    ? 'bg-rose-500'
                                                    : syncState === 'completed'
                                                      ? 'bg-emerald-500'
                                                      : 'bg-primary'
                                            }`}
                                            style={{ width: `${progressPercent}%` }}
                                        />
                                    </div>
                                </div>

                                {syncMessage && (
                                    <div
                                        className={`rounded-lg p-3 text-xs flex items-start gap-2 ${
                                            syncState === 'failed'
                                                ? 'bg-rose-500/10 text-rose-600 dark:text-rose-400'
                                                : syncState === 'completed'
                                                  ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400'
                                                  : 'bg-muted/60 text-foreground'
                                        }`}
                                    >
                                        <Info className="size-4 shrink-0 mt-0.5" />
                                        <span className="leading-relaxed">{syncMessage}</span>
                                    </div>
                                )}

                                {/* Result Metric Card if completed */}
                                {syncResult && (
                                    <div className="grid grid-cols-2 gap-2 sm:grid-cols-4 rounded-xl border bg-muted/20 p-3 text-center">
                                        <div>
                                            <div className="text-xs text-muted-foreground">Ulasan Baru</div>
                                            <div className="text-lg font-bold text-emerald-600 dark:text-emerald-400">
                                                +{syncResult.imported}
                                            </div>
                                        </div>
                                        <div>
                                            <div className="text-xs text-muted-foreground">Diperbarui</div>
                                            <div className="text-lg font-bold text-blue-600 dark:text-blue-400">
                                                {syncResult.updated}
                                            </div>
                                        </div>
                                        <div>
                                            <div className="text-xs text-muted-foreground">Total Scraped</div>
                                            <div className="text-lg font-bold">
                                                {syncResult.total_scraped}
                                            </div>
                                        </div>
                                        <div>
                                            <div className="text-xs text-muted-foreground">Rating Maps</div>
                                            <div className="text-lg font-bold text-amber-500 flex items-center justify-center gap-1">
                                                <Star className="size-3.5 fill-amber-400" />
                                                {syncResult.dealer_rating ?? '-'}
                                            </div>
                                        </div>
                                    </div>
                                )}
                            </CardContent>
                        </Card>

                        {/* Real-time Activity Terminal Logs */}
                        <Card className="flex-1 flex flex-col">
                            <CardHeader className="flex flex-row items-center justify-between pb-2">
                                <div className="flex items-center gap-2">
                                    <Terminal className="size-4 text-muted-foreground" />
                                    <CardTitle className="text-sm">Log Aktivitas Scraper</CardTitle>
                                </div>
                                <div className="flex items-center gap-1">
                                    <Button
                                        type="button"
                                        variant="ghost"
                                        size="sm"
                                        onClick={handleCopyLogs}
                                        disabled={logs.length === 0}
                                        className="h-7 px-2 text-xs gap-1"
                                    >
                                        <Copy className="size-3" />
                                        Salin
                                    </Button>
                                    <Button
                                        type="button"
                                        variant="ghost"
                                        size="sm"
                                        onClick={handleClearLogs}
                                        disabled={logs.length === 0}
                                        className="h-7 px-2 text-xs gap-1 text-muted-foreground hover:text-destructive"
                                    >
                                        <Trash2 className="size-3" />
                                        Bersihkan
                                    </Button>
                                </div>
                            </CardHeader>
                            <CardContent className="flex-1">
                                <div
                                    ref={logContainerRef}
                                    className="h-56 overflow-y-auto rounded-lg border bg-zinc-950 p-3 font-mono text-[11px] text-zinc-200 dark:bg-black"
                                >
                                    {logs.length === 0 ? (
                                        <div className="flex h-full items-center justify-center text-zinc-500">
                                            Belum ada aktivitas sinkronisasi. Silakan pilih target showroom dan klik Mulai Sinkronisasi.
                                        </div>
                                    ) : (
                                        logs.map((log) => (
                                            <div key={log.id} className="py-0.5 leading-relaxed">
                                                <span className="text-zinc-500">[{log.time}]</span>{' '}
                                                <span
                                                    className={
                                                        log.type === 'error'
                                                            ? 'text-rose-400 font-semibold'
                                                            : log.type === 'warn'
                                                              ? 'text-amber-400'
                                                              : log.type === 'success'
                                                                ? 'text-emerald-400'
                                                                : 'text-zinc-300'
                                                    }
                                                >
                                                    {log.message}
                                                </span>
                                            </div>
                                        ))
                                    )}
                                </div>
                            </CardContent>
                        </Card>
                    </div>
                </div>

                {/* Showroom Quick Table */}
                <Card>
                    <CardHeader className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between pb-3">
                        <div>
                            <CardTitle className="text-base">Daftar Showroom & Status Maps</CardTitle>
                            <CardDescription>
                                Periksa kelengkapan Google Maps dan jalankan sinkronisasi instan per showroom.
                            </CardDescription>
                        </div>
                        <div className="flex flex-wrap items-center gap-2">
                            <div className="relative w-48 sm:w-60">
                                <Search className="absolute left-2.5 top-2.5 size-3.5 text-muted-foreground" />
                                <Input
                                    placeholder="Cari showroom / kode..."
                                    value={tableSearch}
                                    onChange={(e) => setTableSearch(e.target.value)}
                                    className="h-8 pl-8 text-xs"
                                />
                            </div>
                            <div className="flex items-center gap-1 rounded-lg border p-1 text-xs">
                                <button
                                    type="button"
                                    onClick={() => setFilterMapsOnly('all')}
                                    className={`rounded px-2 py-0.5 transition-colors ${
                                        filterMapsOnly === 'all'
                                            ? 'bg-primary text-primary-foreground'
                                            : 'text-muted-foreground hover:bg-muted'
                                    }`}
                                >
                                    Semua ({dealers.length})
                                </button>
                                <button
                                    type="button"
                                    onClick={() => setFilterMapsOnly('with_maps')}
                                    className={`rounded px-2 py-0.5 transition-colors ${
                                        filterMapsOnly === 'with_maps'
                                            ? 'bg-primary text-primary-foreground'
                                            : 'text-muted-foreground hover:bg-muted'
                                    }`}
                                >
                                    Terkoneksi ({stats.dealers_with_maps})
                                </button>
                                <button
                                    type="button"
                                    onClick={() => setFilterMapsOnly('without_maps')}
                                    className={`rounded px-2 py-0.5 transition-colors ${
                                        filterMapsOnly === 'without_maps'
                                            ? 'bg-primary text-primary-foreground'
                                            : 'text-muted-foreground hover:bg-muted'
                                    }`}
                                >
                                    Belum Ada ({stats.dealers_without_maps})
                                </button>
                            </div>
                        </div>
                    </CardHeader>
                    <CardContent className="p-0">
                        <div className="overflow-x-auto">
                            <table className="w-full text-left text-xs">
                                <thead className="border-b bg-muted/40 font-medium text-muted-foreground">
                                    <tr>
                                        <th className="px-4 py-3">Kode</th>
                                        <th className="px-4 py-3">Nama Showroom</th>
                                        <th className="px-4 py-3">Status Google Maps</th>
                                        <th className="px-4 py-3 text-center">Review di DB</th>
                                        <th className="px-4 py-3 text-center">Rating Maps</th>
                                        <th className="px-4 py-3 text-right">Aksi</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y">
                                    {filteredDealers.length === 0 ? (
                                        <tr>
                                            <td colSpan={6} className="py-8 text-center text-muted-foreground">
                                                Tidak ada showroom yang sesuai dengan kriteria filter.
                                            </td>
                                        </tr>
                                    ) : (
                                        filteredDealers.map((d) => (
                                            <tr key={d.id} className="hover:bg-muted/30 transition-colors">
                                                <td className="px-4 py-3 font-mono font-medium">
                                                    {d.kode_dealer}
                                                </td>
                                                <td className="px-4 py-3 font-medium">
                                                    {d.nama_dealer}
                                                </td>
                                                <td className="px-4 py-3">
                                                    {d.link_google_maps ? (
                                                        <div className="flex items-center gap-1.5">
                                                            <Badge
                                                                variant="outline"
                                                                className="text-emerald-600 border-emerald-500/30 bg-emerald-500/5 text-[11px]"
                                                            >
                                                                Terkoneksi
                                                            </Badge>
                                                            <a
                                                                href={d.link_google_maps}
                                                                target="_blank"
                                                                rel="noopener noreferrer"
                                                                className="text-muted-foreground hover:text-primary transition-colors"
                                                                title="Buka Google Maps"
                                                            >
                                                                <ExternalLink className="size-3.5" />
                                                            </a>
                                                        </div>
                                                    ) : (
                                                        <div className="flex items-center gap-1.5">
                                                            <Badge
                                                                variant="outline"
                                                                className="text-amber-600 border-amber-500/30 bg-amber-500/5 text-[11px]"
                                                            >
                                                                Belum Ada Link
                                                            </Badge>
                                                            {canManageAll && (
                                                                <Link
                                                                    href={dealersRoute.index()}
                                                                    className="text-[11px] text-primary hover:underline"
                                                                >
                                                                    Atur Link
                                                                </Link>
                                                            )}
                                                        </div>
                                                    )}
                                                </td>
                                                <td className="px-4 py-3 text-center">
                                                    <span className="font-semibold">
                                                        {(d.reviews_count ?? 0).toLocaleString('id-ID')}
                                                    </span>
                                                </td>
                                                <td className="px-4 py-3 text-center">
                                                    {d.star_rate ? (
                                                        <div className="inline-flex items-center gap-1 font-semibold text-amber-500">
                                                            <Star className="size-3 fill-amber-400" />
                                                            {d.star_rate}
                                                            <span className="text-[11px] text-muted-foreground font-normal">
                                                                ({d.total_review ?? 0})
                                                            </span>
                                                        </div>
                                                    ) : (
                                                        <span className="text-muted-foreground">-</span>
                                                    )}
                                                </td>
                                                <td className="px-4 py-3 text-right">
                                                    <Button
                                                        type="button"
                                                        variant="outline"
                                                        size="sm"
                                                        disabled={!d.link_google_maps || isRunning}
                                                        onClick={() => {
                                                            setSelectedDealerId(String(d.id));
                                                            handleStartServerSync(String(d.id));
                                                        }}
                                                        className="h-7 text-xs gap-1"
                                                    >
                                                        <RefreshCw className="size-3" />
                                                        Sync
                                                    </Button>
                                                </td>
                                            </tr>
                                        ))
                                    )}
                                </tbody>
                            </table>
                        </div>
                    </CardContent>
                </Card>
            </div>
        </>
    );
}

SyncReviewsPage.layout = {
    breadcrumbs: [
        {
            title: 'Dashboard',
            href: dashboard(),
        },
        {
            title: 'Review',
            href: reviewsRoute.index(),
        },
        {
            title: 'Sync Review',
            href: syncRoute.index(),
        },
    ],
};
