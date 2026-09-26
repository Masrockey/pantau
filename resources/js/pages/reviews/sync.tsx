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

interface SyncPageProps {
    dealers: SyncDealer[];
    stats: SyncStats;
    canManageAll?: boolean;
}

interface LogEntry {
    id: string;
    time: string;
    type: 'info' | 'success' | 'warn' | 'error';
    message: string;
}

interface SyncSessionData {
    syncState: 'idle' | 'starting' | 'running' | 'completed' | 'failed' | 'cancelled';
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
    activeJob?: {
        jobId: string;
        dealerId: number | string;
        dealerName: string;
        startedAt: number;
        maxReviews: number;
    } | null;
}

const STORAGE_KEY_LOGS = 'pantau_sync_logs_v1';
const STORAGE_KEY_SESSION = 'pantau_sync_session_v1';

const getStoredSession = (): SyncSessionData => {
    if (typeof window === 'undefined') {
        return {
            syncState: 'idle',
            syncMessage: '',
            progressPercent: 0,
            syncError: null,
            bulkProgress: null,
            syncResult: null,
            activeJob: null,
        };
    }
    try {
        const saved = localStorage.getItem(STORAGE_KEY_SESSION);
        if (saved) {
            return JSON.parse(saved);
        }
    } catch {
        // ignore
    }
    return {
        syncState: 'idle',
        syncMessage: '',
        progressPercent: 0,
        syncError: null,
        bulkProgress: null,
        syncResult: null,
        activeJob: null,
    };
};

const getStoredLogs = (): LogEntry[] => {
    if (typeof window === 'undefined') return [];
    try {
        const saved = localStorage.getItem(STORAGE_KEY_LOGS);
        if (saved) {
            const parsed = JSON.parse(saved);
            if (Array.isArray(parsed)) return parsed;
        }
    } catch {
        // ignore
    }
    return [];
};

const selectClass =
    'h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-xs transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring dark:bg-background';

export default function SyncReviewsPage({
    dealers,
    stats,
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

    // Restored session from localStorage
    const [initialSession] = useState<SyncSessionData>(getStoredSession);

    // Execution & progress state
    const [syncState, setSyncState] = useState<
        'idle' | 'starting' | 'running' | 'completed' | 'failed' | 'cancelled'
    >(initialSession.syncState);
    const [syncMessage, setSyncMessage] = useState<string>(initialSession.syncMessage);
    const [syncError, setSyncError] = useState<string | null>(initialSession.syncError ?? null);
    const [progressPercent, setProgressPercent] = useState<number>(initialSession.progressPercent);
    const [bulkProgress, setBulkProgress] = useState(initialSession.bulkProgress ?? null);
    const [syncResult, setSyncResult] = useState(initialSession.syncResult ?? null);

    // Log terminal state with localStorage persistence
    const [logs, setLogs] = useState<LogEntry[]>(getStoredLogs);
    const logContainerRef = useRef<HTMLDivElement>(null);
    const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);
    const isCancelledRef = useRef(false);

    // Quick table search & filter
    const [tableSearch, setTableSearch] = useState('');
    const [filterMapsOnly, setFilterMapsOnly] = useState<'all' | 'with_maps' | 'without_maps'>('all');

    // Persist session to localStorage
    const saveSession = (data: Partial<SyncSessionData>) => {
        if (typeof window === 'undefined') return;
        try {
            const current = getStoredSession();
            const updated = { ...current, ...data };
            localStorage.setItem(STORAGE_KEY_SESSION, JSON.stringify(updated));
        } catch {
            // ignore
        }
    };

    const addLog = (message: string, type: 'info' | 'success' | 'warn' | 'error' = 'info') => {
        const now = new Date();
        const time = now.toTimeString().split(' ')[0];
        const newEntry: LogEntry = {
            id: `${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
            time,
            type,
            message,
        };
        setLogs((prev) => {
            const updated = [...prev, newEntry].slice(-300);
            if (typeof window !== 'undefined') {
                try {
                    localStorage.setItem(STORAGE_KEY_LOGS, JSON.stringify(updated));
                } catch {
                    // ignore
                }
            }
            return updated;
        });
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
                        addLog('Scraper service aktif & terhubung normal.', 'success');
                    } else {
                        toast.error('Scraper service tidak merespon di port 3000');
                        addLog('Scraper service tidak merespon di port 3000.', 'error');
                    }
                }
            } else {
                setScraperOnline(false);
                setProxyInfo(null);
                if (!silent) {
                    toast.error('Gagal menghubungi scraper service');
                    addLog('Gagal menghubungi scraper service.', 'error');
                }
            }
        } catch {
            setScraperOnline(false);
            setProxyInfo(null);
            if (!silent) {
                toast.error('Koneksi ke scraper service gagal');
                addLog('Koneksi ke scraper service gagal dipanggil.', 'error');
            }
        } finally {
            setIsCheckingHealth(false);
        }
    };

    // Reusable single job polling function
    const startPollingJob = (
        jobId: string,
        dealerId: number | string,
        dealerName: string,
        initialPollCount = 0,
    ) => {
        if (pollRef.current) {
            clearInterval(pollRef.current);
        }

        let pollCount = initialPollCount;
        pollRef.current = setInterval(async () => {
            pollCount++;
            setProgressPercent((prev) => {
                const next = Math.min(90, prev + 2);
                saveSession({ progressPercent: next });
                return next;
            });

            try {
                const statusUrl = `${syncRoute.status.url({ jobId })}?dealer_id=${dealerId}`;
                const statusRes = await fetch(statusUrl, {
                    headers: { Accept: 'application/json' },
                });
                const statusData = await statusRes.json();

                if (statusData.status === 'completed') {
                    if (pollRef.current) {
                        clearInterval(pollRef.current);
                    }
                    setProgressPercent(100);
                    setSyncState('completed');

                    const syncData = statusData.data || {};
                    const resObj = {
                        imported: syncData.imported ?? 0,
                        updated: syncData.updated ?? 0,
                        total_scraped: (syncData.imported ?? 0) + (syncData.updated ?? 0),
                        dealer_nama: dealerName,
                        dealer_rating: syncData.dealer_rating,
                        dealer_total_review: syncData.dealer_total_review,
                    };
                    setSyncResult(resObj);

                    const doneMsg = `Selesai! Berhasil mengimpor ${resObj.imported} ulasan baru dan memperbarui ${resObj.updated} ulasan.`;
                    setSyncMessage(doneMsg);
                    addLog(
                        `[Selesai] ${dealerName}: ${resObj.imported} ulasan baru, ${resObj.updated} ulasan terupdate. Rating Google: ★ ${resObj.dealer_rating ?? '-'} (${resObj.dealer_total_review ?? '-'} ulasan)`,
                        'success',
                    );
                    toast.success(doneMsg);

                    saveSession({
                        syncState: 'completed',
                        syncMessage: doneMsg,
                        progressPercent: 100,
                        syncResult: resObj,
                        activeJob: null,
                    });

                    router.reload({ only: ['dealers', 'stats'] });
                } else if (statusData.status === 'failed') {
                    if (pollRef.current) {
                        clearInterval(pollRef.current);
                    }
                    setSyncState('failed');
                    const failMsg =
                        statusData.message || 'Scraping ulasan gagal diproses oleh service scraper.';
                    setSyncError(failMsg);
                    setSyncMessage(failMsg);
                    addLog(`[Error] ${failMsg}`, 'error');
                    toast.error(failMsg);

                    saveSession({
                        syncState: 'failed',
                        syncMessage: failMsg,
                        syncError: failMsg,
                        activeJob: null,
                    });
                } else {
                    if (pollCount % 3 === 0) {
                        addLog(
                            `Menunggu ekstraksi data ulasan (${pollCount * 2} detik berjalan)...`,
                            'info',
                        );
                    }
                }
            } catch {
                // Toleransi jaringan saat polling
            }
        }, 2000);
    };

    // On Mount: Check health and resume active job if page was refreshed while scraping
    useEffect(() => {
        checkScraperHealth(true);

        if (typeof window !== 'undefined') {
            try {
                const saved = localStorage.getItem(STORAGE_KEY_SESSION);
                if (saved) {
                    const session: SyncSessionData = JSON.parse(saved);
                    if (session.syncState === 'running' && session.activeJob) {
                        const elapsed = Date.now() - (session.activeJob.startedAt || 0);
                        if (elapsed < 15 * 60 * 1000) {
                            addLog(
                                `[Lanjutan] Menyambung kembali pemantauan scraping job #${session.activeJob.jobId} (${session.activeJob.dealerName})...`,
                                'info',
                            );
                            startPollingJob(
                                session.activeJob.jobId,
                                session.activeJob.dealerId,
                                session.activeJob.dealerName,
                                Math.floor(elapsed / 2000),
                            );
                        } else {
                            setSyncState('failed');
                            setSyncMessage('Proses scraping sebelumnya telah melewati batas waktu (timeout).');
                            saveSession({ syncState: 'failed', activeJob: null });
                        }
                    } else if (session.syncState === 'running' && !session.activeJob) {
                        setSyncState('cancelled');
                        const msg = 'Halaman di-refresh saat proses sinkronisasi massal berlangsung.';
                        setSyncMessage(msg);
                        addLog(`[Perhatian] ${msg}`, 'warn');
                        saveSession({ syncState: 'cancelled' });
                    }
                }
            } catch {
                // ignore
            }
        }

        return () => {
            if (pollRef.current) {
                clearInterval(pollRef.current);
            }
        };
    }, []);

    // Abort handler
    const handleCancelSync = () => {
        isCancelledRef.current = true;
        if (pollRef.current) {
            clearInterval(pollRef.current);
        }
        setSyncState('cancelled');
        const msg = 'Permintaan pembatalan diterima. Menghentikan sinkronisasi...';
        setSyncMessage(msg);
        addLog(msg, 'warn');
        toast.info('Sinkronisasi dihentikan.');
        saveSession({
            syncState: 'cancelled',
            syncMessage: msg,
            activeJob: null,
        });
    };

    // Reset monitor status to idle
    const handleResetMonitoring = () => {
        setSyncState('idle');
        setSyncMessage('');
        setSyncError(null);
        setProgressPercent(0);
        setBulkProgress(null);
        setSyncResult(null);
        saveSession({
            syncState: 'idle',
            syncMessage: '',
            syncError: null,
            progressPercent: 0,
            bulkProgress: null,
            syncResult: null,
            activeJob: null,
        });
        toast.info('Status monitoring direset ke Siap (Idle).');
    };

    // Copy logs
    const handleCopyLogs = () => {
        const text = logs.map((l) => `[${l.time}] [${l.type.toUpperCase()}] ${l.message}`).join('\n');
        navigator.clipboard.writeText(text);
        toast.success('Log aktivitas berhasil disalin ke clipboard');
    };

    // Clear logs from memory & localStorage
    const handleClearLogs = () => {
        setLogs([]);
        if (typeof window !== 'undefined') {
            try {
                localStorage.removeItem(STORAGE_KEY_LOGS);
            } catch {
                // ignore
            }
        }
        addLog('Log aktivitas dibersihkan.', 'info');
    };

    // Single Dealer Sync Execution
    const executeSingleDealerSync = async (dealerId: number | string, customLimit?: number) => {
        const actualLimit = customLimit ?? Math.max(1, Math.min(5000, Number(maxReviews) || 20));
        const target = dealers.find((d) => String(d.id) === String(dealerId));

        if (!target) {
            toast.error('Data showroom tidak ditemukan.');
            return;
        }

        if (!target.link_google_maps) {
            toast.error(`Dealer "${target.nama_dealer}" belum memiliki link Google Maps.`);
            addLog(`Gagal: Dealer "${target.nama_dealer}" belum memiliki link Google Maps.`, 'error');
            return;
        }

        setSyncState('starting');
        setSyncError(null);
        setSyncResult(null);
        setBulkProgress(null);
        setProgressPercent(10);
        isCancelledRef.current = false;

        const csrfToken =
            (document.querySelector('meta[name="csrf-token"]') as HTMLMetaElement)?.content || '';

        const startMsg = `Memulai scraping Google Review untuk ${target.kode_dealer} - ${target.nama_dealer} (Maks ${actualLimit} ulasan)...`;
        setSyncMessage(startMsg);
        addLog(startMsg, 'info');

        saveSession({
            syncState: 'starting',
            syncMessage: startMsg,
            syncError: null,
            syncResult: null,
            bulkProgress: null,
            progressPercent: 10,
            activeJob: null,
        });

        try {
            const startRes = await fetch(syncRoute.start.url(), {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'X-CSRF-TOKEN': csrfToken,
                    Accept: 'application/json',
                },
                body: JSON.stringify({
                    dealer_id: target.id,
                    max_reviews: actualLimit,
                    sort_by: sortBy,
                    use_proxy: useProxy,
                }),
            });

            const startData = await startRes.json();
            if (!startRes.ok || !startData.success) {
                const errMsg = startData.message || 'Gagal memulai scraping review.';
                setSyncState('failed');
                setSyncError(errMsg);
                setSyncMessage(errMsg);
                addLog(`[Error] ${errMsg}`, 'error');
                toast.error(errMsg);
                saveSession({
                    syncState: 'failed',
                    syncError: errMsg,
                    syncMessage: errMsg,
                    activeJob: null,
                });
                return;
            }

            const jobId = startData.jobId;
            setSyncState('running');
            setProgressPercent(30);
            const runMsg = `Job scraper #${jobId} diterima. Browser Playwright sedang membuka halaman ulasan Google Maps...`;
            setSyncMessage(runMsg);
            addLog(runMsg, 'info');

            saveSession({
                syncState: 'running',
                syncMessage: runMsg,
                progressPercent: 30,
                activeJob: {
                    jobId,
                    dealerId: target.id,
                    dealerName: target.nama_dealer,
                    startedAt: Date.now(),
                    maxReviews: actualLimit,
                },
            });

            startPollingJob(jobId, target.id, target.nama_dealer);
        } catch (err: unknown) {
            const errStr = err instanceof Error ? err.message : 'Terjadi kendala koneksi ke server.';
            setSyncState('failed');
            setSyncError(errStr);
            setSyncMessage(errStr);
            addLog(`[Network Error] ${errStr}`, 'error');
            toast.error(errStr);
            saveSession({
                syncState: 'failed',
                syncError: errStr,
                syncMessage: errStr,
                activeJob: null,
            });
        }
    };

    // Bulk All Dealers Sync Execution
    const executeBulkSync = async () => {
        const targetDealers = dealers.filter((d) => Boolean(d.link_google_maps));
        if (targetDealers.length === 0) {
            toast.error('Tidak ada showroom dengan link Google Maps yang siap disinkronkan.');
            addLog('Tidak ada showroom dengan link Google Maps yang valid.', 'error');
            return;
        }

        setSyncState('running');
        setSyncError(null);
        setSyncResult(null);
        isCancelledRef.current = false;

        const csrfToken =
            (document.querySelector('meta[name="csrf-token"]') as HTMLMetaElement)?.content || '';

        let totalImported = 0;
        let totalUpdated = 0;
        let processedCount = 0;

        const actualLimit = Math.max(1, Math.min(5000, Number(maxReviews) || 20));

        addLog(
            `Memulai sinkronisasi massal untuk ${targetDealers.length} showroom (Limit: ${actualLimit} ulasan per showroom)...`,
            'info',
        );

        saveSession({
            syncState: 'running',
            syncMessage: 'Memulai sinkronisasi massal...',
            syncError: null,
            syncResult: null,
            progressPercent: 0,
            activeJob: null,
        });

        for (let i = 0; i < targetDealers.length; i++) {
            if (isCancelledRef.current) {
                addLog('Sinkronisasi massal dibatalkan oleh pengguna.', 'warn');
                break;
            }

            const d = targetDealers[i];
            const currentPct = Math.round(((i) / targetDealers.length) * 100);
            setProgressPercent(currentPct);

            const currentBulk = {
                current: i + 1,
                total: targetDealers.length,
                currentDealerName: `${d.kode_dealer} - ${d.nama_dealer}`,
                currentImported: totalImported,
                currentUpdated: totalUpdated,
            };
            setBulkProgress(currentBulk);

            const stepMsg = `[${i + 1}/${targetDealers.length}] Memproses ${d.nama_dealer}...`;
            setSyncMessage(stepMsg);
            addLog(stepMsg, 'info');

            saveSession({
                syncState: 'running',
                progressPercent: currentPct,
                syncMessage: stepMsg,
                bulkProgress: currentBulk,
            });

            try {
                const startRes = await fetch(syncRoute.start.url(), {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        'X-CSRF-TOKEN': csrfToken,
                        Accept: 'application/json',
                    },
                    body: JSON.stringify({
                        dealer_id: d.id,
                        max_reviews: actualLimit,
                        sort_by: sortBy,
                        use_proxy: useProxy,
                    }),
                });

                const startData = await startRes.json();
                if (!startRes.ok || !startData.success) {
                    addLog(`Lewati ${d.nama_dealer}: ${startData.message || 'Scraper menolak permintaan'}`, 'warn');
                    continue;
                }

                const jobId = startData.jobId;
                let isCompleted = false;
                let pollCycles = 0;

                while (!isCompleted && pollCycles < 90 && !isCancelledRef.current) {
                    await new Promise((r) => setTimeout(r, 2000));
                    pollCycles++;

                    const statusUrl = `${syncRoute.status.url({ jobId })}?dealer_id=${d.id}`;
                    const statusRes = await fetch(statusUrl, {
                        headers: { Accept: 'application/json' },
                    });
                    const statusData = await statusRes.json();

                    if (statusData.status === 'completed') {
                        isCompleted = true;
                        const syncData = statusData.data || {};
                        const imp = syncData.imported || 0;
                        const upd = syncData.updated || 0;
                        totalImported += imp;
                        totalUpdated += upd;
                        processedCount++;

                        const updatedBulk = {
                            current: i + 1,
                            total: targetDealers.length,
                            currentDealerName: `${d.kode_dealer} - ${d.nama_dealer}`,
                            currentImported: totalImported,
                            currentUpdated: totalUpdated,
                        };
                        setBulkProgress(updatedBulk);

                        saveSession({
                            bulkProgress: updatedBulk,
                        });

                        addLog(
                            `[Berhasil] ${d.nama_dealer}: +${imp} ulasan baru, ${upd} terupdate.`,
                            'success',
                        );
                    } else if (statusData.status === 'failed') {
                        isCompleted = true;
                        addLog(`[Gagal] ${d.nama_dealer}: ${statusData.message || 'Scraping gagal'}`, 'warn');
                    }
                }
            } catch (err: unknown) {
                const errStr = err instanceof Error ? err.message : 'Error koneksi';
                addLog(`Kendala koneksi pada ${d.nama_dealer}: ${errStr}`, 'warn');
            }
        }

        setProgressPercent(100);
        const finalState = isCancelledRef.current ? 'cancelled' : 'completed';
        setSyncState(finalState);
        const finalMsg = isCancelledRef.current
            ? `Sinkronisasi dihentikan. Berhasil memproses ${processedCount} dari ${targetDealers.length} showroom.`
            : `Selesai seluruhnya! Berhasil memproses ${processedCount} showroom. Total +${totalImported} ulasan baru, ${totalUpdated} ulasan terupdate.`;
        setSyncMessage(finalMsg);
        const finalResult = {
            imported: totalImported,
            updated: totalUpdated,
            total_scraped: totalImported + totalUpdated,
            dealer_nama: `Semua Showroom (${processedCount} selesai)`,
        };
        setSyncResult(finalResult);

        saveSession({
            syncState: finalState,
            syncMessage: finalMsg,
            progressPercent: 100,
            syncResult: finalResult,
            activeJob: null,
        });

        addLog(finalMsg, isCancelledRef.current ? 'warn' : 'success');
        toast.success(finalMsg);
        router.reload({ only: ['dealers', 'stats'] });
    };

    // Form submit dispatcher
    const handleStartSync = (e: React.FormEvent) => {
        e.preventDefault();
        if (scraperOnline === false) {
            toast.error('Scraper service tidak aktif. Mohon jalankan scraper terlebih dahulu.');
            return;
        }

        if (selectedDealerId === 'all') {
            executeBulkSync();
        } else {
            executeSingleDealerSync(selectedDealerId);
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
                            <Link href={reviewsRoute.index()}>
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
                                                            executeSingleDealerSync(d.id);
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
