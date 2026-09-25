import { Head, router, useForm } from '@inertiajs/react';
import {
    AlertCircle,
    Calendar,
    CheckCircle2,
    Clock,
    Edit2,
    ExternalLink,
    Eye,
    Filter,
    Loader2,
    MessageSquare,
    Plus,
    RefreshCw,
    Search,
    Sparkles,
    Star,
    Trash2,
    X,
} from 'lucide-react';
import React, { useState } from 'react';
import { toast } from 'sonner';
import InputError from '@/components/input-error';
import { Pagination } from '@/components/pagination';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import {
    Dialog,
    DialogClose,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { dashboard } from '@/routes';
import reviewsRoute from '@/routes/reviews';
import type { Dealer, PaginatedData, Review, ReviewStats } from '@/types';

interface ReviewsIndexProps {
    reviews: PaginatedData<Review>;
    dealers: Pick<Dealer, 'id' | 'kode_dealer' | 'nama_dealer'>[];
    stats: ReviewStats;
    filters: {
        search?: string;
        dealer_id?: string;
        star_rate?: string;
        respon_from_owner?: string;
    };
}

const selectClass =
    'h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-xs transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring dark:bg-background';

export default function ReviewsIndex({
    reviews,
    dealers,
    stats,
    filters,
}: ReviewsIndexProps) {
    const [search, setSearch] = useState(filters.search || '');
    const [dealerFilter, setDealerFilter] = useState(filters.dealer_id || '');
    const [starFilter, setStarFilter] = useState(filters.star_rate || '');
    const [responFilter, setResponFilter] = useState(
        filters.respon_from_owner || '',
    );

    const [isCreateOpen, setIsCreateOpen] = useState(false);
    const [isEditOpen, setIsEditOpen] = useState(false);
    const [isDeleteOpen, setIsDeleteOpen] = useState(false);
    const [isDetailOpen, setIsDetailOpen] = useState(false);
    const [selectedReview, setSelectedReview] = useState<Review | null>(null);

    // Scraper Sync State
    const [isSyncOpen, setIsSyncOpen] = useState(false);
    const [syncDealerId, setSyncDealerId] = useState<string>('all');
    const [syncLimit, setSyncLimit] = useState<number | string>(20);
    const [syncSort, setSyncSort] = useState<string>('newest');
    const [isCheckingHealth, setIsCheckingHealth] = useState(false);
    const [scraperOnline, setScraperOnline] = useState<boolean | null>(null);
    const [proxyInfo, setProxyInfo] = useState<{
        enabled: boolean;
        totalLoaded?: number;
        deadCount?: number;
    } | null>(null);
    const [syncState, setSyncState] = useState<
        'idle' | 'starting' | 'running' | 'completed' | 'failed'
    >('idle');
    const [syncMessage, setSyncMessage] = useState<string>('');
    const [syncError, setSyncError] = useState<string | null>(null);
    const [syncResult, setSyncResult] = useState<{
        imported: number;
        updated: number;
        total_scraped: number;
        dealer_nama?: string;
        dealer_rating?: number;
        dealer_total_review?: number;
    } | null>(null);
    const [bulkProgress, setBulkProgress] = useState<{
        current: number;
        total: number;
        currentDealerName: string;
        currentImported: number;
        currentUpdated: number;
    } | null>(null);

    const pollRef = React.useRef<ReturnType<typeof setInterval> | null>(null);
    const isCancelledRef = React.useRef(false);

    React.useEffect(() => {
        return () => {
            if (pollRef.current) {
                clearInterval(pollRef.current);
            }
        };
    }, []);

    const todayString = new Date().toISOString().split('T')[0];

    const createForm = useForm({
        dealer_id: dealers.length > 0 ? String(dealers[0].id) : '',
        nama_reviewer: '',
        tanggal_publish_review: todayString,
        star_rate: '5',
        review: '',
        respon_from_owner: false,
        tanggal_respon: '',
        respon: '',
        google_review_url: '',
    });

    const editForm = useForm({
        dealer_id: '',
        nama_reviewer: '',
        tanggal_publish_review: '',
        star_rate: '5',
        review: '',
        respon_from_owner: false,
        tanggal_respon: '',
        respon: '',
        google_review_url: '',
    });

    const applyFilters = (newFilters: {
        search?: string;
        dealer_id?: string;
        star_rate?: string;
        respon_from_owner?: string;
    }) => {
        router.get(
            reviewsRoute.index.url(),
            {
                search: newFilters.search || undefined,
                dealer_id: newFilters.dealer_id || undefined,
                star_rate: newFilters.star_rate || undefined,
                respon_from_owner: newFilters.respon_from_owner || undefined,
            },
            { preserveState: true, replace: true },
        );
    };

    const handleSearchSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        applyFilters({
            search,
            dealer_id: dealerFilter,
            star_rate: starFilter,
            respon_from_owner: responFilter,
        });
    };

    const handleDealerChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
        const val = e.target.value;
        setDealerFilter(val);
        applyFilters({
            search,
            dealer_id: val,
            star_rate: starFilter,
            respon_from_owner: responFilter,
        });
    };

    const handleStarChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
        const val = e.target.value;
        setStarFilter(val);
        applyFilters({
            search,
            dealer_id: dealerFilter,
            star_rate: val,
            respon_from_owner: responFilter,
        });
    };

    const handleResponChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
        const val = e.target.value;
        setResponFilter(val);
        applyFilters({
            search,
            dealer_id: dealerFilter,
            star_rate: starFilter,
            respon_from_owner: val,
        });
    };

    const handleResetFilters = () => {
        setSearch('');
        setDealerFilter('');
        setStarFilter('');
        setResponFilter('');
        router.get(
            reviewsRoute.index.url(),
            {},
            { preserveState: true, replace: true },
        );
    };

    const handleOpenCreate = () => {
        createForm.reset();
        createForm.clearErrors();
        createForm.setData({
            dealer_id: dealers.length > 0 ? String(dealers[0].id) : '',
            nama_reviewer: '',
            tanggal_publish_review: todayString,
            star_rate: '5',
            review: '',
            respon_from_owner: false,
            tanggal_respon: '',
            respon: '',
            google_review_url: '',
        });
        setIsCreateOpen(true);
    };

    const handleSubmitCreate = (e: React.FormEvent) => {
        e.preventDefault();
        createForm.post(reviewsRoute.store.url(), {
            onSuccess: () => {
                setIsCreateOpen(false);
                createForm.reset();
            },
        });
    };

    const handleOpenEdit = (rev: Review) => {
        setSelectedReview(rev);
        editForm.clearErrors();
        editForm.setData({
            dealer_id: String(rev.dealer_id),
            nama_reviewer: rev.nama_reviewer,
            tanggal_publish_review: rev.tanggal_publish_review
                ? rev.tanggal_publish_review.substring(0, 10)
                : '',
            star_rate: String(rev.star_rate),
            review: rev.review || '',
            respon_from_owner: rev.respon_from_owner,
            tanggal_respon: rev.tanggal_respon
                ? rev.tanggal_respon.substring(0, 10)
                : '',
            respon: rev.respon || '',
            google_review_url: rev.google_review_url || '',
        });
        setIsEditOpen(true);
    };

    const handleSubmitEdit = (e: React.FormEvent) => {
        e.preventDefault();
        if (!selectedReview) return;

        editForm.put(reviewsRoute.update.url(selectedReview.id), {
            onSuccess: () => {
                setIsEditOpen(false);
                setSelectedReview(null);
            },
        });
    };

    const handleOpenDelete = (rev: Review) => {
        setSelectedReview(rev);
        setIsDeleteOpen(true);
    };

    const handleSubmitDelete = () => {
        if (!selectedReview) return;

        router.delete(reviewsRoute.destroy.url(selectedReview.id), {
            onSuccess: () => {
                setIsDeleteOpen(false);
                setSelectedReview(null);
            },
        });
    };

    const handleOpenDetail = (rev: Review) => {
        setSelectedReview(rev);
        setIsDetailOpen(true);
    };

    const handleOpenSync = async (defaultDealerId?: string) => {
        const targetDealerId =
            defaultDealerId ||
            dealerFilter ||
            'all';

        setSyncDealerId(targetDealerId);
        setSyncState('idle');
        setSyncMessage('');
        setSyncError(null);
        setSyncResult(null);
        setBulkProgress(null);
        isCancelledRef.current = false;
        setIsSyncOpen(true);

        setIsCheckingHealth(true);
        try {
            const res = await fetch(reviewsRoute.scraperHealth.url());
            if (res.ok) {
                const data = await res.json();
                setScraperOnline(Boolean(data.online));
                setProxyInfo(data.proxy || null);
            } else {
                setScraperOnline(false);
                setProxyInfo(null);
            }
        } catch {
            setScraperOnline(false);
            setProxyInfo(null);
        } finally {
            setIsCheckingHealth(false);
        }
    };

    const handleCancelSync = () => {
        isCancelledRef.current = true;
        if (pollRef.current) {
            clearInterval(pollRef.current);
        }
        setSyncMessage('Menghentikan sinkronisasi setelah proses saat ini selesai...');
    };

    const handleStartSync = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!syncDealerId) return;

        const actualLimit = Math.max(1, Math.min(1000, Number(syncLimit) || 20));

        setSyncState('starting');
        setSyncError(null);
        setSyncResult(null);
        isCancelledRef.current = false;

        const csrfToken =
            (document.querySelector('meta[name="csrf-token"]') as HTMLMetaElement)
                ?.content || '';

        // Kasus 1: Sinkronisasi Semua Dealer
        if (syncDealerId === 'all') {
            const targetDealers = dealers;
            if (targetDealers.length === 0) {
                setSyncState('failed');
                setSyncError('Tidak ada dealer yang tersedia untuk disinkronisasi.');
                return;
            }

            setSyncState('running');
            let totalImported = 0;
            let totalUpdated = 0;
            let processed = 0;

            for (let i = 0; i < targetDealers.length; i++) {
                if (isCancelledRef.current) {
                    break;
                }

                const d = targetDealers[i];
                setBulkProgress({
                    current: i + 1,
                    total: targetDealers.length,
                    currentDealerName: `${d.kode_dealer} - ${d.nama_dealer}`,
                    currentImported: totalImported,
                    currentUpdated: totalUpdated,
                });
                setSyncMessage(
                    `[${i + 1}/${targetDealers.length}] Sedang mengekstrak ulasan: ${d.nama_dealer}...`,
                );

                try {
                    const startRes = await fetch(reviewsRoute.sync.start.url(), {
                        method: 'POST',
                        headers: {
                            'Content-Type': 'application/json',
                            'X-CSRF-TOKEN': csrfToken,
                            Accept: 'application/json',
                        },
                        body: JSON.stringify({
                            dealer_id: d.id,
                            max_reviews: actualLimit,
                            sort_by: syncSort,
                        }),
                    });

                    const startData = await startRes.json();
                    if (!startRes.ok || !startData.success) {
                        continue;
                    }

                    const jobId = startData.jobId;
                    let completed = false;
                    let pollCount = 0;

                    while (!completed && pollCount < 90 && !isCancelledRef.current) {
                        await new Promise((resolve) => setTimeout(resolve, 2000));
                        pollCount++;

                        const statusUrl = `${reviewsRoute.sync.status.url({ jobId })}?dealer_id=${d.id}`;
                        const statusRes = await fetch(statusUrl, {
                            headers: { Accept: 'application/json' },
                        });
                        const statusData = await statusRes.json();

                        if (statusData.status === 'completed') {
                            completed = true;
                            if (statusData.data) {
                                totalImported += statusData.data.imported || 0;
                                totalUpdated += statusData.data.updated || 0;
                                setBulkProgress({
                                    current: i + 1,
                                    total: targetDealers.length,
                                    currentDealerName: `${d.kode_dealer} - ${d.nama_dealer}`,
                                    currentImported: totalImported,
                                    currentUpdated: totalUpdated,
                                });
                            }
                        } else if (statusData.status === 'failed') {
                            completed = true;
                        }
                    }

                    processed++;
                } catch {
                    // Lanjutkan ke dealer berikutnya jika ada kendala
                }
            }

            setSyncState('completed');
            setSyncResult({
                imported: totalImported,
                updated: totalUpdated,
                total_scraped: totalImported + totalUpdated,
                dealer_nama: `Semua Dealer (${processed} selesai diproses)`,
            });
            setSyncMessage(
                isCancelledRef.current
                    ? `Sinkronisasi dihentikan. Berhasil memproses ${processed} dealer.`
                    : `Selesai! Berhasil memproses ${processed} dari ${targetDealers.length} dealer.`,
            );
            toast.success(
                `Berhasil: ${totalImported} ulasan baru diimpor, ${totalUpdated} ulasan diperbarui.`,
            );
            router.reload({ only: ['reviews', 'stats'] });
            return;
        }

        // Kasus 2: Sinkronisasi 1 Dealer Tertentu
        setSyncMessage('Mengirim permintaan scraping ke service Scraper...');
        try {
            const res = await fetch(reviewsRoute.sync.start.url(), {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'X-CSRF-TOKEN': csrfToken,
                    Accept: 'application/json',
                },
                body: JSON.stringify({
                    dealer_id: syncDealerId,
                    max_reviews: actualLimit,
                    sort_by: syncSort,
                }),
            });

            const data = await res.json();

            if (!res.ok || !data.success) {
                setSyncState('failed');
                setSyncError(data.message || 'Gagal memulai scraping review.');
                return;
            }

            const jobId = data.jobId;
            setSyncState('running');
            setSyncMessage(
                'Browser Playwright sedang membuka Google Maps & mengunduh ulasan...',
            );

            if (pollRef.current) {
                clearInterval(pollRef.current);
            }

            let pollCount = 0;
            pollRef.current = setInterval(async () => {
                pollCount++;
                try {
                    const statusUrl = `${reviewsRoute.sync.status.url({ jobId })}?dealer_id=${syncDealerId}`;
                    const statusRes = await fetch(statusUrl, {
                        headers: { Accept: 'application/json' },
                    });
                    const statusData = await statusRes.json();

                    if (statusData.status === 'completed') {
                        if (pollRef.current) {
                            clearInterval(pollRef.current);
                        }
                        setSyncState('completed');
                        setSyncResult(statusData.data);
                        setSyncMessage(statusData.message);
                        toast.success(statusData.message);
                        router.reload({ only: ['reviews', 'stats'] });
                    } else if (statusData.status === 'failed') {
                        if (pollRef.current) {
                            clearInterval(pollRef.current);
                        }
                        setSyncState('failed');
                        setSyncError(
                            statusData.message ||
                                'Scraping ulasan gagal dilakukan.',
                        );
                        toast.error(
                            statusData.message || 'Scraping ulasan gagal.',
                        );
                    } else {
                        if (pollCount > 6) {
                            setSyncMessage(
                                'Sedang mengekstrak rating, komentar ulasan, dan respon owner...',
                            );
                        }
                    }
                } catch {
                    if (pollCount > 80) {
                        if (pollRef.current) {
                            clearInterval(pollRef.current);
                        }
                        setSyncState('failed');
                        setSyncError(
                            'Koneksi terputus saat memeriksa status scraping.',
                        );
                    }
                }
            }, 2500);
        } catch (err: any) {
            setSyncState('failed');
            setSyncError(
                err.message ||
                    'Terjadi kesalahan saat menghubungi API scraper.',
            );
        }
    };

    const formatDate = (dateStr?: string | null) => {
        if (!dateStr) return '-';
        try {
            const d = new Date(dateStr);
            return d.toLocaleDateString('id-ID', {
                day: 'numeric',
                month: 'short',
                year: 'numeric',
            });
        } catch {
            return dateStr;
        }
    };

    const hasActiveFilters = Boolean(
        search || dealerFilter || starFilter || responFilter,
    );

    const respondedPct =
        stats.total > 0 ? Math.round((stats.responded / stats.total) * 100) : 0;

    return (
        <>
            <Head title="Menu Review" />

            <div className="flex h-full flex-1 flex-col gap-6 p-4 md:p-6">
                {/* Header Section */}
                <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
                    <div>
                        <h1 className="flex items-center gap-2 text-2xl font-bold tracking-tight text-foreground">
                            <Star className="size-6 fill-amber-400 text-amber-500" />
                            Menu Review
                        </h1>
                        <p className="mt-1 text-sm text-muted-foreground">
                            Kelola data ulasan pelanggan Google Review per
                            dealer, rating bintang, dan respon tanggapan owner.
                        </p>
                    </div>

                    <div className="flex items-center gap-2">
                        <Button
                            variant="outline"
                            onClick={() => handleOpenSync()}
                            className="shrink-0 gap-2 border-primary/40 text-primary hover:bg-primary/10"
                        >
                            <RefreshCw className="size-4" />
                            Tarik Google Review
                        </Button>
                        <Button
                            onClick={handleOpenCreate}
                            className="shrink-0 gap-2"
                        >
                            <Plus className="size-4" />
                            Tambah Review
                        </Button>
                    </div>
                </div>

                {/* Stats Cards */}
                <div className="grid grid-cols-2 gap-3 sm:grid-cols-4 md:gap-4">
                    <div className="rounded-xl border border-sidebar-border/70 bg-card p-4 shadow-2xs dark:border-sidebar-border">
                        <div className="flex items-center justify-between">
                            <span className="text-xs font-medium text-muted-foreground">
                                Total Review
                            </span>
                            <div className="flex size-7 items-center justify-center rounded-lg bg-blue-500/10 text-blue-600 dark:text-blue-400">
                                <MessageSquare className="size-4" />
                            </div>
                        </div>
                        <div className="mt-2 text-2xl font-bold text-foreground">
                            {stats.total.toLocaleString('id-ID')}
                        </div>
                        <p className="mt-0.5 text-[11px] text-muted-foreground">
                            Semua ulasan terdaftar
                        </p>
                    </div>

                    <div className="rounded-xl border border-sidebar-border/70 bg-card p-4 shadow-2xs dark:border-sidebar-border">
                        <div className="flex items-center justify-between">
                            <span className="text-xs font-medium text-muted-foreground">
                                Rata-rata Rating
                            </span>
                            <div className="flex size-7 items-center justify-center rounded-lg bg-amber-500/10 text-amber-600 dark:text-amber-400">
                                <Star className="size-4 fill-amber-400 text-amber-500" />
                            </div>
                        </div>
                        <div className="mt-2 flex items-baseline gap-1">
                            <span className="text-2xl font-bold text-foreground">
                                {stats.average_rating > 0
                                    ? stats.average_rating.toFixed(1)
                                    : '-'}
                            </span>
                            <span className="text-xs text-muted-foreground">
                                / 5.0
                            </span>
                        </div>
                        <p className="mt-0.5 text-[11px] text-muted-foreground">
                            Skor kepuasan pelanggan
                        </p>
                    </div>

                    <div className="rounded-xl border border-sidebar-border/70 bg-card p-4 shadow-2xs dark:border-sidebar-border">
                        <div className="flex items-center justify-between">
                            <span className="text-xs font-medium text-muted-foreground">
                                Sudah Direspon
                            </span>
                            <div className="flex size-7 items-center justify-center rounded-lg bg-emerald-500/10 text-emerald-600 dark:text-emerald-400">
                                <CheckCircle2 className="size-4" />
                            </div>
                        </div>
                        <div className="mt-2 text-2xl font-bold text-emerald-600 dark:text-emerald-400">
                            {stats.responded.toLocaleString('id-ID')}
                        </div>
                        <p className="mt-0.5 text-[11px] text-muted-foreground">
                            {respondedPct}% telah ditanggapi
                        </p>
                    </div>

                    <div className="rounded-xl border border-sidebar-border/70 bg-card p-4 shadow-2xs dark:border-sidebar-border">
                        <div className="flex items-center justify-between">
                            <span className="text-xs font-medium text-muted-foreground">
                                Belum Direspon
                            </span>
                            <div className="flex size-7 items-center justify-center rounded-lg bg-rose-500/10 text-rose-600 dark:text-rose-400">
                                <Clock className="size-4" />
                            </div>
                        </div>
                        <div className="mt-2 text-2xl font-bold text-rose-600 dark:text-rose-400">
                            {stats.unresponded.toLocaleString('id-ID')}
                        </div>
                        <p className="mt-0.5 text-[11px] text-muted-foreground">
                            Menunggu tindak lanjut
                        </p>
                    </div>
                </div>

                {/* Filter and Search Panel */}
                <div className="rounded-xl border border-sidebar-border/70 bg-card p-4 shadow-2xs dark:border-sidebar-border">
                    <div className="mb-3 flex items-center gap-1.5 text-xs font-semibold text-muted-foreground uppercase">
                        <Filter className="size-3.5" />
                        Filter & Pencarian Review
                    </div>

                    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 md:grid-cols-4">
                        {/* Search Input */}
                        <form
                            onSubmit={handleSearchSubmit}
                            className="relative"
                        >
                            <Search className="absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" />
                            <Input
                                type="text"
                                placeholder="Cari reviewer, ulasan..."
                                value={search}
                                onChange={(e) => setSearch(e.target.value)}
                                className="pr-8 pl-9"
                            />
                            {search && (
                                <button
                                    type="button"
                                    onClick={() => {
                                        setSearch('');
                                        applyFilters({
                                            search: '',
                                            dealer_id: dealerFilter,
                                            star_rate: starFilter,
                                            respon_from_owner: responFilter,
                                        });
                                    }}
                                    className="absolute top-1/2 right-2.5 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                                >
                                    <X className="size-4" />
                                </button>
                            )}
                        </form>

                        {/* Filter Dealer */}
                        <div>
                            <select
                                value={dealerFilter}
                                onChange={handleDealerChange}
                                className={selectClass}
                                aria-label="Filter Dealer"
                            >
                                <option value="">Semua Dealer</option>
                                {dealers.map((d) => (
                                    <option key={d.id} value={d.id}>
                                        {d.kode_dealer} - {d.nama_dealer}
                                    </option>
                                ))}
                            </select>
                        </div>

                        {/* Filter Star Rate */}
                        <div>
                            <select
                                value={starFilter}
                                onChange={handleStarChange}
                                className={selectClass}
                                aria-label="Filter Rating"
                            >
                                <option value="">Semua Rating</option>
                                <option value="5">★ 5 Bintang</option>
                                <option value="4">★ 4 Bintang</option>
                                <option value="3">★ 3 Bintang</option>
                                <option value="2">★ 2 Bintang</option>
                                <option value="1">★ 1 Bintang</option>
                            </select>
                        </div>

                        {/* Filter Respon From Owner */}
                        <div>
                            <select
                                value={responFilter}
                                onChange={handleResponChange}
                                className={selectClass}
                                aria-label="Filter Respon Owner"
                            >
                                <option value="">Semua Status Respon</option>
                                <option value="true">
                                    Sudah Direspon Owner
                                </option>
                                <option value="false">Belum Direspon</option>
                            </select>
                        </div>
                    </div>

                    {hasActiveFilters && (
                        <div className="mt-3 flex items-center justify-between border-t border-sidebar-border/50 pt-3 text-xs text-muted-foreground dark:border-sidebar-border">
                            <span>Filter aktif diterapkan</span>
                            <button
                                type="button"
                                onClick={handleResetFilters}
                                className="font-medium text-primary hover:underline"
                            >
                                Reset Semua Filter
                            </button>
                        </div>
                    )}
                </div>

                {/* Table Container */}
                <div className="overflow-hidden rounded-xl border border-sidebar-border/70 bg-card shadow-xs dark:border-sidebar-border">
                    <div className="overflow-x-auto">
                        <table className="w-full text-left text-sm">
                            <thead className="border-b border-sidebar-border/70 bg-muted/40 text-xs font-semibold tracking-wider text-muted-foreground uppercase dark:border-sidebar-border">
                                <tr>
                                    <th className="w-12 px-3 py-3.5 text-center">
                                        No
                                    </th>
                                    <th className="px-3 py-3.5 whitespace-nowrap">
                                        Dealer
                                    </th>
                                    <th className="px-3 py-3.5 whitespace-nowrap">
                                        Nama Reviewer
                                    </th>
                                    <th className="px-3 py-3.5 whitespace-nowrap">
                                        Tgl Publish
                                    </th>
                                    <th className="px-3 py-3.5 whitespace-nowrap">
                                        Star Rate
                                    </th>
                                    <th className="min-w-[220px] px-3 py-3.5">
                                        Review
                                    </th>
                                    <th className="px-3 py-3.5 text-center whitespace-nowrap">
                                        Respon Owner
                                    </th>
                                    <th className="px-3 py-3.5 whitespace-nowrap">
                                        Tgl Respon
                                    </th>
                                    <th className="min-w-[200px] px-3 py-3.5">
                                        Respon
                                    </th>
                                    <th className="px-3 py-3.5 text-center whitespace-nowrap">
                                        Google Review
                                    </th>
                                    <th className="px-3 py-3.5 text-right whitespace-nowrap">
                                        Aksi
                                    </th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-sidebar-border/50 dark:divide-sidebar-border">
                                {reviews.data.length === 0 ? (
                                    <tr>
                                        <td
                                            colSpan={11}
                                            className="py-12 text-center text-muted-foreground"
                                        >
                                            <div className="flex flex-col items-center justify-center gap-2">
                                                <Star className="size-10 text-muted-foreground/40" />
                                                <p className="font-medium text-foreground">
                                                    Tidak ada data review
                                                </p>
                                                <p className="text-xs">
                                                    {hasActiveFilters
                                                        ? 'Tidak ditemukan review dengan filter yang dipilih.'
                                                        : 'Belum ada data review yang ditambahkan.'}
                                                </p>
                                                {hasActiveFilters && (
                                                    <Button
                                                        variant="outline"
                                                        size="sm"
                                                        onClick={
                                                            handleResetFilters
                                                        }
                                                        className="mt-2"
                                                    >
                                                        Reset Filter
                                                    </Button>
                                                )}
                                            </div>
                                        </td>
                                    </tr>
                                ) : (
                                    reviews.data.map((rev, index) => {
                                        const rowNumber =
                                            (reviews.current_page - 1) *
                                                reviews.per_page +
                                            index +
                                            1;
                                        return (
                                            <tr
                                                key={rev.id}
                                                className="transition-colors hover:bg-muted/40"
                                            >
                                                <td className="px-3 py-3.5 text-center font-mono text-xs text-muted-foreground">
                                                    {rowNumber}
                                                </td>
                                                <td className="px-3 py-3.5 whitespace-nowrap">
                                                    {rev.dealer ? (
                                                        <div className="flex flex-col">
                                                            <span className="font-medium text-foreground">
                                                                {
                                                                    rev.dealer
                                                                        .nama_dealer
                                                                }
                                                            </span>
                                                            <span className="font-mono text-[11px] text-muted-foreground">
                                                                {
                                                                    rev.dealer
                                                                        .kode_dealer
                                                                }
                                                            </span>
                                                        </div>
                                                    ) : (
                                                        <span className="text-xs text-muted-foreground italic">
                                                            -
                                                        </span>
                                                    )}
                                                </td>
                                                <td className="px-3 py-3.5 font-medium whitespace-nowrap text-foreground">
                                                    {rev.nama_reviewer}
                                                </td>
                                                <td className="px-3 py-3.5 font-mono text-xs whitespace-nowrap text-muted-foreground">
                                                    {formatDate(
                                                        rev.tanggal_publish_review,
                                                    )}
                                                </td>
                                                <td className="px-3 py-3.5 whitespace-nowrap">
                                                    <span className="inline-flex items-center gap-1 font-semibold text-amber-600 dark:text-amber-400">
                                                        <Star className="size-3.5 fill-amber-400 text-amber-500" />
                                                        {Number(
                                                            rev.star_rate,
                                                        ).toFixed(1)}
                                                    </span>
                                                </td>
                                                <td className="max-w-[280px] min-w-[200px] px-3 py-3.5 text-xs text-foreground">
                                                    {rev.review ? (
                                                        <div
                                                            onClick={() =>
                                                                handleOpenDetail(
                                                                    rev,
                                                                )
                                                            }
                                                            className="line-clamp-2 cursor-pointer hover:text-primary hover:underline"
                                                            title="Klik untuk melihat ulasan lengkap"
                                                        >
                                                            {rev.review}
                                                        </div>
                                                    ) : (
                                                        <span className="text-muted-foreground italic">
                                                            (Tanpa teks ulasan)
                                                        </span>
                                                    )}
                                                </td>
                                                <td className="px-3 py-3.5 text-center whitespace-nowrap">
                                                    {rev.respon_from_owner ? (
                                                        <Badge
                                                            variant="outline"
                                                            className="border-emerald-600/30 bg-emerald-50 text-emerald-700 dark:border-emerald-500/30 dark:bg-emerald-950/40 dark:text-emerald-400"
                                                        >
                                                            Sudah Direspon
                                                        </Badge>
                                                    ) : (
                                                        <Badge
                                                            variant="outline"
                                                            className="border-muted bg-muted/40 text-muted-foreground"
                                                        >
                                                            Belum Direspon
                                                        </Badge>
                                                    )}
                                                </td>
                                                <td className="px-3 py-3.5 font-mono text-xs whitespace-nowrap text-muted-foreground">
                                                    {formatDate(
                                                        rev.tanggal_respon,
                                                    )}
                                                </td>
                                                <td className="max-w-[260px] min-w-[180px] px-3 py-3.5 text-xs text-foreground">
                                                    {rev.respon ? (
                                                        <div
                                                            onClick={() =>
                                                                handleOpenDetail(
                                                                    rev,
                                                                )
                                                            }
                                                            className="line-clamp-2 cursor-pointer hover:text-primary hover:underline"
                                                            title="Klik untuk melihat respon lengkap"
                                                        >
                                                            {rev.respon}
                                                        </div>
                                                    ) : (
                                                        <span className="text-muted-foreground italic">
                                                            -
                                                        </span>
                                                    )}
                                                </td>
                                                <td className="px-3 py-3.5 text-center whitespace-nowrap">
                                                    {rev.google_review_url ? (
                                                        <a
                                                            href={
                                                                rev.google_review_url
                                                            }
                                                            target="_blank"
                                                            rel="noopener noreferrer"
                                                            className="inline-flex items-center gap-1 rounded-md border border-sidebar-border bg-background px-2.5 py-1 text-xs font-medium text-foreground shadow-2xs transition-colors hover:border-primary/50 hover:bg-accent hover:text-primary dark:border-sidebar-border"
                                                            title={
                                                                rev.google_review_url
                                                            }
                                                        >
                                                            <span>
                                                                Buka URL
                                                            </span>
                                                            <ExternalLink className="size-3 shrink-0 text-muted-foreground" />
                                                        </a>
                                                    ) : (
                                                        <span className="text-xs text-muted-foreground italic">
                                                            -
                                                        </span>
                                                    )}
                                                </td>
                                                <td className="px-3 py-3.5 text-right whitespace-nowrap">
                                                    <div className="flex items-center justify-end gap-1">
                                                        <Button
                                                            variant="ghost"
                                                            size="sm"
                                                            onClick={() =>
                                                                handleOpenDetail(
                                                                    rev,
                                                                )
                                                            }
                                                            className="h-8 px-2 text-muted-foreground hover:text-foreground"
                                                            title="Lihat Detail Review"
                                                        >
                                                            <Eye className="size-3.5" />
                                                            <span className="sr-only">
                                                                Detail
                                                            </span>
                                                        </Button>
                                                        <Button
                                                            variant="ghost"
                                                            size="sm"
                                                            onClick={() =>
                                                                handleOpenEdit(
                                                                    rev,
                                                                )
                                                            }
                                                            className="h-8 px-2 text-muted-foreground hover:text-foreground"
                                                            title="Edit Review"
                                                        >
                                                            <Edit2 className="size-3.5" />
                                                            <span className="sr-only">
                                                                Edit
                                                            </span>
                                                        </Button>
                                                        <Button
                                                            variant="ghost"
                                                            size="sm"
                                                            onClick={() =>
                                                                handleOpenDelete(
                                                                    rev,
                                                                )
                                                            }
                                                            className="h-8 px-2 text-destructive/80 hover:bg-destructive/10 hover:text-destructive"
                                                            title="Hapus Review"
                                                        >
                                                            <Trash2 className="size-3.5" />
                                                            <span className="sr-only">
                                                                Hapus
                                                            </span>
                                                        </Button>
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
                    {reviews.total > 0 && (
                        <div className="flex flex-col items-center justify-between gap-3 border-t border-sidebar-border/70 p-4 sm:flex-row dark:border-sidebar-border">
                            <p className="text-xs text-muted-foreground">
                                Menampilkan{' '}
                                <span className="font-medium text-foreground">
                                    {reviews.from ?? 0}
                                </span>{' '}
                                sampai{' '}
                                <span className="font-medium text-foreground">
                                    {reviews.to ?? 0}
                                </span>{' '}
                                dari{' '}
                                <span className="font-medium text-foreground">
                                    {reviews.total}
                                </span>{' '}
                                data review
                            </p>
                            <Pagination links={reviews.links} />
                        </div>
                    )}
                </div>
            </div>

            {/* Modal Tambah Review */}
            <Dialog open={isCreateOpen} onOpenChange={setIsCreateOpen}>
                <DialogContent className="max-h-[85vh] overflow-y-auto sm:max-w-2xl">
                    <DialogHeader>
                        <DialogTitle>Tambah Review Baru</DialogTitle>
                        <DialogDescription>
                            Tambahkan data ulasan pelanggan Google Review
                            beserta tanggapan atau respon owner dealer.
                        </DialogDescription>
                    </DialogHeader>

                    <form
                        onSubmit={handleSubmitCreate}
                        className="space-y-4 py-2"
                    >
                        {/* Section 1: Dealer & Reviewer */}
                        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                            <div className="space-y-2">
                                <Label htmlFor="create_dealer_id">
                                    Pilih Dealer{' '}
                                    <span className="text-destructive">*</span>
                                </Label>
                                <select
                                    id="create_dealer_id"
                                    value={createForm.data.dealer_id}
                                    onChange={(e) =>
                                        createForm.setData(
                                            'dealer_id',
                                            e.target.value,
                                        )
                                    }
                                    className={`${selectClass} ${createForm.errors.dealer_id ? 'border-destructive' : ''}`}
                                >
                                    <option value="" disabled>
                                        Pilih Dealer...
                                    </option>
                                    {dealers.map((d) => (
                                        <option key={d.id} value={d.id}>
                                            {d.kode_dealer} - {d.nama_dealer}
                                        </option>
                                    ))}
                                </select>
                                <InputError
                                    message={createForm.errors.dealer_id}
                                />
                            </div>

                            <div className="space-y-2">
                                <Label htmlFor="create_nama_reviewer">
                                    Nama Reviewer{' '}
                                    <span className="text-destructive">*</span>
                                </Label>
                                <Input
                                    id="create_nama_reviewer"
                                    placeholder="Contoh: Ahmad Fauzi"
                                    value={createForm.data.nama_reviewer}
                                    onChange={(e) =>
                                        createForm.setData(
                                            'nama_reviewer',
                                            e.target.value,
                                        )
                                    }
                                    className={
                                        createForm.errors.nama_reviewer
                                            ? 'border-destructive'
                                            : ''
                                    }
                                />
                                <InputError
                                    message={createForm.errors.nama_reviewer}
                                />
                            </div>
                        </div>

                        {/* Section 2: Tanggal Publish & Rating */}
                        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                            <div className="space-y-2">
                                <Label htmlFor="create_tanggal_publish">
                                    Tanggal Publish Review{' '}
                                    <span className="text-destructive">*</span>
                                </Label>
                                <Input
                                    id="create_tanggal_publish"
                                    type="date"
                                    value={
                                        createForm.data.tanggal_publish_review
                                    }
                                    onChange={(e) =>
                                        createForm.setData(
                                            'tanggal_publish_review',
                                            e.target.value,
                                        )
                                    }
                                    className={
                                        createForm.errors.tanggal_publish_review
                                            ? 'border-destructive'
                                            : ''
                                    }
                                />
                                <InputError
                                    message={
                                        createForm.errors.tanggal_publish_review
                                    }
                                />
                            </div>

                            <div className="space-y-2">
                                <Label htmlFor="create_star_rate">
                                    Star Rate (1 - 5){' '}
                                    <span className="text-destructive">*</span>
                                </Label>
                                <div className="flex items-center gap-2">
                                    <Input
                                        id="create_star_rate"
                                        type="number"
                                        step="0.1"
                                        min="1"
                                        max="5"
                                        placeholder="5.0"
                                        value={createForm.data.star_rate}
                                        onChange={(e) =>
                                            createForm.setData(
                                                'star_rate',
                                                e.target.value,
                                            )
                                        }
                                        className={
                                            createForm.errors.star_rate
                                                ? 'w-24 border-destructive'
                                                : 'w-24'
                                        }
                                    />
                                    <div className="flex items-center gap-1">
                                        {[1, 2, 3, 4, 5].map((s) => (
                                            <button
                                                key={s}
                                                type="button"
                                                onClick={() =>
                                                    createForm.setData(
                                                        'star_rate',
                                                        String(s),
                                                    )
                                                }
                                                className="p-1 text-muted-foreground hover:text-amber-500"
                                                title={`Pilih ${s} Bintang`}
                                            >
                                                <Star
                                                    className={`size-4 ${
                                                        Number(
                                                            createForm.data
                                                                .star_rate,
                                                        ) >= s
                                                            ? 'fill-amber-400 text-amber-500'
                                                            : 'text-muted-foreground/30'
                                                    }`}
                                                />
                                            </button>
                                        ))}
                                    </div>
                                </div>
                                <InputError
                                    message={createForm.errors.star_rate}
                                />
                            </div>
                        </div>

                        {/* Section 3: Review Text */}
                        <div className="space-y-2">
                            <div className="flex items-center justify-between">
                                <Label htmlFor="create_review">
                                    Isi Ulasan / Review
                                </Label>
                                <span className="text-[11px] text-muted-foreground italic">
                                    Opsional
                                </span>
                            </div>
                            <textarea
                                id="create_review"
                                rows={3}
                                placeholder="Tuliskan isi komentar ulasan dari pelanggan..."
                                value={createForm.data.review}
                                onChange={(e) =>
                                    createForm.setData('review', e.target.value)
                                }
                                className={`flex w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm shadow-xs placeholder:text-muted-foreground focus-visible:ring-1 focus-visible:ring-ring focus-visible:outline-none disabled:cursor-not-allowed disabled:opacity-50 ${
                                    createForm.errors.review
                                        ? 'border-destructive'
                                        : ''
                                }`}
                            />
                            <InputError message={createForm.errors.review} />
                        </div>

                        {/* Section 4: Respon From Owner Checkbox */}
                        <div className="rounded-lg border border-sidebar-border/80 bg-muted/20 p-3">
                            <div className="flex items-start space-x-2">
                                <Checkbox
                                    id="create_respon_from_owner"
                                    checked={createForm.data.respon_from_owner}
                                    onCheckedChange={(checked) => {
                                        const isChecked = checked === true;
                                        createForm.setData({
                                            ...createForm.data,
                                            respon_from_owner: isChecked,
                                            tanggal_respon: isChecked
                                                ? createForm.data
                                                      .tanggal_respon ||
                                                  todayString
                                                : '',
                                        });
                                    }}
                                    className="mt-0.5"
                                />
                                <div className="space-y-0.5">
                                    <Label
                                        htmlFor="create_respon_from_owner"
                                        className="cursor-pointer text-xs font-semibold text-foreground"
                                    >
                                        Respon From Owner (True / False)
                                    </Label>
                                    <p className="text-[11px] text-muted-foreground">
                                        Centang jika ulasan ini sudah dibalas
                                        oleh pihak owner / pengelola dealer.
                                    </p>
                                </div>
                            </div>

                            {createForm.data.respon_from_owner && (
                                <div className="mt-3 space-y-3 border-t border-sidebar-border/60 pt-3">
                                    <div className="space-y-2">
                                        <Label htmlFor="create_tanggal_respon">
                                            Tanggal Respon
                                        </Label>
                                        <Input
                                            id="create_tanggal_respon"
                                            type="date"
                                            value={
                                                createForm.data.tanggal_respon
                                            }
                                            onChange={(e) =>
                                                createForm.setData(
                                                    'tanggal_respon',
                                                    e.target.value,
                                                )
                                            }
                                            className={
                                                createForm.errors.tanggal_respon
                                                    ? 'border-destructive'
                                                    : ''
                                            }
                                        />
                                        <InputError
                                            message={
                                                createForm.errors.tanggal_respon
                                            }
                                        />
                                    </div>

                                    <div className="space-y-2">
                                        <Label htmlFor="create_respon">
                                            Teks Respon / Tanggapan Owner
                                        </Label>
                                        <textarea
                                            id="create_respon"
                                            rows={3}
                                            placeholder="Tuliskan balasan jawaban dari owner/dealer..."
                                            value={createForm.data.respon}
                                            onChange={(e) =>
                                                createForm.setData(
                                                    'respon',
                                                    e.target.value,
                                                )
                                            }
                                            className={`flex w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm shadow-xs placeholder:text-muted-foreground focus-visible:ring-1 focus-visible:ring-ring focus-visible:outline-none disabled:cursor-not-allowed disabled:opacity-50 ${
                                                createForm.errors.respon
                                                    ? 'border-destructive'
                                                    : ''
                                            }`}
                                        />
                                        <InputError
                                            message={createForm.errors.respon}
                                        />
                                    </div>
                                </div>
                            )}
                        </div>

                        {/* Section 5: Google Review URL */}
                        <div className="space-y-2">
                            <div className="flex items-center justify-between">
                                <Label htmlFor="create_google_review_url">
                                    Google Review URL
                                </Label>
                                <span className="text-[11px] text-muted-foreground italic">
                                    Opsional
                                </span>
                            </div>
                            <Input
                                id="create_google_review_url"
                                placeholder="Contoh: https://maps.app.goo.gl/..."
                                value={createForm.data.google_review_url}
                                onChange={(e) =>
                                    createForm.setData(
                                        'google_review_url',
                                        e.target.value,
                                    )
                                }
                                className={
                                    createForm.errors.google_review_url
                                        ? 'border-destructive'
                                        : ''
                                }
                            />
                            <InputError
                                message={createForm.errors.google_review_url}
                            />
                        </div>

                        <DialogFooter className="pt-2">
                            <DialogClose asChild>
                                <Button
                                    type="button"
                                    variant="outline"
                                    disabled={createForm.processing}
                                >
                                    Batal
                                </Button>
                            </DialogClose>
                            <Button
                                type="submit"
                                disabled={createForm.processing}
                            >
                                {createForm.processing
                                    ? 'Menyimpan...'
                                    : 'Simpan Review'}
                            </Button>
                        </DialogFooter>
                    </form>
                </DialogContent>
            </Dialog>

            {/* Modal Edit Review */}
            <Dialog open={isEditOpen} onOpenChange={setIsEditOpen}>
                <DialogContent className="max-h-[85vh] overflow-y-auto sm:max-w-2xl">
                    <DialogHeader>
                        <DialogTitle>Edit Review</DialogTitle>
                        <DialogDescription>
                            Perbarui data review pelanggan, status respon owner,
                            atau Google Review URL terpilih.
                        </DialogDescription>
                    </DialogHeader>

                    <form
                        onSubmit={handleSubmitEdit}
                        className="space-y-4 py-2"
                    >
                        {/* Section 1: Dealer & Reviewer */}
                        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                            <div className="space-y-2">
                                <Label htmlFor="edit_dealer_id">
                                    Pilih Dealer{' '}
                                    <span className="text-destructive">*</span>
                                </Label>
                                <select
                                    id="edit_dealer_id"
                                    value={editForm.data.dealer_id}
                                    onChange={(e) =>
                                        editForm.setData(
                                            'dealer_id',
                                            e.target.value,
                                        )
                                    }
                                    className={`${selectClass} ${editForm.errors.dealer_id ? 'border-destructive' : ''}`}
                                >
                                    <option value="" disabled>
                                        Pilih Dealer...
                                    </option>
                                    {dealers.map((d) => (
                                        <option key={d.id} value={d.id}>
                                            {d.kode_dealer} - {d.nama_dealer}
                                        </option>
                                    ))}
                                </select>
                                <InputError
                                    message={editForm.errors.dealer_id}
                                />
                            </div>

                            <div className="space-y-2">
                                <Label htmlFor="edit_nama_reviewer">
                                    Nama Reviewer{' '}
                                    <span className="text-destructive">*</span>
                                </Label>
                                <Input
                                    id="edit_nama_reviewer"
                                    placeholder="Contoh: Ahmad Fauzi"
                                    value={editForm.data.nama_reviewer}
                                    onChange={(e) =>
                                        editForm.setData(
                                            'nama_reviewer',
                                            e.target.value,
                                        )
                                    }
                                    className={
                                        editForm.errors.nama_reviewer
                                            ? 'border-destructive'
                                            : ''
                                    }
                                />
                                <InputError
                                    message={editForm.errors.nama_reviewer}
                                />
                            </div>
                        </div>

                        {/* Section 2: Tanggal Publish & Rating */}
                        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                            <div className="space-y-2">
                                <Label htmlFor="edit_tanggal_publish">
                                    Tanggal Publish Review{' '}
                                    <span className="text-destructive">*</span>
                                </Label>
                                <Input
                                    id="edit_tanggal_publish"
                                    type="date"
                                    value={editForm.data.tanggal_publish_review}
                                    onChange={(e) =>
                                        editForm.setData(
                                            'tanggal_publish_review',
                                            e.target.value,
                                        )
                                    }
                                    className={
                                        editForm.errors.tanggal_publish_review
                                            ? 'border-destructive'
                                            : ''
                                    }
                                />
                                <InputError
                                    message={
                                        editForm.errors.tanggal_publish_review
                                    }
                                />
                            </div>

                            <div className="space-y-2">
                                <Label htmlFor="edit_star_rate">
                                    Star Rate (1 - 5){' '}
                                    <span className="text-destructive">*</span>
                                </Label>
                                <div className="flex items-center gap-2">
                                    <Input
                                        id="edit_star_rate"
                                        type="number"
                                        step="0.1"
                                        min="1"
                                        max="5"
                                        placeholder="5.0"
                                        value={editForm.data.star_rate}
                                        onChange={(e) =>
                                            editForm.setData(
                                                'star_rate',
                                                e.target.value,
                                            )
                                        }
                                        className={
                                            editForm.errors.star_rate
                                                ? 'w-24 border-destructive'
                                                : 'w-24'
                                        }
                                    />
                                    <div className="flex items-center gap-1">
                                        {[1, 2, 3, 4, 5].map((s) => (
                                            <button
                                                key={s}
                                                type="button"
                                                onClick={() =>
                                                    editForm.setData(
                                                        'star_rate',
                                                        String(s),
                                                    )
                                                }
                                                className="p-1 text-muted-foreground hover:text-amber-500"
                                                title={`Pilih ${s} Bintang`}
                                            >
                                                <Star
                                                    className={`size-4 ${
                                                        Number(
                                                            editForm.data
                                                                .star_rate,
                                                        ) >= s
                                                            ? 'fill-amber-400 text-amber-500'
                                                            : 'text-muted-foreground/30'
                                                    }`}
                                                />
                                            </button>
                                        ))}
                                    </div>
                                </div>
                                <InputError
                                    message={editForm.errors.star_rate}
                                />
                            </div>
                        </div>

                        {/* Section 3: Review Text */}
                        <div className="space-y-2">
                            <div className="flex items-center justify-between">
                                <Label htmlFor="edit_review">
                                    Isi Ulasan / Review
                                </Label>
                                <span className="text-[11px] text-muted-foreground italic">
                                    Opsional
                                </span>
                            </div>
                            <textarea
                                id="edit_review"
                                rows={3}
                                placeholder="Tuliskan isi komentar ulasan dari pelanggan..."
                                value={editForm.data.review}
                                onChange={(e) =>
                                    editForm.setData('review', e.target.value)
                                }
                                className={`flex w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm shadow-xs placeholder:text-muted-foreground focus-visible:ring-1 focus-visible:ring-ring focus-visible:outline-none disabled:cursor-not-allowed disabled:opacity-50 ${
                                    editForm.errors.review
                                        ? 'border-destructive'
                                        : ''
                                }`}
                            />
                            <InputError message={editForm.errors.review} />
                        </div>

                        {/* Section 4: Respon From Owner Checkbox */}
                        <div className="rounded-lg border border-sidebar-border/80 bg-muted/20 p-3">
                            <div className="flex items-start space-x-2">
                                <Checkbox
                                    id="edit_respon_from_owner"
                                    checked={editForm.data.respon_from_owner}
                                    onCheckedChange={(checked) => {
                                        const isChecked = checked === true;
                                        editForm.setData({
                                            ...editForm.data,
                                            respon_from_owner: isChecked,
                                            tanggal_respon: isChecked
                                                ? editForm.data
                                                      .tanggal_respon ||
                                                  todayString
                                                : '',
                                        });
                                    }}
                                    className="mt-0.5"
                                />
                                <div className="space-y-0.5">
                                    <Label
                                        htmlFor="edit_respon_from_owner"
                                        className="cursor-pointer text-xs font-semibold text-foreground"
                                    >
                                        Respon From Owner (True / False)
                                    </Label>
                                    <p className="text-[11px] text-muted-foreground">
                                        Centang jika ulasan ini sudah dibalas
                                        oleh pihak owner / pengelola dealer.
                                    </p>
                                </div>
                            </div>

                            {editForm.data.respon_from_owner && (
                                <div className="mt-3 space-y-3 border-t border-sidebar-border/60 pt-3">
                                    <div className="space-y-2">
                                        <Label htmlFor="edit_tanggal_respon">
                                            Tanggal Respon
                                        </Label>
                                        <Input
                                            id="edit_tanggal_respon"
                                            type="date"
                                            value={editForm.data.tanggal_respon}
                                            onChange={(e) =>
                                                editForm.setData(
                                                    'tanggal_respon',
                                                    e.target.value,
                                                )
                                            }
                                            className={
                                                editForm.errors.tanggal_respon
                                                    ? 'border-destructive'
                                                    : ''
                                            }
                                        />
                                        <InputError
                                            message={
                                                editForm.errors.tanggal_respon
                                            }
                                        />
                                    </div>

                                    <div className="space-y-2">
                                        <Label htmlFor="edit_respon">
                                            Teks Respon / Tanggapan Owner
                                        </Label>
                                        <textarea
                                            id="edit_respon"
                                            rows={3}
                                            placeholder="Tuliskan balasan jawaban dari owner/dealer..."
                                            value={editForm.data.respon}
                                            onChange={(e) =>
                                                editForm.setData(
                                                    'respon',
                                                    e.target.value,
                                                )
                                            }
                                            className={`flex w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm shadow-xs placeholder:text-muted-foreground focus-visible:ring-1 focus-visible:ring-ring focus-visible:outline-none disabled:cursor-not-allowed disabled:opacity-50 ${
                                                editForm.errors.respon
                                                    ? 'border-destructive'
                                                    : ''
                                            }`}
                                        />
                                        <InputError
                                            message={editForm.errors.respon}
                                        />
                                    </div>
                                </div>
                            )}
                        </div>

                        {/* Section 5: Google Review URL */}
                        <div className="space-y-2">
                            <div className="flex items-center justify-between">
                                <Label htmlFor="edit_google_review_url">
                                    Google Review URL
                                </Label>
                                <span className="text-[11px] text-muted-foreground italic">
                                    Opsional
                                </span>
                            </div>
                            <Input
                                id="edit_google_review_url"
                                placeholder="Contoh: https://maps.app.goo.gl/..."
                                value={editForm.data.google_review_url}
                                onChange={(e) =>
                                    editForm.setData(
                                        'google_review_url',
                                        e.target.value,
                                    )
                                }
                                className={
                                    editForm.errors.google_review_url
                                        ? 'border-destructive'
                                        : ''
                                }
                            />
                            <InputError
                                message={editForm.errors.google_review_url}
                            />
                        </div>

                        <DialogFooter className="pt-2">
                            <DialogClose asChild>
                                <Button
                                    type="button"
                                    variant="outline"
                                    disabled={editForm.processing}
                                >
                                    Batal
                                </Button>
                            </DialogClose>
                            <Button
                                type="submit"
                                disabled={editForm.processing}
                            >
                                {editForm.processing
                                    ? 'Menyimpan...'
                                    : 'Perbarui Review'}
                            </Button>
                        </DialogFooter>
                    </form>
                </DialogContent>
            </Dialog>

            {/* Modal Detail Review */}
            <Dialog open={isDetailOpen} onOpenChange={setIsDetailOpen}>
                <DialogContent className="max-h-[85vh] overflow-y-auto sm:max-w-lg">
                    <DialogHeader>
                        <DialogTitle className="flex items-center gap-2">
                            <Star className="size-5 fill-amber-400 text-amber-500" />
                            Detail Ulasan Pelanggan
                        </DialogTitle>
                        <DialogDescription>
                            Informasi lengkap ulasan dari reviewer dan tanggapan
                            resmi owner dealer.
                        </DialogDescription>
                    </DialogHeader>

                    {selectedReview && (
                        <div className="space-y-4 py-2 text-sm">
                            {/* Header Info */}
                            <div className="rounded-lg border border-sidebar-border/80 bg-muted/30 p-3">
                                <div className="flex items-start justify-between">
                                    <div>
                                        <p className="font-semibold text-foreground">
                                            {selectedReview.nama_reviewer}
                                        </p>
                                        <p className="text-xs text-muted-foreground">
                                            Dealer:{' '}
                                            <span className="font-medium text-foreground">
                                                {selectedReview.dealer
                                                    ?.nama_dealer || '-'}{' '}
                                                (
                                                {selectedReview.dealer
                                                    ?.kode_dealer || '-'}
                                                )
                                            </span>
                                        </p>
                                    </div>
                                    <div className="flex items-center gap-1 rounded-md bg-amber-500/10 px-2 py-1 font-semibold text-amber-600 dark:text-amber-400">
                                        <Star className="size-3.5 fill-amber-400 text-amber-500" />
                                        <span>
                                            {Number(
                                                selectedReview.star_rate,
                                            ).toFixed(1)}
                                        </span>
                                    </div>
                                </div>
                                <div className="mt-2 flex items-center gap-1 text-[11px] text-muted-foreground">
                                    <Calendar className="size-3" />
                                    <span>
                                        Dipublikasikan:{' '}
                                        {formatDate(
                                            selectedReview.tanggal_publish_review,
                                        )}
                                    </span>
                                </div>
                            </div>

                            {/* Review Content */}
                            <div className="space-y-1.5">
                                <Label className="text-xs font-semibold text-muted-foreground uppercase">
                                    Isi Ulasan Reviewer
                                </Label>
                                <div className="rounded-md border border-sidebar-border bg-background p-3 whitespace-pre-wrap text-foreground">
                                    {selectedReview.review || (
                                        <span className="text-xs text-muted-foreground italic">
                                            Tidak ada ulasan tertulis.
                                        </span>
                                    )}
                                </div>
                            </div>

                            {/* Owner Response */}
                            <div className="space-y-1.5">
                                <div className="flex items-center justify-between">
                                    <Label className="text-xs font-semibold text-muted-foreground uppercase">
                                        Respon Owner
                                    </Label>
                                    {selectedReview.respon_from_owner ? (
                                        <Badge
                                            variant="outline"
                                            className="border-emerald-600/30 bg-emerald-50 text-[10px] text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-400"
                                        >
                                            Sudah Direspon
                                        </Badge>
                                    ) : (
                                        <Badge
                                            variant="outline"
                                            className="text-[10px] text-muted-foreground"
                                        >
                                            Belum Direspon
                                        </Badge>
                                    )}
                                </div>

                                {selectedReview.respon_from_owner ? (
                                    <div className="rounded-md border border-emerald-500/30 bg-emerald-500/5 p-3 whitespace-pre-wrap text-foreground">
                                        <p className="text-xs">
                                            {selectedReview.respon || (
                                                <span className="text-muted-foreground italic">
                                                    (Respon kosong)
                                                </span>
                                            )}
                                        </p>
                                        {selectedReview.tanggal_respon && (
                                            <p className="mt-2 text-[11px] text-muted-foreground">
                                                Ditanggapi pada:{' '}
                                                {formatDate(
                                                    selectedReview.tanggal_respon,
                                                )}
                                            </p>
                                        )}
                                    </div>
                                ) : (
                                    <p className="text-xs text-muted-foreground italic">
                                        Ulasan ini belum memiliki respon dari
                                        owner dealer.
                                    </p>
                                )}
                            </div>

                            {/* Google Review URL */}
                            {selectedReview.google_review_url && (
                                <div className="pt-1">
                                    <a
                                        href={selectedReview.google_review_url}
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        className="inline-flex items-center gap-1.5 text-xs text-primary hover:underline"
                                    >
                                        <ExternalLink className="size-3.5" />
                                        <span>
                                            Lihat ulasan asli di Google Maps /
                                            Review
                                        </span>
                                    </a>
                                </div>
                            )}
                        </div>
                    )}

                    <DialogFooter className="pt-2">
                        <DialogClose asChild>
                            <Button type="button" variant="outline">
                                Tutup
                            </Button>
                        </DialogClose>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            {/* Modal Konfirmasi Hapus */}
            <Dialog open={isDeleteOpen} onOpenChange={setIsDeleteOpen}>
                <DialogContent className="sm:max-w-md">
                    <DialogHeader>
                        <DialogTitle className="flex items-center gap-2 text-destructive">
                            <AlertCircle className="size-5" />
                            Hapus Review
                        </DialogTitle>
                        <DialogDescription>
                            Apakah Anda yakin ingin menghapus ulasan dari{' '}
                            <span className="font-semibold text-foreground">
                                {selectedReview?.nama_reviewer}
                            </span>
                            ? Tindakan ini tidak dapat dibatalkan.
                        </DialogDescription>
                    </DialogHeader>

                    <DialogFooter className="pt-2">
                        <DialogClose asChild>
                            <Button type="button" variant="outline">
                                Batal
                            </Button>
                        </DialogClose>
                        <Button
                            type="button"
                            variant="destructive"
                            onClick={handleSubmitDelete}
                        >
                            Hapus Sekarang
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            {/* Modal Tarik Google Review */}
            <Dialog
                open={isSyncOpen}
                onOpenChange={(open) => {
                    if (
                        !open &&
                        (syncState === 'starting' || syncState === 'running')
                    ) {
                        if (
                            !window.confirm(
                                'Proses penarikan ulasan sedang berjalan di latar belakang. Anda yakin ingin menutup jendela ini?',
                            )
                        ) {
                            return;
                        }
                    }
                    setIsSyncOpen(open);
                }}
            >
                <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-lg">
                    <DialogHeader>
                        <div className="flex items-center justify-between pr-4">
                            <DialogTitle className="flex items-center gap-2">
                                <RefreshCw
                                    className={`size-5 text-primary ${
                                        syncState === 'starting' ||
                                        syncState === 'running'
                                            ? 'animate-spin'
                                            : ''
                                    }`}
                                />
                                Tarik Google Review
                            </DialogTitle>

                            {/* Server Health & Proxy Badges */}
                            <div className="flex flex-wrap items-center gap-1.5">
                                {isCheckingHealth ? (
                                    <Badge
                                        variant="outline"
                                        className="gap-1 text-xs text-muted-foreground"
                                    >
                                        <Loader2 className="size-3 animate-spin" />
                                        Cek API...
                                    </Badge>
                                ) : scraperOnline === true ? (
                                    <>
                                        <Badge
                                            variant="outline"
                                            className="gap-1.5 border-emerald-500/40 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400"
                                        >
                                            <span className="relative flex size-2">
                                                <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-75"></span>
                                                <span className="relative inline-flex size-2 rounded-full bg-emerald-500"></span>
                                            </span>
                                            API Online (:3000)
                                        </Badge>
                                        {proxyInfo?.enabled && (
                                            <Badge
                                                variant="outline"
                                                className="gap-1 border-blue-500/40 bg-blue-500/10 text-blue-600 dark:text-blue-400"
                                            >
                                                <Sparkles className="size-3 text-blue-500" />
                                                Rotasi Proxy Aktif
                                            </Badge>
                                        )}
                                    </>
                                ) : (
                                    <Badge
                                        variant="outline"
                                        className="gap-1 border-rose-500/40 bg-rose-500/10 text-rose-600 dark:text-rose-400"
                                    >
                                        <AlertCircle className="size-3" />
                                        API Offline (:3000)
                                    </Badge>
                                )}
                            </div>
                        </div>
                        <DialogDescription>
                            Tarik ulasan dan rating terbaru Google Maps untuk
                            dealer secara otomatis melalui scraper API service.
                        </DialogDescription>
                    </DialogHeader>

                    {/* Offline Warning Notice */}
                    {scraperOnline === false && (
                        <div className="rounded-lg border border-amber-500/30 bg-amber-500/10 p-3 text-xs text-amber-800 dark:text-amber-300">
                            <div className="flex items-center gap-2 font-semibold">
                                <AlertCircle className="size-4 shrink-0 text-amber-600 dark:text-amber-400" />
                                <span>API Scraper Belum Terhubung</span>
                            </div>
                            <p className="mt-1">
                                Service API di port 3000 tidak merespons.
                                Pastikan service scraper Anda telah dijalankan
                                (misal: jalankan{' '}
                                <code className="rounded bg-background/80 px-1 py-0.5 font-mono text-[11px]">
                                    npm run dev
                                </code>{' '}
                                di folder gbpscrap).
                            </p>
                        </div>
                    )}

                    {/* State: IDLE */}
                    {syncState === 'idle' && (
                        <form
                            onSubmit={handleStartSync}
                            className="space-y-4 py-2"
                        >
                            <div className="space-y-2">
                                <Label htmlFor="sync_dealer_id">
                                    Pilih Dealer{' '}
                                    <span className="text-destructive">*</span>
                                </Label>
                                <select
                                    id="sync_dealer_id"
                                    value={syncDealerId}
                                    onChange={(e) =>
                                        setSyncDealerId(e.target.value)
                                    }
                                    className={selectClass}
                                    required
                                >
                                    <option value="" disabled>
                                        -- Pilih Dealer yang Akan Disinkronkan
                                        --
                                    </option>
                                    <option value="all">
                                        🌟 Semua Dealer ({dealers.length} Showroom)
                                    </option>
                                    {dealers.map((d) => (
                                        <option key={d.id} value={d.id}>
                                            {d.kode_dealer} - {d.nama_dealer}
                                        </option>
                                    ))}
                                </select>
                                <p className="text-[11px] text-muted-foreground">
                                    {syncDealerId === 'all'
                                        ? `Scraper akan memproses seluruh ${dealers.length} showroom secara berurutan.`
                                        : 'Scraper akan mencari data profil dan ulasan menggunakan tautan Google Maps dealer.'}
                                </p>
                            </div>

                            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                                <div className="space-y-2">
                                    <div className="flex items-center justify-between">
                                        <Label htmlFor="sync_limit">
                                            Maksimal Ulasan
                                        </Label>
                                        <span className="font-mono text-[10px] text-muted-foreground">
                                            1 - 1000
                                        </span>
                                    </div>
                                    <Input
                                        id="sync_limit"
                                        type="number"
                                        min={1}
                                        max={1000}
                                        value={syncLimit}
                                        onChange={(e) =>
                                            setSyncLimit(e.target.value)
                                        }
                                        placeholder="Contoh: 20"
                                        className="h-9"
                                        required
                                    />
                                    {/* Preset buttons */}
                                    <div className="flex flex-wrap items-center gap-1.5 pt-0.5">
                                        <span className="text-[10px] text-muted-foreground">
                                            Preset:
                                        </span>
                                        {[5, 10, 20, 50, 100].map((num) => (
                                            <button
                                                key={num}
                                                type="button"
                                                onClick={() =>
                                                    setSyncLimit(num)
                                                }
                                                className={`rounded px-1.5 py-0.5 text-[10px] font-medium transition-colors ${
                                                    Number(syncLimit) === num
                                                        ? 'bg-primary text-primary-foreground'
                                                        : 'bg-muted text-muted-foreground hover:bg-accent hover:text-foreground'
                                                }`}
                                            >
                                                {num}
                                            </button>
                                        ))}
                                    </div>
                                </div>

                                <div className="space-y-2">
                                    <Label htmlFor="sync_sort">
                                        Urutan Ulasan
                                    </Label>
                                    <select
                                        id="sync_sort"
                                        value={syncSort}
                                        onChange={(e) =>
                                            setSyncSort(e.target.value)
                                        }
                                        className={selectClass}
                                    >
                                        <option value="newest">
                                            Ulasan Terbaru
                                        </option>
                                        <option value="highest">
                                            Rating Tertinggi (5★)
                                        </option>
                                        <option value="lowest">
                                            Rating Terendah (1★)
                                        </option>
                                        <option value="relevant">
                                            Paling Relevan
                                        </option>
                                    </select>
                                    <p className="text-[10px] text-muted-foreground">
                                        Urutan penyortiran Google Maps
                                    </p>
                                </div>
                            </div>

                            <div className="rounded-lg border border-sidebar-border/70 bg-muted/20 p-3 text-xs text-muted-foreground">
                                <div className="flex items-center gap-1.5 font-medium text-foreground">
                                    <Sparkles className="size-3.5 text-primary" />
                                    Fitur Otomatisasi Terintegrasi
                                </div>
                                <ul className="mt-1.5 list-inside list-disc space-y-1 text-[11px]">
                                    <li>
                                        Data reviewer, bintang rating, dan
                                        ulasan akan disimpan otomatis.
                                    </li>
                                    <li>
                                        Tanggapan / respon dari owner dealer
                                        ikut ditarik dan disesuaikan statusnya.
                                    </li>
                                    <li>
                                        <strong className="text-foreground">
                                            Deduplikasi Cerdas:
                                        </strong>{' '}
                                        Jika ulasan sudah ada di database, ulasan
                                        akan di-update tanpa membuat data ganda.
                                    </li>
                                    <li>
                                        <strong className="text-foreground">
                                            Rotasi Proxy Anti-Limit:
                                        </strong>{' '}
                                        Menggunakan pool proxy otomatis (Proxifly) untuk mencegah limitasi dan CAPTCHA Google Maps.
                                    </li>
                                    <li>
                                        Rating rata-rata dan total review dealer
                                        akan diperbarui secara sinkron.
                                    </li>
                                </ul>
                            </div>

                            <DialogFooter className="pt-2">
                                <DialogClose asChild>
                                    <Button type="button" variant="outline">
                                        Batal
                                    </Button>
                                </DialogClose>
                                <Button
                                    type="submit"
                                    disabled={
                                        !syncDealerId ||
                                        scraperOnline === false ||
                                        dealers.length === 0 ||
                                        !syncLimit ||
                                        Number(syncLimit) <= 0
                                    }
                                    className="gap-2"
                                >
                                    <RefreshCw className="size-4" />
                                    {syncDealerId === 'all'
                                        ? `Tarik Semua Dealer (${dealers.length})`
                                        : 'Mulai Tarik Ulasan'}
                                </Button>
                            </DialogFooter>
                        </form>
                    )}

                    {/* State: STARTING / RUNNING */}
                    {(syncState === 'starting' || syncState === 'running') && (
                        <div className="space-y-5 py-4 text-center">
                            <div className="relative mx-auto flex size-20 items-center justify-center">
                                <div className="absolute inset-0 animate-ping rounded-full bg-primary/20 opacity-75"></div>
                                <div className="relative flex size-16 items-center justify-center rounded-full bg-primary/10 text-primary">
                                    <Loader2 className="size-8 animate-spin" />
                                </div>
                            </div>

                            <div className="space-y-1">
                                <h3 className="text-base font-semibold text-foreground">
                                    {bulkProgress
                                        ? `Sinkronisasi Semua Dealer (${bulkProgress.current}/${bulkProgress.total})`
                                        : syncState === 'starting'
                                          ? 'Menyiapkan Antrean Scraping...'
                                          : 'Sedang Menarik Ulasan Google Maps...'}
                                </h3>
                                <p className="text-xs text-muted-foreground">
                                    {syncMessage ||
                                        'Browser Playwright sedang membuka halaman Google Maps...'}
                                </p>
                            </div>

                            {/* Bulk Progress Bar & Counters */}
                            {bulkProgress && (
                                <div className="mx-auto max-w-md space-y-3 rounded-lg border border-sidebar-border bg-muted/20 p-4 text-left">
                                    <div className="flex items-center justify-between text-xs">
                                        <span className="font-medium text-foreground">
                                            Progres Dealer: {bulkProgress.current} dari {bulkProgress.total}
                                        </span>
                                        <span className="font-semibold text-primary">
                                            {Math.round(
                                                (bulkProgress.current /
                                                    bulkProgress.total) *
                                                    100,
                                            )}
                                            %
                                        </span>
                                    </div>
                                    <div className="h-2 w-full overflow-hidden rounded-full bg-muted">
                                        <div
                                            className="h-full bg-primary transition-all duration-300"
                                            style={{
                                                width: `${Math.round((bulkProgress.current / bulkProgress.total) * 100)}%`,
                                            }}
                                        />
                                    </div>
                                    <div className="text-xs text-muted-foreground">
                                        <span className="font-medium text-foreground">
                                            Showroom saat ini:
                                        </span>{' '}
                                        <span className="text-foreground">
                                            {bulkProgress.currentDealerName}
                                        </span>
                                    </div>
                                    <div className="flex items-center justify-around rounded-md border border-sidebar-border/70 bg-background/50 py-2 text-center text-xs">
                                        <div>
                                            <span className="text-[10px] text-muted-foreground">
                                                Ulasan Baru
                                            </span>
                                            <p className="font-bold text-emerald-600 dark:text-emerald-400">
                                                +{bulkProgress.currentImported}
                                            </p>
                                        </div>
                                        <div className="h-6 w-px bg-border" />
                                        <div>
                                            <span className="text-[10px] text-muted-foreground">
                                                Ulasan Diperbarui
                                            </span>
                                            <p className="font-bold text-blue-600 dark:text-blue-400">
                                                {bulkProgress.currentUpdated}
                                            </p>
                                        </div>
                                    </div>
                                </div>
                            )}

                            {!bulkProgress && (
                                <div className="mx-auto max-w-sm rounded-lg border border-sidebar-border bg-muted/30 p-3 text-left text-xs text-muted-foreground">
                                    <div className="flex items-start gap-2">
                                        <Clock className="mt-0.5 size-4 shrink-0 text-primary" />
                                        <div>
                                            <span className="font-semibold text-foreground">
                                                Estimasi Waktu:
                                            </span>{' '}
                                            20 - 45 detik. Google Maps memuat ulasan
                                            secara bertahap via Chromium headless.
                                            Mohon tunggu sejenak.
                                        </div>
                                    </div>
                                </div>
                            )}

                            <div className="flex flex-wrap items-center justify-center gap-2 pt-2">
                                {bulkProgress && (
                                    <Button
                                        type="button"
                                        variant="destructive"
                                        size="sm"
                                        onClick={handleCancelSync}
                                        className="text-xs"
                                    >
                                        Hentikan Proses
                                    </Button>
                                )}
                                <Button
                                    type="button"
                                    variant="outline"
                                    size="sm"
                                    onClick={() => setIsSyncOpen(false)}
                                    className="text-xs"
                                >
                                    Tutup & Biarkan Berjalan di Latar Belakang
                                </Button>
                            </div>
                        </div>
                    )}

                    {/* State: COMPLETED */}
                    {syncState === 'completed' && syncResult && (
                        <div className="space-y-4 py-4">
                            <div className="flex flex-col items-center justify-center text-center">
                                <div className="flex size-14 items-center justify-center rounded-full bg-emerald-500/10 text-emerald-600 dark:text-emerald-400">
                                    <CheckCircle2 className="size-8" />
                                </div>
                                <h3 className="mt-3 text-base font-semibold text-foreground">
                                    Penarikan Ulasan Berhasil!
                                </h3>
                                <p className="mt-1 text-xs text-muted-foreground">
                                    {syncMessage ||
                                        'Data ulasan dan profil dealer telah berhasil disinkronkan.'}
                                </p>
                            </div>

                            {/* Summary Grid */}
                            <div className="grid grid-cols-2 gap-3 rounded-lg border border-sidebar-border/70 bg-muted/20 p-3 sm:grid-cols-4">
                                <div className="text-center">
                                    <span className="text-[11px] text-muted-foreground">
                                        Ulasan Baru
                                    </span>
                                    <p className="text-lg font-bold text-emerald-600 dark:text-emerald-400">
                                        +{syncResult.imported}
                                    </p>
                                </div>
                                <div className="text-center">
                                    <span className="text-[11px] text-muted-foreground">
                                        Diperbarui
                                    </span>
                                    <p className="text-lg font-bold text-blue-600 dark:text-blue-400">
                                        {syncResult.updated}
                                    </p>
                                </div>
                                <div className="text-center">
                                    <span className="text-[11px] text-muted-foreground">
                                        Rating Dealer
                                    </span>
                                    <p className="flex items-center justify-center gap-0.5 text-lg font-bold text-amber-500">
                                        <Star className="size-4 fill-amber-400" />
                                        {syncResult.dealer_rating
                                            ? Number(
                                                  syncResult.dealer_rating,
                                              ).toFixed(1)
                                            : '-'}
                                    </p>
                                </div>
                                <div className="text-center">
                                    <span className="text-[11px] text-muted-foreground">
                                        Total Review
                                    </span>
                                    <p className="text-lg font-bold text-foreground">
                                        {syncResult.dealer_total_review ?? '-'}
                                    </p>
                                </div>
                            </div>

                            <DialogFooter className="pt-2">
                                <Button
                                    type="button"
                                    onClick={() => {
                                        setIsSyncOpen(false);
                                        setSyncState('idle');
                                    }}
                                    className="w-full sm:w-auto"
                                >
                                    Selesai & Lihat Review
                                </Button>
                            </DialogFooter>
                        </div>
                    )}

                    {/* State: FAILED */}
                    {syncState === 'failed' && (
                        <div className="space-y-4 py-4">
                            <div className="flex flex-col items-center justify-center text-center">
                                <div className="flex size-14 items-center justify-center rounded-full bg-rose-500/10 text-rose-600 dark:text-rose-400">
                                    <AlertCircle className="size-8" />
                                </div>
                                <h3 className="mt-3 text-base font-semibold text-rose-600 dark:text-rose-400">
                                    Penarikan Ulasan Gagal
                                </h3>
                                <p className="mt-1 text-xs text-muted-foreground">
                                    {syncError ||
                                        'Terjadi kesalahan saat memproses ulasan Google Maps.'}
                                </p>
                            </div>

                            <div className="rounded-lg border border-rose-500/30 bg-rose-500/10 p-3 text-xs text-rose-800 dark:text-rose-300">
                                <p className="font-semibold">
                                    Kemungkinan penyebab:
                                </p>
                                <ul className="mt-1 list-inside list-disc space-y-0.5">
                                    <li>
                                        Tautan Google Maps dealer tidak valid
                                        atau tidak dapat diakses.
                                    </li>
                                    <li>
                                        API Scraper di port 3000 mengalami
                                        timeout atau terhenti.
                                    </li>
                                    <li>
                                        Halaman Google Maps memerlukan
                                        verifikasi CAPTCHA.
                                    </li>
                                </ul>
                            </div>

                            <DialogFooter className="flex justify-end gap-2 pt-2">
                                <Button
                                    type="button"
                                    variant="outline"
                                    onClick={() => {
                                        setIsSyncOpen(false);
                                        setSyncState('idle');
                                    }}
                                >
                                    Tutup
                                </Button>
                                <Button
                                    type="button"
                                    onClick={() => {
                                        setSyncState('idle');
                                        setSyncError(null);
                                    }}
                                    className="gap-2"
                                >
                                    <RefreshCw className="size-4" />
                                    Coba Lagi
                                </Button>
                            </DialogFooter>
                        </div>
                    )}
                </DialogContent>
            </Dialog>
        </>
    );
}

ReviewsIndex.layout = {
    breadcrumbs: [
        {
            title: 'Dashboard',
            href: dashboard(),
        },
        {
            title: 'Review',
            href: reviewsRoute.index(),
        },
    ],
};
