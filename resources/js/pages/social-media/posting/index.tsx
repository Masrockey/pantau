import { Head, router, useForm } from '@inertiajs/react';
import {
    ArrowDown,
    ArrowUp,
    ArrowUpDown,
    Calendar,
    Check,
    ChevronDown,
    Download,
    Edit2,
    ExternalLink,
    Eye,
    FileSpreadsheet,
    Globe,
    Layers,
    MessageSquare,
    Plus,
    Share2,
    Trash2,
    Upload,
    UserCircle,
    X,
} from 'lucide-react';
import React, { useRef, useState } from 'react';
import {
    Button as AntButton,
    Input as AntInput,
    Select as AntSelect,
    Tag as AntTag,
    Tooltip as AntTooltip,
    message as antMessage,
} from 'antd';
import InputError from '@/components/input-error';
import { Pagination } from '@/components/pagination';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
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
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { dashboard } from '@/routes';
import socialMediaPostingRoute from '@/routes/social-media/posting';
import type { PaginatedData, SocialMediaPosting } from '@/types';

interface ProfileOption {
    id: number;
    nama_lengkap: string;
    email?: string | null;
    no_hp?: string | null;
    domisili?: string | null;
}

interface SocialMediaPostingsIndexProps {
    postings: PaginatedData<SocialMediaPosting>;
    profiles: ProfileOption[];
    stats: {
        total_postings: number;
        total_views: number;
        total_komentar: number;
    };
    filters: {
        search?: string;
        brand?: string;
        jenis_sosmed?: string;
        bulan_entry?: string;
        sort_by?: string;
        sort_dir?: string;
        sort?: string;
    };
}

const SORT_OPTIONS = [
    { value: 'tanggal_desc', label: 'Tanggal: Terbaru' },
    { value: 'tanggal_asc', label: 'Tanggal: Terlama' },
    { value: 'nama_asc', label: 'Nama: A - Z' },
    { value: 'nama_desc', label: 'Nama: Z - A' },
    { value: 'views_desc', label: 'Views: Terbanyak' },
    { value: 'views_asc', label: 'Views: Tersedikit' },
    { value: 'komentar_desc', label: 'Komentar: Terbanyak' },
    { value: 'komentar_asc', label: 'Komentar: Tersedikit' },
];

const BRAND_OPTIONS = [
    'Honda',
    'Kawasaki',
    'Yamaha',
    'Aprilia',
    'TVS',
    'Bajaj',
    'KTM',
    'Piaggio',
    'MV Agusta',
    'All Brand',
];

const PLATFORM_OPTIONS = [
    { value: 'ig', label: 'Instagram (ig)', badgeClass: 'bg-rose-50 text-rose-700 border-rose-200 dark:bg-rose-950/40 dark:text-rose-300 dark:border-rose-800' },
    { value: 'TikTok', label: 'TikTok', badgeClass: 'bg-slate-900 text-white dark:bg-slate-100 dark:text-slate-900' },
    { value: 'facebook', label: 'Facebook', badgeClass: 'bg-blue-50 text-blue-700 border-blue-200 dark:bg-blue-950/40 dark:text-blue-300 dark:border-blue-800' },
    { value: 'youtube', label: 'YouTube', badgeClass: 'bg-red-50 text-red-700 border-red-200 dark:bg-red-950/40 dark:text-red-300 dark:border-red-800' },
];

const MONTH_ENTRY_OPTIONS = [
    { value: 'Jan', label: 'Jan' },
    { value: 'Feb', label: 'Feb' },
    { value: 'Mar', label: 'Mar' },
    { value: 'Apr', label: 'Apr' },
    { value: 'May', label: 'May' },
    { value: 'Jun', label: 'Jun' },
    { value: 'Jul', label: 'Jul' },
    { value: 'Aug', label: 'Aug' },
    { value: 'Sep', label: 'Sep' },
    { value: 'Oct', label: 'Oct' },
    { value: 'Nov', label: 'Nov' },
    { value: 'Dec', label: 'Dec' },
];

const formatNumber = (num?: number | null) => {
    if (num === null || num === undefined) return '0';
    if (num >= 1_000_000) return (num / 1_000_000).toFixed(1).replace(/\.0$/, '') + 'M';
    if (num >= 1_000) return (num / 1_000).toFixed(1).replace(/\.0$/, '') + 'K';
    return num.toLocaleString('id-ID');
};

const formatDateIndo = (dateStr?: string | null) => {
    if (!dateStr) return '-';
    try {
        const [year, month, day] = dateStr.split('T')[0].split('-');
        if (year && month && day) {
            return `${day}/${month}/${year}`;
        }
        return dateStr;
    } catch {
        return dateStr;
    }
};

const dialogSelectProps = {
    virtual: false,
    getPopupContainer: (trigger: HTMLElement): HTMLElement =>
        (trigger.closest('[role="dialog"]') as HTMLElement) || trigger.parentElement || document.body,
    dropdownRender: (menu: React.ReactNode) => (
        <div onWheel={(e) => e.stopPropagation()}>{menu}</div>
    ),
};

export default function SocialMediaPostingsIndex({
    postings,
    profiles,
    stats,
    filters,
}: SocialMediaPostingsIndexProps) {
    const [search, setSearch] = useState(filters.search || '');
    const [selectedBrand, setSelectedBrand] = useState(filters.brand || '');
    const [selectedPlatform, setSelectedPlatform] = useState(filters.jenis_sosmed || '');
    const [selectedMonth, setSelectedMonth] = useState(filters.bulan_entry || '');
    const [selectedSort, setSelectedSort] = useState(filters.sort || 'tanggal_desc');

    const [isCreateOpen, setIsCreateOpen] = useState(false);
    const [isEditOpen, setIsEditOpen] = useState(false);
    const [isDeleteOpen, setIsDeleteOpen] = useState(false);
    const [selectedPosting, setSelectedPosting] = useState<SocialMediaPosting | null>(null);
    const [viewDetailPosting, setViewDetailPosting] = useState<SocialMediaPosting | null>(null);

    // Import modal & file upload states
    const [isImportOpen, setIsImportOpen] = useState(false);
    const [isDragging, setIsDragging] = useState(false);
    const fileInputRef = useRef<HTMLInputElement>(null);

    // Form for import
    const importForm = useForm<{
        file: File | null;
        update_existing: boolean;
        replace_all: boolean;
    }>({
        file: null,
        update_existing: true,
        replace_all: false,
    });

    // Form for create
    const createForm = useForm({
        social_media_profile_id: '' as number | string,
        jenis_sosmed: 'ig',
        tanggal_rilis: new Date().toISOString().split('T')[0],
        bulan_entry: MONTH_ENTRY_OPTIONS[new Date().getMonth()].value,
        brand: 'Honda',
        caption: '',
        link: '',
        total_komentar: 0 as number | string,
        total_views: 0 as number | string,
    });

    // Form for edit
    const editForm = useForm({
        social_media_profile_id: '' as number | string,
        jenis_sosmed: 'ig',
        tanggal_rilis: '',
        bulan_entry: '',
        brand: 'Honda',
        caption: '',
        link: '',
        total_komentar: 0 as number | string,
        total_views: 0 as number | string,
    });

    const triggerFilter = (newFilters: {
        search?: string;
        brand?: string;
        jenis_sosmed?: string;
        bulan_entry?: string;
        sort?: string;
    }) => {
        router.get(
            socialMediaPostingRoute.index.url(),
            {
                search: newFilters.search || undefined,
                brand: newFilters.brand || undefined,
                jenis_sosmed: newFilters.jenis_sosmed || undefined,
                bulan_entry: newFilters.bulan_entry || undefined,
                sort: newFilters.sort && newFilters.sort !== 'tanggal_desc' ? newFilters.sort : undefined,
            },
            { preserveState: true, replace: true },
        );
    };

    const handleSearch = (val: string) => {
        setSearch(val);
        triggerFilter({
            search: val,
            brand: selectedBrand,
            jenis_sosmed: selectedPlatform,
            bulan_entry: selectedMonth,
            sort: selectedSort,
        });
    };

    const handleBrandChange = (brand: string) => {
        setSelectedBrand(brand);
        triggerFilter({
            search,
            brand,
            jenis_sosmed: selectedPlatform,
            bulan_entry: selectedMonth,
            sort: selectedSort,
        });
    };

    const handlePlatformChange = (platform: string) => {
        setSelectedPlatform(platform);
        triggerFilter({
            search,
            brand: selectedBrand,
            jenis_sosmed: platform,
            bulan_entry: selectedMonth,
            sort: selectedSort,
        });
    };

    const handleMonthChange = (month: string) => {
        setSelectedMonth(month);
        triggerFilter({
            search,
            brand: selectedBrand,
            jenis_sosmed: selectedPlatform,
            bulan_entry: month,
            sort: selectedSort,
        });
    };

    const handleSortChange = (sort: string) => {
        setSelectedSort(sort);
        triggerFilter({
            search,
            brand: selectedBrand,
            jenis_sosmed: selectedPlatform,
            bulan_entry: selectedMonth,
            sort,
        });
    };

    const handleToggleSort = (field: 'tanggal' | 'nama' | 'views' | 'komentar') => {
        let nextSort = '';
        if (field === 'nama') {
            nextSort = selectedSort === 'nama_asc' ? 'nama_desc' : 'nama_asc';
        } else if (field === 'views') {
            nextSort = selectedSort === 'views_desc' ? 'views_asc' : 'views_desc';
        } else if (field === 'komentar') {
            nextSort = selectedSort === 'komentar_desc' ? 'komentar_asc' : 'komentar_desc';
        } else {
            nextSort = selectedSort === 'tanggal_desc' ? 'tanggal_asc' : 'tanggal_desc';
        }
        handleSortChange(nextSort);
    };

    const renderSortIcon = (field: 'tanggal' | 'nama' | 'views' | 'komentar') => {
        const [currField, currDir] = (selectedSort || 'tanggal_desc').split('_');
        if (currField === field) {
            return currDir === 'asc' ? (
                <ArrowUp className="size-3 text-primary shrink-0" />
            ) : (
                <ArrowDown className="size-3 text-primary shrink-0" />
            );
        }
        return <ArrowUpDown className="size-3 text-muted-foreground/40 group-hover:text-foreground/70 shrink-0" />;
    };

    const handleResetFilter = () => {
        setSearch('');
        setSelectedBrand('');
        setSelectedPlatform('');
        setSelectedMonth('');
        setSelectedSort('tanggal_desc');
        router.get(socialMediaPostingRoute.index.url(), {}, { preserveState: true, replace: true });
    };

    const handleOpenCreate = () => {
        createForm.reset();
        createForm.clearErrors();
        createForm.setData({
            social_media_profile_id: profiles.length > 0 ? profiles[0].id : '',
            jenis_sosmed: 'ig',
            tanggal_rilis: new Date().toISOString().split('T')[0],
            bulan_entry: MONTH_ENTRY_OPTIONS[new Date().getMonth()].value,
            brand: 'Honda',
            caption: '',
            link: '',
            total_komentar: 0,
            total_views: 0,
        });
        setIsCreateOpen(true);
    };

    const handleSubmitCreate = (e: React.FormEvent) => {
        e.preventDefault();
        createForm.post(socialMediaPostingRoute.store.url(), {
            onSuccess: () => {
                setIsCreateOpen(false);
                createForm.reset();
            },
        });
    };

    const handleOpenEdit = (posting: SocialMediaPosting) => {
        setSelectedPosting(posting);
        editForm.clearErrors();
        editForm.setData({
            social_media_profile_id: posting.social_media_profile_id,
            jenis_sosmed: posting.jenis_sosmed || 'ig',
            tanggal_rilis: posting.tanggal_rilis ? posting.tanggal_rilis.split('T')[0] : '',
            bulan_entry: posting.bulan_entry || '',
            brand: posting.brand || 'Honda',
            caption: posting.caption || '',
            link: posting.link || '',
            total_komentar: posting.total_komentar ?? 0,
            total_views: posting.total_views ?? 0,
        });
        setIsEditOpen(true);
    };

    const handleSubmitEdit = (e: React.FormEvent) => {
        e.preventDefault();
        if (!selectedPosting) return;

        editForm.put(socialMediaPostingRoute.update.url(selectedPosting.id), {
            onSuccess: () => {
                setIsEditOpen(false);
                setSelectedPosting(null);
            },
        });
    };

    const handleOpenDelete = (posting: SocialMediaPosting) => {
        setSelectedPosting(posting);
        setIsDeleteOpen(true);
    };

    const handleSubmitDelete = () => {
        if (!selectedPosting) return;

        router.delete(socialMediaPostingRoute.destroy.url(selectedPosting.id), {
            onSuccess: () => {
                setIsDeleteOpen(false);
                setSelectedPosting(null);
            },
        });
    };

    const handleExport = (format: 'xlsx' | 'csv' = 'xlsx') => {
        const queryParams: Record<string, string> = { format };
        if (search) queryParams.search = search;
        if (selectedBrand) queryParams.brand = selectedBrand;
        if (selectedPlatform) queryParams.jenis_sosmed = selectedPlatform;
        if (selectedMonth) queryParams.bulan_entry = selectedMonth;
        if (selectedSort && selectedSort !== 'tanggal_desc') queryParams.sort = selectedSort;

        antMessage.loading({
            content: `Menyiapkan berkas ekspor ${format.toUpperCase()}...`,
            key: 'exporting',
            duration: 1.5,
        });

        const url = socialMediaPostingRoute.export.url({ query: queryParams });
        window.location.href = url;
    };

    const formatFileSize = (bytes: number): string => {
        if (bytes < 1024) return bytes + ' B';
        if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
        return (bytes / (1024 * 1024)).toFixed(2) + ' MB';
    };

    const handleOpenImport = () => {
        importForm.reset();
        importForm.clearErrors();
        importForm.setData({
            file: null,
            update_existing: true,
            replace_all: false,
        });
        if (fileInputRef.current) {
            fileInputRef.current.value = '';
        }
        setIsImportOpen(true);
    };

    const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        if (e.target.files && e.target.files.length > 0) {
            importForm.setData('file', e.target.files[0]);
        }
    };

    const handleDragOver = (e: React.DragEvent<HTMLDivElement>) => {
        e.preventDefault();
        setIsDragging(true);
    };

    const handleDragLeave = () => {
        setIsDragging(false);
    };

    const handleDrop = (e: React.DragEvent<HTMLDivElement>) => {
        e.preventDefault();
        setIsDragging(false);
        if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
            importForm.setData('file', e.dataTransfer.files[0]);
        }
    };

    const handleRemoveFile = () => {
        importForm.setData('file', null);
        if (fileInputRef.current) {
            fileInputRef.current.value = '';
        }
    };

    const handleSubmitImport = (e: React.FormEvent) => {
        e.preventDefault();
        if (!importForm.data.file) return;

        antMessage.loading({
            content: 'Sedang memproses import data postingan...',
            key: 'import_process',
            duration: 0,
        });

        importForm.post(socialMediaPostingRoute.import.url(), {
            forceFormData: true,
            onSuccess: () => {
                antMessage.destroy('import_process');
                setIsImportOpen(false);
                importForm.reset();
            },
            onError: (errs) => {
                antMessage.destroy('import_process');
                const firstErr = Object.values(errs)[0];
                antMessage.error(firstErr || 'Gagal mengimpor berkas Excel.');
            },
            onFinish: () => {
                antMessage.destroy('import_process');
            },
        });
    };

    const getPlatformBadge = (platform: string) => {
        const found = PLATFORM_OPTIONS.find((p) => p.value.toLowerCase() === platform.toLowerCase());
        const badgeClass = found ? found.badgeClass : 'bg-muted text-muted-foreground';
        const label = found ? found.label : platform;

        return (
            <span className={`inline-flex items-center px-2 py-0.5 rounded text-[11px] font-semibold border ${badgeClass}`}>
                {label}
            </span>
        );
    };

    const getBrandBadge = (brand: string) => {
        let colorClass = 'border-muted text-muted-foreground bg-muted/30';
        if (brand === 'Honda') colorClass = 'border-red-200 bg-red-50 text-red-700 dark:border-red-800 dark:bg-red-950/40 dark:text-red-300 font-semibold';
        else if (brand === 'Yamaha') colorClass = 'border-blue-200 bg-blue-50 text-blue-700 dark:border-blue-800 dark:bg-blue-950/40 dark:text-blue-300';
        else if (brand === 'Kawasaki') colorClass = 'border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-300';
        else if (brand === 'All Brand') colorClass = 'border-purple-200 bg-purple-50 text-purple-700 dark:border-purple-800 dark:bg-purple-950/40 dark:text-purple-300';

        return (
            <span className={`inline-flex items-center px-2 py-0.5 rounded text-[11px] border ${colorClass}`}>
                {brand}
            </span>
        );
    };

    const isFiltered = Boolean(
        search ||
            selectedBrand ||
            selectedPlatform ||
            selectedMonth ||
            (selectedSort && selectedSort !== 'tanggal_desc'),
    );

    return (
        <>
            <Head title="Sosmed Posting" />

            <div className="flex h-full flex-1 flex-col gap-6 p-4 md:p-6">
                {/* Header Section */}
                <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
                    <div>
                        <h1 className="flex items-center gap-2 text-2xl font-bold tracking-tight text-foreground">
                            <Share2 className="size-6 text-primary" />
                            Sosmed Posting
                        </h1>
                        <p className="mt-1 text-sm text-muted-foreground">
                            Kelola data postingan kreator dan influencer di media sosial dengan performa views dan komentar.
                        </p>
                    </div>

                    <div className="flex flex-wrap items-center gap-2">
                        <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                                <AntButton
                                    icon={
                                        <Download className="size-3.5 text-amber-600 dark:text-amber-400" />
                                    }
                                    className="border-amber-600/30 text-amber-700 dark:text-amber-400 font-medium hover:border-amber-500"
                                >
                                    Export Data <ChevronDown className="ml-1 size-3 opacity-70" />
                                </AntButton>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end" className="w-52">
                                <DropdownMenuItem
                                    onClick={() => handleExport('xlsx')}
                                    className="cursor-pointer"
                                >
                                    <FileSpreadsheet className="mr-2 size-4 text-emerald-600" />
                                    <span>Format Excel (.xlsx)</span>
                                </DropdownMenuItem>
                                <DropdownMenuItem
                                    onClick={() => handleExport('csv')}
                                    className="cursor-pointer"
                                >
                                    <Download className="mr-2 size-4 text-blue-600" />
                                    <span>Format CSV (.csv)</span>
                                </DropdownMenuItem>
                            </DropdownMenuContent>
                        </DropdownMenu>

                        <AntButton
                            onClick={handleOpenImport}
                            icon={
                                <Upload className="size-3.5 text-slate-600 dark:text-slate-400" />
                            }
                            className="font-medium"
                        >
                            Import Excel
                        </AntButton>

                        <AntButton
                            type="primary"
                            onClick={handleOpenCreate}
                            icon={<Plus className="size-3.5" />}
                            className="font-medium"
                        >
                            Tambah Postingan
                        </AntButton>
                    </div>
                </div>

                {/* Stat Metrics Cards */}
                <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
                    <Card className="border shadow-2xs">
                        <CardContent className="p-4 flex items-center justify-between">
                            <div>
                                <p className="text-xs font-medium text-muted-foreground">Total Postingan</p>
                                <p className="mt-1 text-2xl font-bold tracking-tight text-foreground">
                                    {stats.total_postings.toLocaleString('id-ID')}
                                </p>
                            </div>
                            <div className="flex size-10 items-center justify-center rounded-lg bg-red-50 text-red-600 dark:bg-red-950/50 dark:text-red-400">
                                <Share2 className="size-5" />
                            </div>
                        </CardContent>
                    </Card>

                    <Card className="border shadow-2xs">
                        <CardContent className="p-4 flex items-center justify-between">
                            <div>
                                <p className="text-xs font-medium text-muted-foreground">Total Views</p>
                                <p className="mt-1 text-2xl font-bold tracking-tight text-foreground">
                                    {formatNumber(stats.total_views)}
                                </p>
                                <p className="text-[11px] text-muted-foreground">{stats.total_views.toLocaleString('id-ID')} tayangan</p>
                            </div>
                            <div className="flex size-10 items-center justify-center rounded-lg bg-blue-50 text-blue-600 dark:bg-blue-950/50 dark:text-blue-400">
                                <Eye className="size-5" />
                            </div>
                        </CardContent>
                    </Card>

                    <Card className="border shadow-2xs">
                        <CardContent className="p-4 flex items-center justify-between">
                            <div>
                                <p className="text-xs font-medium text-muted-foreground">Total Komentar</p>
                                <p className="mt-1 text-2xl font-bold tracking-tight text-foreground">
                                    {formatNumber(stats.total_komentar)}
                                </p>
                                <p className="text-[11px] text-muted-foreground">{stats.total_komentar.toLocaleString('id-ID')} interaksi</p>
                            </div>
                            <div className="flex size-10 items-center justify-center rounded-lg bg-emerald-50 text-emerald-600 dark:bg-emerald-950/50 dark:text-emerald-400">
                                <MessageSquare className="size-5" />
                            </div>
                        </CardContent>
                    </Card>
                </div>

                {/* Filter and Search Bar */}
                <div className="flex flex-col gap-3 rounded-lg border bg-card p-3 shadow-2xs">
                    <div className="flex flex-wrap items-center gap-3">
                        <div className="min-w-[240px] flex-1">
                            <AntInput.Search
                                placeholder="Cari kreator, caption, link postingan..."
                                value={search}
                                onChange={(e) => setSearch(e.target.value)}
                                onSearch={handleSearch}
                                allowClear
                                onClear={() => handleSearch('')}
                                enterButton="Cari"
                            />
                        </div>

                        <div className="w-36">
                            <AntSelect
                                placeholder="Pilih Brand"
                                value={selectedBrand || undefined}
                                onChange={handleBrandChange}
                                allowClear
                                virtual={false}
                                className="w-full"
                                options={BRAND_OPTIONS.map((b) => ({ value: b, label: b }))}
                            />
                        </div>

                        <div className="w-40">
                            <AntSelect
                                placeholder="Jenis Sosmed"
                                value={selectedPlatform || undefined}
                                onChange={handlePlatformChange}
                                allowClear
                                virtual={false}
                                className="w-full"
                                options={PLATFORM_OPTIONS.map((p) => ({ value: p.value, label: p.label }))}
                            />
                        </div>

                        <div className="w-32">
                            <AntSelect
                                placeholder="Bulan Entry"
                                value={selectedMonth || undefined}
                                onChange={handleMonthChange}
                                allowClear
                                virtual={false}
                                className="w-full"
                                options={MONTH_ENTRY_OPTIONS.map((m) => ({ value: m.value, label: m.label }))}
                            />
                        </div>

                        <div className="w-48">
                            <AntSelect
                                placeholder="Urutkan"
                                value={selectedSort}
                                onChange={handleSortChange}
                                virtual={false}
                                className="w-full"
                                options={SORT_OPTIONS}
                            />
                        </div>

                        {isFiltered && (
                            <Button
                                type="button"
                                variant="ghost"
                                size="sm"
                                onClick={handleResetFilter}
                                className="text-xs text-muted-foreground hover:text-foreground"
                            >
                                Reset Filter
                            </Button>
                        )}
                    </div>

                    <div className="flex items-center justify-between text-xs text-muted-foreground pt-1 border-t">
                        <span>
                            Menampilkan <span className="font-semibold text-foreground">{postings.total}</span> data postingan
                        </span>
                        {isFiltered && (
                            <span className="text-[11px] text-amber-600 dark:text-amber-400 font-medium">
                                * Filter aktif diterapkan
                            </span>
                        )}
                    </div>
                </div>

                {/* Postings Table */}
                <Card className="border shadow-xs overflow-hidden">
                    <CardContent className="p-0">
                        <div className="overflow-x-auto">
                            <table className="w-full text-left text-xs">
                                <thead className="border-b bg-muted/40 font-medium text-muted-foreground">
                                    <tr>
                                        <th className="px-4 py-3 text-center w-12">NO</th>
                                        <th className="px-4 py-3 min-w-[200px]">
                                            <button
                                                type="button"
                                                onClick={() => handleToggleSort('nama')}
                                                className="flex items-center gap-1.5 hover:text-foreground font-medium text-left group transition-colors"
                                                title="Urutkan berdasarkan Nama Lengkap"
                                            >
                                                <span>NAMA LENGKAP</span>
                                                {renderSortIcon('nama')}
                                            </button>
                                        </th>
                                        <th className="px-4 py-3 min-w-[160px]">SOSMED & BRAND</th>
                                        <th className="px-4 py-3 min-w-[160px]">
                                            <button
                                                type="button"
                                                onClick={() => handleToggleSort('tanggal')}
                                                className="flex items-center gap-1.5 hover:text-foreground font-medium text-left group transition-colors"
                                                title="Urutkan berdasarkan Tanggal Rilis"
                                            >
                                                <span>RILIS & BULAN</span>
                                                {renderSortIcon('tanggal')}
                                            </button>
                                        </th>
                                        <th className="px-4 py-3 min-w-[260px]">CAPTION & LINK</th>
                                        <th className="px-4 py-3 min-w-[170px]">
                                            <div className="flex items-center gap-2">
                                                <button
                                                    type="button"
                                                    onClick={() => handleToggleSort('views')}
                                                    className="flex items-center gap-1 hover:text-foreground font-medium group transition-colors"
                                                    title="Urutkan berdasarkan Total Views"
                                                >
                                                    <span>VIEWS</span>
                                                    {renderSortIcon('views')}
                                                </button>
                                                <span className="text-muted-foreground/40 font-normal">/</span>
                                                <button
                                                    type="button"
                                                    onClick={() => handleToggleSort('komentar')}
                                                    className="flex items-center gap-1 hover:text-foreground font-medium group transition-colors"
                                                    title="Urutkan berdasarkan Total Komentar"
                                                >
                                                    <span>KOMEN</span>
                                                    {renderSortIcon('komentar')}
                                                </button>
                                            </div>
                                        </th>
                                        <th className="px-4 py-3 text-right w-28">AKSI</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-border/60">
                                    {postings.data.length === 0 ? (
                                        <tr>
                                            <td colSpan={7} className="py-12 text-center text-muted-foreground">
                                                <div className="flex flex-col items-center justify-center gap-2">
                                                    <Share2 className="size-8 text-muted-foreground/40" />
                                                    <p className="font-medium">Belum ada data postingan sosial media.</p>
                                                    <p className="text-xs text-muted-foreground/80">
                                                        Klik tombol "Tambah Postingan" untuk memasukkan data baru.
                                                    </p>
                                                </div>
                                            </td>
                                        </tr>
                                    ) : (
                                        postings.data.map((posting, idx) => {
                                            const rowNumber = (postings.current_page - 1) * postings.per_page + idx + 1;
                                            return (
                                                <tr key={posting.id} className="hover:bg-muted/30 transition-colors">
                                                    {/* NO */}
                                                    <td className="px-4 py-3 text-center font-medium text-muted-foreground">
                                                        {rowNumber}
                                                    </td>

                                                    {/* NAMA LENGKAP */}
                                                    <td className="px-4 py-3">
                                                        <div className="space-y-0.5">
                                                            <div className="flex items-center gap-1.5 font-semibold text-foreground">
                                                                <UserCircle className="size-3.5 text-primary shrink-0" />
                                                                <span>{posting.profile?.nama_lengkap || '-'}</span>
                                                            </div>
                                                            {posting.profile?.domisili && (
                                                                <p className="text-[11px] text-muted-foreground">
                                                                    {posting.profile.domisili}
                                                                </p>
                                                            )}
                                                        </div>
                                                    </td>

                                                    {/* SOSMED & BRAND */}
                                                    <td className="px-4 py-3">
                                                        <div className="flex flex-col gap-1 items-start">
                                                            {getPlatformBadge(posting.jenis_sosmed)}
                                                            {getBrandBadge(posting.brand)}
                                                        </div>
                                                    </td>

                                                    {/* TANGGAL RILIS & BULAN ENTRY */}
                                                    <td className="px-4 py-3">
                                                        <div className="space-y-0.5 text-xs">
                                                            <div className="flex items-center gap-1 text-foreground">
                                                                <Calendar className="size-3 text-muted-foreground shrink-0" />
                                                                <span>{formatDateIndo(posting.tanggal_rilis)}</span>
                                                            </div>
                                                            {posting.bulan_entry && (
                                                                <span className="inline-block text-[10px] text-muted-foreground uppercase font-mono px-1 bg-muted rounded">
                                                                    Bulan: {posting.bulan_entry}
                                                                </span>
                                                            )}
                                                        </div>
                                                    </td>

                                                    {/* CAPTION & LINK */}
                                                    <td className="px-4 py-3">
                                                        <div className="space-y-1 max-w-xs">
                                                            <p className="line-clamp-2 text-xs text-foreground/90" title={posting.caption || ''}>
                                                                {posting.caption || '-'}
                                                            </p>
                                                            {posting.link && (
                                                                <a
                                                                    href={posting.link}
                                                                    target="_blank"
                                                                    rel="noopener noreferrer"
                                                                    className="inline-flex items-center gap-1 text-[11px] text-blue-600 hover:text-blue-800 hover:underline dark:text-blue-400"
                                                                >
                                                                    <ExternalLink className="size-3 shrink-0" />
                                                                    <span className="truncate max-w-[200px]">{posting.link}</span>
                                                                </a>
                                                            )}
                                                        </div>
                                                    </td>

                                                    {/* TOTAL VIEWS & TOTAL KOMENTAR */}
                                                    <td className="px-4 py-3">
                                                        <div className="space-y-1">
                                                            <div className="flex items-center gap-1 text-xs font-semibold text-foreground">
                                                                <Eye className="size-3 text-blue-600 shrink-0" />
                                                                <span>{formatNumber(posting.total_views)}</span>
                                                                <span className="text-[10px] font-normal text-muted-foreground">views</span>
                                                            </div>
                                                            <div className="flex items-center gap-1 text-xs text-muted-foreground">
                                                                <MessageSquare className="size-3 text-emerald-600 shrink-0" />
                                                                <span>{formatNumber(posting.total_komentar)}</span>
                                                                <span className="text-[10px] font-normal text-muted-foreground">komentar</span>
                                                            </div>
                                                        </div>
                                                    </td>

                                                    {/* AKSI */}
                                                    <td className="px-4 py-3 text-right">
                                                        <div className="flex items-center justify-end gap-1">
                                                            <AntTooltip title="Lihat Rincian">
                                                                <Button
                                                                    type="button"
                                                                    variant="ghost"
                                                                    size="sm"
                                                                    className="size-7 p-0 text-muted-foreground hover:text-foreground"
                                                                    onClick={() => setViewDetailPosting(posting)}
                                                                >
                                                                    <Eye className="size-3.5" />
                                                                </Button>
                                                            </AntTooltip>

                                                            <AntTooltip title="Edit Postingan">
                                                                <Button
                                                                    type="button"
                                                                    variant="ghost"
                                                                    size="sm"
                                                                    className="size-7 p-0 text-muted-foreground hover:text-primary"
                                                                    onClick={() => handleOpenEdit(posting)}
                                                                >
                                                                    <Edit2 className="size-3.5" />
                                                                </Button>
                                                            </AntTooltip>

                                                            <AntTooltip title="Hapus Postingan">
                                                                <Button
                                                                    type="button"
                                                                    variant="ghost"
                                                                    size="sm"
                                                                    className="size-7 p-0 text-muted-foreground hover:text-rose-600"
                                                                    onClick={() => handleOpenDelete(posting)}
                                                                >
                                                                    <Trash2 className="size-3.5" />
                                                                </Button>
                                                            </AntTooltip>
                                                        </div>
                                                    </td>
                                                </tr>
                                            );
                                        })
                                    )}
                                </tbody>
                            </table>
                        </div>

                        {/* Pagination Section */}
                        {postings.total > 0 && (
                            <div className="border-t p-3">
                                <Pagination links={postings.links} />
                            </div>
                        )}
                    </CardContent>
                </Card>
            </div>

            {/* Modal Tambah Postingan */}
            <Dialog open={isCreateOpen} onOpenChange={setIsCreateOpen}>
                <DialogContent className="max-w-xl max-h-[90vh] overflow-y-auto">
                    <DialogHeader>
                        <DialogTitle className="flex items-center gap-2">
                            <Plus className="size-5 text-primary" />
                            Tambah Postingan Sosial Media
                        </DialogTitle>
                        <DialogDescription className="text-xs">
                            Masukkan data postingan dari influencer/kreator beserta link dan engagement.
                        </DialogDescription>
                    </DialogHeader>

                    <form onSubmit={handleSubmitCreate} className="space-y-4">
                        {/* Nama Lengkap (Profile Select) */}
                        <div className="space-y-1.5">
                            <Label htmlFor="create_profile">Nama Lengkap (Kreator / Profile) *</Label>
                            <AntSelect
                                id="create_profile"
                                showSearch
                                placeholder="Pilih Profil Kreator"
                                value={createForm.data.social_media_profile_id || undefined}
                                onChange={(val) => createForm.setData('social_media_profile_id', val)}
                                className="w-full"
                                optionFilterProp="label"
                                {...dialogSelectProps}
                                options={profiles.map((p) => ({
                                    value: p.id,
                                    label: `${p.nama_lengkap}${p.domisili ? ` (${p.domisili})` : ''}`,
                                }))}
                            />
                            <InputError message={createForm.errors.social_media_profile_id} />
                        </div>

                        {/* Jenis Sosmed & Brand */}
                        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                            <div className="space-y-1.5">
                                <Label htmlFor="create_jenis">Jenis Sosmed *</Label>
                                <AntSelect
                                    id="create_jenis"
                                    value={createForm.data.jenis_sosmed}
                                    onChange={(val) => createForm.setData('jenis_sosmed', val)}
                                    className="w-full"
                                    {...dialogSelectProps}
                                    options={PLATFORM_OPTIONS.map((p) => ({ value: p.value, label: p.label }))}
                                />
                                <InputError message={createForm.errors.jenis_sosmed} />
                            </div>

                            <div className="space-y-1.5">
                                <Label htmlFor="create_brand">Brand *</Label>
                                <AntSelect
                                    id="create_brand"
                                    value={createForm.data.brand}
                                    onChange={(val) => createForm.setData('brand', val)}
                                    className="w-full"
                                    {...dialogSelectProps}
                                    options={BRAND_OPTIONS.map((b) => ({ value: b, label: b }))}
                                />
                                <InputError message={createForm.errors.brand} />
                            </div>
                        </div>

                        {/* Tanggal Rilis & Bulan Entry */}
                        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                            <div className="space-y-1.5">
                                <Label htmlFor="create_tanggal_rilis">Tanggal Rilis</Label>
                                <Input
                                    id="create_tanggal_rilis"
                                    type="date"
                                    value={createForm.data.tanggal_rilis}
                                    onChange={(e) => createForm.setData('tanggal_rilis', e.target.value)}
                                />
                                <InputError message={createForm.errors.tanggal_rilis} />
                            </div>

                            <div className="space-y-1.5">
                                <Label htmlFor="create_bulan_entry">Bulan Entry (contoh: Oct/Nov/Jun)</Label>
                                <AntSelect
                                    id="create_bulan_entry"
                                    placeholder="Pilih Bulan Entry"
                                    value={createForm.data.bulan_entry || undefined}
                                    onChange={(val) => createForm.setData('bulan_entry', val)}
                                    className="w-full"
                                    {...dialogSelectProps}
                                    options={MONTH_ENTRY_OPTIONS.map((m) => ({ value: m.value, label: m.label }))}
                                />
                                <InputError message={createForm.errors.bulan_entry} />
                            </div>
                        </div>

                        {/* Link Postingan */}
                        <div className="space-y-1.5">
                            <Label htmlFor="create_link">Link Postingan</Label>
                            <Input
                                id="create_link"
                                type="url"
                                placeholder="https://www.instagram.com/p/DeRsNjYvrv6/"
                                value={createForm.data.link}
                                onChange={(e) => createForm.setData('link', e.target.value)}
                            />
                            <InputError message={createForm.errors.link} />
                        </div>

                        {/* Total Views & Total Komentar */}
                        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                            <div className="space-y-1.5">
                                <Label htmlFor="create_views">Total Views (Count Views)</Label>
                                <Input
                                    id="create_views"
                                    type="number"
                                    min={0}
                                    placeholder="0"
                                    value={createForm.data.total_views}
                                    onChange={(e) => createForm.setData('total_views', e.target.value === '' ? '' : Number(e.target.value))}
                                />
                                <InputError message={createForm.errors.total_views} />
                            </div>

                            <div className="space-y-1.5">
                                <Label htmlFor="create_komentar">Total Komentar (Count Comment)</Label>
                                <Input
                                    id="create_komentar"
                                    type="number"
                                    min={0}
                                    placeholder="0"
                                    value={createForm.data.total_komentar}
                                    onChange={(e) => createForm.setData('total_komentar', e.target.value === '' ? '' : Number(e.target.value))}
                                />
                                <InputError message={createForm.errors.total_komentar} />
                            </div>
                        </div>

                        {/* Caption (Paragraf) */}
                        <div className="space-y-1.5">
                            <Label htmlFor="create_caption">Caption Postingan</Label>
                            <Textarea
                                id="create_caption"
                                rows={4}
                                placeholder="Masukkan teks caption lengkap dari postingan..."
                                value={createForm.data.caption}
                                onChange={(e) => createForm.setData('caption', e.target.value)}
                            />
                            <InputError message={createForm.errors.caption} />
                        </div>

                        <DialogFooter className="pt-2">
                            <DialogClose asChild>
                                <Button type="button" variant="outline" disabled={createForm.processing}>
                                    Batal
                                </Button>
                            </DialogClose>
                            <Button type="submit" disabled={createForm.processing}>
                                {createForm.processing ? 'Menyimpan...' : 'Simpan Postingan'}
                            </Button>
                        </DialogFooter>
                    </form>
                </DialogContent>
            </Dialog>

            {/* Modal Edit Postingan */}
            <Dialog open={isEditOpen} onOpenChange={setIsEditOpen}>
                <DialogContent className="max-w-xl max-h-[90vh] overflow-y-auto">
                    <DialogHeader>
                        <DialogTitle className="flex items-center gap-2">
                            <Edit2 className="size-5 text-primary" />
                            Edit Postingan Sosial Media
                        </DialogTitle>
                        <DialogDescription className="text-xs">
                            Perbarui data postingan, tautan rilis, atau performa views dan komentar.
                        </DialogDescription>
                    </DialogHeader>

                    <form onSubmit={handleSubmitEdit} className="space-y-4">
                        {/* Nama Lengkap (Profile Select) */}
                        <div className="space-y-1.5">
                            <Label htmlFor="edit_profile">Nama Lengkap (Kreator / Profile) *</Label>
                            <AntSelect
                                id="edit_profile"
                                showSearch
                                placeholder="Pilih Profil Kreator"
                                value={editForm.data.social_media_profile_id || undefined}
                                onChange={(val) => editForm.setData('social_media_profile_id', val)}
                                className="w-full"
                                optionFilterProp="label"
                                {...dialogSelectProps}
                                options={profiles.map((p) => ({
                                    value: p.id,
                                    label: `${p.nama_lengkap}${p.domisili ? ` (${p.domisili})` : ''}`,
                                }))}
                            />
                            <InputError message={editForm.errors.social_media_profile_id} />
                        </div>

                        {/* Jenis Sosmed & Brand */}
                        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                            <div className="space-y-1.5">
                                <Label htmlFor="edit_jenis">Jenis Sosmed *</Label>
                                <AntSelect
                                    id="edit_jenis"
                                    value={editForm.data.jenis_sosmed}
                                    onChange={(val) => editForm.setData('jenis_sosmed', val)}
                                    className="w-full"
                                    {...dialogSelectProps}
                                    options={PLATFORM_OPTIONS.map((p) => ({ value: p.value, label: p.label }))}
                                />
                                <InputError message={editForm.errors.jenis_sosmed} />
                            </div>

                            <div className="space-y-1.5">
                                <Label htmlFor="edit_brand">Brand *</Label>
                                <AntSelect
                                    id="edit_brand"
                                    value={editForm.data.brand}
                                    onChange={(val) => editForm.setData('brand', val)}
                                    className="w-full"
                                    {...dialogSelectProps}
                                    options={BRAND_OPTIONS.map((b) => ({ value: b, label: b }))}
                                />
                                <InputError message={editForm.errors.brand} />
                            </div>
                        </div>

                        {/* Tanggal Rilis & Bulan Entry */}
                        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                            <div className="space-y-1.5">
                                <Label htmlFor="edit_tanggal_rilis">Tanggal Rilis</Label>
                                <Input
                                    id="edit_tanggal_rilis"
                                    type="date"
                                    value={editForm.data.tanggal_rilis}
                                    onChange={(e) => editForm.setData('tanggal_rilis', e.target.value)}
                                />
                                <InputError message={editForm.errors.tanggal_rilis} />
                            </div>

                            <div className="space-y-1.5">
                                <Label htmlFor="edit_bulan_entry">Bulan Entry (contoh: Oct/Nov/Jun)</Label>
                                <AntSelect
                                    id="edit_bulan_entry"
                                    placeholder="Pilih Bulan Entry"
                                    value={editForm.data.bulan_entry || undefined}
                                    onChange={(val) => editForm.setData('bulan_entry', val)}
                                    className="w-full"
                                    {...dialogSelectProps}
                                    options={MONTH_ENTRY_OPTIONS.map((m) => ({ value: m.value, label: m.label }))}
                                />
                                <InputError message={editForm.errors.bulan_entry} />
                            </div>
                        </div>

                        {/* Link Postingan */}
                        <div className="space-y-1.5">
                            <Label htmlFor="edit_link">Link Postingan</Label>
                            <Input
                                id="edit_link"
                                type="url"
                                placeholder="https://www.instagram.com/p/DeRsNjYvrv6/"
                                value={editForm.data.link}
                                onChange={(e) => editForm.setData('link', e.target.value)}
                            />
                            <InputError message={editForm.errors.link} />
                        </div>

                        {/* Total Views & Total Komentar */}
                        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                            <div className="space-y-1.5">
                                <Label htmlFor="edit_views">Total Views (Count Views)</Label>
                                <Input
                                    id="edit_views"
                                    type="number"
                                    min={0}
                                    value={editForm.data.total_views}
                                    onChange={(e) => editForm.setData('total_views', e.target.value === '' ? '' : Number(e.target.value))}
                                />
                                <InputError message={editForm.errors.total_views} />
                            </div>

                            <div className="space-y-1.5">
                                <Label htmlFor="edit_komentar">Total Komentar (Count Comment)</Label>
                                <Input
                                    id="edit_komentar"
                                    type="number"
                                    min={0}
                                    value={editForm.data.total_komentar}
                                    onChange={(e) => editForm.setData('total_komentar', e.target.value === '' ? '' : Number(e.target.value))}
                                />
                                <InputError message={editForm.errors.total_komentar} />
                            </div>
                        </div>

                        {/* Caption (Paragraf) */}
                        <div className="space-y-1.5">
                            <Label htmlFor="edit_caption">Caption Postingan</Label>
                            <Textarea
                                id="edit_caption"
                                rows={4}
                                placeholder="Masukkan teks caption lengkap dari postingan..."
                                value={editForm.data.caption}
                                onChange={(e) => editForm.setData('caption', e.target.value)}
                            />
                            <InputError message={editForm.errors.caption} />
                        </div>

                        <DialogFooter className="pt-2">
                            <DialogClose asChild>
                                <Button type="button" variant="outline" disabled={editForm.processing}>
                                    Batal
                                </Button>
                            </DialogClose>
                            <Button type="submit" disabled={editForm.processing}>
                                {editForm.processing ? 'Menyimpan...' : 'Perbarui Postingan'}
                            </Button>
                        </DialogFooter>
                    </form>
                </DialogContent>
            </Dialog>

            {/* Modal View Detail Postingan */}
            <Dialog open={!!viewDetailPosting} onOpenChange={(open) => !open && setViewDetailPosting(null)}>
                <DialogContent className="max-w-xl max-h-[90vh] overflow-y-auto">
                    <DialogHeader>
                        <DialogTitle className="flex items-center gap-2">
                            <Eye className="size-5 text-primary" />
                            Rincian Postingan Sosmed
                        </DialogTitle>
                    </DialogHeader>

                    {viewDetailPosting && (
                        <div className="space-y-4 pt-1">
                            {/* Header Info */}
                            <div className="flex items-start justify-between rounded-lg border bg-muted/20 p-4">
                                <div className="space-y-1">
                                    <div className="flex items-center gap-2">
                                        <UserCircle className="size-4 text-primary" />
                                        <span className="font-bold text-foreground">
                                            {viewDetailPosting.profile?.nama_lengkap || '-'}
                                        </span>
                                    </div>
                                    <p className="text-xs text-muted-foreground">
                                        Domisili: {viewDetailPosting.profile?.domisili || '-'} | No HP: {viewDetailPosting.profile?.no_hp || '-'}
                                    </p>
                                </div>
                                <div className="flex flex-col items-end gap-1">
                                    {getPlatformBadge(viewDetailPosting.jenis_sosmed)}
                                    {getBrandBadge(viewDetailPosting.brand)}
                                </div>
                            </div>

                            {/* Release & Month Info */}
                            <div className="grid grid-cols-2 gap-3 text-xs">
                                <div className="rounded-md border p-3 bg-card">
                                    <span className="text-muted-foreground">Tanggal Rilis:</span>
                                    <p className="font-semibold text-foreground mt-0.5">
                                        {formatDateIndo(viewDetailPosting.tanggal_rilis)}
                                    </p>
                                </div>
                                <div className="rounded-md border p-3 bg-card">
                                    <span className="text-muted-foreground">Bulan Entry:</span>
                                    <p className="font-semibold text-foreground mt-0.5">
                                        {viewDetailPosting.bulan_entry || '-'}
                                    </p>
                                </div>
                            </div>

                            {/* Metrics Cards */}
                            <div className="grid grid-cols-2 gap-3">
                                <div className="flex items-center gap-3 rounded-md border p-3 bg-card">
                                    <div className="flex size-9 items-center justify-center rounded-lg bg-blue-50 text-blue-600 dark:bg-blue-950/40">
                                        <Eye className="size-4" />
                                    </div>
                                    <div>
                                        <p className="text-[11px] text-muted-foreground">Total Views</p>
                                        <p className="text-sm font-bold text-foreground">
                                            {viewDetailPosting.total_views.toLocaleString('id-ID')}
                                        </p>
                                    </div>
                                </div>

                                <div className="flex items-center gap-3 rounded-md border p-3 bg-card">
                                    <div className="flex size-9 items-center justify-center rounded-lg bg-emerald-50 text-emerald-600 dark:bg-emerald-950/40">
                                        <MessageSquare className="size-4" />
                                    </div>
                                    <div>
                                        <p className="text-[11px] text-muted-foreground">Total Komentar</p>
                                        <p className="text-sm font-bold text-foreground">
                                            {viewDetailPosting.total_komentar.toLocaleString('id-ID')}
                                        </p>
                                    </div>
                                </div>
                            </div>

                            {/* Link Postingan */}
                            {viewDetailPosting.link && (
                                <div className="space-y-1 rounded-md border p-3 bg-card text-xs">
                                    <span className="text-muted-foreground font-medium">Link Tautan Postingan:</span>
                                    <div>
                                        <a
                                            href={viewDetailPosting.link}
                                            target="_blank"
                                            rel="noopener noreferrer"
                                            className="inline-flex items-center gap-1.5 text-blue-600 hover:underline dark:text-blue-400 break-all"
                                        >
                                            <ExternalLink className="size-3.5 shrink-0" />
                                            {viewDetailPosting.link}
                                        </a>
                                    </div>
                                </div>
                            )}

                            {/* Caption Text */}
                            <div className="space-y-1.5 rounded-md border p-3 bg-card">
                                <span className="text-xs font-semibold text-foreground">Caption Postingan:</span>
                                <div className="rounded bg-muted/40 p-3 text-xs text-foreground/90 whitespace-pre-wrap font-sans leading-relaxed">
                                    {viewDetailPosting.caption || '(Tidak ada teks caption)'}
                                </div>
                            </div>

                            <DialogFooter className="pt-2">
                                <Button type="button" variant="outline" onClick={() => setViewDetailPosting(null)}>
                                    Tutup
                                </Button>
                            </DialogFooter>
                        </div>
                    )}
                </DialogContent>
            </Dialog>

            {/* Modal Import Excel / CSV */}
            <Dialog open={isImportOpen} onOpenChange={setIsImportOpen}>
                <DialogContent className="max-w-lg">
                    <DialogHeader>
                        <DialogTitle className="flex items-center gap-2">
                            <FileSpreadsheet className="size-5 text-emerald-600" />
                            Import Postingan dari Excel / CSV
                        </DialogTitle>
                        <DialogDescription className="text-xs">
                            Unggah berkas spreadsheet Excel (.xlsx, .xls) atau CSV untuk memasukkan atau memperbarui postingan sosial media secara massal.
                        </DialogDescription>
                    </DialogHeader>

                    <form onSubmit={handleSubmitImport} className="space-y-4">
                        {/* Download Template Banner */}
                        <div className="flex items-center justify-between rounded-lg border border-sidebar-border/80 bg-muted/30 p-3">
                            <div className="space-y-0.5">
                                <p className="text-xs font-medium text-foreground">
                                    Format template Excel (.xlsx)
                                </p>
                                <p className="text-[11px] text-muted-foreground">
                                    Unduh berkas contoh format kolom sesuai standar sistem.
                                </p>
                            </div>
                            <a
                                href={socialMediaPostingRoute.template.url()}
                                download="template_social_media_posting.xlsx"
                                className="inline-flex shrink-0 items-center gap-1.5 rounded-md border border-sidebar-border bg-background px-2.5 py-1.5 text-xs font-medium text-foreground shadow-2xs transition-colors hover:border-primary/50 hover:bg-accent hover:text-primary dark:border-sidebar-border"
                            >
                                <Download className="size-3.5 text-primary" />
                                Unduh Template
                            </a>
                        </div>

                        {/* Drag & Drop File Upload Area */}
                        <div className="space-y-2">
                            <Label>Pilih File Excel (.xlsx / .csv)</Label>
                            <input
                                ref={fileInputRef}
                                type="file"
                                accept=".xlsx,.xls,.csv"
                                onChange={handleFileChange}
                                className="hidden"
                            />

                            {!importForm.data.file ? (
                                <div
                                    onDragOver={handleDragOver}
                                    onDragLeave={handleDragLeave}
                                    onDrop={handleDrop}
                                    onClick={() => fileInputRef.current?.click()}
                                    className={`flex cursor-pointer flex-col items-center justify-center rounded-lg border-2 border-dashed p-6 text-center transition-colors ${
                                        isDragging
                                            ? 'border-primary bg-primary/5'
                                            : 'border-sidebar-border/80 hover:border-primary/50 hover:bg-muted/30'
                                    }`}
                                >
                                    <div className="flex size-10 items-center justify-center rounded-full bg-emerald-50 text-emerald-600 dark:bg-emerald-950/50 dark:text-emerald-400">
                                        <Upload className="size-5" />
                                    </div>
                                    <p className="mt-2 text-xs font-medium text-foreground">
                                        Klik untuk memilih file atau seret file ke sini
                                    </p>
                                    <p className="mt-1 text-[11px] text-muted-foreground">
                                        Mendukung file Excel .xlsx, .xls atau .csv (Maks. 10MB)
                                    </p>
                                </div>
                            ) : (
                                <div className="flex items-center justify-between rounded-lg border border-sidebar-border bg-card p-3 shadow-2xs">
                                    <div className="flex items-center gap-3 overflow-hidden">
                                        <div className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-emerald-100 text-emerald-700 dark:bg-emerald-900/60 dark:text-emerald-300">
                                            <FileSpreadsheet className="size-5" />
                                        </div>
                                        <div className="overflow-hidden">
                                            <p className="truncate text-xs font-medium text-foreground">
                                                {importForm.data.file.name}
                                            </p>
                                            <p className="text-[11px] text-muted-foreground">
                                                {formatFileSize(importForm.data.file.size)}
                                            </p>
                                        </div>
                                    </div>
                                    <Button
                                        type="button"
                                        variant="ghost"
                                        size="sm"
                                        onClick={handleRemoveFile}
                                        className="size-8 p-0 text-muted-foreground hover:text-destructive"
                                        title="Hapus file"
                                    >
                                        <X className="size-4" />
                                    </Button>
                                </div>
                            )}

                            <InputError message={importForm.errors.file} />
                        </div>

                        {/* Panduan Format Kolom */}
                        <div className="space-y-1.5 rounded-lg border border-sidebar-border/60 bg-muted/20 p-3 text-xs text-muted-foreground">
                            <p className="text-[11px] font-semibold tracking-wider text-foreground uppercase">
                                Ketentuan Kolom Excel:
                            </p>
                            <ul className="list-disc space-y-0.5 pl-4 text-[11px]">
                                <li>
                                    <strong className="text-foreground">Nama Lengkap</strong>: Nama kreator/influencer (jika profil belum ada di database, sistem akan otomatis membuatnya).
                                </li>
                                <li>
                                    <strong className="text-foreground">Jenis Sosmed</strong>: Pilihan platform (<code className="rounded bg-muted px-1">ig</code>, <code className="rounded bg-muted px-1">TikTok</code>, <code className="rounded bg-muted px-1">facebook</code>, <code className="rounded bg-muted px-1">youtube</code>).
                                </li>
                                <li>
                                    <strong className="text-foreground">Tanggal Rilis & Bulan Entry</strong>: Tanggal rilis (contoh: <code className="rounded bg-muted px-1">2026-11-01</code> atau <code className="rounded bg-muted px-1">01/11/2026</code>) dan kode bulan (contoh: <code className="rounded bg-muted px-1">Nov</code>).
                                </li>
                                <li>
                                    <strong className="text-foreground">Brand</strong>: Honda, Kawasaki, Yamaha, Aprilia, TVS, Bajaj, KTM, Piaggio, MV Agusta, All Brand.
                                </li>
                                <li>
                                    <strong className="text-foreground">Total Komentar & Total Views</strong>: Angka jumlah komentar dan tayangan views.
                                </li>
                                <li>
                                    <strong className="text-foreground">Link & Caption</strong>: Tautan postingan sosial media dan isi teks caption postingan.
                                </li>
                            </ul>
                        </div>

                        {/* Checkbox Options */}
                        <div className="space-y-3 pt-1">
                            <div className="flex items-start space-x-2">
                                <Checkbox
                                    id="posting_update_existing"
                                    checked={importForm.data.update_existing}
                                    onCheckedChange={(checked) =>
                                        importForm.setData('update_existing', Boolean(checked))
                                    }
                                />
                                <div className="grid gap-1 leading-none">
                                    <label
                                        htmlFor="posting_update_existing"
                                        className="cursor-pointer text-xs font-medium text-foreground select-none"
                                    >
                                        Perbarui data jika postingan sudah ada
                                    </label>
                                    <p className="text-[11px] text-muted-foreground">
                                        Postingan yang cocok berdasarkan tautan Link akan diperbarui datanya dengan file ini.
                                    </p>
                                </div>
                            </div>

                            <div className="flex items-start space-x-2 rounded-md border border-amber-500/20 bg-amber-500/5 p-2.5">
                                <Checkbox
                                    id="posting_replace_all"
                                    checked={importForm.data.replace_all}
                                    onCheckedChange={(checked) =>
                                        importForm.setData('replace_all', Boolean(checked))
                                    }
                                />
                                <div className="grid gap-1 leading-none">
                                    <label
                                        htmlFor="posting_replace_all"
                                        className="cursor-pointer text-xs font-medium text-amber-900 dark:text-amber-200 select-none"
                                    >
                                        Kosongkan data lama & masukkan ulang seluruh isi file (Clean Re-import)
                                    </label>
                                    <p className="text-[11px] text-muted-foreground">
                                        Centang ini jika Anda ingin menghapus postingan lama dan mengimpor ulang seluruh baris data dari file Excel secara bersih dari awal.
                                    </p>
                                </div>
                            </div>
                        </div>

                        <DialogFooter className="gap-2 sm:gap-0 pt-2">
                            <Button
                                type="button"
                                variant="outline"
                                onClick={() => setIsImportOpen(false)}
                                disabled={importForm.processing}
                            >
                                Batal
                            </Button>
                            <Button
                                type="submit"
                                disabled={!importForm.data.file || importForm.processing}
                                className="bg-red-600 hover:bg-red-700 text-white"
                            >
                                {importForm.processing ? 'Mengimpor...' : 'Mulai Import'}
                            </Button>
                        </DialogFooter>
                    </form>
                </DialogContent>
            </Dialog>

            {/* Modal Konfirmasi Hapus */}
            <Dialog open={isDeleteOpen} onOpenChange={setIsDeleteOpen}>
                <DialogContent className="max-w-md">
                    <DialogHeader>
                        <DialogTitle className="text-rose-600">Hapus Postingan</DialogTitle>
                        <DialogDescription className="text-xs pt-1">
                            Apakah Anda yakin ingin menghapus postingan milik{' '}
                            <strong>{selectedPosting?.profile?.nama_lengkap || 'kreator ini'}</strong> untuk brand{' '}
                            <strong>{selectedPosting?.brand}</strong>? Tindakan ini tidak dapat dibatalkan.
                        </DialogDescription>
                    </DialogHeader>

                    <DialogFooter className="gap-2 sm:gap-0">
                        <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            onClick={() => setIsDeleteOpen(false)}
                        >
                            Batal
                        </Button>
                        <Button
                            type="button"
                            variant="destructive"
                            size="sm"
                            onClick={handleSubmitDelete}
                        >
                            Ya, Hapus Postingan
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </>
    );
}

SocialMediaPostingsIndex.layout = {
    breadcrumbs: [
        {
            title: 'Dashboard GBP',
            href: dashboard(),
        },
        {
            title: 'Sosial Media Monitoring',
            href: socialMediaPostingRoute.index(),
        },
        {
            title: 'Sosmed Posting',
            href: socialMediaPostingRoute.index(),
        },
    ],
};

