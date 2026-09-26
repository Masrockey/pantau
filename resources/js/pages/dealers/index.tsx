import { Head, router, useForm } from '@inertiajs/react';
import {
    AlertCircle,
    Building2,
    Download,
    Edit2,
    ExternalLink,
    FileSpreadsheet,
    MapPin,
    Phone,
    Plus,
    Search,
    Star,
    Trash2,
    Upload,
    X,
} from 'lucide-react';
import React, { useState } from 'react';
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
import { cn } from '@/lib/utils';
import { dashboard } from '@/routes';
import dealersRoute from '@/routes/dealers';
import type { Dealer, PaginatedData } from '@/types';

interface DealersIndexProps {
    dealers: PaginatedData<Dealer>;
    filters: {
        search?: string;
    };
    canManageAll?: boolean;
}

export default function DealersIndex({
    dealers,
    filters,
    canManageAll = true,
}: DealersIndexProps) {
    const [search, setSearch] = useState(filters.search || '');
    const [isCreateOpen, setIsCreateOpen] = useState(false);
    const [isEditOpen, setIsEditOpen] = useState(false);
    const [isDeleteOpen, setIsDeleteOpen] = useState(false);
    const [isImportOpen, setIsImportOpen] = useState(false);
    const [isDragging, setIsDragging] = useState(false);
    const [selectedDealer, setSelectedDealer] = useState<Dealer | null>(null);
    const fileInputRef = React.useRef<HTMLInputElement>(null);

    const createForm = useForm({
        kode_dealer: '',
        nama_dealer: '',
        link_google_maps: '',
        latitude: '',
        longitude: '',
        alamat: '',
        kelurahan: '',
        kecamatan: '',
        pos_code: '',
        no_telp_showroom: '',
        star_rate: '',
        total_review: '',
    });

    const editForm = useForm({
        kode_dealer: '',
        nama_dealer: '',
        link_google_maps: '',
        latitude: '',
        longitude: '',
        alamat: '',
        kelurahan: '',
        kecamatan: '',
        pos_code: '',
        no_telp_showroom: '',
        star_rate: '',
        total_review: '',
    });

    const importForm = useForm<{
        file: File | null;
        update_existing: boolean;
    }>({
        file: null,
        update_existing: true,
    });

    const handleSearch = (e: React.FormEvent) => {
        e.preventDefault();
        router.get(
            dealersRoute.index.url(),
            { search: search || undefined },
            { preserveState: true, replace: true },
        );
    };

    const handleClearSearch = () => {
        setSearch('');
        router.get(
            dealersRoute.index.url(),
            {},
            { preserveState: true, replace: true },
        );
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

        importForm.post(dealersRoute.import.url(), {
            forceFormData: true,
            onSuccess: () => {
                setIsImportOpen(false);
                importForm.reset();
            },
        });
    };

    const handleOpenCreate = () => {
        createForm.reset();
        createForm.clearErrors();
        createForm.setData({
            kode_dealer: '',
            nama_dealer: '',
            link_google_maps: '',
            latitude: '',
            longitude: '',
            alamat: '',
            kelurahan: '',
            kecamatan: '',
            pos_code: '',
            no_telp_showroom: '',
            star_rate: '',
            total_review: '',
        });
        setIsCreateOpen(true);
    };

    const handleSubmitCreate = (e: React.FormEvent) => {
        e.preventDefault();
        createForm.post(dealersRoute.store.url(), {
            onSuccess: () => {
                setIsCreateOpen(false);
                createForm.reset();
            },
        });
    };

    const handleOpenEdit = (dealer: Dealer) => {
        setSelectedDealer(dealer);
        editForm.clearErrors();
        editForm.setData({
            kode_dealer: dealer.kode_dealer,
            nama_dealer: dealer.nama_dealer,
            link_google_maps: dealer.link_google_maps || '',
            latitude:
                dealer.latitude !== null && dealer.latitude !== undefined
                    ? String(dealer.latitude)
                    : '',
            longitude:
                dealer.longitude !== null && dealer.longitude !== undefined
                    ? String(dealer.longitude)
                    : '',
            alamat: dealer.alamat || '',
            kelurahan: dealer.kelurahan || '',
            kecamatan: dealer.kecamatan || '',
            pos_code: dealer.pos_code || '',
            no_telp_showroom: dealer.no_telp_showroom || '',
            star_rate:
                dealer.star_rate !== null && dealer.star_rate !== undefined
                    ? String(dealer.star_rate)
                    : '',
            total_review:
                dealer.total_review !== null &&
                dealer.total_review !== undefined
                    ? String(dealer.total_review)
                    : '',
        });
        setIsEditOpen(true);
    };

    const handleSubmitEdit = (e: React.FormEvent) => {
        e.preventDefault();
        if (!selectedDealer) return;

        editForm.put(dealersRoute.update.url(selectedDealer.id), {
            onSuccess: () => {
                setIsEditOpen(false);
                setSelectedDealer(null);
            },
        });
    };

    const handleOpenDelete = (dealer: Dealer) => {
        setSelectedDealer(dealer);
        setIsDeleteOpen(true);
    };

    const handleSubmitDelete = () => {
        if (!selectedDealer) return;

        router.delete(dealersRoute.destroy.url(selectedDealer.id), {
            onSuccess: () => {
                setIsDeleteOpen(false);
                setSelectedDealer(null);
            },
        });
    };

    return (
        <>
            <Head title="Menu Dealer" />

            <div className="flex h-full flex-1 flex-col gap-6 p-4 md:p-6">
                {/* Header Section */}
                <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
                    <div>
                        <h1 className="flex items-center gap-2 text-2xl font-bold tracking-tight text-foreground">
                            <Building2 className="size-6 text-primary" />
                            Menu Dealer
                        </h1>
                        <p className="mt-1 text-sm text-muted-foreground">
                            Kelola data master dealer, kontak showroom, rating,
                            alamat, dan link Google Maps.
                        </p>
                    </div>

                    {canManageAll && (
                        <div className="flex flex-wrap items-center gap-2">
                            <Button
                                variant="outline"
                                onClick={handleOpenImport}
                                className="shrink-0 gap-2 border-emerald-600/30 text-emerald-700 hover:bg-emerald-50 hover:text-emerald-800 dark:border-emerald-500/30 dark:text-emerald-400 dark:hover:bg-emerald-950/40"
                            >
                                <Upload className="size-4 text-emerald-600 dark:text-emerald-400" />
                                Import Excel
                            </Button>
                            <Button
                                onClick={handleOpenCreate}
                                className="shrink-0 gap-2"
                            >
                                <Plus className="size-4" />
                                Tambah Dealer
                            </Button>
                        </div>
                    )}
                </div>

                {/* Filter and Search Bar */}
                <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                    <form
                        onSubmit={handleSearch}
                        className="relative max-w-md flex-1"
                    >
                        <Search className="absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" />
                        <Input
                            type="text"
                            placeholder="Cari kode, nama, alamat, kelurahan, atau no telp..."
                            value={search}
                            onChange={(e) => setSearch(e.target.value)}
                            className="pr-8 pl-9"
                        />
                        {search && (
                            <button
                                type="button"
                                onClick={handleClearSearch}
                                className="absolute top-1/2 right-2.5 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                            >
                                <X className="size-4" />
                            </button>
                        )}
                    </form>

                    <div className="text-xs text-muted-foreground">
                        Total:{' '}
                        <span className="font-semibold text-foreground">
                            {dealers.total}
                        </span>{' '}
                        dealer
                    </div>
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
                                        Kode Dealer
                                    </th>
                                    <th className="px-3 py-3.5 whitespace-nowrap">
                                        Nama Dealer
                                    </th>
                                    <th className="px-3 py-3.5 whitespace-nowrap">
                                        Star Rate
                                    </th>
                                    <th className="px-3 py-3.5 whitespace-nowrap">
                                        Total Review
                                    </th>
                                    <th className="px-3 py-3.5 whitespace-nowrap">
                                        No Telp Showroom
                                    </th>
                                    <th className="min-w-[200px] px-3 py-3.5">
                                        Alamat
                                    </th>
                                    <th className="px-3 py-3.5 whitespace-nowrap">
                                        Kelurahan
                                    </th>
                                    <th className="px-3 py-3.5 whitespace-nowrap">
                                        Kecamatan
                                    </th>
                                    <th className="px-3 py-3.5 whitespace-nowrap">
                                        Pos Code
                                    </th>
                                    <th className="px-3 py-3.5 whitespace-nowrap">
                                        Latitude
                                    </th>
                                    <th className="px-3 py-3.5 whitespace-nowrap">
                                        Longitude
                                    </th>
                                    <th className="px-3 py-3.5 whitespace-nowrap">
                                        Link Google Maps
                                    </th>
                                    <th className="px-3 py-3.5 text-right whitespace-nowrap">
                                        Aksi
                                    </th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-sidebar-border/50 dark:divide-sidebar-border">
                                {dealers.data.length === 0 ? (
                                    <tr>
                                        <td
                                            colSpan={14}
                                            className="py-12 text-center text-muted-foreground"
                                        >
                                            <div className="flex flex-col items-center justify-center gap-2">
                                                <Building2 className="size-10 text-muted-foreground/40" />
                                                <p className="font-medium text-foreground">
                                                    Tidak ada data dealer
                                                </p>
                                                <p className="text-xs">
                                                    {search
                                                        ? 'Tidak ditemukan dealer dengan kata kunci tersebut.'
                                                        : 'Belum ada dealer yang ditambahkan.'}
                                                </p>
                                                {search && (
                                                    <Button
                                                        variant="outline"
                                                        size="sm"
                                                        onClick={
                                                            handleClearSearch
                                                        }
                                                        className="mt-2"
                                                    >
                                                        Reset Pencarian
                                                    </Button>
                                                )}
                                            </div>
                                        </td>
                                    </tr>
                                ) : (
                                    dealers.data.map((dealer, index) => {
                                        const rowNumber =
                                            (dealers.current_page - 1) *
                                                dealers.per_page +
                                            index +
                                            1;
                                        return (
                                            <tr
                                                key={dealer.id}
                                                className="transition-colors hover:bg-muted/40"
                                            >
                                                <td className="px-3 py-3.5 text-center font-mono text-xs text-muted-foreground">
                                                    {rowNumber}
                                                </td>
                                                <td className="px-3 py-3.5 font-medium whitespace-nowrap">
                                                    <Badge
                                                        variant="outline"
                                                        className="font-mono tracking-wide"
                                                    >
                                                        {dealer.kode_dealer}
                                                    </Badge>
                                                </td>
                                                <td className="px-3 py-3.5 font-medium whitespace-nowrap text-foreground">
                                                    {dealer.nama_dealer}
                                                </td>
                                                <td className="px-3 py-3.5 whitespace-nowrap">
                                                    {dealer.star_rate !==
                                                        null &&
                                                    dealer.star_rate !==
                                                        undefined ? (
                                                        <span className="inline-flex items-center gap-1 font-semibold text-amber-600 dark:text-amber-400">
                                                            <Star className="size-3.5 fill-amber-400 text-amber-500" />
                                                            {Number(
                                                                dealer.star_rate,
                                                            ).toFixed(1)}
                                                        </span>
                                                    ) : (
                                                        <span className="text-xs text-muted-foreground italic">
                                                            -
                                                        </span>
                                                    )}
                                                </td>
                                                <td className="px-3 py-3.5 text-xs whitespace-nowrap">
                                                    {dealer.total_review !==
                                                        null &&
                                                    dealer.total_review !==
                                                        undefined ? (
                                                        <span className="text-foreground">
                                                            {dealer.total_review.toLocaleString(
                                                                'id-ID',
                                                            )}
                                                        </span>
                                                    ) : (
                                                        <span className="text-xs text-muted-foreground italic">
                                                            -
                                                        </span>
                                                    )}
                                                </td>
                                                <td className="px-3 py-3.5 text-xs whitespace-nowrap">
                                                    {dealer.no_telp_showroom ? (
                                                        <a
                                                            href={`tel:${dealer.no_telp_showroom}`}
                                                            className="inline-flex items-center gap-1 text-primary hover:underline"
                                                        >
                                                            <Phone className="size-3 text-muted-foreground" />
                                                            <span>
                                                                {
                                                                    dealer.no_telp_showroom
                                                                }
                                                            </span>
                                                        </a>
                                                    ) : (
                                                        <span className="text-xs text-muted-foreground italic">
                                                            -
                                                        </span>
                                                    )}
                                                </td>
                                                <td
                                                    className="max-w-[260px] min-w-[180px] truncate px-3 py-3.5 text-xs text-foreground"
                                                    title={dealer.alamat || ''}
                                                >
                                                    {dealer.alamat || (
                                                        <span className="text-muted-foreground italic">
                                                            -
                                                        </span>
                                                    )}
                                                </td>
                                                <td className="px-3 py-3.5 text-xs whitespace-nowrap text-foreground">
                                                    {dealer.kelurahan || (
                                                        <span className="text-muted-foreground italic">
                                                            -
                                                        </span>
                                                    )}
                                                </td>
                                                <td className="px-3 py-3.5 text-xs whitespace-nowrap text-foreground">
                                                    {dealer.kecamatan || (
                                                        <span className="text-muted-foreground italic">
                                                            -
                                                        </span>
                                                    )}
                                                </td>
                                                <td className="px-3 py-3.5 font-mono text-xs whitespace-nowrap text-foreground">
                                                    {dealer.pos_code || (
                                                        <span className="text-muted-foreground italic">
                                                            -
                                                        </span>
                                                    )}
                                                </td>
                                                <td className="px-3 py-3.5 font-mono text-xs whitespace-nowrap">
                                                    {dealer.latitude !== null &&
                                                    dealer.latitude !==
                                                        undefined ? (
                                                        <span className="text-foreground">
                                                            {dealer.latitude}
                                                        </span>
                                                    ) : (
                                                        <span className="text-xs text-muted-foreground italic">
                                                            -
                                                        </span>
                                                    )}
                                                </td>
                                                <td className="px-3 py-3.5 font-mono text-xs whitespace-nowrap">
                                                    {dealer.longitude !==
                                                        null &&
                                                    dealer.longitude !==
                                                        undefined ? (
                                                        <span className="text-foreground">
                                                            {dealer.longitude}
                                                        </span>
                                                    ) : (
                                                        <span className="text-xs text-muted-foreground italic">
                                                            -
                                                        </span>
                                                    )}
                                                </td>
                                                <td className="px-3 py-3.5 whitespace-nowrap">
                                                    {dealer.link_google_maps ? (
                                                        <a
                                                            href={
                                                                dealer.link_google_maps
                                                            }
                                                            target="_blank"
                                                            rel="noopener noreferrer"
                                                            className="inline-flex items-center gap-1.5 rounded-md border border-sidebar-border/80 bg-background px-2.5 py-1 text-xs font-medium text-foreground shadow-2xs transition-colors hover:border-primary/50 hover:bg-accent hover:text-primary dark:border-sidebar-border"
                                                            title={
                                                                dealer.link_google_maps
                                                            }
                                                        >
                                                            <MapPin className="size-3.5 shrink-0 text-red-500" />
                                                            <span className="max-w-[140px] truncate">
                                                                Buka Maps
                                                            </span>
                                                            <ExternalLink className="size-3 shrink-0 text-muted-foreground" />
                                                        </a>
                                                    ) : dealer.latitude !==
                                                          null &&
                                                      dealer.longitude !==
                                                          null ? (
                                                        <a
                                                            href={`https://www.google.com/maps?q=${dealer.latitude},${dealer.longitude}`}
                                                            target="_blank"
                                                            rel="noopener noreferrer"
                                                            className="inline-flex items-center gap-1.5 rounded-md border border-sidebar-border/80 bg-background px-2.5 py-1 text-xs font-medium text-foreground shadow-2xs transition-colors hover:border-primary/50 hover:bg-accent hover:text-primary dark:border-sidebar-border"
                                                            title={`Buka koordinat ${dealer.latitude}, ${dealer.longitude}`}
                                                        >
                                                            <MapPin className="size-3.5 shrink-0 text-red-500" />
                                                            <span className="max-w-[140px] truncate">
                                                                Buka Maps
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
                                                    <div className="flex items-center justify-end gap-1.5">
                                                        <Button
                                                            variant="ghost"
                                                            size="sm"
                                                            onClick={() =>
                                                                handleOpenEdit(
                                                                    dealer,
                                                                )
                                                            }
                                                            className="h-8 px-2 text-muted-foreground hover:text-foreground"
                                                            title="Edit Dealer"
                                                        >
                                                            <Edit2 className="size-3.5" />
                                                            <span className="sr-only">
                                                                Edit
                                                            </span>
                                                        </Button>
                                                        {canManageAll && (
                                                            <Button
                                                                variant="ghost"
                                                                size="sm"
                                                                onClick={() =>
                                                                    handleOpenDelete(
                                                                        dealer,
                                                                    )
                                                                }
                                                                className="h-8 px-2 text-destructive/80 hover:bg-destructive/10 hover:text-destructive"
                                                                title="Hapus Dealer"
                                                            >
                                                                <Trash2 className="size-3.5" />
                                                                <span className="sr-only">
                                                                    Hapus
                                                                </span>
                                                            </Button>
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
                    {dealers.total > 0 && (
                        <div className="flex flex-col items-center justify-between gap-3 border-t border-sidebar-border/70 p-4 sm:flex-row dark:border-sidebar-border">
                            <p className="text-xs text-muted-foreground">
                                Menampilkan{' '}
                                <span className="font-medium text-foreground">
                                    {dealers.from ?? 0}
                                </span>{' '}
                                sampai{' '}
                                <span className="font-medium text-foreground">
                                    {dealers.to ?? 0}
                                </span>{' '}
                                dari{' '}
                                <span className="font-medium text-foreground">
                                    {dealers.total}
                                </span>{' '}
                                data
                            </p>
                            <Pagination links={dealers.links} />
                        </div>
                    )}
                </div>
            </div>

            {/* Modal Tambah Dealer */}
            <Dialog open={isCreateOpen} onOpenChange={setIsCreateOpen}>
                <DialogContent className="max-h-[85vh] overflow-y-auto sm:max-w-2xl">
                    <DialogHeader>
                        <DialogTitle>Tambah Dealer Baru</DialogTitle>
                        <DialogDescription>
                            Lengkapi informasi data master dealer, kontak
                            showroom, rating, alamat, dan titik lokasi koordinat
                            Google Maps.
                        </DialogDescription>
                    </DialogHeader>

                    <form
                        onSubmit={handleSubmitCreate}
                        className="space-y-4 py-2"
                    >
                        {/* Section 1: Identitas Dealer */}
                        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                            <div className="space-y-2">
                                <Label htmlFor="create_kode_dealer">
                                    Kode Dealer{' '}
                                    <span className="text-destructive">*</span>
                                </Label>
                                <Input
                                    id="create_kode_dealer"
                                    placeholder="Contoh: DLR001"
                                    value={createForm.data.kode_dealer}
                                    onChange={(e) =>
                                        createForm.setData(
                                            'kode_dealer',
                                            e.target.value.toUpperCase(),
                                        )
                                    }
                                    className={
                                        createForm.errors.kode_dealer
                                            ? 'border-destructive'
                                            : ''
                                    }
                                    autoFocus
                                />
                                <InputError
                                    message={createForm.errors.kode_dealer}
                                />
                            </div>

                            <div className="space-y-2">
                                <Label htmlFor="create_nama_dealer">
                                    Nama Dealer{' '}
                                    <span className="text-destructive">*</span>
                                </Label>
                                <Input
                                    id="create_nama_dealer"
                                    placeholder="Contoh: Dealer Nusantara Jakarta"
                                    value={createForm.data.nama_dealer}
                                    onChange={(e) =>
                                        createForm.setData(
                                            'nama_dealer',
                                            e.target.value,
                                        )
                                    }
                                    className={
                                        createForm.errors.nama_dealer
                                            ? 'border-destructive'
                                            : ''
                                    }
                                />
                                <InputError
                                    message={createForm.errors.nama_dealer}
                                />
                            </div>
                        </div>

                        {/* Section 2: Kontak & Review */}
                        <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
                            <div className="space-y-2">
                                <div className="flex items-center justify-between">
                                    <Label htmlFor="create_no_telp_showroom">
                                        No Telp Showroom
                                    </Label>
                                    <span className="text-[11px] text-muted-foreground italic">
                                        Opsional
                                    </span>
                                </div>
                                <Input
                                    id="create_no_telp_showroom"
                                    placeholder="Contoh: 021-5551234"
                                    value={createForm.data.no_telp_showroom}
                                    onChange={(e) =>
                                        createForm.setData(
                                            'no_telp_showroom',
                                            e.target.value,
                                        )
                                    }
                                    className={
                                        createForm.errors.no_telp_showroom
                                            ? 'border-destructive'
                                            : ''
                                    }
                                />
                                <InputError
                                    message={createForm.errors.no_telp_showroom}
                                />
                            </div>

                            <div className="space-y-2">
                                <div className="flex items-center justify-between">
                                    <Label htmlFor="create_star_rate">
                                        Star Rate (0 - 5)
                                    </Label>
                                    <span className="text-[11px] text-muted-foreground italic">
                                        Opsional
                                    </span>
                                </div>
                                <Input
                                    id="create_star_rate"
                                    type="number"
                                    step="0.01"
                                    min="0"
                                    max="5"
                                    placeholder="Contoh: 4.80"
                                    value={createForm.data.star_rate}
                                    onChange={(e) =>
                                        createForm.setData(
                                            'star_rate',
                                            e.target.value,
                                        )
                                    }
                                    className={
                                        createForm.errors.star_rate
                                            ? 'border-destructive'
                                            : ''
                                    }
                                />
                                <InputError
                                    message={createForm.errors.star_rate}
                                />
                            </div>

                            <div className="space-y-2">
                                <div className="flex items-center justify-between">
                                    <Label htmlFor="create_total_review">
                                        Total Review
                                    </Label>
                                    <span className="text-[11px] text-muted-foreground italic">
                                        Opsional
                                    </span>
                                </div>
                                <Input
                                    id="create_total_review"
                                    type="number"
                                    min="0"
                                    placeholder="Contoh: 120"
                                    value={createForm.data.total_review}
                                    onChange={(e) =>
                                        createForm.setData(
                                            'total_review',
                                            e.target.value,
                                        )
                                    }
                                    className={
                                        createForm.errors.total_review
                                            ? 'border-destructive'
                                            : ''
                                    }
                                />
                                <InputError
                                    message={createForm.errors.total_review}
                                />
                            </div>
                        </div>

                        {/* Section 3: Alamat Lengkap */}
                        <div className="space-y-2">
                            <div className="flex items-center justify-between">
                                <Label htmlFor="create_alamat">
                                    Alamat Lengkap
                                </Label>
                                <span className="text-[11px] text-muted-foreground italic">
                                    Opsional
                                </span>
                            </div>
                            <textarea
                                id="create_alamat"
                                rows={2}
                                placeholder="Contoh: Jl. Sudirman No. 123, Gedung Graha Lantai 1"
                                value={createForm.data.alamat}
                                onChange={(e) =>
                                    createForm.setData('alamat', e.target.value)
                                }
                                className={`flex w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm shadow-xs placeholder:text-muted-foreground focus-visible:ring-1 focus-visible:ring-ring focus-visible:outline-none disabled:cursor-not-allowed disabled:opacity-50 ${
                                    createForm.errors.alamat
                                        ? 'border-destructive'
                                        : ''
                                }`}
                            />
                            <InputError message={createForm.errors.alamat} />
                        </div>

                        {/* Section 4: Wilayah */}
                        <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
                            <div className="space-y-2">
                                <div className="flex items-center justify-between">
                                    <Label htmlFor="create_kelurahan">
                                        Kelurahan
                                    </Label>
                                    <span className="text-[11px] text-muted-foreground italic">
                                        Opsional
                                    </span>
                                </div>
                                <Input
                                    id="create_kelurahan"
                                    placeholder="Contoh: Menteng"
                                    value={createForm.data.kelurahan}
                                    onChange={(e) =>
                                        createForm.setData(
                                            'kelurahan',
                                            e.target.value,
                                        )
                                    }
                                    className={
                                        createForm.errors.kelurahan
                                            ? 'border-destructive'
                                            : ''
                                    }
                                />
                                <InputError
                                    message={createForm.errors.kelurahan}
                                />
                            </div>

                            <div className="space-y-2">
                                <div className="flex items-center justify-between">
                                    <Label htmlFor="create_kecamatan">
                                        Kecamatan
                                    </Label>
                                    <span className="text-[11px] text-muted-foreground italic">
                                        Opsional
                                    </span>
                                </div>
                                <Input
                                    id="create_kecamatan"
                                    placeholder="Contoh: Menteng"
                                    value={createForm.data.kecamatan}
                                    onChange={(e) =>
                                        createForm.setData(
                                            'kecamatan',
                                            e.target.value,
                                        )
                                    }
                                    className={
                                        createForm.errors.kecamatan
                                            ? 'border-destructive'
                                            : ''
                                    }
                                />
                                <InputError
                                    message={createForm.errors.kecamatan}
                                />
                            </div>

                            <div className="space-y-2">
                                <div className="flex items-center justify-between">
                                    <Label htmlFor="create_pos_code">
                                        Pos Code
                                    </Label>
                                    <span className="text-[11px] text-muted-foreground italic">
                                        Opsional
                                    </span>
                                </div>
                                <Input
                                    id="create_pos_code"
                                    placeholder="Contoh: 10310"
                                    value={createForm.data.pos_code}
                                    onChange={(e) =>
                                        createForm.setData(
                                            'pos_code',
                                            e.target.value,
                                        )
                                    }
                                    className={
                                        createForm.errors.pos_code
                                            ? 'border-destructive font-mono'
                                            : 'font-mono'
                                    }
                                />
                                <InputError
                                    message={createForm.errors.pos_code}
                                />
                            </div>
                        </div>

                        {/* Section 5: Link Google Maps & Koordinat */}
                        <div className="space-y-2">
                            <div className="flex items-center justify-between">
                                <Label htmlFor="create_link_google_maps">
                                    Link Google Maps
                                </Label>
                                <span className="text-[11px] text-muted-foreground italic">
                                    Opsional
                                </span>
                            </div>
                            <Input
                                id="create_link_google_maps"
                                placeholder="Contoh: https://maps.google.com/?q=..."
                                value={createForm.data.link_google_maps}
                                onChange={(e) =>
                                    createForm.setData(
                                        'link_google_maps',
                                        e.target.value,
                                    )
                                }
                                className={
                                    createForm.errors.link_google_maps
                                        ? 'border-destructive'
                                        : ''
                                }
                            />
                            <InputError
                                message={createForm.errors.link_google_maps}
                            />
                        </div>

                        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                            <div className="space-y-2">
                                <div className="flex items-center justify-between">
                                    <Label htmlFor="create_latitude">
                                        Latitude
                                    </Label>
                                    <span className="text-[11px] text-muted-foreground italic">
                                        Opsional
                                    </span>
                                </div>
                                <Input
                                    id="create_latitude"
                                    type="text"
                                    placeholder="Contoh: -6.200000"
                                    value={createForm.data.latitude}
                                    onChange={(e) =>
                                        createForm.setData(
                                            'latitude',
                                            e.target.value,
                                        )
                                    }
                                    className={
                                        createForm.errors.latitude
                                            ? 'border-destructive font-mono'
                                            : 'font-mono'
                                    }
                                />
                                <InputError
                                    message={createForm.errors.latitude}
                                />
                            </div>

                            <div className="space-y-2">
                                <div className="flex items-center justify-between">
                                    <Label htmlFor="create_longitude">
                                        Longitude
                                    </Label>
                                    <span className="text-[11px] text-muted-foreground italic">
                                        Opsional
                                    </span>
                                </div>
                                <Input
                                    id="create_longitude"
                                    type="text"
                                    placeholder="Contoh: 106.816666"
                                    value={createForm.data.longitude}
                                    onChange={(e) =>
                                        createForm.setData(
                                            'longitude',
                                            e.target.value,
                                        )
                                    }
                                    className={
                                        createForm.errors.longitude
                                            ? 'border-destructive font-mono'
                                            : 'font-mono'
                                    }
                                />
                                <InputError
                                    message={createForm.errors.longitude}
                                />
                            </div>
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
                                    : 'Simpan Dealer'}
                            </Button>
                        </DialogFooter>
                    </form>
                </DialogContent>
            </Dialog>

            {/* Modal Edit Dealer */}
            <Dialog open={isEditOpen} onOpenChange={setIsEditOpen}>
                <DialogContent className="max-h-[85vh] overflow-y-auto sm:max-w-2xl">
                    <DialogHeader>
                        <DialogTitle>Edit Dealer</DialogTitle>
                        <DialogDescription>
                            Perbarui informasi master dealer, kontak showroom,
                            rating, alamat, dan link Google Maps terpilih.
                        </DialogDescription>
                    </DialogHeader>

                    <form
                        onSubmit={handleSubmitEdit}
                        className="space-y-4 py-2"
                    >
                        {/* Section 1: Identitas Dealer */}
                        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                            <div className="space-y-2">
                                <Label htmlFor="edit_kode_dealer">
                                    Kode Dealer{' '}
                                    <span className="text-destructive">*</span>
                                </Label>
                                <Input
                                    id="edit_kode_dealer"
                                    placeholder="Contoh: DLR001"
                                    disabled={!canManageAll}
                                    value={editForm.data.kode_dealer}
                                    onChange={(e) =>
                                        editForm.setData(
                                            'kode_dealer',
                                            e.target.value.toUpperCase(),
                                        )
                                    }
                                    className={cn(
                                        editForm.errors.kode_dealer
                                            ? 'border-destructive'
                                            : '',
                                        !canManageAll
                                            ? 'cursor-not-allowed bg-muted'
                                            : '',
                                    )}
                                />
                                <InputError
                                    message={editForm.errors.kode_dealer}
                                />
                            </div>

                            <div className="space-y-2">
                                <Label htmlFor="edit_nama_dealer">
                                    Nama Dealer{' '}
                                    <span className="text-destructive">*</span>
                                </Label>
                                <Input
                                    id="edit_nama_dealer"
                                    placeholder="Contoh: Dealer Nusantara Jakarta"
                                    value={editForm.data.nama_dealer}
                                    onChange={(e) =>
                                        editForm.setData(
                                            'nama_dealer',
                                            e.target.value,
                                        )
                                    }
                                    className={
                                        editForm.errors.nama_dealer
                                            ? 'border-destructive'
                                            : ''
                                    }
                                />
                                <InputError
                                    message={editForm.errors.nama_dealer}
                                />
                            </div>
                        </div>

                        {/* Section 2: Kontak & Review */}
                        <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
                            <div className="space-y-2">
                                <div className="flex items-center justify-between">
                                    <Label htmlFor="edit_no_telp_showroom">
                                        No Telp Showroom
                                    </Label>
                                    <span className="text-[11px] text-muted-foreground italic">
                                        Opsional
                                    </span>
                                </div>
                                <Input
                                    id="edit_no_telp_showroom"
                                    placeholder="Contoh: 021-5551234"
                                    value={editForm.data.no_telp_showroom}
                                    onChange={(e) =>
                                        editForm.setData(
                                            'no_telp_showroom',
                                            e.target.value,
                                        )
                                    }
                                    className={
                                        editForm.errors.no_telp_showroom
                                            ? 'border-destructive'
                                            : ''
                                    }
                                />
                                <InputError
                                    message={editForm.errors.no_telp_showroom}
                                />
                            </div>

                            <div className="space-y-2">
                                <div className="flex items-center justify-between">
                                    <Label htmlFor="edit_star_rate">
                                        Star Rate (0 - 5)
                                    </Label>
                                    <span className="text-[11px] text-muted-foreground italic">
                                        Opsional
                                    </span>
                                </div>
                                <Input
                                    id="edit_star_rate"
                                    type="number"
                                    step="0.01"
                                    min="0"
                                    max="5"
                                    placeholder="Contoh: 4.80"
                                    value={editForm.data.star_rate}
                                    onChange={(e) =>
                                        editForm.setData(
                                            'star_rate',
                                            e.target.value,
                                        )
                                    }
                                    className={
                                        editForm.errors.star_rate
                                            ? 'border-destructive'
                                            : ''
                                    }
                                />
                                <InputError
                                    message={editForm.errors.star_rate}
                                />
                            </div>

                            <div className="space-y-2">
                                <div className="flex items-center justify-between">
                                    <Label htmlFor="edit_total_review">
                                        Total Review
                                    </Label>
                                    <span className="text-[11px] text-muted-foreground italic">
                                        Opsional
                                    </span>
                                </div>
                                <Input
                                    id="edit_total_review"
                                    type="number"
                                    min="0"
                                    placeholder="Contoh: 120"
                                    value={editForm.data.total_review}
                                    onChange={(e) =>
                                        editForm.setData(
                                            'total_review',
                                            e.target.value,
                                        )
                                    }
                                    className={
                                        editForm.errors.total_review
                                            ? 'border-destructive'
                                            : ''
                                    }
                                />
                                <InputError
                                    message={editForm.errors.total_review}
                                />
                            </div>
                        </div>

                        {/* Section 3: Alamat Lengkap */}
                        <div className="space-y-2">
                            <div className="flex items-center justify-between">
                                <Label htmlFor="edit_alamat">
                                    Alamat Lengkap
                                </Label>
                                <span className="text-[11px] text-muted-foreground italic">
                                    Opsional
                                </span>
                            </div>
                            <textarea
                                id="edit_alamat"
                                rows={2}
                                placeholder="Contoh: Jl. Sudirman No. 123, Gedung Graha Lantai 1"
                                value={editForm.data.alamat}
                                onChange={(e) =>
                                    editForm.setData('alamat', e.target.value)
                                }
                                className={`flex w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm shadow-xs placeholder:text-muted-foreground focus-visible:ring-1 focus-visible:ring-ring focus-visible:outline-none disabled:cursor-not-allowed disabled:opacity-50 ${
                                    editForm.errors.alamat
                                        ? 'border-destructive'
                                        : ''
                                }`}
                            />
                            <InputError message={editForm.errors.alamat} />
                        </div>

                        {/* Section 4: Wilayah */}
                        <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
                            <div className="space-y-2">
                                <div className="flex items-center justify-between">
                                    <Label htmlFor="edit_kelurahan">
                                        Kelurahan
                                    </Label>
                                    <span className="text-[11px] text-muted-foreground italic">
                                        Opsional
                                    </span>
                                </div>
                                <Input
                                    id="edit_kelurahan"
                                    placeholder="Contoh: Menteng"
                                    value={editForm.data.kelurahan}
                                    onChange={(e) =>
                                        editForm.setData(
                                            'kelurahan',
                                            e.target.value,
                                        )
                                    }
                                    className={
                                        editForm.errors.kelurahan
                                            ? 'border-destructive'
                                            : ''
                                    }
                                />
                                <InputError
                                    message={editForm.errors.kelurahan}
                                />
                            </div>

                            <div className="space-y-2">
                                <div className="flex items-center justify-between">
                                    <Label htmlFor="edit_kecamatan">
                                        Kecamatan
                                    </Label>
                                    <span className="text-[11px] text-muted-foreground italic">
                                        Opsional
                                    </span>
                                </div>
                                <Input
                                    id="edit_kecamatan"
                                    placeholder="Contoh: Menteng"
                                    value={editForm.data.kecamatan}
                                    onChange={(e) =>
                                        editForm.setData(
                                            'kecamatan',
                                            e.target.value,
                                        )
                                    }
                                    className={
                                        editForm.errors.kecamatan
                                            ? 'border-destructive'
                                            : ''
                                    }
                                />
                                <InputError
                                    message={editForm.errors.kecamatan}
                                />
                            </div>

                            <div className="space-y-2">
                                <div className="flex items-center justify-between">
                                    <Label htmlFor="edit_pos_code">
                                        Pos Code
                                    </Label>
                                    <span className="text-[11px] text-muted-foreground italic">
                                        Opsional
                                    </span>
                                </div>
                                <Input
                                    id="edit_pos_code"
                                    placeholder="Contoh: 10310"
                                    value={editForm.data.pos_code}
                                    onChange={(e) =>
                                        editForm.setData(
                                            'pos_code',
                                            e.target.value,
                                        )
                                    }
                                    className={
                                        editForm.errors.pos_code
                                            ? 'border-destructive font-mono'
                                            : 'font-mono'
                                    }
                                />
                                <InputError
                                    message={editForm.errors.pos_code}
                                />
                            </div>
                        </div>

                        {/* Section 5: Link Google Maps & Koordinat */}
                        <div className="space-y-2">
                            <div className="flex items-center justify-between">
                                <Label htmlFor="edit_link_google_maps">
                                    Link Google Maps
                                </Label>
                                <span className="text-[11px] text-muted-foreground italic">
                                    Opsional
                                </span>
                            </div>
                            <Input
                                id="edit_link_google_maps"
                                placeholder="Contoh: https://maps.google.com/?q=..."
                                value={editForm.data.link_google_maps}
                                onChange={(e) =>
                                    editForm.setData(
                                        'link_google_maps',
                                        e.target.value,
                                    )
                                }
                                className={
                                    editForm.errors.link_google_maps
                                        ? 'border-destructive'
                                        : ''
                                }
                            />
                            <InputError
                                message={editForm.errors.link_google_maps}
                            />
                        </div>

                        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                            <div className="space-y-2">
                                <div className="flex items-center justify-between">
                                    <Label htmlFor="edit_latitude">
                                        Latitude
                                    </Label>
                                    <span className="text-[11px] text-muted-foreground italic">
                                        Opsional
                                    </span>
                                </div>
                                <Input
                                    id="edit_latitude"
                                    type="text"
                                    placeholder="Contoh: -6.200000"
                                    value={editForm.data.latitude}
                                    onChange={(e) =>
                                        editForm.setData(
                                            'latitude',
                                            e.target.value,
                                        )
                                    }
                                    className={
                                        editForm.errors.latitude
                                            ? 'border-destructive font-mono'
                                            : 'font-mono'
                                    }
                                />
                                <InputError
                                    message={editForm.errors.latitude}
                                />
                            </div>

                            <div className="space-y-2">
                                <div className="flex items-center justify-between">
                                    <Label htmlFor="edit_longitude">
                                        Longitude
                                    </Label>
                                    <span className="text-[11px] text-muted-foreground italic">
                                        Opsional
                                    </span>
                                </div>
                                <Input
                                    id="edit_longitude"
                                    type="text"
                                    placeholder="Contoh: 106.816666"
                                    value={editForm.data.longitude}
                                    onChange={(e) =>
                                        editForm.setData(
                                            'longitude',
                                            e.target.value,
                                        )
                                    }
                                    className={
                                        editForm.errors.longitude
                                            ? 'border-destructive font-mono'
                                            : 'font-mono'
                                    }
                                />
                                <InputError
                                    message={editForm.errors.longitude}
                                />
                            </div>
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
                                    : 'Perbarui Dealer'}
                            </Button>
                        </DialogFooter>
                    </form>
                </DialogContent>
            </Dialog>

            {/* Modal Konfirmasi Hapus */}
            <Dialog open={isDeleteOpen} onOpenChange={setIsDeleteOpen}>
                <DialogContent className="sm:max-w-md">
                    <DialogHeader>
                        <DialogTitle className="flex items-center gap-2 text-destructive">
                            <AlertCircle className="size-5" />
                            Hapus Dealer
                        </DialogTitle>
                        <DialogDescription>
                            Apakah Anda yakin ingin menghapus dealer{' '}
                            <span className="font-semibold text-foreground">
                                {selectedDealer?.nama_dealer} (
                                {selectedDealer?.kode_dealer})
                            </span>
                            ? Tindakan ini tidak dapat dibatalkan.
                        </DialogDescription>
                    </DialogHeader>

                    {selectedDealer?.users_count &&
                    selectedDealer.users_count > 0 ? (
                        <div className="rounded-lg border border-amber-500/30 bg-amber-500/10 p-3 text-xs text-amber-700 dark:text-amber-400">
                            <strong>Perhatian:</strong> Dealer ini memiliki{' '}
                            {selectedDealer.users_count} user terdaftar. Anda
                            harus memindahkan atau menghapus user tersebut
                            sebelum menghapus dealer ini.
                        </div>
                    ) : null}

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
                            disabled={Boolean(
                                selectedDealer?.users_count &&
                                selectedDealer.users_count > 0,
                            )}
                        >
                            Hapus Sekarang
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            {/* Modal Import Dealer Excel */}
            <Dialog open={isImportOpen} onOpenChange={setIsImportOpen}>
                <DialogContent className="sm:max-w-lg">
                    <DialogHeader>
                        <DialogTitle className="flex items-center gap-2">
                            <FileSpreadsheet className="size-5 text-emerald-600 dark:text-emerald-400" />
                            Import Data Dealer Excel
                        </DialogTitle>
                        <DialogDescription>
                            Unggah file spreadsheet Excel (.xlsx) atau CSV untuk
                            menambahkan atau memperbarui data dealer sekaligus.
                        </DialogDescription>
                    </DialogHeader>

                    <form
                        onSubmit={handleSubmitImport}
                        className="space-y-4 py-2"
                    >
                        {/* Download Template Banner */}
                        <div className="flex items-center justify-between rounded-lg border border-sidebar-border/80 bg-muted/40 p-3">
                            <div className="space-y-0.5 pr-2">
                                <p className="text-xs font-semibold text-foreground">
                                    Belum memiliki format template Excel?
                                </p>
                                <p className="text-[11px] text-muted-foreground">
                                    Unduh template resmi dengan susunan kolom
                                    yang telah sesuai sistem.
                                </p>
                            </div>
                            <a
                                href={dealersRoute.template.url()}
                                download="template_dealer.xlsx"
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
                                    onClick={() =>
                                        fileInputRef.current?.click()
                                    }
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
                                        Klik untuk memilih file atau seret file
                                        ke sini
                                    </p>
                                    <p className="mt-1 text-[11px] text-muted-foreground">
                                        Mendukung file Excel .xlsx, .xls atau
                                        .csv (Maks. 10MB)
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
                                                {formatFileSize(
                                                    importForm.data.file.size,
                                                )}
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
                                    <strong className="text-foreground">
                                        Kode Dealer
                                    </strong>
                                    : Wajib diisi, kode unik dealer (contoh:{' '}
                                    <code className="rounded bg-muted px-1 font-mono">
                                        DLR001
                                    </code>
                                    ).
                                </li>
                                <li>
                                    <strong className="text-foreground">
                                        Nama Dealer
                                    </strong>
                                    : Wajib diisi (contoh:{' '}
                                    <code className="rounded bg-muted px-1">
                                        Dealer Nusantara Jakarta
                                    </code>
                                    ).
                                </li>
                                <li>
                                    <strong className="text-foreground">
                                        Star Rate
                                    </strong>
                                    : Opsional, rating bintang 0.00 - 5.00
                                    (contoh:{' '}
                                    <code className="rounded bg-muted px-1 font-mono">
                                        4.8
                                    </code>
                                    ).
                                </li>
                                <li>
                                    <strong className="text-foreground">
                                        Total Review
                                    </strong>
                                    : Opsional, total jumlah ulasan pelanggan
                                    (contoh:{' '}
                                    <code className="rounded bg-muted px-1 font-mono">
                                        120
                                    </code>
                                    ).
                                </li>
                                <li>
                                    <strong className="text-foreground">
                                        No Telp Showroom
                                    </strong>
                                    : Opsional, nomor telepon kantor/showroom
                                    (contoh:{' '}
                                    <code className="rounded bg-muted px-1 font-mono">
                                        021-5551234
                                    </code>
                                    ).
                                </li>
                                <li>
                                    <strong className="text-foreground">
                                        Alamat
                                    </strong>
                                    : Opsional, alamat lengkap showroom/dealer.
                                </li>
                                <li>
                                    <strong className="text-foreground">
                                        Kelurahan
                                    </strong>
                                    : Opsional, nama kelurahan.
                                </li>
                                <li>
                                    <strong className="text-foreground">
                                        Kecamatan
                                    </strong>
                                    : Opsional, nama kecamatan.
                                </li>
                                <li>
                                    <strong className="text-foreground">
                                        Pos Code
                                    </strong>
                                    : Opsional, kode pos (contoh:{' '}
                                    <code className="rounded bg-muted px-1 font-mono">
                                        10310
                                    </code>
                                    ).
                                </li>
                                <li>
                                    <strong className="text-foreground">
                                        Latitude
                                    </strong>
                                    : Opsional, koordinat garis lintang (contoh:{' '}
                                    <code className="rounded bg-muted px-1 font-mono">
                                        -6.200000
                                    </code>
                                    ).
                                </li>
                                <li>
                                    <strong className="text-foreground">
                                        Longitude
                                    </strong>
                                    : Opsional, koordinat garis bujur (contoh:{' '}
                                    <code className="rounded bg-muted px-1 font-mono">
                                        106.816666
                                    </code>
                                    ).
                                </li>
                                <li>
                                    <strong className="text-foreground">
                                        Link Google Maps
                                    </strong>
                                    : Opsional, tautan lokasi Google Maps
                                    (contoh:{' '}
                                    <code className="rounded bg-muted px-1">
                                        https://maps.google.com/?q=...
                                    </code>
                                    ).
                                </li>
                            </ul>
                        </div>

                        {/* Checkbox Update Existing */}
                        <div className="flex items-start space-x-2 pt-1">
                            <Checkbox
                                id="update_existing"
                                checked={importForm.data.update_existing}
                                onCheckedChange={(checked) =>
                                    importForm.setData(
                                        'update_existing',
                                        checked === true,
                                    )
                                }
                                className="mt-0.5"
                            />
                            <div className="space-y-0.5">
                                <Label
                                    htmlFor="update_existing"
                                    className="cursor-pointer text-xs font-medium text-foreground"
                                >
                                    Perbarui data jika kode dealer sudah ada
                                </Label>
                                <p className="text-[11px] text-muted-foreground">
                                    Jika dicentang, dealer dengan kode yang sama
                                    akan diperbarui data nama, kontak, alamat,
                                    rating, dan tautan lokasinya.
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
                                disabled={
                                    !importForm.data.file ||
                                    importForm.processing
                                }
                            >
                                {importForm.processing
                                    ? 'Mengimpor...'
                                    : 'Mulai Import'}
                            </Button>
                        </DialogFooter>
                    </form>
                </DialogContent>
            </Dialog>
        </>
    );
}

DealersIndex.layout = {
    breadcrumbs: [
        {
            title: 'Dashboard',
            href: dashboard(),
        },
        {
            title: 'Dealer',
            href: dealersRoute.index(),
        },
    ],
};
