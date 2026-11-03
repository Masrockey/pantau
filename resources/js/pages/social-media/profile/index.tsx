import { Head, router, useForm } from '@inertiajs/react';
import {
    Calendar,
    ChevronDown,
    ChevronRight,
    Download,
    Edit2,
    ExternalLink,
    Eye,
    FileSpreadsheet,
    Globe,
    LoaderCircle,
    Mail,
    MapPin,
    Phone,
    Plus,
    Search,
    Shield,
    Trash2,
    Upload,
    UserCircle,
    Users,
    X,
} from 'lucide-react';
import React, { useRef, useState } from 'react';
import {
    Button as AntButton,
    Input as AntInput,
    Modal as AntModal,
    Popconfirm as AntPopconfirm,
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
import socialMediaProfileRoute from '@/routes/social-media/profile';
import type { PaginatedData, SocialMediaProfile } from '@/types';

interface SocialMediaProfilesIndexProps {
    profiles: PaginatedData<SocialMediaProfile>;
    filters: {
        search?: string;
    };
}

const MONTH_OPTIONS = [
    { value: 'Januari', label: 'Januari' },
    { value: 'Februari', label: 'Februari' },
    { value: 'Maret', label: 'Maret' },
    { value: 'April', label: 'April' },
    { value: 'Mei', label: 'Mei' },
    { value: 'Juni', label: 'Juni' },
    { value: 'Juli', label: 'Juli' },
    { value: 'Agustus', label: 'Agustus' },
    { value: 'September', label: 'September' },
    { value: 'Oktober', label: 'Oktober' },
    { value: 'November', label: 'November' },
    { value: 'Desember', label: 'Desember' },
];

const DATE_OPTIONS = Array.from({ length: 31 }, (_, i) => ({
    value: i + 1,
    label: String(i + 1),
}));

const HELMET_SIZES = ['XS', 'S', 'M', 'L', 'XL', 'XXL'];
const JACKET_SIZES = ['S', 'M', 'L', 'XL', 'XXL', '3XL'];
const GLOVE_SIZES = ['S', 'M', 'L', 'XL'];
const SHOE_SIZES = ['37', '38', '39', '40', '41', '42', '43', '44', '45', '46'];

const formatFollower = (num?: number | null) => {
    if (num === null || num === undefined) return '0';
    if (num >= 1_000_000) return (num / 1_000_000).toFixed(1).replace(/\.0$/, '') + 'M';
    if (num >= 1_000) return (num / 1_000).toFixed(1).replace(/\.0$/, '') + 'K';
    return num.toLocaleString('id-ID');
};

const dialogSelectProps = {
    virtual: false,
    getPopupContainer: (trigger: HTMLElement): HTMLElement =>
        (trigger.closest('[role="dialog"]') as HTMLElement) || trigger.parentElement || document.body,
    dropdownRender: (menu: React.ReactNode) => (
        <div onWheel={(e) => e.stopPropagation()}>{menu}</div>
    ),
};

export default function SocialMediaProfilesIndex({
    profiles,
    filters,
}: SocialMediaProfilesIndexProps) {
    const [search, setSearch] = useState(filters.search || '');
    const [isCreateOpen, setIsCreateOpen] = useState(false);
    const [isEditOpen, setIsEditOpen] = useState(false);
    const [isDeleteOpen, setIsDeleteOpen] = useState(false);
    const [isImportOpen, setIsImportOpen] = useState(false);
    const [isDragging, setIsDragging] = useState(false);
    const [selectedProfile, setSelectedProfile] = useState<SocialMediaProfile | null>(null);
    const [viewDetailProfile, setViewDetailProfile] = useState<SocialMediaProfile | null>(null);
    const fileInputRef = useRef<HTMLInputElement>(null);

    const importForm = useForm<{
        file: File | null;
        update_existing: boolean;
    }>({
        file: null,
        update_existing: true,
    });

    // Form for create
    const createForm = useForm({
        nama_lengkap: '',
        link_youtube: '',
        total_subscribe_youtube: '' as number | string,
        link_instagram: '',
        total_follower_ig: '' as number | string,
        link_tiktok: '',
        total_follower_tiktok: '' as number | string,
        link_facebook: '',
        total_follower_fb: '' as number | string,
        no_hp: '',
        email: '',
        tanggal_lahir: undefined as number | undefined,
        bulan_lahir: '',
        ukuran_helm: '',
        ukuran_jaket: '',
        ukuran_sarung_tangan: '',
        ukuran_sepatu: '',
        alamat_rumah: '',
        domisili: '',
    });

    // Form for edit
    const editForm = useForm({
        nama_lengkap: '',
        link_youtube: '',
        total_subscribe_youtube: '' as number | string,
        link_instagram: '',
        total_follower_ig: '' as number | string,
        link_tiktok: '',
        total_follower_tiktok: '' as number | string,
        link_facebook: '',
        total_follower_fb: '' as number | string,
        no_hp: '',
        email: '',
        tanggal_lahir: undefined as number | undefined,
        bulan_lahir: '',
        ukuran_helm: '',
        ukuran_jaket: '',
        ukuran_sarung_tangan: '',
        ukuran_sepatu: '',
        alamat_rumah: '',
        domisili: '',
    });

    const handleSearch = (val: string) => {
        router.get(
            socialMediaProfileRoute.index.url(),
            { search: val || undefined },
            { preserveState: true, replace: true },
        );
    };

    const handleClearSearch = () => {
        setSearch('');
        router.get(
            socialMediaProfileRoute.index.url(),
            {},
            { preserveState: true, replace: true },
        );
    };

    const handleOpenCreate = () => {
        createForm.reset();
        createForm.clearErrors();
        setIsCreateOpen(true);
    };

    const handleSubmitCreate = (e: React.FormEvent) => {
        e.preventDefault();
        createForm.post(socialMediaProfileRoute.store.url(), {
            onSuccess: () => {
                setIsCreateOpen(false);
                createForm.reset();
            },
        });
    };

    const handleOpenEdit = (profile: SocialMediaProfile) => {
        setSelectedProfile(profile);
        editForm.clearErrors();
        editForm.setData({
            nama_lengkap: profile.nama_lengkap || '',
            link_youtube: profile.link_youtube || '',
            total_subscribe_youtube: profile.total_subscribe_youtube ?? '',
            link_instagram: profile.link_instagram || '',
            total_follower_ig: profile.total_follower_ig ?? '',
            link_tiktok: profile.link_tiktok || '',
            total_follower_tiktok: profile.total_follower_tiktok ?? '',
            link_facebook: profile.link_facebook || '',
            total_follower_fb: profile.total_follower_fb ?? '',
            no_hp: profile.no_hp || '',
            email: profile.email || '',
            tanggal_lahir: profile.tanggal_lahir ?? undefined,
            bulan_lahir: profile.bulan_lahir || '',
            ukuran_helm: profile.ukuran_helm || '',
            ukuran_jaket: profile.ukuran_jaket || '',
            ukuran_sarung_tangan: profile.ukuran_sarung_tangan || '',
            ukuran_sepatu: profile.ukuran_sepatu || '',
            alamat_rumah: profile.alamat_rumah || '',
            domisili: profile.domisili || '',
        });
        setIsEditOpen(true);
    };

    const handleSubmitEdit = (e: React.FormEvent) => {
        e.preventDefault();
        if (!selectedProfile) return;

        editForm.put(socialMediaProfileRoute.update.url(selectedProfile.id), {
            onSuccess: () => {
                setIsEditOpen(false);
                setSelectedProfile(null);
            },
        });
    };

    const handleOpenDelete = (profile: SocialMediaProfile) => {
        setSelectedProfile(profile);
        setIsDeleteOpen(true);
    };

    const handleSubmitDelete = () => {
        if (!selectedProfile) return;

        router.delete(socialMediaProfileRoute.destroy.url(selectedProfile.id), {
            onSuccess: () => {
                setIsDeleteOpen(false);
                setSelectedProfile(null);
            },
        });
    };

    const handleExport = (format: 'xlsx' | 'csv' = 'xlsx') => {
        const queryParams: Record<string, string> = { format };
        if (search) {
            queryParams.search = search;
        }

        antMessage.loading({
            content: `Menyiapkan berkas ekspor ${format.toUpperCase()}...`,
            key: 'exporting',
            duration: 1.5,
        });

        const url = socialMediaProfileRoute.export.url({ query: queryParams });
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
            content: 'Sedang memproses import profile...',
            key: 'import_process',
            duration: 0,
        });

        importForm.post(socialMediaProfileRoute.import.url(), {
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

    return (
        <>
            <Head title="Profile Sosial Media" />

            <div className="flex h-full flex-1 flex-col gap-6 p-4 md:p-6">
                {/* Header Section */}
                <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
                    <div>
                        <h1 className="flex items-center gap-2 text-2xl font-bold tracking-tight text-foreground">
                            <UserCircle className="size-6 text-primary" />
                            Profile Sosial Media
                        </h1>
                        <p className="mt-1 text-sm text-muted-foreground">
                            Kelola data profil influencer, talent, dan kreator sosial media.
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
                            Tambah Profile
                        </AntButton>
                    </div>
                </div>

                {/* Filter and Search Bar */}
                <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                    <div className="max-w-md flex-1">
                        <AntInput.Search
                            placeholder="Cari nama lengkap, no hp, email, domisili..."
                            value={search}
                            onChange={(e) => setSearch(e.target.value)}
                            onSearch={handleSearch}
                            allowClear
                            onClear={handleClearSearch}
                            enterButton="Cari"
                        />
                    </div>

                    <div className="text-xs text-muted-foreground">
                        Total:{' '}
                        <span className="font-semibold text-foreground">
                            {profiles.total}
                        </span>{' '}
                        profile
                    </div>
                </div>

                {/* Profiles Table */}
                <Card className="border shadow-xs overflow-hidden">
                    <CardContent className="p-0">
                        <div className="overflow-x-auto">
                            <table className="w-full text-left text-xs">
                                <thead className="border-b bg-muted/40 font-medium text-muted-foreground">
                                    <tr>
                                        <th className="px-4 py-3 text-center w-12">NO</th>
                                        <th className="px-4 py-3 min-w-[200px]">NAMA LENGKAP</th>
                                        <th className="px-4 py-3 min-w-[160px]">KONTAK</th>
                                        <th className="px-4 py-3 min-w-[220px]">SOSIAL MEDIA & FOLLOWER</th>
                                        <th className="px-4 py-3 min-w-[130px]">TANGGAL & BULAN LAHIR</th>
                                        <th className="px-4 py-3 min-w-[160px]">UKURAN GEAR</th>
                                        <th className="px-4 py-3 text-right w-28">AKSI</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-border/60">
                                    {profiles.data.length === 0 ? (
                                        <tr>
                                            <td colSpan={7} className="py-12 text-center text-muted-foreground">
                                                <div className="flex flex-col items-center justify-center gap-2">
                                                    <Users className="size-8 text-muted-foreground/40" />
                                                    <p className="font-medium">Belum ada data profile sosial media.</p>
                                                    <p className="text-xs text-muted-foreground/80">
                                                        Klik tombol "Tambah Profile" di atas untuk menambahkan data baru.
                                                    </p>
                                                </div>
                                            </td>
                                        </tr>
                                    ) : (
                                        profiles.data.map((profile, idx) => {
                                            const rowNumber = (profiles.current_page - 1) * profiles.per_page + idx + 1;
                                            return (
                                                <tr key={profile.id} className="hover:bg-muted/30 transition-colors">
                                                    {/* NO */}
                                                    <td className="px-4 py-3 text-center font-mono text-muted-foreground">
                                                        {rowNumber}
                                                    </td>

                                                    {/* Nama Lengkap */}
                                                    <td className="px-4 py-3">
                                                        <div className="flex items-center gap-2.5">
                                                            <div className="flex size-8 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary font-bold text-xs uppercase">
                                                                {profile.nama_lengkap.charAt(0)}
                                                            </div>
                                                            <div className="min-w-0">
                                                                <button
                                                                    type="button"
                                                                    onClick={() => setViewDetailProfile(profile)}
                                                                    className="font-medium text-foreground hover:text-primary transition-colors text-left line-clamp-1 cursor-pointer"
                                                                >
                                                                    {profile.nama_lengkap}
                                                                </button>
                                                                {profile.domisili && (
                                                                    <div className="flex items-center gap-1 text-[11px] text-muted-foreground mt-0.5">
                                                                        <MapPin className="size-3 text-muted-foreground/60" />
                                                                        <span className="truncate">{profile.domisili}</span>
                                                                    </div>
                                                                )}
                                                            </div>
                                                        </div>
                                                    </td>

                                                    {/* Kontak */}
                                                    <td className="px-4 py-3">
                                                        <div className="space-y-0.5 text-[11.5px]">
                                                            {profile.no_hp ? (
                                                                <div className="flex items-center gap-1.5 text-foreground">
                                                                    <Phone className="size-3 text-emerald-600 shrink-0" />
                                                                    <span>{profile.no_hp}</span>
                                                                </div>
                                                            ) : null}
                                                            {profile.email ? (
                                                                <div className="flex items-center gap-1.5 text-muted-foreground truncate">
                                                                    <Mail className="size-3 text-blue-500 shrink-0" />
                                                                    <span className="truncate">{profile.email}</span>
                                                                </div>
                                                            ) : null}
                                                            {!profile.no_hp && !profile.email && (
                                                                <span className="text-muted-foreground italic">-</span>
                                                            )}
                                                        </div>
                                                    </td>

                                                    {/* Sosial Media & Follower */}
                                                    <td className="px-4 py-3">
                                                        <div className="flex flex-wrap items-center gap-1.5">
                                                            {/* YouTube */}
                                                            {profile.link_youtube && (
                                                                <a
                                                                    href={profile.link_youtube}
                                                                    target="_blank"
                                                                    rel="noopener noreferrer"
                                                                    className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-md bg-red-500/10 text-red-600 hover:bg-red-500/20 text-[10.5px] font-medium transition-colors"
                                                                    title={`YouTube: ${formatFollower(profile.total_subscribe_youtube)} subscriber`}
                                                                >
                                                                    <span>YT</span>
                                                                    <span className="font-semibold">{formatFollower(profile.total_subscribe_youtube)}</span>
                                                                </a>
                                                            )}

                                                            {/* Instagram */}
                                                            {profile.link_instagram && (
                                                                <a
                                                                    href={profile.link_instagram}
                                                                    target="_blank"
                                                                    rel="noopener noreferrer"
                                                                    className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-md bg-pink-500/10 text-pink-600 hover:bg-pink-500/20 text-[10.5px] font-medium transition-colors"
                                                                    title={`Instagram: ${formatFollower(profile.total_follower_ig)} follower`}
                                                                >
                                                                    <span>IG</span>
                                                                    <span className="font-semibold">{formatFollower(profile.total_follower_ig)}</span>
                                                                </a>
                                                            )}

                                                            {/* TikTok */}
                                                            {profile.link_tiktok && (
                                                                <a
                                                                    href={profile.link_tiktok}
                                                                    target="_blank"
                                                                    rel="noopener noreferrer"
                                                                    className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-md bg-slate-800/10 text-slate-800 dark:bg-slate-200/10 dark:text-slate-200 hover:bg-slate-800/20 text-[10.5px] font-medium transition-colors"
                                                                    title={`TikTok: ${formatFollower(profile.total_follower_tiktok)} follower`}
                                                                >
                                                                    <span>TT</span>
                                                                    <span className="font-semibold">{formatFollower(profile.total_follower_tiktok)}</span>
                                                                </a>
                                                            )}

                                                            {/* Facebook */}
                                                            {profile.link_facebook && (
                                                                <a
                                                                    href={profile.link_facebook}
                                                                    target="_blank"
                                                                    rel="noopener noreferrer"
                                                                    className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-md bg-blue-600/10 text-blue-600 hover:bg-blue-600/20 text-[10.5px] font-medium transition-colors"
                                                                    title={`Facebook: ${formatFollower(profile.total_follower_fb)} follower`}
                                                                >
                                                                    <span>FB</span>
                                                                    <span className="font-semibold">{formatFollower(profile.total_follower_fb)}</span>
                                                                </a>
                                                            )}

                                                            {!profile.link_youtube && !profile.link_instagram && !profile.link_tiktok && !profile.link_facebook && (
                                                                <span className="text-muted-foreground italic text-[11px]">Belum ada sosmed</span>
                                                            )}
                                                        </div>
                                                    </td>

                                                    {/* Lahir & Domisili */}
                                                    <td className="px-4 py-3">
                                                        <div className="space-y-0.5 text-[11px]">
                                                            {(profile.tanggal_lahir || profile.bulan_lahir) ? (
                                                                <div className="flex items-center gap-1 text-foreground">
                                                                    <Calendar className="size-3 text-muted-foreground/70 shrink-0" />
                                                                    <span>
                                                                        {profile.tanggal_lahir ? `${profile.tanggal_lahir} ` : ''}
                                                                        {profile.bulan_lahir || ''}
                                                                    </span>
                                                                </div>
                                                            ) : (
                                                                <span className="text-muted-foreground">-</span>
                                                            )}
                                                        </div>
                                                    </td>

                                                    {/* Ukuran Gear */}
                                                    <td className="px-4 py-3">
                                                        <div className="flex flex-wrap items-center gap-1">
                                                            {profile.ukuran_helm && (
                                                                <AntTag color="default" className="text-[10px] m-0 px-1 py-0">
                                                                    H: {profile.ukuran_helm}
                                                                </AntTag>
                                                            )}
                                                            {profile.ukuran_jaket && (
                                                                <AntTag color="default" className="text-[10px] m-0 px-1 py-0">
                                                                    J: {profile.ukuran_jaket}
                                                                </AntTag>
                                                            )}
                                                            {profile.ukuran_sarung_tangan && (
                                                                <AntTag color="default" className="text-[10px] m-0 px-1 py-0">
                                                                    ST: {profile.ukuran_sarung_tangan}
                                                                </AntTag>
                                                            )}
                                                            {profile.ukuran_sepatu && (
                                                                <AntTag color="default" className="text-[10px] m-0 px-1 py-0">
                                                                    S: {profile.ukuran_sepatu}
                                                                </AntTag>
                                                            )}
                                                            {!profile.ukuran_helm && !profile.ukuran_jaket && !profile.ukuran_sarung_tangan && !profile.ukuran_sepatu && (
                                                                <span className="text-muted-foreground italic text-[11px]">-</span>
                                                            )}
                                                        </div>
                                                    </td>

                                                    {/* Aksi */}
                                                    <td className="px-4 py-3 text-right">
                                                        <div className="flex items-center justify-end gap-1">
                                                            <Button
                                                                type="button"
                                                                variant="ghost"
                                                                size="sm"
                                                                onClick={() => setViewDetailProfile(profile)}
                                                                className="h-7 w-7 p-0 text-muted-foreground hover:text-foreground cursor-pointer"
                                                                title="Lihat detail profile"
                                                            >
                                                                <Eye className="size-3.5" />
                                                            </Button>
                                                            <Button
                                                                type="button"
                                                                variant="ghost"
                                                                size="sm"
                                                                onClick={() => handleOpenEdit(profile)}
                                                                className="h-7 w-7 p-0 text-muted-foreground hover:text-foreground cursor-pointer"
                                                                title="Ubah profile"
                                                            >
                                                                <Edit2 className="size-3.5" />
                                                            </Button>
                                                            <Button
                                                                type="button"
                                                                variant="ghost"
                                                                size="sm"
                                                                onClick={() => handleOpenDelete(profile)}
                                                                className="h-7 w-7 p-0 text-muted-foreground hover:text-rose-600 cursor-pointer"
                                                                title="Hapus profile"
                                                            >
                                                                <Trash2 className="size-3.5" />
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
                        {profiles.links.length > 3 && (
                            <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between px-4 py-3 border-t">
                                <div className="text-xs text-muted-foreground">
                                    Menampilkan{' '}
                                    <span className="font-semibold text-foreground">
                                        {(profiles.current_page - 1) * profiles.per_page + 1}
                                    </span>{' '}
                                    -{' '}
                                    <span className="font-semibold text-foreground">
                                        {Math.min(profiles.current_page * profiles.per_page, profiles.total)}
                                    </span>{' '}
                                    dari <span className="font-semibold text-foreground">{profiles.total}</span> profile
                                </div>
                                <Pagination links={profiles.links} />
                            </div>
                        )}
                    </CardContent>
                </Card>
            </div>

            {/* Modal Tambah Profile */}
            <AntModal
                title={
                    <div className="flex items-center gap-2 text-base font-semibold">
                        <UserCircle className="size-5 text-primary" />
                        <span>Tambah Profile Baru</span>
                    </div>
                }
                open={isCreateOpen}
                onCancel={() => setIsCreateOpen(false)}
                footer={null}
                width={780}
                destroyOnClose
            >
                <form onSubmit={handleSubmitCreate} className="space-y-4 pt-2 text-xs">
                    {/* Section 1: Data Diri & Kontak */}
                    <div className="rounded-lg border bg-muted/20 p-3.5 space-y-3">
                        <h3 className="font-semibold text-xs text-foreground flex items-center gap-1.5">
                            <span className="flex size-5 items-center justify-center rounded-full bg-primary text-white text-[10px]">1</span>
                            Data Diri & Kontak
                        </h3>

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                            <div className="md:col-span-2 space-y-1">
                                <Label htmlFor="c-nama" className="text-xs font-medium">
                                    Nama Lengkap <span className="text-rose-500">*</span>
                                </Label>
                                <Input
                                    id="c-nama"
                                    value={createForm.data.nama_lengkap}
                                    onChange={(e) => createForm.setData('nama_lengkap', e.target.value)}
                                    placeholder="Contoh: Budi Pratama"
                                    required
                                    className="h-8 text-xs bg-background"
                                />
                                <InputError message={createForm.errors.nama_lengkap} />
                            </div>

                            <div className="space-y-1">
                                <Label htmlFor="c-nohp" className="text-xs font-medium">No HP / WhatsApp</Label>
                                <Input
                                    id="c-nohp"
                                    value={createForm.data.no_hp}
                                    onChange={(e) => createForm.setData('no_hp', e.target.value)}
                                    placeholder="Contoh: 08123456789"
                                    className="h-8 text-xs bg-background"
                                />
                                <InputError message={createForm.errors.no_hp} />
                            </div>

                            <div className="space-y-1">
                                <Label htmlFor="c-email" className="text-xs font-medium">Email</Label>
                                <Input
                                    id="c-email"
                                    type="email"
                                    value={createForm.data.email}
                                    onChange={(e) => createForm.setData('email', e.target.value)}
                                    placeholder="Contoh: budi@gmail.com"
                                    className="h-8 text-xs bg-background"
                                />
                                <InputError message={createForm.errors.email} />
                            </div>

                            <div className="space-y-1">
                                <Label className="text-xs font-medium">Tanggal Lahir</Label>
                                <AntSelect
                                    placeholder="Pilih tanggal (1-31)"
                                    value={createForm.data.tanggal_lahir}
                                    onChange={(val) => createForm.setData('tanggal_lahir', val)}
                                    options={DATE_OPTIONS}
                                    allowClear
                                    className="w-full text-xs"
                                    size="small"
                                    {...dialogSelectProps}
                                />
                                <InputError message={createForm.errors.tanggal_lahir} />
                            </div>

                            <div className="space-y-1">
                                <Label className="text-xs font-medium">Bulan Lahir</Label>
                                <AntSelect
                                    placeholder="Pilih bulan"
                                    value={createForm.data.bulan_lahir || undefined}
                                    onChange={(val) => createForm.setData('bulan_lahir', val || '')}
                                    options={MONTH_OPTIONS}
                                    allowClear
                                    className="w-full text-xs"
                                    size="small"
                                    {...dialogSelectProps}
                                />
                                <InputError message={createForm.errors.bulan_lahir} />
                            </div>

                            <div className="space-y-1">
                                <Label htmlFor="c-domisili" className="text-xs font-medium">Domisili (Kota/Kab)</Label>
                                <Input
                                    id="c-domisili"
                                    value={createForm.data.domisili}
                                    onChange={(e) => createForm.setData('domisili', e.target.value)}
                                    placeholder="Contoh: Kota Mataram"
                                    className="h-8 text-xs bg-background"
                                />
                                <InputError message={createForm.errors.domisili} />
                            </div>

                            <div className="space-y-1">
                                <Label htmlFor="c-alamat" className="text-xs font-medium">Alamat Rumah</Label>
                                <Input
                                    id="c-alamat"
                                    value={createForm.data.alamat_rumah}
                                    onChange={(e) => createForm.setData('alamat_rumah', e.target.value)}
                                    placeholder="Alamat lengkap tempat tinggal"
                                    className="h-8 text-xs bg-background"
                                />
                                <InputError message={createForm.errors.alamat_rumah} />
                            </div>
                        </div>
                    </div>

                    {/* Section 2: Sosial Media & Follower */}
                    <div className="rounded-lg border bg-muted/20 p-3.5 space-y-3">
                        <h3 className="font-semibold text-xs text-foreground flex items-center gap-1.5">
                            <span className="flex size-5 items-center justify-center rounded-full bg-primary text-white text-[10px]">2</span>
                            Akun Sosial Media & Follower
                        </h3>

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                            {/* YouTube */}
                            <div className="space-y-1">
                                <Label htmlFor="c-yt" className="text-xs font-medium text-red-600 dark:text-red-400">Link YouTube</Label>
                                <Input
                                    id="c-yt"
                                    value={createForm.data.link_youtube}
                                    onChange={(e) => createForm.setData('link_youtube', e.target.value)}
                                    placeholder="https://youtube.com/@channel"
                                    className="h-8 text-xs bg-background"
                                />
                                <InputError message={createForm.errors.link_youtube} />
                            </div>
                            <div className="space-y-1">
                                <Label htmlFor="c-sub-yt" className="text-xs font-medium text-red-600 dark:text-red-400">Total Subscribe YouTube</Label>
                                <Input
                                    id="c-sub-yt"
                                    type="number"
                                    min="0"
                                    value={createForm.data.total_subscribe_youtube}
                                    onChange={(e) => createForm.setData('total_subscribe_youtube', e.target.value)}
                                    placeholder="Contoh: 15000"
                                    className="h-8 text-xs bg-background"
                                />
                                <InputError message={createForm.errors.total_subscribe_youtube} />
                            </div>

                            {/* Instagram */}
                            <div className="space-y-1">
                                <Label htmlFor="c-ig" className="text-xs font-medium text-pink-600 dark:text-pink-400">Link Instagram</Label>
                                <Input
                                    id="c-ig"
                                    value={createForm.data.link_instagram}
                                    onChange={(e) => createForm.setData('link_instagram', e.target.value)}
                                    placeholder="https://instagram.com/username"
                                    className="h-8 text-xs bg-background"
                                />
                                <InputError message={createForm.errors.link_instagram} />
                            </div>
                            <div className="space-y-1">
                                <Label htmlFor="c-fol-ig" className="text-xs font-medium text-pink-600 dark:text-pink-400">Total Follower IG</Label>
                                <Input
                                    id="c-fol-ig"
                                    type="number"
                                    min="0"
                                    value={createForm.data.total_follower_ig}
                                    onChange={(e) => createForm.setData('total_follower_ig', e.target.value)}
                                    placeholder="Contoh: 25000"
                                    className="h-8 text-xs bg-background"
                                />
                                <InputError message={createForm.errors.total_follower_ig} />
                            </div>

                            {/* TikTok */}
                            <div className="space-y-1">
                                <Label htmlFor="c-tt" className="text-xs font-medium">Link TikTok</Label>
                                <Input
                                    id="c-tt"
                                    value={createForm.data.link_tiktok}
                                    onChange={(e) => createForm.setData('link_tiktok', e.target.value)}
                                    placeholder="https://tiktok.com/@username"
                                    className="h-8 text-xs bg-background"
                                />
                                <InputError message={createForm.errors.link_tiktok} />
                            </div>
                            <div className="space-y-1">
                                <Label htmlFor="c-fol-tt" className="text-xs font-medium">Total Follower TikTok</Label>
                                <Input
                                    id="c-fol-tt"
                                    type="number"
                                    min="0"
                                    value={createForm.data.total_follower_tiktok}
                                    onChange={(e) => createForm.setData('total_follower_tiktok', e.target.value)}
                                    placeholder="Contoh: 50000"
                                    className="h-8 text-xs bg-background"
                                />
                                <InputError message={createForm.errors.total_follower_tiktok} />
                            </div>

                            {/* Facebook */}
                            <div className="space-y-1">
                                <Label htmlFor="c-fb" className="text-xs font-medium text-blue-600 dark:text-blue-400">Link Facebook</Label>
                                <Input
                                    id="c-fb"
                                    value={createForm.data.link_facebook}
                                    onChange={(e) => createForm.setData('link_facebook', e.target.value)}
                                    placeholder="https://facebook.com/username"
                                    className="h-8 text-xs bg-background"
                                />
                                <InputError message={createForm.errors.link_facebook} />
                            </div>
                            <div className="space-y-1">
                                <Label htmlFor="c-fol-fb" className="text-xs font-medium text-blue-600 dark:text-blue-400">Total Follower FB</Label>
                                <Input
                                    id="c-fol-fb"
                                    type="number"
                                    min="0"
                                    value={createForm.data.total_follower_fb}
                                    onChange={(e) => createForm.setData('total_follower_fb', e.target.value)}
                                    placeholder="Contoh: 8000"
                                    className="h-8 text-xs bg-background"
                                />
                                <InputError message={createForm.errors.total_follower_fb} />
                            </div>
                        </div>
                    </div>

                    {/* Section 3: Ukuran Perlengkapan (Gear Size) */}
                    <div className="rounded-lg border bg-muted/20 p-3.5 space-y-3">
                        <h3 className="font-semibold text-xs text-foreground flex items-center gap-1.5">
                            <span className="flex size-5 items-center justify-center rounded-full bg-primary text-white text-[10px]">3</span>
                            Ukuran Perlengkapan (Apparel & Gear)
                        </h3>

                        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                            <div className="space-y-1">
                                <Label className="text-xs font-medium">Uk Helm</Label>
                                <AntSelect
                                    placeholder="Pilih ukuran"
                                    value={createForm.data.ukuran_helm || undefined}
                                    onChange={(val) => createForm.setData('ukuran_helm', val || '')}
                                    options={HELMET_SIZES.map((s) => ({ value: s, label: s }))}
                                    allowClear
                                    className="w-full text-xs"
                                    size="small"
                                    {...dialogSelectProps}
                                />
                                <InputError message={createForm.errors.ukuran_helm} />
                            </div>

                            <div className="space-y-1">
                                <Label className="text-xs font-medium">Uk Jaket</Label>
                                <AntSelect
                                    placeholder="Pilih ukuran"
                                    value={createForm.data.ukuran_jaket || undefined}
                                    onChange={(val) => createForm.setData('ukuran_jaket', val || '')}
                                    options={JACKET_SIZES.map((s) => ({ value: s, label: s }))}
                                    allowClear
                                    className="w-full text-xs"
                                    size="small"
                                    {...dialogSelectProps}
                                />
                                <InputError message={createForm.errors.ukuran_jaket} />
                            </div>

                            <div className="space-y-1">
                                <Label className="text-xs font-medium">Uk Sarung Tangan</Label>
                                <AntSelect
                                    placeholder="Pilih ukuran"
                                    value={createForm.data.ukuran_sarung_tangan || undefined}
                                    onChange={(val) => createForm.setData('ukuran_sarung_tangan', val || '')}
                                    options={GLOVE_SIZES.map((s) => ({ value: s, label: s }))}
                                    allowClear
                                    className="w-full text-xs"
                                    size="small"
                                    {...dialogSelectProps}
                                />
                                <InputError message={createForm.errors.ukuran_sarung_tangan} />
                            </div>

                            <div className="space-y-1">
                                <Label className="text-xs font-medium">Uk Sepatu</Label>
                                <AntSelect
                                    placeholder="Pilih ukuran"
                                    value={createForm.data.ukuran_sepatu || undefined}
                                    onChange={(val) => createForm.setData('ukuran_sepatu', val || '')}
                                    options={SHOE_SIZES.map((s) => ({ value: s, label: s }))}
                                    allowClear
                                    className="w-full text-xs"
                                    size="small"
                                    {...dialogSelectProps}
                                />
                                <InputError message={createForm.errors.ukuran_sepatu} />
                            </div>
                        </div>
                    </div>

                    <div className="flex justify-end gap-2 pt-2">
                        <AntButton onClick={() => setIsCreateOpen(false)}>
                            Batal
                        </AntButton>
                        <AntButton
                            type="primary"
                            htmlType="submit"
                            loading={createForm.processing}
                        >
                            Simpan Profile
                        </AntButton>
                    </div>
                </form>
            </AntModal>

            {/* Modal Edit Profile */}
            <AntModal
                title={
                    <div className="flex items-center gap-2 text-base font-semibold">
                        <Edit2 className="size-4 text-primary" />
                        <span>Ubah Profile: {selectedProfile?.nama_lengkap}</span>
                    </div>
                }
                open={isEditOpen}
                onCancel={() => setIsEditOpen(false)}
                footer={null}
                width={780}
                destroyOnClose
            >
                <form onSubmit={handleSubmitEdit} className="space-y-4 pt-2 text-xs">
                    {/* Section 1: Data Diri & Kontak */}
                    <div className="rounded-lg border bg-muted/20 p-3.5 space-y-3">
                        <h3 className="font-semibold text-xs text-foreground flex items-center gap-1.5">
                            <span className="flex size-5 items-center justify-center rounded-full bg-primary text-white text-[10px]">1</span>
                            Data Diri & Kontak
                        </h3>

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                            <div className="md:col-span-2 space-y-1">
                                <Label htmlFor="e-nama" className="text-xs font-medium">
                                    Nama Lengkap <span className="text-rose-500">*</span>
                                </Label>
                                <Input
                                    id="e-nama"
                                    value={editForm.data.nama_lengkap}
                                    onChange={(e) => editForm.setData('nama_lengkap', e.target.value)}
                                    placeholder="Nama Lengkap"
                                    required
                                    className="h-8 text-xs bg-background"
                                />
                                <InputError message={editForm.errors.nama_lengkap} />
                            </div>

                            <div className="space-y-1">
                                <Label htmlFor="e-nohp" className="text-xs font-medium">No HP / WhatsApp</Label>
                                <Input
                                    id="e-nohp"
                                    value={editForm.data.no_hp}
                                    onChange={(e) => editForm.setData('no_hp', e.target.value)}
                                    placeholder="Contoh: 08123456789"
                                    className="h-8 text-xs bg-background"
                                />
                                <InputError message={editForm.errors.no_hp} />
                            </div>

                            <div className="space-y-1">
                                <Label htmlFor="e-email" className="text-xs font-medium">Email</Label>
                                <Input
                                    id="e-email"
                                    type="email"
                                    value={editForm.data.email}
                                    onChange={(e) => editForm.setData('email', e.target.value)}
                                    placeholder="Contoh: budi@gmail.com"
                                    className="h-8 text-xs bg-background"
                                />
                                <InputError message={editForm.errors.email} />
                            </div>

                            <div className="space-y-1">
                                <Label className="text-xs font-medium">Tanggal Lahir</Label>
                                <AntSelect
                                    placeholder="Pilih tanggal (1-31)"
                                    value={editForm.data.tanggal_lahir}
                                    onChange={(val) => editForm.setData('tanggal_lahir', val)}
                                    options={DATE_OPTIONS}
                                    allowClear
                                    className="w-full text-xs"
                                    size="small"
                                    {...dialogSelectProps}
                                />
                                <InputError message={editForm.errors.tanggal_lahir} />
                            </div>

                            <div className="space-y-1">
                                <Label className="text-xs font-medium">Bulan Lahir</Label>
                                <AntSelect
                                    placeholder="Pilih bulan"
                                    value={editForm.data.bulan_lahir || undefined}
                                    onChange={(val) => editForm.setData('bulan_lahir', val || '')}
                                    options={MONTH_OPTIONS}
                                    allowClear
                                    className="w-full text-xs"
                                    size="small"
                                    {...dialogSelectProps}
                                />
                                <InputError message={editForm.errors.bulan_lahir} />
                            </div>

                            <div className="space-y-1">
                                <Label htmlFor="e-domisili" className="text-xs font-medium">Domisili (Kota/Kab)</Label>
                                <Input
                                    id="e-domisili"
                                    value={editForm.data.domisili}
                                    onChange={(e) => editForm.setData('domisili', e.target.value)}
                                    placeholder="Contoh: Kota Mataram"
                                    className="h-8 text-xs bg-background"
                                />
                                <InputError message={editForm.errors.domisili} />
                            </div>

                            <div className="space-y-1">
                                <Label htmlFor="e-alamat" className="text-xs font-medium">Alamat Rumah</Label>
                                <Input
                                    id="e-alamat"
                                    value={editForm.data.alamat_rumah}
                                    onChange={(e) => editForm.setData('alamat_rumah', e.target.value)}
                                    placeholder="Alamat lengkap tempat tinggal"
                                    className="h-8 text-xs bg-background"
                                />
                                <InputError message={editForm.errors.alamat_rumah} />
                            </div>
                        </div>
                    </div>

                    {/* Section 2: Sosial Media & Follower */}
                    <div className="rounded-lg border bg-muted/20 p-3.5 space-y-3">
                        <h3 className="font-semibold text-xs text-foreground flex items-center gap-1.5">
                            <span className="flex size-5 items-center justify-center rounded-full bg-primary text-white text-[10px]">2</span>
                            Akun Sosial Media & Follower
                        </h3>

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                            {/* YouTube */}
                            <div className="space-y-1">
                                <Label htmlFor="e-yt" className="text-xs font-medium text-red-600 dark:text-red-400">Link YouTube</Label>
                                <Input
                                    id="e-yt"
                                    value={editForm.data.link_youtube}
                                    onChange={(e) => editForm.setData('link_youtube', e.target.value)}
                                    placeholder="https://youtube.com/@channel"
                                    className="h-8 text-xs bg-background"
                                />
                                <InputError message={editForm.errors.link_youtube} />
                            </div>
                            <div className="space-y-1">
                                <Label htmlFor="e-sub-yt" className="text-xs font-medium text-red-600 dark:text-red-400">Total Subscribe YouTube</Label>
                                <Input
                                    id="e-sub-yt"
                                    type="number"
                                    min="0"
                                    value={editForm.data.total_subscribe_youtube}
                                    onChange={(e) => editForm.setData('total_subscribe_youtube', e.target.value)}
                                    placeholder="Contoh: 15000"
                                    className="h-8 text-xs bg-background"
                                />
                                <InputError message={editForm.errors.total_subscribe_youtube} />
                            </div>

                            {/* Instagram */}
                            <div className="space-y-1">
                                <Label htmlFor="e-ig" className="text-xs font-medium text-pink-600 dark:text-pink-400">Link Instagram</Label>
                                <Input
                                    id="e-ig"
                                    value={editForm.data.link_instagram}
                                    onChange={(e) => editForm.setData('link_instagram', e.target.value)}
                                    placeholder="https://instagram.com/username"
                                    className="h-8 text-xs bg-background"
                                />
                                <InputError message={editForm.errors.link_instagram} />
                            </div>
                            <div className="space-y-1">
                                <Label htmlFor="e-fol-ig" className="text-xs font-medium text-pink-600 dark:text-pink-400">Total Follower IG</Label>
                                <Input
                                    id="e-fol-ig"
                                    type="number"
                                    min="0"
                                    value={editForm.data.total_follower_ig}
                                    onChange={(e) => editForm.setData('total_follower_ig', e.target.value)}
                                    placeholder="Contoh: 25000"
                                    className="h-8 text-xs bg-background"
                                />
                                <InputError message={editForm.errors.total_follower_ig} />
                            </div>

                            {/* TikTok */}
                            <div className="space-y-1">
                                <Label htmlFor="e-tt" className="text-xs font-medium">Link TikTok</Label>
                                <Input
                                    id="e-tt"
                                    value={editForm.data.link_tiktok}
                                    onChange={(e) => editForm.setData('link_tiktok', e.target.value)}
                                    placeholder="https://tiktok.com/@username"
                                    className="h-8 text-xs bg-background"
                                />
                                <InputError message={editForm.errors.link_tiktok} />
                            </div>
                            <div className="space-y-1">
                                <Label htmlFor="e-fol-tt" className="text-xs font-medium">Total Follower TikTok</Label>
                                <Input
                                    id="e-fol-tt"
                                    type="number"
                                    min="0"
                                    value={editForm.data.total_follower_tiktok}
                                    onChange={(e) => editForm.setData('total_follower_tiktok', e.target.value)}
                                    placeholder="Contoh: 50000"
                                    className="h-8 text-xs bg-background"
                                />
                                <InputError message={editForm.errors.total_follower_tiktok} />
                            </div>

                            {/* Facebook */}
                            <div className="space-y-1">
                                <Label htmlFor="e-fb" className="text-xs font-medium text-blue-600 dark:text-blue-400">Link Facebook</Label>
                                <Input
                                    id="e-fb"
                                    value={editForm.data.link_facebook}
                                    onChange={(e) => editForm.setData('link_facebook', e.target.value)}
                                    placeholder="https://facebook.com/username"
                                    className="h-8 text-xs bg-background"
                                />
                                <InputError message={editForm.errors.link_facebook} />
                            </div>
                            <div className="space-y-1">
                                <Label htmlFor="e-fol-fb" className="text-xs font-medium text-blue-600 dark:text-blue-400">Total Follower FB</Label>
                                <Input
                                    id="e-fol-fb"
                                    type="number"
                                    min="0"
                                    value={editForm.data.total_follower_fb}
                                    onChange={(e) => editForm.setData('total_follower_fb', e.target.value)}
                                    placeholder="Contoh: 8000"
                                    className="h-8 text-xs bg-background"
                                />
                                <InputError message={editForm.errors.total_follower_fb} />
                            </div>
                        </div>
                    </div>

                    {/* Section 3: Ukuran Perlengkapan (Gear Size) */}
                    <div className="rounded-lg border bg-muted/20 p-3.5 space-y-3">
                        <h3 className="font-semibold text-xs text-foreground flex items-center gap-1.5">
                            <span className="flex size-5 items-center justify-center rounded-full bg-primary text-white text-[10px]">3</span>
                            Ukuran Perlengkapan (Apparel & Gear)
                        </h3>

                        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                            <div className="space-y-1">
                                <Label className="text-xs font-medium">Uk Helm</Label>
                                <AntSelect
                                    placeholder="Pilih ukuran"
                                    value={editForm.data.ukuran_helm || undefined}
                                    onChange={(val) => editForm.setData('ukuran_helm', val || '')}
                                    options={HELMET_SIZES.map((s) => ({ value: s, label: s }))}
                                    allowClear
                                    className="w-full text-xs"
                                    size="small"
                                    {...dialogSelectProps}
                                />
                                <InputError message={editForm.errors.ukuran_helm} />
                            </div>

                            <div className="space-y-1">
                                <Label className="text-xs font-medium">Uk Jaket</Label>
                                <AntSelect
                                    placeholder="Pilih ukuran"
                                    value={editForm.data.ukuran_jaket || undefined}
                                    onChange={(val) => editForm.setData('ukuran_jaket', val || '')}
                                    options={JACKET_SIZES.map((s) => ({ value: s, label: s }))}
                                    allowClear
                                    className="w-full text-xs"
                                    size="small"
                                    {...dialogSelectProps}
                                />
                                <InputError message={editForm.errors.ukuran_jaket} />
                            </div>

                            <div className="space-y-1">
                                <Label className="text-xs font-medium">Uk Sarung Tangan</Label>
                                <AntSelect
                                    placeholder="Pilih ukuran"
                                    value={editForm.data.ukuran_sarung_tangan || undefined}
                                    onChange={(val) => editForm.setData('ukuran_sarung_tangan', val || '')}
                                    options={GLOVE_SIZES.map((s) => ({ value: s, label: s }))}
                                    allowClear
                                    className="w-full text-xs"
                                    size="small"
                                    {...dialogSelectProps}
                                />
                                <InputError message={editForm.errors.ukuran_sarung_tangan} />
                            </div>

                            <div className="space-y-1">
                                <Label className="text-xs font-medium">Uk Sepatu</Label>
                                <AntSelect
                                    placeholder="Pilih ukuran"
                                    value={editForm.data.ukuran_sepatu || undefined}
                                    onChange={(val) => editForm.setData('ukuran_sepatu', val || '')}
                                    options={SHOE_SIZES.map((s) => ({ value: s, label: s }))}
                                    allowClear
                                    className="w-full text-xs"
                                    size="small"
                                    {...dialogSelectProps}
                                />
                                <InputError message={editForm.errors.ukuran_sepatu} />
                            </div>
                        </div>
                    </div>

                    <div className="flex justify-end gap-2 pt-2">
                        <AntButton onClick={() => setIsEditOpen(false)}>
                            Batal
                        </AntButton>
                        <AntButton
                            type="primary"
                            htmlType="submit"
                            loading={editForm.processing}
                        >
                            Simpan Perubahan
                        </AntButton>
                    </div>
                </form>
            </AntModal>

            {/* Modal Detail Profile */}
            <Dialog
                open={Boolean(viewDetailProfile)}
                onOpenChange={(open) => !open && setViewDetailProfile(null)}
            >
                <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
                    <DialogHeader>
                        <div className="flex items-center gap-3">
                            <div className="flex size-11 items-center justify-center rounded-full bg-primary/10 text-primary font-bold text-base uppercase">
                                {viewDetailProfile?.nama_lengkap.charAt(0)}
                            </div>
                            <div>
                                <DialogTitle className="text-lg font-bold">
                                    {viewDetailProfile?.nama_lengkap}
                                </DialogTitle>
                                <DialogDescription className="text-xs flex items-center gap-2 mt-0.5">
                                    {viewDetailProfile?.domisili && (
                                        <span className="flex items-center gap-1 text-muted-foreground">
                                            <MapPin className="size-3" />
                                            {viewDetailProfile.domisili}
                                        </span>
                                    )}
                                    {viewDetailProfile?.no_hp && (
                                        <span className="flex items-center gap-1 text-emerald-600 font-medium">
                                            <Phone className="size-3" />
                                            {viewDetailProfile.no_hp}
                                        </span>
                                    )}
                                </DialogDescription>
                            </div>
                        </div>
                    </DialogHeader>

                    {viewDetailProfile && (
                        <div className="space-y-4 py-2 text-xs">
                            {/* Card Sosial Media */}
                            <div className="space-y-2">
                                <Label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                                    Statistik Sosial Media
                                </Label>
                                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                                    {/* YouTube */}
                                    <div className="rounded-lg border bg-red-500/5 border-red-500/20 p-2.5 space-y-1">
                                        <div className="flex items-center justify-between text-[11px] text-red-600 font-semibold">
                                            <span>YouTube</span>
                                            {viewDetailProfile.link_youtube && (
                                                <a
                                                    href={viewDetailProfile.link_youtube}
                                                    target="_blank"
                                                    rel="noopener noreferrer"
                                                    className="hover:underline"
                                                >
                                                    <ExternalLink className="size-3" />
                                                </a>
                                            )}
                                        </div>
                                        <div className="text-base font-bold text-foreground">
                                            {formatFollower(viewDetailProfile.total_subscribe_youtube)}
                                        </div>
                                        <div className="text-[10px] text-muted-foreground">Subscriber</div>
                                    </div>

                                    {/* Instagram */}
                                    <div className="rounded-lg border bg-pink-500/5 border-pink-500/20 p-2.5 space-y-1">
                                        <div className="flex items-center justify-between text-[11px] text-pink-600 font-semibold">
                                            <span>Instagram</span>
                                            {viewDetailProfile.link_instagram && (
                                                <a
                                                    href={viewDetailProfile.link_instagram}
                                                    target="_blank"
                                                    rel="noopener noreferrer"
                                                    className="hover:underline"
                                                >
                                                    <ExternalLink className="size-3" />
                                                </a>
                                            )}
                                        </div>
                                        <div className="text-base font-bold text-foreground">
                                            {formatFollower(viewDetailProfile.total_follower_ig)}
                                        </div>
                                        <div className="text-[10px] text-muted-foreground">Follower</div>
                                    </div>

                                    {/* TikTok */}
                                    <div className="rounded-lg border bg-slate-500/5 border-slate-500/20 p-2.5 space-y-1">
                                        <div className="flex items-center justify-between text-[11px] font-semibold text-foreground">
                                            <span>TikTok</span>
                                            {viewDetailProfile.link_tiktok && (
                                                <a
                                                    href={viewDetailProfile.link_tiktok}
                                                    target="_blank"
                                                    rel="noopener noreferrer"
                                                    className="hover:underline"
                                                >
                                                    <ExternalLink className="size-3" />
                                                </a>
                                            )}
                                        </div>
                                        <div className="text-base font-bold text-foreground">
                                            {formatFollower(viewDetailProfile.total_follower_tiktok)}
                                        </div>
                                        <div className="text-[10px] text-muted-foreground">Follower</div>
                                    </div>

                                    {/* Facebook */}
                                    <div className="rounded-lg border bg-blue-500/5 border-blue-500/20 p-2.5 space-y-1">
                                        <div className="flex items-center justify-between text-[11px] text-blue-600 font-semibold">
                                            <span>Facebook</span>
                                            {viewDetailProfile.link_facebook && (
                                                <a
                                                    href={viewDetailProfile.link_facebook}
                                                    target="_blank"
                                                    rel="noopener noreferrer"
                                                    className="hover:underline"
                                                >
                                                    <ExternalLink className="size-3" />
                                                </a>
                                            )}
                                        </div>
                                        <div className="text-base font-bold text-foreground">
                                            {formatFollower(viewDetailProfile.total_follower_fb)}
                                        </div>
                                        <div className="text-[10px] text-muted-foreground">Follower</div>
                                    </div>
                                </div>
                            </div>

                            {/* Card Ukuran Gear / Riding Equipment */}
                            <div className="space-y-2">
                                <Label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                                    Ukuran Perlengkapan (Riding Gear)
                                </Label>
                                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                                    <div className="rounded-lg border bg-muted/20 p-2.5 text-center">
                                        <div className="text-[10px] text-muted-foreground uppercase font-medium">Uk Helm</div>
                                        <div className="text-sm font-bold text-foreground mt-0.5">
                                            {viewDetailProfile.ukuran_helm || '-'}
                                        </div>
                                    </div>
                                    <div className="rounded-lg border bg-muted/20 p-2.5 text-center">
                                        <div className="text-[10px] text-muted-foreground uppercase font-medium">Uk Jaket</div>
                                        <div className="text-sm font-bold text-foreground mt-0.5">
                                            {viewDetailProfile.ukuran_jaket || '-'}
                                        </div>
                                    </div>
                                    <div className="rounded-lg border bg-muted/20 p-2.5 text-center">
                                        <div className="text-[10px] text-muted-foreground uppercase font-medium">Uk Sarung Tangan</div>
                                        <div className="text-sm font-bold text-foreground mt-0.5">
                                            {viewDetailProfile.ukuran_sarung_tangan || '-'}
                                        </div>
                                    </div>
                                    <div className="rounded-lg border bg-muted/20 p-2.5 text-center">
                                        <div className="text-[10px] text-muted-foreground uppercase font-medium">Uk Sepatu</div>
                                        <div className="text-sm font-bold text-foreground mt-0.5">
                                            {viewDetailProfile.ukuran_sepatu || '-'}
                                        </div>
                                    </div>
                                </div>
                            </div>

                            {/* Card Informasi Personal */}
                            <div className="space-y-2">
                                <Label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                                    Informasi Pribadi & Kontak
                                </Label>
                                <div className="rounded-lg border bg-muted/10 divide-y text-xs">
                                    <div className="grid grid-cols-3 p-2.5">
                                        <span className="text-muted-foreground">Email:</span>
                                        <span className="col-span-2 font-medium">{viewDetailProfile.email || '-'}</span>
                                    </div>
                                    <div className="grid grid-cols-3 p-2.5">
                                        <span className="text-muted-foreground">No HP / WA:</span>
                                        <span className="col-span-2 font-medium">{viewDetailProfile.no_hp || '-'}</span>
                                    </div>
                                    <div className="grid grid-cols-3 p-2.5">
                                        <span className="text-muted-foreground">Tanggal & Bulan Lahir:</span>
                                        <span className="col-span-2 font-medium">
                                            {(viewDetailProfile.tanggal_lahir || viewDetailProfile.bulan_lahir)
                                                ? `${viewDetailProfile.tanggal_lahir ? viewDetailProfile.tanggal_lahir + ' ' : ''}${viewDetailProfile.bulan_lahir || ''}`
                                                : '-'}
                                        </span>
                                    </div>
                                    <div className="grid grid-cols-3 p-2.5">
                                        <span className="text-muted-foreground">Domisili:</span>
                                        <span className="col-span-2 font-medium">{viewDetailProfile.domisili || '-'}</span>
                                    </div>
                                    <div className="grid grid-cols-3 p-2.5">
                                        <span className="text-muted-foreground">Alamat Rumah:</span>
                                        <span className="col-span-2 font-medium leading-relaxed">{viewDetailProfile.alamat_rumah || '-'}</span>
                                    </div>
                                </div>
                            </div>
                        </div>
                    )}

                    <DialogFooter>
                        <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            onClick={() => setViewDetailProfile(null)}
                        >
                            Tutup
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            {/* Modal Import Excel */}
            <Dialog open={isImportOpen} onOpenChange={setIsImportOpen}>
                <DialogContent className="max-w-lg">
                    <DialogHeader>
                        <DialogTitle className="flex items-center gap-2">
                            <FileSpreadsheet className="size-5 text-emerald-600" />
                            Import Profile dari Excel / CSV
                        </DialogTitle>
                        <DialogDescription className="text-xs">
                            Unggah berkas spreadsheet Excel (.xlsx, .xls) atau CSV untuk memasukkan atau memperbarui profil sosial media secara massal.
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
                                href={socialMediaProfileRoute.template.url()}
                                download="template_social_media_profile.xlsx"
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
                                    className={`flex cursor-pointer flex-col items-center justify-center rounded-lg border-2 border-dashed p-6 text-center transition-colors ${isDragging
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
                                    <strong className="text-foreground">Nama Lengkap</strong>: Wajib diisi (contoh: <code className="rounded bg-muted px-1">Budi Pratama</code>).
                                </li>
                                <li>
                                    <strong className="text-foreground">Sosial Media & Follower</strong>: Link & total follower/subscriber Youtube, Instagram, TikTok, dan Facebook.
                                </li>
                                <li>
                                    <strong className="text-foreground">No HP & Email</strong>: Kontak talent/influencer.
                                </li>
                                <li>
                                    <strong className="text-foreground">Tanggal & Bulan Lahir</strong>: Tanggal (1-31) dan nama bulan (Januari-Desember).
                                </li>
                                <li>
                                    <strong className="text-foreground">Ukuran Gear</strong>: Ukuran helm, jaket, sarung tangan, dan sepatu.
                                </li>
                                <li>
                                    <strong className="text-foreground">Alamat & Domisili</strong>: Alamat rumah dan kota/kabupaten domisili.
                                </li>
                            </ul>
                        </div>

                        {/* Checkbox Update Existing */}
                        <div className="flex items-start space-x-2 pt-1">
                            <Checkbox
                                id="update_existing"
                                checked={importForm.data.update_existing}
                                onCheckedChange={(checked) =>
                                    importForm.setData('update_existing', checked === true)
                                }
                                className="mt-0.5"
                            />
                            <div className="space-y-0.5">
                                <Label
                                    htmlFor="update_existing"
                                    className="cursor-pointer text-xs font-medium text-foreground"
                                >
                                    Perbarui data jika profil sudah ada
                                </Label>
                                <p className="text-[11px] text-muted-foreground">
                                    Jika dicentang, profil yang cocok berdasarkan nama lengkap, email, atau no HP akan diperbarui data terbarunya.
                                </p>
                            </div>
                        </div>

                        <DialogFooter className="pt-2">
                            <DialogClose asChild>
                                <Button
                                    type="button"
                                    variant="outline"
                                    disabled={importForm.processing}
                                >
                                    Batal
                                </Button>
                            </DialogClose>
                            <Button
                                type="submit"
                                disabled={!importForm.data.file || importForm.processing}
                                className="bg-primary text-primary-foreground hover:bg-primary/90"
                            >
                                {importForm.processing ? (
                                    <>
                                        <LoaderCircle className="mr-2 size-4 animate-spin" />
                                        Mengimpor...
                                    </>
                                ) : (
                                    'Mulai Import'
                                )}
                            </Button>
                        </DialogFooter>
                    </form>
                </DialogContent>
            </Dialog>

            {/* Modal Konfirmasi Hapus */}
            <Dialog open={isDeleteOpen} onOpenChange={setIsDeleteOpen}>
                <DialogContent className="max-w-md">
                    <DialogHeader>
                        <DialogTitle className="text-rose-600">Hapus Profile</DialogTitle>
                        <DialogDescription className="text-xs pt-1">
                            Apakah Anda yakin ingin menghapus profile{' '}
                            <strong>{selectedProfile?.nama_lengkap}</strong>? Tindakan ini tidak dapat dibatalkan.
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
                            Ya, Hapus Profile
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </>
    );
}

SocialMediaProfilesIndex.layout = {
    breadcrumbs: [
        {
            title: 'Dashboard GBP',
            href: dashboard(),
        },
        {
            title: 'Sosial Media Monitoring',
            href: socialMediaProfileRoute.index(),
        },
        {
            title: 'Profile',
            href: socialMediaProfileRoute.index(),
        },
    ],
};

