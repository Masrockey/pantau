import { Head, Link, router } from '@inertiajs/react';
import {
    AlertCircle,
    ArrowLeft,
    Calendar,
    CheckCircle2,
    Clock,
    Copy,
    ExternalLink,
    HelpCircle,
    Info,
    Layers,
    Loader2,
    Pencil,
    Play,
    Plus,
    RefreshCw,
    RotateCcw,
    Search,
    CheckSquare,
    ChevronLeft,
    ChevronRight,
    Database,
    Eye,
    Filter,
    MessageSquare,
    Shield,
    ShieldCheck,
    Square,
    Star,
    Terminal,
    Trash2,
} from 'lucide-react';
import React, { useEffect, useRef, useState } from 'react';
import { toast } from 'sonner';
import {
    Button as AntButton,
    Card as AntCard,
    Modal as AntModal,
    Popconfirm as AntPopconfirm,
    Progress as AntProgress,
    Select as AntSelect,
    Statistic as AntStatistic,
    Switch as AntSwitch,
    Tag as AntTag,
} from 'antd';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Checkbox } from '@/components/ui/checkbox';
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { dashboard } from '@/routes';
import dealersRoute from '@/routes/dealers';
import reviewsRoute from '@/routes/reviews';
import syncRoute from '@/routes/reviews/sync';
import schedulesRoute from '@/routes/reviews/sync/schedules';

export interface StagedReviewItem {
    id: string;
    dealer_id: number;
    kode_dealer?: string;
    nama_dealer?: string;
    nama_reviewer: string;
    author_profile_url?: string | null;
    star_rate: number;
    tanggal_publish_review: string;
    relative_time?: string | null;
    review?: string | null;
    respon_from_owner: boolean;
    tanggal_respon?: string | null;
    respon?: string | null;
    google_review_url?: string | null;
    status_action: 'new' | 'update';
    existing_id?: number | null;
    scraped_at?: string;
}

export interface ScrapingScheduleItem {
    id: number;
    dealer_id: number | null;
    max_reviews: number;
    sort_by: 'newest' | 'highest' | 'lowest' | 'relevant';
    interval_value: number;
    interval_unit: 'minute' | 'hour' | 'day' | 'week';
    formatted_interval?: string;
    use_proxy: boolean;
    is_active: boolean;
    last_run_at: string | null;
    next_run_at: string | null;
    last_status: string;
    last_message: string | null;
    dealer?: {
        id: number;
        kode_dealer: string;
        nama_dealer: string;
    } | null;
}

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
    schedules?: ScrapingScheduleItem[];
    serverStatus?: SyncServerStatus;
    serverLogs?: LogEntry[];
    stagedReviews?: StagedReviewItem[];
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
    schedules = [],
    serverStatus,
    serverLogs = [],
    stagedReviews = [],
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

    // Schedule list & modal states
    const [scheduleList, setScheduleList] = useState<ScrapingScheduleItem[]>(schedules);
    useEffect(() => {
        setScheduleList(schedules);
    }, [schedules]);

    const [isScheduleModalOpen, setIsScheduleModalOpen] = useState(false);
    const [editingSchedule, setEditingSchedule] = useState<ScrapingScheduleItem | null>(null);
    const [scheduleForm, setScheduleForm] = useState<{
        dealer_id: string;
        max_reviews: number;
        sort_by: 'newest' | 'highest' | 'lowest' | 'relevant';
        interval_value: number;
        interval_unit: 'minute' | 'hour' | 'day' | 'week';
        use_proxy: boolean;
        is_active: boolean;
    }>({
        dealer_id: 'all',
        max_reviews: 50,
        sort_by: 'newest',
        interval_value: 30,
        interval_unit: 'minute',
        use_proxy: true,
        is_active: true,
    });
    const [isSubmittingSchedule, setIsSubmittingSchedule] = useState(false);
    const [runningScheduleId, setRunningScheduleId] = useState<number | null>(null);
    const [togglingScheduleId, setTogglingScheduleId] = useState<number | null>(null);
    const [deletingScheduleId, setDeletingScheduleId] = useState<number | null>(null);

    const intervalError = React.useMemo(() => {
        const val = Number(scheduleForm.interval_value);
        if (isNaN(val) || val <= 0) {
            return 'Waktu update harus berupa angka positif.';
        }
        if (scheduleForm.interval_unit === 'minute' && val < 5) {
            return 'Waktu update minimal adalah 5 menit (tidak boleh di bawah 5 menit).';
        }
        return null;
    }, [scheduleForm.interval_value, scheduleForm.interval_unit]);

    const handleOpenAddModal = () => {
        setEditingSchedule(null);
        setScheduleForm({
            dealer_id: 'all',
            max_reviews: 50,
            sort_by: 'newest',
            interval_value: 30,
            interval_unit: 'minute',
            use_proxy: true,
            is_active: true,
        });
        setIsScheduleModalOpen(true);
    };

    const handleOpenEditModal = (sched: ScrapingScheduleItem) => {
        setEditingSchedule(sched);
        setScheduleForm({
            dealer_id: sched.dealer_id ? String(sched.dealer_id) : 'all',
            max_reviews: sched.max_reviews,
            sort_by: sched.sort_by,
            interval_value: sched.interval_value,
            interval_unit: sched.interval_unit,
            use_proxy: sched.use_proxy,
            is_active: sched.is_active,
        });
        setIsScheduleModalOpen(true);
    };

    const handleSaveSchedule = async (e: React.FormEvent) => {
        e.preventDefault();
        if (intervalError) {
            toast.error(intervalError);
            return;
        }

        setIsSubmittingSchedule(true);
        const csrfToken = (document.querySelector('meta[name="csrf-token"]') as HTMLMetaElement)?.content || '';
        const isEditing = Boolean(editingSchedule);
        const url = isEditing && editingSchedule
            ? schedulesRoute.update.url({ schedule: editingSchedule.id })
            : schedulesRoute.store.url();
        const method = isEditing ? 'PUT' : 'POST';

        try {
            const res = await fetch(url, {
                method,
                headers: {
                    'Content-Type': 'application/json',
                    'X-CSRF-TOKEN': csrfToken,
                    Accept: 'application/json',
                },
                body: JSON.stringify({
                    dealer_id: scheduleForm.dealer_id === 'all' ? null : scheduleForm.dealer_id,
                    max_reviews: Number(scheduleForm.max_reviews),
                    sort_by: scheduleForm.sort_by,
                    interval_value: Number(scheduleForm.interval_value),
                    interval_unit: scheduleForm.interval_unit,
                    use_proxy: scheduleForm.use_proxy,
                    is_active: scheduleForm.is_active,
                }),
            });

            const data = await res.json();
            if (!res.ok || !data.success) {
                const errMsg = data.message || 'Gagal menyimpan jadwal scraping.';
                toast.error(errMsg);
                return;
            }

            toast.success(data.message || (isEditing ? 'Jadwal berhasil diperbarui.' : 'Jadwal berhasil dibuat.'));
            setIsScheduleModalOpen(false);
            router.reload({ only: ['schedules'] });
        } catch (err: unknown) {
            const errStr = err instanceof Error ? err.message : 'Terjadi kendala koneksi ke server.';
            toast.error(errStr);
        } finally {
            setIsSubmittingSchedule(false);
        }
    };

    const handleToggleSchedule = async (sched: ScrapingScheduleItem) => {
        setTogglingScheduleId(sched.id);
        const csrfToken = (document.querySelector('meta[name="csrf-token"]') as HTMLMetaElement)?.content || '';

        try {
            const res = await fetch(schedulesRoute.toggle.url({ schedule: sched.id }), {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'X-CSRF-TOKEN': csrfToken,
                    Accept: 'application/json',
                },
            });

            const data = await res.json();
            if (!res.ok || !data.success) {
                toast.error(data.message || 'Gagal mengubah status jadwal.');
                return;
            }

            toast.success(data.message || 'Status jadwal berhasil diubah.');
            router.reload({ only: ['schedules'] });
        } catch {
            toast.error('Gagal menghubungi server untuk mengubah status jadwal.');
        } finally {
            setTogglingScheduleId(null);
        }
    };

    const handleRunSchedule = async (sched: ScrapingScheduleItem) => {
        if (scraperOnline === false) {
            toast.error('Scraper service tidak aktif di port 3000.');
            return;
        }

        setRunningScheduleId(sched.id);
        const csrfToken = (document.querySelector('meta[name="csrf-token"]') as HTMLMetaElement)?.content || '';

        try {
            const res = await fetch(schedulesRoute.run.url({ schedule: sched.id }), {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'X-CSRF-TOKEN': csrfToken,
                    Accept: 'application/json',
                },
            });

            const data = await res.json();
            if (!res.ok || !data.success) {
                toast.error(data.message || 'Gagal meluncurkan auto scrap.');
                return;
            }

            toast.success(data.message || 'Auto scrap berhasil diluncurkan di server.');
            startPolling();
            router.reload({ only: ['schedules', 'serverStatus'] });
        } catch {
            toast.error('Gagal menghubungi server untuk menjalankan auto scrap.');
        } finally {
            setRunningScheduleId(null);
        }
    };

    const handleDeleteSchedule = async (sched: ScrapingScheduleItem) => {
        const targetLabel = sched.dealer ? sched.dealer.nama_dealer : 'Semua Showroom';
        if (!window.confirm(`Hapus jadwal auto scrap untuk "${targetLabel}"?`)) {
            return;
        }

        setDeletingScheduleId(sched.id);
        const csrfToken = (document.querySelector('meta[name="csrf-token"]') as HTMLMetaElement)?.content || '';

        try {
            const res = await fetch(schedulesRoute.destroy.url({ schedule: sched.id }), {
                method: 'DELETE',
                headers: {
                    'Content-Type': 'application/json',
                    'X-CSRF-TOKEN': csrfToken,
                    Accept: 'application/json',
                },
            });

            const data = await res.json();
            if (!res.ok || !data.success) {
                toast.error(data.message || 'Gagal menghapus jadwal.');
                return;
            }

            toast.success(data.message || 'Jadwal berhasil dihapus.');
            router.reload({ only: ['schedules'] });
        } catch {
            toast.error('Gagal menghubungi server untuk menghapus jadwal.');
        } finally {
            setDeletingScheduleId(null);
        }
    };

    const formatDateTime = (dateStr?: string | null) => {
        if (!dateStr) return '-';
        try {
            const d = new Date(dateStr);
            if (isNaN(d.getTime())) return dateStr;
            return d.toLocaleString('id-ID', {
                day: 'numeric',
                month: 'short',
                year: 'numeric',
                hour: '2-digit',
                minute: '2-digit',
            });
        } catch {
            return dateStr;
        }
    };

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

    // Staged reviews state (preview before inserting to database)
    const [stagedList, setStagedList] = useState<StagedReviewItem[]>(stagedReviews || []);
    const [selectedStagedIds, setSelectedStagedIds] = useState<string[]>([]);
    const [isCommitting, setIsCommitting] = useState(false);
    const [isClearingStaged, setIsClearingStaged] = useState(false);
    const [isConfirmCommitModalOpen, setIsConfirmCommitModalOpen] = useState(false);
    const [previewReviewDetail, setPreviewReviewDetail] = useState<StagedReviewItem | null>(null);

    // Staged table filters & pagination
    const [stagedSearch, setStagedSearch] = useState('');
    const [stagedDealerFilter, setStagedDealerFilter] = useState('all');
    const [stagedStatusFilter, setStagedStatusFilter] = useState<'all' | 'new' | 'update'>('all');
    const [stagedRatingFilter, setStagedRatingFilter] = useState<string>('all');
    const [stagedResponseFilter, setStagedResponseFilter] = useState<'all' | 'yes' | 'no'>('all');
    const [stagedPage, setStagedPage] = useState(1);
    const [stagedPageSize, setStagedPageSize] = useState(10);

    // Sync with incoming props
    useEffect(() => {
        if (stagedReviews) {
            setStagedList(stagedReviews);
        }
    }, [stagedReviews]);

    // Quick table search & filter for showroom list
    const [tableSearch, setTableSearch] = useState('');
    const [filterMapsOnly, setFilterMapsOnly] = useState<'all' | 'with_maps' | 'without_maps'>('all');

    // Staged review handlers
    const handleCommitStagedReviews = async (onlySelected = false) => {
        const idsToCommit = onlySelected ? selectedStagedIds : null;
        if (onlySelected && selectedStagedIds.length === 0) {
            toast.error('Silakan pilih setidaknya satu ulasan untuk dimasukkan ke database.');
            return;
        }

        setIsCommitting(true);
        const csrfToken = (document.querySelector('meta[name="csrf-token"]') as HTMLMetaElement)?.content || '';

        try {
            const res = await fetch(syncRoute.commit.url(), {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'X-CSRF-TOKEN': csrfToken,
                    Accept: 'application/json',
                },
                body: JSON.stringify({
                    selected_ids: idsToCommit,
                }),
            });

            const data = await res.json();
            if (!res.ok || !data.success) {
                toast.error(data.message || 'Gagal memasukkan ulasan ke database.');
                return;
            }

            toast.success(data.message || 'Ulasan berhasil dimasukkan ke database!');
            setStagedList(data.stagedReviews || []);
            setSelectedStagedIds([]);
            setIsConfirmCommitModalOpen(false);
            router.reload({ only: ['stats', 'dealers'] });
        } catch {
            toast.error('Gagal menghubungi server untuk memasukkan ulasan.');
        } finally {
            setIsCommitting(false);
        }
    };

    const handleClearStagedReviews = async () => {
        setIsClearingStaged(true);
        const csrfToken = (document.querySelector('meta[name="csrf-token"]') as HTMLMetaElement)?.content || '';

        try {
            const res = await fetch(syncRoute.clearStaged.url(), {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'X-CSRF-TOKEN': csrfToken,
                    Accept: 'application/json',
                },
            });

            const data = await res.json();
            if (!res.ok || !data.success) {
                toast.error(data.message || 'Gagal membersihkan daftar pratinjau.');
                return;
            }

            toast.success(data.message || 'Daftar pratinjau berhasil dibersihkan.');
            setStagedList([]);
            setSelectedStagedIds([]);
        } catch {
            toast.error('Gagal menghubungi server untuk membersihkan pratinjau.');
        } finally {
            setIsClearingStaged(false);
        }
    };

    const handleFetchStagedReviews = async () => {
        try {
            const res = await fetch(syncRoute.staged.url(), {
                headers: { Accept: 'application/json' },
            });
            if (res.ok) {
                const data = await res.json();
                if (Array.isArray(data.stagedReviews)) {
                    setStagedList(data.stagedReviews);
                    toast.success('Daftar pratinjau ulasan berhasil disegarkan.');
                }
            }
        } catch {
            toast.error('Gagal memuat pratinjau ulasan dari server.');
        }
    };

    // Derived filtering for staged reviews
    const distinctDealersInStaging = React.useMemo(() => {
        const map = new Map<number, { id: number; kode: string; nama: string; count: number }>();
        stagedList.forEach((item) => {
            const cur = map.get(item.dealer_id);
            if (cur) {
                cur.count++;
            } else {
                map.set(item.dealer_id, {
                    id: item.dealer_id,
                    kode: item.kode_dealer || '',
                    nama: item.nama_dealer || `Dealer #${item.dealer_id}`,
                    count: 1,
                });
            }
        });
        return Array.from(map.values());
    }, [stagedList]);

    const filteredStagedList = React.useMemo(() => {
        return stagedList.filter((item) => {
            if (stagedSearch.trim()) {
                const q = stagedSearch.toLowerCase();
                const nameMatch = item.nama_reviewer?.toLowerCase().includes(q);
                const dealerMatch =
                    item.nama_dealer?.toLowerCase().includes(q) ||
                    item.kode_dealer?.toLowerCase().includes(q);
                const textMatch = item.review?.toLowerCase().includes(q);
                if (!nameMatch && !dealerMatch && !textMatch) {
                    return false;
                }
            }

            if (stagedDealerFilter !== 'all' && String(item.dealer_id) !== stagedDealerFilter) {
                return false;
            }

            if (stagedStatusFilter !== 'all' && item.status_action !== stagedStatusFilter) {
                return false;
            }

            if (stagedRatingFilter !== 'all' && Math.floor(item.star_rate) !== Number(stagedRatingFilter)) {
                return false;
            }

            if (stagedResponseFilter === 'yes' && !item.respon_from_owner) {
                return false;
            }

            if (stagedResponseFilter === 'no' && item.respon_from_owner) {
                return false;
            }

            return true;
        });
    }, [stagedList, stagedSearch, stagedDealerFilter, stagedStatusFilter, stagedRatingFilter, stagedResponseFilter]);

    useEffect(() => {
        setStagedPage(1);
    }, [stagedSearch, stagedDealerFilter, stagedStatusFilter, stagedRatingFilter, stagedResponseFilter, stagedPageSize]);

    const totalStagedPages = Math.max(1, Math.ceil(filteredStagedList.length / stagedPageSize));
    const paginatedStagedList = React.useMemo(() => {
        const start = (stagedPage - 1) * stagedPageSize;
        return filteredStagedList.slice(start, start + stagedPageSize);
    }, [filteredStagedList, stagedPage, stagedPageSize]);

    const allCurrentPageSelected =
        paginatedStagedList.length > 0 &&
        paginatedStagedList.every((i) => selectedStagedIds.includes(i.id));

    const toggleSelectAllCurrentPage = () => {
        if (allCurrentPageSelected) {
            const pageIds = new Set(paginatedStagedList.map((i) => i.id));
            setSelectedStagedIds((prev) => prev.filter((id) => !pageIds.has(id)));
        } else {
            const pageIds = paginatedStagedList.map((i) => i.id);
            setSelectedStagedIds((prev) => Array.from(new Set([...prev, ...pageIds])));
        }
    };

    const toggleSelectAllFiltered = () => {
        if (selectedStagedIds.length === filteredStagedList.length) {
            setSelectedStagedIds([]);
        } else {
            setSelectedStagedIds(filteredStagedList.map((i) => i.id));
        }
    };

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
                if (Array.isArray(data.stagedReviews)) {
                    setStagedList(data.stagedReviews);
                }

                if (status.status === 'completed') {
                    if (pollRef.current) {
                        clearInterval(pollRef.current);
                        pollRef.current = null;
                    }
                    toast.success(status.syncMessage || 'Sinkronisasi ulasan selesai diproses di server.');
                    router.reload({ only: ['dealers', 'stats', 'stagedReviews'] });
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

    // Background ticker to check for due schedules and monitor background server execution
    useEffect(() => {
        const scheduleTicker = setInterval(async () => {
            const now = new Date();
            const hasDueSchedule = scheduleList.some(
                (s) => s.is_active && s.next_run_at && new Date(s.next_run_at) <= now
            );

            if (hasDueSchedule || syncState === 'starting' || syncState === 'running') {
                try {
                    const res = await fetch(syncRoute.progress.url(), {
                        headers: { Accept: 'application/json' },
                    });
                    if (res.ok) {
                        const data = await res.json();
                        const status: SyncServerStatus = data.status || {};
                        if (status.status) {
                            setSyncState(status.status);
                            setSyncMessage(status.syncMessage || '');
                            setSyncError(status.syncError ?? null);
                            setProgressPercent(status.progressPercent ?? 0);
                            setBulkProgress(status.bulkProgress ?? null);
                            setSyncResult(status.syncResult ?? null);
                            if (Array.isArray(data.stagedReviews)) {
                                setStagedList(data.stagedReviews);
                            }

                            if (status.status === 'starting' || status.status === 'running') {
                                if (!pollRef.current) {
                                    startPolling();
                                }
                            } else if (pollRef.current) {
                                clearInterval(pollRef.current);
                                pollRef.current = null;
                            }
                            router.reload({ only: ['schedules', 'serverStatus', 'stagedReviews'] });
                        }
                    }
                } catch {
                    // Ignore transient errors
                }
            }
        }, 10000);

        return () => clearInterval(scheduleTicker);
    }, [scheduleList, syncState]);

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
    const handleCancelSync = async (force = false) => {
        const csrfToken = (document.querySelector('meta[name="csrf-token"]') as HTMLMetaElement)?.content || '';
        try {
            const res = await fetch(syncRoute.cancel.url(), {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'X-CSRF-TOKEN': csrfToken,
                    Accept: 'application/json',
                },
                body: JSON.stringify({ force }),
            });
            const data = await res.json();
            if (res.ok) {
                if (force || scraperOnline === false) {
                    toast.info(data.message || 'Proses sinkronisasi berhasil dihentikan.');
                    setSyncState('cancelled');
                    setSyncMessage(data.message || 'Sinkronisasi berhasil dihentikan.');
                    if (pollRef.current) {
                        clearInterval(pollRef.current);
                        pollRef.current = null;
                    }
                    router.reload({ only: ['serverStatus'] });
                } else {
                    toast.info('Permintaan pembatalan telah dikirim ke server.');
                    setSyncMessage('Mengirim sinyal pembatalan ke server...');
                }
            } else {
                toast.error(data.message || 'Gagal mengirim sinyal pembatalan ke server.');
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
                            Cek Server
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
                    className={`flex flex-col gap-3 rounded-xl border p-4 sm:flex-row sm:items-center sm:justify-between ${scraperOnline === true
                            ? 'border-emerald-500/30 bg-emerald-500/5 dark:bg-emerald-950/20'
                            : scraperOnline === false
                                ? 'border-rose-500/30 bg-rose-500/5 dark:bg-rose-950/20'
                                : 'border-sidebar-border bg-card'
                        }`}
                >
                    <div className="flex items-center gap-3">
                        <div
                            className={`flex size-9 shrink-0 items-center justify-center rounded-lg ${scraperOnline === true
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
                                        ? 'Server Google Online'
                                        : scraperOnline === false
                                            ? 'Server Google Tidak Aktif'
                                            : 'Memeriksa Server Google...'}
                                </span>
                                {scraperOnline === true && (
                                    <span className="flex size-2 rounded-full bg-emerald-500 animate-pulse" />
                                )}
                            </div>
                            <p className="text-xs text-muted-foreground">
                                {scraperOnline === true
                                    ? 'API Server aktif dan siap mengekstrak data ulasan.'
                                    : scraperOnline === false
                                        ? 'Pastikan Google service sudah dinyalakan sebelum memulai sinkronisasi.'
                                        : 'Mengecek konektivitas backend...'}
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
                            {scraperOnline ? 'Server OK' : 'Server Down'}
                        </Badge>
                    </div>
                </div>

                {/* Metric Summary Cards */}
                <div className="grid grid-cols-2 gap-3 sm:grid-cols-4 md:gap-4">
                    <AntCard size="small" className="shadow-xs border border-border/60 hover:border-primary/40 transition-all">
                        <AntStatistic
                            title={<span className="text-xs text-muted-foreground font-medium">Total Showroom</span>}
                            value={stats.total_dealers}
                            prefix={<span className="mr-1 text-sm">🏢</span>}
                            valueStyle={{ fontWeight: 700, fontSize: '1.5rem' }}
                        />
                        <p className="text-[11px] text-muted-foreground mt-1">Showroom dalam jangkauan</p>
                    </AntCard>

                    <AntCard size="small" className="shadow-xs border border-border/60 hover:border-emerald-500/40 transition-all">
                        <AntStatistic
                            title={<span className="text-xs text-muted-foreground font-medium">Siap Sinkronisasi</span>}
                            value={stats.dealers_with_maps}
                            valueStyle={{ fontWeight: 700, fontSize: '1.5rem', color: '#10b981' }}
                            prefix={<CheckCircle2 className="inline size-4 text-emerald-500 mr-1" />}
                        />
                        <p className="text-[11px] text-muted-foreground mt-1">Link Google Maps terisi</p>
                    </AntCard>

                    <AntCard size="small" className="shadow-xs border border-border/60 hover:border-amber-500/40 transition-all">
                        <AntStatistic
                            title={<span className="text-xs text-muted-foreground font-medium">Tanpa Google Maps</span>}
                            value={stats.dealers_without_maps}
                            valueStyle={{ fontWeight: 700, fontSize: '1.5rem', color: '#f59e0b' }}
                            prefix={<AlertCircle className="inline size-4 text-amber-500 mr-1" />}
                        />
                        <p className="text-[11px] text-muted-foreground mt-1">Perlu dilengkapi di Dealer</p>
                    </AntCard>

                    <AntCard size="small" className="shadow-xs border border-border/60 hover:border-amber-500/40 transition-all">
                        <AntStatistic
                            title={<span className="text-xs text-muted-foreground font-medium">Total Review di DB</span>}
                            value={stats.total_reviews_db}
                            valueStyle={{ fontWeight: 700, fontSize: '1.5rem' }}
                            prefix={<Star className="inline size-4 text-amber-400 fill-amber-400 mr-1" />}
                        />
                        <p className="text-[11px] text-muted-foreground mt-1">Ulasan tersimpan di sistem</p>
                    </AntCard>
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
                                            <AntSelect
                                                id="dealer_id"
                                                showSearch
                                                optionFilterProp="label"
                                                value={selectedDealerId}
                                                onChange={(val) => setSelectedDealerId(val)}
                                                disabled={isRunning}
                                                className="w-full"
                                                options={[
                                                    {
                                                        value: 'all',
                                                        label: `🔄 Semua Dealer (${stats.dealers_with_maps} siap sync)`,
                                                    },
                                                    ...dealers.map((d) => ({
                                                        value: String(d.id),
                                                        label: `${d.kode_dealer} - ${d.nama_dealer} ${!d.link_google_maps ? '(Tanpa Link Maps)' : ''}`,
                                                        disabled: !d.link_google_maps,
                                                    })),
                                                ]}
                                            />
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
                                        <AntSelect
                                            id="sort_by"
                                            value={sortBy}
                                            onChange={(val) => setSortBy(val)}
                                            disabled={isRunning}
                                            className="w-full"
                                            options={[
                                                { value: 'newest', label: 'Terbaru (Rekomendasi untuk update rutin)' },
                                                { value: 'relevant', label: 'Paling Relevan' },
                                                { value: 'highest', label: 'Rating Tertinggi' },
                                                { value: 'lowest', label: 'Rating Terendah (Keluhan Konsumen)' },
                                            ]}
                                        />
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
                                            <div className="flex flex-col gap-2">
                                                <Button
                                                    type="button"
                                                    variant="destructive"
                                                    onClick={() => handleCancelSync(false)}
                                                    className="w-full gap-2 shadow-sm font-medium"
                                                >
                                                    <Square className="size-4" />
                                                    Hentikan Sinkronisasi
                                                </Button>
                                                <Button
                                                    type="button"
                                                    variant="outline"
                                                    size="sm"
                                                    onClick={() => handleCancelSync(true)}
                                                    className="w-full gap-1.5 text-xs text-destructive hover:bg-destructive/10 hover:text-destructive border-destructive/30"
                                                >
                                                    <RotateCcw className="size-3.5" />
                                                    Paksa Berhenti & Reset Status
                                                </Button>
                                            </div>
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
                                    {isRunning && (
                                        <Button
                                            type="button"
                                            variant="outline"
                                            size="sm"
                                            onClick={() => handleCancelSync(true)}
                                            className="h-7 px-2 text-xs text-destructive border-destructive/30 hover:bg-destructive/10 gap-1"
                                            title="Paksa hentikan proses sekarang juga dan kembalikan status"
                                        >
                                            <Square className="size-3 fill-current" />
                                            Paksa Stop
                                        </Button>
                                    )}
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
                                {scraperOnline === false && isRunning && (
                                    <div className="rounded-xl border border-destructive/40 bg-destructive/10 p-3 text-destructive flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                                        <div className="flex items-start gap-2.5">
                                            <AlertCircle className="size-4 shrink-0 mt-0.5" />
                                            <div className="text-xs">
                                                <span className="font-semibold block">Scraper Service Tidak Aktif (Port 3000 Down)</span>
                                                <span className="text-destructive/80">Proses tidak dapat berlanjut karena service scraper offline. Klik tombol untuk menghentikan paksa.</span>
                                            </div>
                                        </div>
                                        <Button
                                            type="button"
                                            variant="destructive"
                                            size="sm"
                                            onClick={() => handleCancelSync(true)}
                                            className="shrink-0 h-7 text-xs font-semibold gap-1.5 shadow-sm"
                                        >
                                            <Square className="size-3 fill-current" />
                                            Paksa Hentikan & Reset
                                        </Button>
                                    </div>
                                )}
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
                                    <AntProgress
                                        percent={progressPercent}
                                        status={
                                            syncState === 'failed'
                                                ? 'exception'
                                                : syncState === 'completed'
                                                    ? 'success'
                                                    : isRunning
                                                        ? 'active'
                                                        : 'normal'
                                        }
                                        strokeColor={
                                            syncState === 'failed'
                                                ? '#ef4444'
                                                : syncState === 'completed'
                                                    ? '#10b981'
                                                    : { '0%': '#e60012', '100%': '#ff4d4f' }
                                        }
                                        showInfo={false}
                                    />
                                </div>

                                {syncMessage && (
                                    <div
                                        className={`rounded-lg p-3 text-xs flex items-start gap-2 ${syncState === 'failed'
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
                                    <CardTitle className="text-sm">Log Aktivitas Sync</CardTitle>
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

                {/* Tabel Hasil Scraping Ulasan (Pratinjau Sebelum Masuk Database) */}
                <Card className={`border shadow-sm transition-all ${stagedList.length > 0 ? 'border-primary/40 ring-1 ring-primary/20' : ''}`}>
                    <CardHeader className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between pb-3 bg-muted/10 border-b">
                        <div>
                            <div className="flex flex-wrap items-center gap-2">
                                <Database className="size-5 text-emerald-600 dark:text-emerald-400" />
                                <CardTitle className="text-base font-bold">
                                    Tabel Hasil Scraping Ulasan (Pratinjau Sebelum Masuk Database)
                                </CardTitle>
                                <Badge
                                    variant={stagedList.length > 0 ? 'default' : 'secondary'}
                                    className="font-semibold text-xs"
                                >
                                    {stagedList.length} Ulasan Tersedia
                                </Badge>
                                {stagedList.length > 0 && (
                                    <>
                                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-semibold bg-emerald-500/15 text-emerald-700 dark:text-emerald-400 border border-emerald-500/30">
                                            +{stagedList.filter((i) => i.status_action === 'new').length} Baru
                                        </span>
                                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-semibold bg-blue-500/15 text-blue-700 dark:text-blue-400 border border-blue-500/30">
                                            {stagedList.filter((i) => i.status_action === 'update').length} Update
                                        </span>
                                    </>
                                )}
                            </div>
                            <CardDescription className="text-xs mt-1">
                                Ulasan hasil scraping Google Maps ditampilkan di tabel ini untuk ditinjau terlebih dahulu.
                                Proses insert ke database MySQL <strong>tidak otomatis</strong>. Periksa data ulasan, lalu klik tombol
                                <span className="font-semibold text-emerald-600 dark:text-emerald-400"> &quot;Masukkan ke Database&quot;</span> untuk menyimpannya secara permanen.
                            </CardDescription>
                        </div>

                        {/* Action buttons */}
                        <div className="flex flex-wrap items-center gap-2 shrink-0">
                            <Button
                                type="button"
                                variant="outline"
                                size="sm"
                                onClick={handleFetchStagedReviews}
                                className="h-8 gap-1.5 text-xs"
                                title="Segarkan data pratinjau dari server"
                            >
                                <RefreshCw className="size-3.5" />
                                <span>Segarkan</span>
                            </Button>

                            {stagedList.length > 0 && (
                                <AntPopconfirm
                                    title="Bersihkan Pratinjau Ulasan?"
                                    description="Seluruh ulasan di tabel pratinjau ini akan dihapus dari antrean cache dan tidak dimasukkan ke database. Lanjutkan?"
                                    okText="Ya, Bersihkan"
                                    cancelText="Batal"
                                    okButtonProps={{ danger: true }}
                                    onConfirm={handleClearStagedReviews}
                                >
                                    <Button
                                        type="button"
                                        variant="outline"
                                        size="sm"
                                        disabled={isClearingStaged}
                                        className="h-8 gap-1.5 text-xs text-rose-600 hover:text-rose-700 hover:bg-rose-50 dark:hover:bg-rose-950/20 border-rose-300 dark:border-rose-800"
                                    >
                                        <Trash2 className="size-3.5 text-rose-500" />
                                        <span>Bersihkan Pratinjau</span>
                                    </Button>
                                </AntPopconfirm>
                            )}

                            <Button
                                type="button"
                                size="sm"
                                disabled={stagedList.length === 0 || isCommitting}
                                onClick={() => setIsConfirmCommitModalOpen(true)}
                                className="h-8 gap-1.5 text-xs font-semibold bg-emerald-600 hover:bg-emerald-700 text-white shadow-sm"
                            >
                                {isCommitting ? (
                                    <>
                                        <Loader2 className="size-3.5 animate-spin" />
                                        <span>Menyimpan ke DB...</span>
                                    </>
                                ) : (
                                    <>
                                        <Database className="size-3.5" />
                                        <span>
                                            {selectedStagedIds.length > 0
                                                ? `Masukkan ${selectedStagedIds.length} Ulasan Terpilih ke Database`
                                                : `Masukkan Semua (${filteredStagedList.length}) ke Database`}
                                        </span>
                                    </>
                                )}
                            </Button>
                        </div>
                    </CardHeader>

                    <CardContent className="p-4 space-y-4">
                        {/* Filters & Search Toolbar (Only when there are staged reviews) */}
                        {stagedList.length > 0 && (
                            <div className="flex flex-col gap-3 rounded-lg border bg-muted/20 p-3">
                                <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-2 md:grid-cols-12">
                                    {/* Search Input */}
                                    <div className="relative md:col-span-4">
                                        <Search className="absolute left-2.5 top-2.5 size-3.5 text-muted-foreground" />
                                        <Input
                                            placeholder="Cari reviewer, isi ulasan, showroom..."
                                            value={stagedSearch}
                                            onChange={(e) => setStagedSearch(e.target.value)}
                                            className="h-8 pl-8 text-xs bg-background"
                                        />
                                    </div>

                                    {/* Dealer Showroom Filter */}
                                    <div className="md:col-span-3">
                                        <AntSelect
                                            value={stagedDealerFilter}
                                            onChange={setStagedDealerFilter}
                                            className="w-full text-xs"
                                            size="small"
                                            options={[
                                                { value: 'all', label: `Semua Showroom (${distinctDealersInStaging.length})` },
                                                ...distinctDealersInStaging.map((d) => ({
                                                    value: String(d.id),
                                                    label: `${d.kode} - ${d.nama} (${d.count})`,
                                                })),
                                            ]}
                                        />
                                    </div>

                                    {/* Status DB Filter */}
                                    <div className="md:col-span-2">
                                        <AntSelect
                                            value={stagedStatusFilter}
                                            onChange={setStagedStatusFilter}
                                            className="w-full text-xs"
                                            size="small"
                                            options={[
                                                { value: 'all', label: 'Semua Status DB' },
                                                { value: 'new', label: '✨ Hanya Baru (+ Baru)' },
                                                { value: 'update', label: '🔄 Hanya Update' },
                                            ]}
                                        />
                                    </div>

                                    {/* Star Rating Filter */}
                                    <div className="md:col-span-2">
                                        <AntSelect
                                            value={stagedRatingFilter}
                                            onChange={setStagedRatingFilter}
                                            className="w-full text-xs"
                                            size="small"
                                            options={[
                                                { value: 'all', label: 'Semua Rating' },
                                                { value: '5', label: '★ 5 Bintang' },
                                                { value: '4', label: '★ 4 Bintang' },
                                                { value: '3', label: '★ 3 Bintang' },
                                                { value: '2', label: '★ 2 Bintang' },
                                                { value: '1', label: '★ 1 Bintang' },
                                            ]}
                                        />
                                    </div>

                                    {/* Respon Owner Filter */}
                                    <div className="md:col-span-1">
                                        <AntSelect
                                            value={stagedResponseFilter}
                                            onChange={setStagedResponseFilter}
                                            className="w-full text-xs"
                                            size="small"
                                            options={[
                                                { value: 'all', label: 'Respon' },
                                                { value: 'yes', label: 'Ada Respon' },
                                                { value: 'no', label: 'Belum Ada' },
                                            ]}
                                        />
                                    </div>
                                </div>

                                {/* Selection Summary Bar */}
                                <div className="flex flex-wrap items-center justify-between gap-2 pt-1 border-t border-border/40 text-xs">
                                    <div className="flex items-center gap-2">
                                        <span className="text-muted-foreground">
                                            Menampilkan <strong>{filteredStagedList.length}</strong> dari{' '}
                                            <strong>{stagedList.length}</strong> ulasan hasil scraping.
                                        </span>
                                        {selectedStagedIds.length > 0 && (
                                            <Badge variant="outline" className="bg-primary/10 text-primary border-primary/30">
                                                {selectedStagedIds.length} ulasan terpilih
                                            </Badge>
                                        )}
                                    </div>

                                    <div className="flex items-center gap-2">
                                        {selectedStagedIds.length > 0 ? (
                                            <>
                                                <Button
                                                    type="button"
                                                    variant="ghost"
                                                    size="sm"
                                                    onClick={() => setSelectedStagedIds([])}
                                                    className="h-6 px-2 text-[11px] text-muted-foreground hover:text-foreground"
                                                >
                                                    Batalkan Pilihan
                                                </Button>
                                                <Button
                                                    type="button"
                                                    variant="secondary"
                                                    size="sm"
                                                    onClick={toggleSelectAllFiltered}
                                                    className="h-6 px-2 text-[11px]"
                                                >
                                                    {selectedStagedIds.length === filteredStagedList.length
                                                        ? 'Kosongkan Pilihan'
                                                        : `Pilih Semua Hasil Filter (${filteredStagedList.length})`}
                                                </Button>
                                            </>
                                        ) : (
                                            <Button
                                                type="button"
                                                variant="ghost"
                                                size="sm"
                                                onClick={toggleSelectAllFiltered}
                                                className="h-6 px-2 text-[11px] text-primary hover:text-primary/80"
                                            >
                                                Pilih Semua ({filteredStagedList.length})
                                            </Button>
                                        )}
                                    </div>
                                </div>
                            </div>
                        )}

                        {/* Staged Reviews Table */}
                        <div className="overflow-x-auto rounded-lg border">
                            <table className="w-full text-left text-xs whitespace-nowrap">
                                <thead className="border-b bg-muted/40 font-medium text-muted-foreground">
                                    <tr>
                                        <th className="px-3 py-2.5 w-10 text-center">
                                            <Checkbox
                                                checked={allCurrentPageSelected}
                                                onCheckedChange={toggleSelectAllCurrentPage}
                                                aria-label="Pilih semua halaman ini"
                                            />
                                        </th>
                                        <th className="px-3 py-2.5">Status DB</th>
                                        <th className="px-4 py-2.5">Target Showroom</th>
                                        <th className="px-4 py-2.5">Reviewer</th>
                                        <th className="px-3 py-2.5 text-center">Rating</th>
                                        <th className="px-3 py-2.5">Tanggal Ulasan</th>
                                        <th className="px-4 py-2.5 min-w-[250px]">Isi Ulasan Google Maps</th>
                                        <th className="px-3 py-2.5">Respon Owner</th>
                                        <th className="px-3 py-2.5 text-right">Aksi</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-border/60">
                                    {stagedList.length === 0 ? (
                                        <tr>
                                            <td colSpan={9} className="py-12 text-center text-muted-foreground">
                                                <div className="flex flex-col items-center justify-center max-w-md mx-auto">
                                                    <div className="size-12 rounded-full bg-muted flex items-center justify-center mb-3">
                                                        <Database className="size-6 text-muted-foreground/60" />
                                                    </div>
                                                    <p className="font-semibold text-foreground text-sm">
                                                        Belum ada ulasan di antrean pratinjau.
                                                    </p>
                                                    <p className="text-xs text-muted-foreground mt-1 text-center">
                                                        Jalankan proses sinkronisasi showroom di panel konfigurasi atas untuk mengekstrak ulasan Google Maps terbaru.
                                                        Data ulasan hasil scraping akan tampil di tabel ini untuk Anda periksa terlebih dahulu sebelum disimpan ke database.
                                                    </p>
                                                </div>
                                            </td>
                                        </tr>
                                    ) : paginatedStagedList.length === 0 ? (
                                        <tr>
                                            <td colSpan={9} className="py-8 text-center text-muted-foreground">
                                                <p className="font-medium">Tidak ada ulasan yang sesuai dengan filter pencarian.</p>
                                                <Button
                                                    type="button"
                                                    variant="link"
                                                    size="sm"
                                                    onClick={() => {
                                                        setStagedSearch('');
                                                        setStagedDealerFilter('all');
                                                        setStagedStatusFilter('all');
                                                        setStagedRatingFilter('all');
                                                        setStagedResponseFilter('all');
                                                    }}
                                                    className="text-xs mt-1"
                                                >
                                                    Reset Semua Filter
                                                </Button>
                                            </td>
                                        </tr>
                                    ) : (
                                        paginatedStagedList.map((item) => {
                                            const isSelected = selectedStagedIds.includes(item.id);
                                            return (
                                                <tr
                                                    key={item.id}
                                                    className={`hover:bg-muted/40 transition-colors ${
                                                        isSelected ? 'bg-primary/5' : ''
                                                    }`}
                                                >
                                                    {/* Checkbox */}
                                                    <td className="px-3 py-2.5 text-center">
                                                        <Checkbox
                                                            checked={isSelected}
                                                            onCheckedChange={(checked) => {
                                                                if (checked) {
                                                                    setSelectedStagedIds((prev) => [...prev, item.id]);
                                                                } else {
                                                                    setSelectedStagedIds((prev) =>
                                                                        prev.filter((id) => id !== item.id)
                                                                    );
                                                                }
                                                            }}
                                                            aria-label={`Pilih ulasan dari ${item.nama_reviewer}`}
                                                        />
                                                    </td>

                                                    {/* Status DB */}
                                                    <td className="px-3 py-2.5">
                                                        {item.status_action === 'new' ? (
                                                            <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-500/15 text-emerald-700 dark:text-emerald-400 border border-emerald-500/30">
                                                                + BARU
                                                            </span>
                                                        ) : (
                                                            <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold bg-blue-500/15 text-blue-700 dark:text-blue-400 border border-blue-500/30">
                                                                UPDATE
                                                            </span>
                                                        )}
                                                    </td>

                                                    {/* Target Showroom */}
                                                    <td className="px-4 py-2.5">
                                                        <div className="flex flex-col">
                                                            <span className="font-semibold text-foreground text-xs">
                                                                {item.nama_dealer || `Showroom #${item.dealer_id}`}
                                                            </span>
                                                            {item.kode_dealer && (
                                                                <span className="text-[10px] font-mono text-muted-foreground">
                                                                    {item.kode_dealer}
                                                                </span>
                                                            )}
                                                        </div>
                                                    </td>

                                                    {/* Reviewer */}
                                                    <td className="px-4 py-2.5">
                                                        <div className="flex items-center gap-2">
                                                            <div className="size-6 shrink-0 rounded-full bg-muted flex items-center justify-center font-bold text-[10px] text-muted-foreground uppercase border">
                                                                {item.nama_reviewer ? item.nama_reviewer.charAt(0) : 'U'}
                                                            </div>
                                                            <div className="flex flex-col max-w-[140px] truncate">
                                                                <span className="font-medium text-foreground truncate" title={item.nama_reviewer}>
                                                                    {item.nama_reviewer}
                                                                </span>
                                                                {item.author_profile_url && (
                                                                    <a
                                                                        href={item.author_profile_url}
                                                                        target="_blank"
                                                                        rel="noopener noreferrer"
                                                                        className="text-[10px] text-primary flex items-center gap-0.5 hover:underline"
                                                                    >
                                                                        <span>Profil Google</span>
                                                                        <ExternalLink className="size-2.5" />
                                                                    </a>
                                                                )}
                                                            </div>
                                                        </div>
                                                    </td>

                                                    {/* Rating */}
                                                    <td className="px-3 py-2.5 text-center">
                                                        <div className="inline-flex items-center gap-1 font-bold text-amber-500 bg-amber-500/10 dark:bg-amber-500/20 px-2 py-0.5 rounded-md text-xs">
                                                            <Star className="size-3 fill-amber-400 text-amber-500" />
                                                            <span>{Number(item.star_rate).toFixed(0)}</span>
                                                        </div>
                                                    </td>

                                                    {/* Tanggal Ulasan */}
                                                    <td className="px-3 py-2.5">
                                                        <div className="flex flex-col">
                                                            <span className="font-mono text-xs">{item.tanggal_publish_review}</span>
                                                            {item.relative_time && (
                                                                <span className="text-[10px] text-muted-foreground">
                                                                    {item.relative_time}
                                                                </span>
                                                            )}
                                                        </div>
                                                    </td>

                                                    {/* Isi Ulasan */}
                                                    <td className="px-4 py-2.5 max-w-[320px] whitespace-normal">
                                                        {item.review ? (
                                                            <div className="group relative">
                                                                <p className="line-clamp-2 text-xs text-foreground/90 leading-relaxed">
                                                                    {item.review}
                                                                </p>
                                                                {item.review.length > 80 && (
                                                                    <button
                                                                        type="button"
                                                                        onClick={() => setPreviewReviewDetail(item)}
                                                                        className="text-[10px] text-primary hover:underline font-medium mt-0.5 cursor-pointer"
                                                                    >
                                                                        Baca selengkapnya
                                                                    </button>
                                                                )}
                                                            </div>
                                                        ) : (
                                                            <span className="italic text-muted-foreground text-[11px]">
                                                                (Rating bintang tanpa ulasan teks)
                                                            </span>
                                                        )}
                                                    </td>

                                                    {/* Respon Owner */}
                                                    <td className="px-3 py-2.5">
                                                        {item.respon_from_owner ? (
                                                            <div className="flex flex-col max-w-[160px]">
                                                                <span className="inline-flex items-center gap-1 text-[10px] font-semibold text-emerald-600 dark:text-emerald-400">
                                                                    <CheckCircle2 className="size-3" />
                                                                    <span>Ada Respon</span>
                                                                </span>
                                                                {item.respon && (
                                                                    <span
                                                                        className="text-[10px] text-muted-foreground truncate"
                                                                        title={item.respon}
                                                                    >
                                                                        {item.respon}
                                                                    </span>
                                                                )}
                                                            </div>
                                                        ) : (
                                                            <span className="text-[10px] text-muted-foreground">
                                                                Belum direspon
                                                            </span>
                                                        )}
                                                    </td>

                                                    {/* Aksi */}
                                                    <td className="px-3 py-2.5 text-right">
                                                        <div className="flex items-center justify-end gap-1">
                                                            <Button
                                                                type="button"
                                                                variant="ghost"
                                                                size="sm"
                                                                onClick={() => setPreviewReviewDetail(item)}
                                                                className="h-7 w-7 p-0 text-muted-foreground hover:text-foreground cursor-pointer"
                                                                title="Lihat detail lengkap ulasan"
                                                            >
                                                                <Eye className="size-3.5" />
                                                            </Button>
                                                            {item.google_review_url && (
                                                                <a
                                                                    href={item.google_review_url}
                                                                    target="_blank"
                                                                    rel="noopener noreferrer"
                                                                    className="inline-flex items-center justify-center h-7 w-7 rounded-md text-muted-foreground hover:text-foreground hover:bg-muted"
                                                                    title="Buka ulasan di Google Maps"
                                                                >
                                                                    <ExternalLink className="size-3.5" />
                                                                </a>
                                                            )}
                                                        </div>
                                                    </td>
                                                </tr>
                                            );
                                        })
                                    )}
                                </tbody>
                            </table>
                        </div>

                        {/* Pagination Footer */}
                        {filteredStagedList.length > 0 && (
                            <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between text-xs text-muted-foreground pt-2">
                                <div className="flex items-center gap-2">
                                    <span>
                                        Baris per halaman:
                                    </span>
                                    <AntSelect
                                        size="small"
                                        value={stagedPageSize}
                                        onChange={(val) => setStagedPageSize(val)}
                                        options={[
                                            { value: 10, label: '10' },
                                            { value: 25, label: '25' },
                                            { value: 50, label: '50' },
                                            { value: 100, label: '100' },
                                        ]}
                                        className="w-16"
                                    />
                                    <span>
                                        Menampilkan{' '}
                                        <strong>
                                            {(stagedPage - 1) * stagedPageSize + 1} -{' '}
                                            {Math.min(stagedPage * stagedPageSize, filteredStagedList.length)}
                                        </strong>{' '}
                                        dari <strong>{filteredStagedList.length}</strong> ulasan
                                    </span>
                                </div>

                                <div className="flex items-center gap-2">
                                    <span>
                                        Halaman <strong>{stagedPage}</strong> dari <strong>{totalStagedPages}</strong>
                                    </span>
                                    <div className="flex items-center gap-1">
                                        <Button
                                            type="button"
                                            variant="outline"
                                            size="sm"
                                            disabled={stagedPage <= 1}
                                            onClick={() => setStagedPage((p) => Math.max(1, p - 1))}
                                            className="h-7 w-7 p-0 cursor-pointer"
                                        >
                                            <ChevronLeft className="size-3.5" />
                                        </Button>
                                        <Button
                                            type="button"
                                            variant="outline"
                                            size="sm"
                                            disabled={stagedPage >= totalStagedPages}
                                            onClick={() => setStagedPage((p) => Math.min(totalStagedPages, p + 1))}
                                            className="h-7 w-7 p-0 cursor-pointer"
                                        >
                                            <ChevronRight className="size-3.5" />
                                        </Button>
                                    </div>
                                </div>
                            </div>
                        )}
                    </CardContent>
                </Card>

                {/* Jadwal Scraping Otomatis (Auto Scrap) */}
                <Card className="border shadow-sm">
                    <CardHeader className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between pb-3 bg-muted/10 border-b">
                        <div>
                            <div className="flex items-center gap-2">
                                <Clock className="size-4 text-primary" />
                                <CardTitle className="text-base font-bold">Jadwal Scraping Otomatis (Auto Scrap)</CardTitle>
                                <Badge variant="secondary" className="font-semibold text-xs">
                                    {scheduleList.length} Jadwal
                                </Badge>
                            </div>
                            <CardDescription className="text-xs mt-0.5">
                                Konfigurasi jadwal otomatis untuk memperbarui ulasan Google Maps di background server secara berkala.
                            </CardDescription>
                        </div>
                        {canManageAll && (
                            <Button
                                type="button"
                                size="sm"
                                onClick={handleOpenAddModal}
                                className="h-8 gap-1.5 text-xs font-semibold cursor-pointer"
                            >
                                <Plus className="size-3.5" />
                                <span>Tambah Jadwal</span>
                            </Button>
                        )}
                    </CardHeader>

                    <CardContent className="p-0">
                        <div className="overflow-x-auto">
                            <table className="w-full text-left text-xs whitespace-nowrap">
                                <thead className="border-b bg-muted/40 font-medium text-muted-foreground">
                                    <tr>
                                        <th className="px-4 py-3">Target Showroom</th>
                                        <th className="px-4 py-3 text-center">Maks. Ulasan</th>
                                        <th className="px-4 py-3 text-center">Urutan</th>
                                        <th className="px-4 py-3">Frekuensi Update</th>
                                        <th className="px-4 py-3 text-center">Status</th>
                                        <th className="px-4 py-3">Terakhir Dijalankan</th>
                                        <th className="px-4 py-3">Jadwal Berikutnya</th>
                                        {canManageAll && <th className="px-4 py-3 text-right">Aksi</th>}
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-border/60">
                                    {scheduleList.length === 0 ? (
                                        <tr>
                                            <td colSpan={canManageAll ? 8 : 7} className="py-8 text-center text-muted-foreground text-xs">
                                                <Clock className="size-8 mx-auto mb-2 opacity-30 text-muted-foreground" />
                                                <p className="font-medium">Belum ada jadwal scraping otomatis.</p>
                                                <p className="text-[11px] mt-0.5 text-muted-foreground">
                                                    Klik tombol &quot;Tambah Jadwal&quot; di atas untuk membuat jadwal auto scrap berkala.
                                                </p>
                                            </td>
                                        </tr>
                                    ) : (
                                        scheduleList.map((sched) => (
                                            <tr key={sched.id} className="hover:bg-muted/30 transition-colors">
                                                {/* Target Showroom */}
                                                <td className="px-4 py-3">
                                                    {sched.dealer_id && sched.dealer ? (
                                                        <div className="flex items-center gap-1.5">
                                                            <span className="font-semibold text-foreground">{sched.dealer.nama_dealer}</span>
                                                            <AntTag className="text-[10px] font-mono">
                                                                {sched.dealer.kode_dealer}
                                                            </AntTag>
                                                        </div>
                                                    ) : (
                                                        <AntTag color="blue" className="font-medium">
                                                            <Layers className="size-3 mr-1 inline" />
                                                            Semua Showroom ({dealers.length} Showroom)
                                                        </AntTag>
                                                    )}
                                                </td>

                                                {/* Maks Ulasan */}
                                                <td className="px-4 py-3 text-center font-mono font-medium">
                                                    {sched.max_reviews} ulasan
                                                </td>

                                                {/* Urutan */}
                                                <td className="px-4 py-3 text-center">
                                                    <AntTag>
                                                        {sched.sort_by === 'newest'
                                                            ? 'Terkini'
                                                            : sched.sort_by === 'highest'
                                                                ? 'Rating Tertinggi'
                                                                : sched.sort_by === 'lowest'
                                                                    ? 'Rating Terendah'
                                                                    : 'Paling Relevan'}
                                                    </AntTag>
                                                </td>

                                                {/* Frekuensi Update */}
                                                <td className="px-4 py-3 font-medium">
                                                    <div className="inline-flex items-center gap-1.5 text-foreground">
                                                        <Clock className="size-3.5 text-muted-foreground" />
                                                        <span>
                                                            {sched.formatted_interval || `Setiap ${sched.interval_value} ${sched.interval_unit}`}
                                                        </span>
                                                    </div>
                                                </td>

                                                {/* Status Aktif / Nonaktif */}
                                                <td className="px-4 py-3 text-center">
                                                    {canManageAll ? (
                                                        <button
                                                            type="button"
                                                            onClick={() => handleToggleSchedule(sched)}
                                                            disabled={togglingScheduleId === sched.id}
                                                            className="cursor-pointer transition-opacity hover:opacity-80 inline-flex items-center"
                                                            title="Klik untuk mengubah status aktif/nonaktif"
                                                        >
                                                            <AntTag color={sched.is_active ? 'success' : 'default'} className="cursor-pointer">
                                                                {sched.is_active ? 'Aktif' : 'Nonaktif'}
                                                            </AntTag>
                                                        </button>
                                                    ) : (
                                                        <AntTag color={sched.is_active ? 'success' : 'default'}>
                                                            {sched.is_active ? 'Aktif' : 'Nonaktif'}
                                                        </AntTag>
                                                    )}
                                                </td>

                                                {/* Terakhir Dijalankan */}
                                                <td className="px-4 py-3 text-muted-foreground">
                                                    {sched.last_run_at ? (
                                                        <div>
                                                            <p className="text-foreground font-medium">{formatDateTime(sched.last_run_at)}</p>
                                                            {sched.last_status && sched.last_status !== 'idle' && (
                                                                <div className="mt-0.5">
                                                                    {sched.last_status === 'running' ? (
                                                                        <AntTag color="processing">Sedang Berjalan</AntTag>
                                                                    ) : sched.last_status === 'failed' ? (
                                                                        <AntTag color="error">Gagal</AntTag>
                                                                    ) : (
                                                                        <AntTag color="success">Selesai</AntTag>
                                                                    )}
                                                                </div>
                                                            )}
                                                        </div>
                                                    ) : (
                                                        <span className="text-muted-foreground">-</span>
                                                    )}
                                                </td>

                                                {/* Jadwal Berikutnya */}
                                                <td className="px-4 py-3">
                                                    {sched.is_active && sched.next_run_at ? (
                                                        <div className="flex items-center gap-1.5 text-foreground font-medium">
                                                            <Calendar className="size-3.5 text-primary" />
                                                            <span>{formatDateTime(sched.next_run_at)}</span>
                                                        </div>
                                                    ) : (
                                                        <span className="text-muted-foreground italic">Dinonaktifkan</span>
                                                    )}
                                                </td>

                                                {/* Aksi */}
                                                {canManageAll && (
                                                    <td className="px-4 py-3 text-right">
                                                        <div className="flex items-center justify-end gap-1">
                                                            <AntButton
                                                                size="small"
                                                                type="dashed"
                                                                onClick={() => handleRunSchedule(sched)}
                                                                loading={runningScheduleId === sched.id}
                                                                disabled={isRunning}
                                                                icon={runningScheduleId !== sched.id ? <Play className="size-3 text-emerald-600 inline mr-0.5" /> : undefined}
                                                                className="text-xs text-emerald-600 border-emerald-500/40 hover:text-emerald-700"
                                                                title="Jalankan scraping sekarang"
                                                            >
                                                                Jalankan
                                                            </AntButton>

                                                            <AntButton
                                                                size="small"
                                                                type="text"
                                                                onClick={() => handleOpenEditModal(sched)}
                                                                icon={<Pencil className="size-3.5" />}
                                                                title="Edit jadwal"
                                                            />

                                                            <AntPopconfirm
                                                                title="Hapus jadwal auto scrap?"
                                                                description="Apakah Anda yakin ingin menghapus jadwal ini?"
                                                                onConfirm={() => handleDeleteSchedule(sched)}
                                                                okText="Ya, Hapus"
                                                                cancelText="Batal"
                                                                okButtonProps={{ danger: true }}
                                                            >
                                                                <AntButton
                                                                    size="small"
                                                                    type="text"
                                                                    danger
                                                                    icon={<Trash2 className="size-3.5" />}
                                                                    loading={deletingScheduleId === sched.id}
                                                                    title="Hapus jadwal"
                                                                />
                                                            </AntPopconfirm>
                                                        </div>
                                                    </td>
                                                )}
                                            </tr>
                                        ))
                                    )}
                                </tbody>
                            </table>
                        </div>
                    </CardContent>
                </Card>

                {/* Modal Dialog Tambah / Edit Jadwal */}
                <AntModal
                    open={isScheduleModalOpen}
                    onCancel={() => setIsScheduleModalOpen(false)}
                    title={
                        <div className="flex items-center gap-2">
                            <Clock className="size-5 text-primary" />
                            <span className="text-base font-bold">
                                {editingSchedule ? 'Edit Jadwal Auto Scrap' : 'Tambah Jadwal Auto Scrap'}
                            </span>
                        </div>
                    }
                    footer={[
                        <AntButton
                            key="cancel"
                            onClick={() => setIsScheduleModalOpen(false)}
                            disabled={isSubmittingSchedule}
                        >
                            Batal
                        </AntButton>,
                        <AntButton
                            key="submit"
                            type="primary"
                            loading={isSubmittingSchedule}
                            disabled={Boolean(intervalError)}
                            onClick={(e) => handleSaveSchedule(e as any)}
                        >
                            {editingSchedule ? 'Perbarui Jadwal' : 'Simpan Jadwal'}
                        </AntButton>,
                    ]}
                    centered
                    destroyOnClose
                >
                    <form onSubmit={handleSaveSchedule} className="space-y-4 pt-2">
                        {/* Target Showroom */}
                        <div className="space-y-1.5">
                            <Label htmlFor="sched-dealer" className="text-xs font-semibold">
                                Target Showroom
                            </Label>
                            <AntSelect
                                id="sched-dealer"
                                showSearch
                                optionFilterProp="label"
                                value={scheduleForm.dealer_id}
                                onChange={(val) => setScheduleForm({ ...scheduleForm, dealer_id: val })}
                                className="w-full"
                                options={[
                                    { value: 'all', label: `Semua Showroom (${dealers.length} Showroom)` },
                                    ...dealers.map((d) => ({
                                        value: String(d.id),
                                        label: `${d.kode_dealer} - ${d.nama_dealer} ${!d.link_google_maps ? '(Belum ada link Maps)' : ''}`,
                                        disabled: !d.link_google_maps,
                                    })),
                                ]}
                            />
                            <p className="text-[11px] text-muted-foreground">
                                Pilih &quot;Semua Showroom&quot; untuk scrap otomatis berurutan ke seluruh showroom yang terdaftar.
                            </p>
                        </div>

                        {/* Jumlah Ulasan Maksimal & Urutan Ulasan */}
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                            <div className="space-y-1.5">
                                <Label htmlFor="sched-max" className="text-xs font-semibold">
                                    Jumlah Ulasan Maksimal
                                </Label>
                                <Input
                                    id="sched-max"
                                    type="number"
                                    min={1}
                                    max={5000}
                                    value={scheduleForm.max_reviews}
                                    onChange={(e) => setScheduleForm({ ...scheduleForm, max_reviews: Number(e.target.value) || 1 })}
                                    className="h-9 text-xs"
                                    placeholder="50"
                                />
                                <p className="text-[11px] text-muted-foreground">
                                    Batas maksimal ulasan per showroom
                                </p>
                            </div>

                            <div className="space-y-1.5">
                                <Label htmlFor="sched-sort" className="text-xs font-semibold">
                                    Urutan Ulasan
                                </Label>
                                <AntSelect
                                    id="sched-sort"
                                    value={scheduleForm.sort_by}
                                    onChange={(val) => setScheduleForm({ ...scheduleForm, sort_by: val as any })}
                                    className="w-full"
                                    options={[
                                        { value: 'newest', label: 'Terkini (Newest)' },
                                        { value: 'highest', label: 'Rating Tertinggi' },
                                        { value: 'lowest', label: 'Rating Terendah' },
                                        { value: 'relevant', label: 'Paling Relevan' },
                                    ]}
                                />
                                <p className="text-[11px] text-muted-foreground">
                                    Prioritas urutan ulasan Google Maps
                                </p>
                            </div>
                        </div>

                        {/* Waktu Update / Interval */}
                        <div className="space-y-1.5 rounded-lg border p-3 bg-muted/20">
                            <div className="flex items-center justify-between">
                                <Label className="text-xs font-semibold">
                                    Waktu Update (Frekuensi)
                                </Label>
                                <AntTag color="red">
                                    Minimal 5 Menit
                                </AntTag>
                            </div>
                            <div className="grid grid-cols-2 gap-2 pt-1">
                                <div>
                                    <Input
                                        type="number"
                                        min={scheduleForm.interval_unit === 'minute' ? 5 : 1}
                                        value={scheduleForm.interval_value}
                                        onChange={(e) => {
                                            const val = Number(e.target.value);
                                            setScheduleForm({ ...scheduleForm, interval_value: val });
                                        }}
                                        className="h-9 text-xs font-medium"
                                        placeholder="Contoh: 30"
                                    />
                                </div>
                                <div>
                                    <AntSelect
                                        value={scheduleForm.interval_unit}
                                        onChange={(unit: any) => {
                                            setScheduleForm({
                                                ...scheduleForm,
                                                interval_unit: unit,
                                                interval_value:
                                                    unit === 'minute' && scheduleForm.interval_value < 5
                                                        ? 5
                                                        : scheduleForm.interval_value,
                                            });
                                        }}
                                        className="w-full"
                                        options={[
                                            { value: 'minute', label: 'Menit' },
                                            { value: 'hour', label: 'Jam' },
                                            { value: 'day', label: 'Hari' },
                                            { value: 'week', label: 'Minggu' },
                                        ]}
                                    />
                                </div>
                            </div>

                            {intervalError ? (
                                <div className="flex items-center gap-1.5 text-xs text-rose-600 dark:text-rose-400 mt-1.5 font-medium">
                                    <AlertCircle className="size-3.5 shrink-0" />
                                    <span>{intervalError}</span>
                                </div>
                            ) : (
                                <p className="text-[11px] text-muted-foreground mt-1">
                                    Sistem akan menjalankan auto scrap otomatis setiap{' '}
                                    <strong className="text-foreground">
                                        {scheduleForm.interval_value}{' '}
                                        {scheduleForm.interval_unit === 'minute'
                                            ? 'Menit'
                                            : scheduleForm.interval_unit === 'hour'
                                                ? 'Jam'
                                                : scheduleForm.interval_unit === 'day'
                                                    ? 'Hari'
                                                    : 'Minggu'}
                                    </strong>
                                    .
                                </p>
                            )}
                        </div>

                        {/* Switch Options */}
                        <div className="flex flex-col gap-2 pt-1">
                            <div className="flex items-center justify-between py-1">
                                <Label htmlFor="sched-proxy" className="text-xs font-medium cursor-pointer">
                                    Gunakan Rotating Proxy (Direkomendasikan)
                                </Label>
                                <AntSwitch
                                    id="sched-proxy"
                                    checked={scheduleForm.use_proxy}
                                    onChange={(checked) => setScheduleForm({ ...scheduleForm, use_proxy: checked })}
                                />
                            </div>
                            <div className="flex items-center justify-between py-1">
                                <Label htmlFor="sched-active" className="text-xs font-medium cursor-pointer">
                                    Status Jadwal Langsung Aktif
                                </Label>
                                <AntSwitch
                                    id="sched-active"
                                    checked={scheduleForm.is_active}
                                    onChange={(checked) => setScheduleForm({ ...scheduleForm, is_active: checked })}
                                />
                            </div>
                        </div>
                    </form>
                </AntModal>

                {/* Modal Konfirmasi Masukkan ke Database */}
                <Dialog open={isConfirmCommitModalOpen} onOpenChange={setIsConfirmCommitModalOpen}>
                    <DialogContent className="max-w-md">
                        <DialogHeader>
                            <div className="flex items-center gap-2 text-primary">
                                <Database className="size-5" />
                                <DialogTitle>Konfirmasi Masukkan ke Database</DialogTitle>
                            </div>
                            <DialogDescription className="text-xs pt-1.5">
                                Anda akan memasukkan ulasan hasil scraping ke dalam database MySQL.
                            </DialogDescription>
                        </DialogHeader>

                        <div className="space-y-3 py-2 text-xs">
                            <div className="rounded-lg border bg-muted/40 p-3 space-y-2">
                                <div className="flex items-center justify-between">
                                    <span className="text-muted-foreground">Jumlah Ulasan:</span>
                                    <span className="font-semibold text-sm">
                                        {selectedStagedIds.length > 0 ? selectedStagedIds.length : stagedList.length} ulasan
                                        {selectedStagedIds.length > 0 && ' (Pilihan)'}
                                    </span>
                                </div>
                                <div className="flex items-center justify-between text-[11px] pt-1 border-t border-border/50">
                                    <span className="flex items-center gap-1 text-emerald-600 dark:text-emerald-400 font-medium">
                                        <Plus className="size-3" /> Ulasan Baru (+ Baru):
                                    </span>
                                    <span className="font-semibold text-emerald-600 dark:text-emerald-400">
                                        {(selectedStagedIds.length > 0
                                            ? stagedList.filter((item) => selectedStagedIds.includes(item.id) && item.status_action === 'new')
                                            : stagedList.filter((item) => item.status_action === 'new')
                                        ).length} ulasan
                                    </span>
                                </div>
                                <div className="flex items-center justify-between text-[11px]">
                                    <span className="flex items-center gap-1 text-blue-600 dark:text-blue-400 font-medium">
                                        <RefreshCw className="size-3" /> Pembaruan Ulasan:
                                    </span>
                                    <span className="font-semibold text-blue-600 dark:text-blue-400">
                                        {(selectedStagedIds.length > 0
                                            ? stagedList.filter((item) => selectedStagedIds.includes(item.id) && item.status_action === 'update')
                                            : stagedList.filter((item) => item.status_action === 'update')
                                        ).length} ulasan
                                    </span>
                                </div>
                            </div>

                            <p className="text-[11px] text-muted-foreground leading-relaxed">
                                Ulasan akan disimpan ke tabel ulasan, rating showroom akan diperbarui otomatis, dan daftar pratinjau ini akan dikosongkan setelah proses selesai.
                            </p>
                        </div>

                        <DialogFooter className="gap-2 sm:gap-0">
                            <Button
                                type="button"
                                variant="outline"
                                size="sm"
                                disabled={isCommitting}
                                onClick={() => setIsConfirmCommitModalOpen(false)}
                            >
                                Batal
                            </Button>
                            <Button
                                type="button"
                                size="sm"
                                disabled={isCommitting}
                                onClick={() => handleCommitStagedReviews(selectedStagedIds.length > 0)}
                                className="bg-primary text-primary-foreground hover:bg-primary/90 gap-1.5"
                            >
                                {isCommitting ? (
                                    <>
                                        <Loader2 className="size-3.5 animate-spin" />
                                        <span>Menyimpan ke DB...</span>
                                    </>
                                ) : (
                                    <>
                                        <Database className="size-3.5" />
                                        <span>Ya, Masukkan Sekarang</span>
                                    </>
                                )}
                            </Button>
                        </DialogFooter>
                    </DialogContent>
                </Dialog>

                {/* Modal Detail Ulasan Staging */}
                <Dialog
                    open={Boolean(previewReviewDetail)}
                    onOpenChange={(open) => !open && setPreviewReviewDetail(null)}
                >
                    <DialogContent className="max-w-lg">
                        <DialogHeader>
                            <div className="flex items-center justify-between gap-2">
                                <div className="flex items-center gap-2">
                                    <div className="flex size-9 items-center justify-center rounded-full bg-primary/10 text-primary font-bold text-sm">
                                        {previewReviewDetail?.nama_reviewer?.charAt(0).toUpperCase() || 'U'}
                                    </div>
                                    <div>
                                        <DialogTitle className="text-sm font-semibold">
                                            {previewReviewDetail?.nama_reviewer}
                                        </DialogTitle>
                                        <DialogDescription className="text-[11px]">
                                            {previewReviewDetail?.kode_dealer} - {previewReviewDetail?.nama_dealer}
                                        </DialogDescription>
                                    </div>
                                </div>
                                {previewReviewDetail?.status_action === 'new' ? (
                                    <Badge className="bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20 text-[10px]">
                                        + Baru
                                    </Badge>
                                ) : (
                                    <Badge className="bg-blue-500/10 text-blue-600 dark:text-blue-400 border-blue-500/20 text-[10px]">
                                        Pembaruan
                                    </Badge>
                                )}
                            </div>
                        </DialogHeader>

                        {previewReviewDetail && (
                            <div className="space-y-3 py-2 text-xs">
                                <div className="flex items-center justify-between border-b pb-2">
                                    <div className="flex items-center gap-1">
                                        {Array.from({ length: 5 }).map((_, i) => (
                                            <Star
                                                key={i}
                                                className={`size-3.5 ${
                                                    i < previewReviewDetail.star_rate
                                                        ? 'fill-amber-400 text-amber-500'
                                                        : 'text-muted-foreground/30'
                                                }`}
                                            />
                                        ))}
                                        <span className="font-semibold ml-1 text-xs">
                                            {previewReviewDetail.star_rate}.0
                                        </span>
                                    </div>
                                    <div className="flex items-center gap-1.5 text-[11px] text-muted-foreground">
                                        <Clock className="size-3" />
                                        <span>{previewReviewDetail.relative_time || previewReviewDetail.tanggal_publish_review}</span>
                                    </div>
                                </div>

                                <div className="space-y-1">
                                    <Label className="text-[11px] font-semibold text-muted-foreground">
                                        Isi Ulasan:
                                    </Label>
                                    <div className="rounded-lg border bg-muted/30 p-3 text-xs leading-relaxed max-h-48 overflow-y-auto whitespace-pre-wrap">
                                        {previewReviewDetail.review || (
                                            <span className="italic text-muted-foreground">
                                                (Ulasan rating bintang tanpa teks)
                                            </span>
                                        )}
                                    </div>
                                </div>

                                {previewReviewDetail.respon_from_owner ? (
                                    <div className="space-y-1">
                                        <div className="flex items-center justify-between text-[11px]">
                                            <span className="font-semibold text-emerald-600 dark:text-emerald-400 flex items-center gap-1">
                                                <CheckCircle2 className="size-3" />
                                                Respon Pemilik Showroom:
                                            </span>
                                            {previewReviewDetail.tanggal_respon && (
                                                <span className="text-muted-foreground">
                                                    {previewReviewDetail.tanggal_respon}
                                                </span>
                                            )}
                                        </div>
                                        <div className="rounded-lg border border-emerald-500/20 bg-emerald-500/5 p-2.5 text-xs text-foreground leading-relaxed whitespace-pre-wrap">
                                            {previewReviewDetail.respon}
                                        </div>
                                    </div>
                                ) : (
                                    <div className="rounded-lg border border-dashed p-2.5 text-center text-[11px] text-muted-foreground">
                                        Belum ada respon dari showroom untuk ulasan ini.
                                    </div>
                                )}

                                {previewReviewDetail.google_review_url && (
                                    <div className="pt-1">
                                        <a
                                            href={previewReviewDetail.google_review_url}
                                            target="_blank"
                                            rel="noopener noreferrer"
                                            className="inline-flex items-center gap-1.5 text-xs text-primary hover:underline font-medium"
                                        >
                                            <ExternalLink className="size-3.5" />
                                            <span>Buka ulasan asli di Google Maps</span>
                                        </a>
                                    </div>
                                )}
                            </div>
                        )}

                        <DialogFooter>
                            <Button
                                type="button"
                                variant="outline"
                                size="sm"
                                onClick={() => setPreviewReviewDetail(null)}
                            >
                                Tutup
                            </Button>
                        </DialogFooter>
                    </DialogContent>
                </Dialog>

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
                            <div className="flex items-center gap-1.5 text-xs">
                                <AntTag.CheckableTag
                                    checked={filterMapsOnly === 'all'}
                                    onChange={() => setFilterMapsOnly('all')}
                                    className="cursor-pointer"
                                >
                                    Semua ({dealers.length})
                                </AntTag.CheckableTag>
                                <AntTag.CheckableTag
                                    checked={filterMapsOnly === 'with_maps'}
                                    onChange={() => setFilterMapsOnly('with_maps')}
                                    className="cursor-pointer"
                                >
                                    Terkoneksi ({stats.dealers_with_maps})
                                </AntTag.CheckableTag>
                                <AntTag.CheckableTag
                                    checked={filterMapsOnly === 'without_maps'}
                                    onChange={() => setFilterMapsOnly('without_maps')}
                                    className="cursor-pointer"
                                >
                                    Belum Ada ({stats.dealers_without_maps})
                                </AntTag.CheckableTag>
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
                                                            <AntTag color="success">
                                                                Terkoneksi
                                                            </AntTag>
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
                                                            <AntTag color="warning">
                                                                Belum Ada Link
                                                            </AntTag>
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
                                                    <AntButton
                                                        size="small"
                                                        disabled={!d.link_google_maps || isRunning}
                                                        onClick={() => {
                                                            setSelectedDealerId(String(d.id));
                                                            handleStartServerSync(String(d.id));
                                                        }}
                                                        icon={<RefreshCw className="size-3 inline mr-1" />}
                                                        className="text-xs"
                                                    >
                                                        Sync
                                                    </AntButton>
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
            title: 'Dashboard GBP',
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
