import { Head, router, useForm, usePage } from '@inertiajs/react';
import {
    AlertCircle,
    Building2,
    Edit2,
    Filter,
    Plus,
    Search,
    Shield,
    Trash2,
    UserCheck,
    Users,
    X,
} from 'lucide-react';
import React, { useState } from 'react';
import InputError from '@/components/input-error';
import { Pagination } from '@/components/pagination';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
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
import { useInitials } from '@/hooks/use-initials';
import { cn } from '@/lib/utils';
import { dashboard } from '@/routes';
import usersRoute from '@/routes/users';
import type { Auth, Dealer, PaginatedData, User, UserRole } from '@/types';

interface RoleOption {
    value: string;
    label: string;
}

interface UsersIndexProps {
    users: PaginatedData<User>;
    dealers: Pick<Dealer, 'id' | 'kode_dealer' | 'nama_dealer'>[];
    roles: RoleOption[];
    filters: {
        search?: string;
        role?: string;
        dealer_id?: string;
    };
}

export default function UsersIndex({
    users,
    dealers,
    roles,
    filters,
}: UsersIndexProps) {
    const { auth } = usePage<{ auth: Auth }>().props;
    const currentUserId = auth?.user?.id;
    const getInitials = useInitials();

    const [search, setSearch] = useState(filters.search || '');
    const [roleFilter, setRoleFilter] = useState(filters.role || '');
    const [dealerFilter, setDealerFilter] = useState(filters.dealer_id || '');

    const [isCreateOpen, setIsCreateOpen] = useState(false);
    const [isEditOpen, setIsEditOpen] = useState(false);
    const [isDeleteOpen, setIsDeleteOpen] = useState(false);
    const [selectedUser, setSelectedUser] = useState<User | null>(null);

    const createForm = useForm({
        name: '',
        email: '',
        password: '',
        role: 'user' as UserRole,
        dealer_id: '' as string | number,
    });

    const editForm = useForm({
        name: '',
        email: '',
        password: '',
        role: 'user' as UserRole,
        dealer_id: '' as string | number,
    });

    const applyFilters = (newFilters: {
        search?: string;
        role?: string;
        dealer_id?: string;
    }) => {
        router.get(
            usersRoute.index.url(),
            {
                search: newFilters.search || undefined,
                role: newFilters.role || undefined,
                dealer_id: newFilters.dealer_id || undefined,
            },
            { preserveState: true, replace: true },
        );
    };

    const handleSearchSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        applyFilters({ search, role: roleFilter, dealer_id: dealerFilter });
    };

    const handleRoleChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
        const val = e.target.value;
        setRoleFilter(val);
        applyFilters({ search, role: val, dealer_id: dealerFilter });
    };

    const handleDealerChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
        const val = e.target.value;
        setDealerFilter(val);
        applyFilters({ search, role: roleFilter, dealer_id: val });
    };

    const handleResetFilters = () => {
        setSearch('');
        setRoleFilter('');
        setDealerFilter('');
        router.get(
            usersRoute.index.url(),
            {},
            { preserveState: true, replace: true },
        );
    };

    const handleOpenCreate = () => {
        createForm.reset();
        createForm.clearErrors();
        createForm.setData({
            name: '',
            email: '',
            password: '',
            role: 'user',
            dealer_id: dealers.length > 0 ? dealers[0].id : '',
        });
        setIsCreateOpen(true);
    };

    const handleSubmitCreate = (e: React.FormEvent) => {
        e.preventDefault();
        createForm.post(usersRoute.store.url(), {
            onSuccess: () => {
                setIsCreateOpen(false);
                createForm.reset();
            },
        });
    };

    const handleOpenEdit = (user: User) => {
        setSelectedUser(user);
        editForm.clearErrors();
        editForm.setData({
            name: user.name,
            email: user.email,
            password: '',
            role: user.role,
            dealer_id: user.dealer_id ?? '',
        });
        setIsEditOpen(true);
    };

    const handleSubmitEdit = (e: React.FormEvent) => {
        e.preventDefault();
        if (!selectedUser) return;

        editForm.put(usersRoute.update.url(selectedUser.id), {
            onSuccess: () => {
                setIsEditOpen(false);
                setSelectedUser(null);
            },
        });
    };

    const handleOpenDelete = (user: User) => {
        setSelectedUser(user);
        setIsDeleteOpen(true);
    };

    const handleSubmitDelete = () => {
        if (!selectedUser) return;

        router.delete(usersRoute.destroy.url(selectedUser.id), {
            onSuccess: () => {
                setIsDeleteOpen(false);
                setSelectedUser(null);
            },
        });
    };

    const renderRoleBadge = (role: string) => {
        switch (role) {
            case 'super_admin':
                return (
                    <Badge
                        variant="outline"
                        className="border-purple-300 bg-purple-50 font-medium text-purple-700 dark:border-purple-800 dark:bg-purple-950/50 dark:text-purple-300"
                    >
                        <Shield className="mr-1 size-3" />
                        Super Admin
                    </Badge>
                );
            case 'admin_dealer':
                return (
                    <Badge
                        variant="outline"
                        className="border-blue-300 bg-blue-50 font-medium text-blue-700 dark:border-blue-800 dark:bg-blue-950/50 dark:text-blue-300"
                    >
                        <Building2 className="mr-1 size-3" />
                        Admin Dealer
                    </Badge>
                );
            default:
                return (
                    <Badge
                        variant="outline"
                        className="border-emerald-300 bg-emerald-50 font-medium text-emerald-700 dark:border-emerald-800 dark:bg-emerald-950/50 dark:text-emerald-300"
                    >
                        <UserCheck className="mr-1 size-3" />
                        User Dealer
                    </Badge>
                );
        }
    };

    const selectClass = cn(
        'flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-xs transition-[color,box-shadow] outline-none',
        'focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50',
        'disabled:cursor-not-allowed disabled:opacity-50 dark:bg-input/30',
    );

    const hasActiveFilters = Boolean(search || roleFilter || dealerFilter);

    return (
        <>
            <Head title="Menu User" />

            <div className="flex h-full flex-1 flex-col gap-6 p-4 md:p-6">
                {/* Header Section */}
                <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
                    <div>
                        <h1 className="flex items-center gap-2 text-2xl font-bold tracking-tight text-foreground">
                            <Users className="size-6 text-primary" />
                            Menu User
                        </h1>
                        <p className="mt-1 text-sm text-muted-foreground">
                            Kelola pengguna, penugasan role, dan integrasi
                            dengan data dealer.
                        </p>
                    </div>

                    <Button
                        onClick={handleOpenCreate}
                        className="shrink-0 gap-2"
                    >
                        <Plus className="size-4" />
                        Tambah User
                    </Button>
                </div>

                {/* Filter and Search Section */}
                <div className="flex flex-col gap-3 rounded-xl border border-sidebar-border/70 bg-card p-4 shadow-xs dark:border-sidebar-border">
                    <div className="flex items-center gap-2 text-xs font-semibold tracking-wider text-muted-foreground uppercase">
                        <Filter className="size-3.5" />
                        Filter & Pencarian
                    </div>

                    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 md:grid-cols-4">
                        {/* Search Input */}
                        <form
                            onSubmit={handleSearchSubmit}
                            className="relative sm:col-span-2 md:col-span-2"
                        >
                            <Search className="absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" />
                            <Input
                                type="text"
                                placeholder="Cari nama atau email pengguna..."
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
                                            role: roleFilter,
                                            dealer_id: dealerFilter,
                                        });
                                    }}
                                    className="absolute top-1/2 right-2.5 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                                >
                                    <X className="size-4" />
                                </button>
                            )}
                        </form>

                        {/* Filter Role */}
                        <div>
                            <select
                                value={roleFilter}
                                onChange={handleRoleChange}
                                className={selectClass}
                                aria-label="Filter Role"
                            >
                                <option value="">Semua Role</option>
                                {roles.map((r) => (
                                    <option key={r.value} value={r.value}>
                                        {r.label}
                                    </option>
                                ))}
                            </select>
                        </div>

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
                    </div>

                    {hasActiveFilters && (
                        <div className="flex items-center justify-between border-t border-sidebar-border/50 pt-3 text-xs text-muted-foreground dark:border-sidebar-border">
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
                                    <th className="w-14 px-4 py-3.5 text-center">
                                        No
                                    </th>
                                    <th className="px-4 py-3.5">Pengguna</th>
                                    <th className="px-4 py-3.5">Role</th>
                                    <th className="px-4 py-3.5">
                                        Dealer Terintegrasi
                                    </th>
                                    <th className="px-4 py-3.5 text-right">
                                        Aksi
                                    </th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-sidebar-border/50 dark:divide-sidebar-border">
                                {users.data.length === 0 ? (
                                    <tr>
                                        <td
                                            colSpan={5}
                                            className="py-12 text-center text-muted-foreground"
                                        >
                                            <div className="flex flex-col items-center justify-center gap-2">
                                                <Users className="size-10 text-muted-foreground/40" />
                                                <p className="font-medium text-foreground">
                                                    Tidak ada data pengguna
                                                </p>
                                                <p className="text-xs">
                                                    {hasActiveFilters
                                                        ? 'Tidak ditemukan user yang cocok dengan filter.'
                                                        : 'Belum ada user yang terdaftar.'}
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
                                    users.data.map((user, index) => {
                                        const rowNumber =
                                            (users.current_page - 1) *
                                                users.per_page +
                                            index +
                                            1;
                                        const isSelf =
                                            user.id === currentUserId;

                                        return (
                                            <tr
                                                key={user.id}
                                                className="transition-colors hover:bg-muted/40"
                                            >
                                                <td className="px-4 py-3.5 text-center font-mono text-xs text-muted-foreground">
                                                    {rowNumber}
                                                </td>
                                                <td className="px-4 py-3.5">
                                                    <div className="flex items-center gap-3">
                                                        <Avatar className="size-8">
                                                            <AvatarImage
                                                                src={
                                                                    user.avatar
                                                                }
                                                                alt={user.name}
                                                            />
                                                            <AvatarFallback className="bg-muted text-xs font-medium text-foreground">
                                                                {getInitials(
                                                                    user.name,
                                                                )}
                                                            </AvatarFallback>
                                                        </Avatar>
                                                        <div>
                                                            <div className="flex items-center gap-1.5 font-medium text-foreground">
                                                                <span>
                                                                    {user.name}
                                                                </span>
                                                                {isSelf && (
                                                                    <Badge
                                                                        variant="secondary"
                                                                        className="h-4 px-1.5 py-0 text-[10px]"
                                                                    >
                                                                        Anda
                                                                    </Badge>
                                                                )}
                                                            </div>
                                                            <span className="text-xs text-muted-foreground">
                                                                {user.email}
                                                            </span>
                                                        </div>
                                                    </div>
                                                </td>
                                                <td className="px-4 py-3.5">
                                                    {renderRoleBadge(user.role)}
                                                </td>
                                                <td className="px-4 py-3.5">
                                                    {user.dealer ? (
                                                        <div className="flex flex-col">
                                                            <span className="font-medium text-foreground">
                                                                {
                                                                    user.dealer
                                                                        .nama_dealer
                                                                }
                                                            </span>
                                                            <span className="font-mono text-xs text-muted-foreground">
                                                                Kode:{' '}
                                                                {
                                                                    user.dealer
                                                                        .kode_dealer
                                                                }
                                                            </span>
                                                        </div>
                                                    ) : user.role ===
                                                      'super_admin' ? (
                                                        <span className="flex items-center gap-1 text-xs text-muted-foreground italic">
                                                            <Shield className="size-3 text-purple-500" />
                                                            Akses Global (Semua
                                                            Dealer)
                                                        </span>
                                                    ) : (
                                                        <span className="text-xs text-amber-600 italic dark:text-amber-400">
                                                            Belum terhubung
                                                            dealer
                                                        </span>
                                                    )}
                                                </td>
                                                <td className="px-4 py-3.5 text-right">
                                                    <div className="flex items-center justify-end gap-1.5">
                                                        <Button
                                                            variant="ghost"
                                                            size="sm"
                                                            onClick={() =>
                                                                handleOpenEdit(
                                                                    user,
                                                                )
                                                            }
                                                            className="h-8 px-2 text-muted-foreground hover:text-foreground"
                                                            title="Edit User"
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
                                                                    user,
                                                                )
                                                            }
                                                            disabled={isSelf}
                                                            className={cn(
                                                                'h-8 px-2',
                                                                isSelf
                                                                    ? 'cursor-not-allowed opacity-40'
                                                                    : 'text-destructive/80 hover:bg-destructive/10 hover:text-destructive',
                                                            )}
                                                            title={
                                                                isSelf
                                                                    ? 'Tidak dapat menghapus akun sendiri'
                                                                    : 'Hapus User'
                                                            }
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
                    {users.total > 0 && (
                        <div className="flex flex-col items-center justify-between gap-3 border-t border-sidebar-border/70 p-4 sm:flex-row dark:border-sidebar-border">
                            <p className="text-xs text-muted-foreground">
                                Menampilkan{' '}
                                <span className="font-medium text-foreground">
                                    {users.from ?? 0}
                                </span>{' '}
                                sampai{' '}
                                <span className="font-medium text-foreground">
                                    {users.to ?? 0}
                                </span>{' '}
                                dari{' '}
                                <span className="font-medium text-foreground">
                                    {users.total}
                                </span>{' '}
                                data
                            </p>
                            <Pagination links={users.links} />
                        </div>
                    )}
                </div>
            </div>

            {/* Modal Tambah User */}
            <Dialog open={isCreateOpen} onOpenChange={setIsCreateOpen}>
                <DialogContent className="sm:max-w-md">
                    <DialogHeader>
                        <DialogTitle>Tambah Pengguna Baru</DialogTitle>
                        <DialogDescription>
                            Daftarkan akun pengguna baru beserta peran (role)
                            dan integrasi ke dealer.
                        </DialogDescription>
                    </DialogHeader>

                    <form
                        onSubmit={handleSubmitCreate}
                        className="space-y-4 py-2"
                    >
                        <div className="space-y-2">
                            <Label htmlFor="create_user_name">
                                Nama Lengkap
                            </Label>
                            <Input
                                id="create_user_name"
                                placeholder="Contoh: Budi Santoso"
                                value={createForm.data.name}
                                onChange={(e) =>
                                    createForm.setData('name', e.target.value)
                                }
                                className={
                                    createForm.errors.name
                                        ? 'border-destructive'
                                        : ''
                                }
                                autoFocus
                            />
                            <InputError message={createForm.errors.name} />
                        </div>

                        <div className="space-y-2">
                            <Label htmlFor="create_user_email">Email</Label>
                            <Input
                                id="create_user_email"
                                type="email"
                                placeholder="Contoh: budi@pantau.com"
                                value={createForm.data.email}
                                onChange={(e) =>
                                    createForm.setData('email', e.target.value)
                                }
                                className={
                                    createForm.errors.email
                                        ? 'border-destructive'
                                        : ''
                                }
                            />
                            <InputError message={createForm.errors.email} />
                        </div>

                        <div className="space-y-2">
                            <Label htmlFor="create_user_password">
                                Password
                            </Label>
                            <Input
                                id="create_user_password"
                                type="password"
                                placeholder="Minimal 8 karakter"
                                value={createForm.data.password}
                                onChange={(e) =>
                                    createForm.setData(
                                        'password',
                                        e.target.value,
                                    )
                                }
                                className={
                                    createForm.errors.password
                                        ? 'border-destructive'
                                        : ''
                                }
                            />
                            <InputError message={createForm.errors.password} />
                        </div>

                        <div className="space-y-2">
                            <Label htmlFor="create_user_role">
                                Role (Peran)
                            </Label>
                            <select
                                id="create_user_role"
                                value={createForm.data.role}
                                onChange={(e) => {
                                    const nextRole = e.target.value as UserRole;
                                    createForm.setData((prev) => ({
                                        ...prev,
                                        role: nextRole,
                                        dealer_id:
                                            nextRole === 'super_admin'
                                                ? ''
                                                : prev.dealer_id ||
                                                  (dealers[0]?.id ?? ''),
                                    }));
                                }}
                                className={cn(
                                    selectClass,
                                    createForm.errors.role
                                        ? 'border-destructive'
                                        : '',
                                )}
                            >
                                {roles.map((r) => (
                                    <option key={r.value} value={r.value}>
                                        {r.label}
                                    </option>
                                ))}
                            </select>
                            <InputError message={createForm.errors.role} />
                        </div>

                        <div className="space-y-2">
                            <div className="flex items-center justify-between">
                                <Label htmlFor="create_user_dealer">
                                    Dealer Terintegrasi
                                </Label>
                                {createForm.data.role === 'super_admin' && (
                                    <span className="text-[11px] text-muted-foreground italic">
                                        Opsional untuk Super Admin
                                    </span>
                                )}
                            </div>

                            <select
                                id="create_user_dealer"
                                value={createForm.data.dealer_id}
                                disabled={
                                    createForm.data.role === 'super_admin'
                                }
                                onChange={(e) =>
                                    createForm.setData(
                                        'dealer_id',
                                        e.target.value,
                                    )
                                }
                                className={cn(
                                    selectClass,
                                    createForm.errors.dealer_id
                                        ? 'border-destructive'
                                        : '',
                                    createForm.data.role === 'super_admin'
                                        ? 'cursor-not-allowed bg-muted/50 text-muted-foreground'
                                        : '',
                                )}
                            >
                                {createForm.data.role === 'super_admin' ? (
                                    <option value="">
                                        Akses Semua Dealer (Global)
                                    </option>
                                ) : (
                                    <>
                                        <option value="">
                                            -- Pilih Dealer --
                                        </option>
                                        {dealers.map((d) => (
                                            <option key={d.id} value={d.id}>
                                                {d.kode_dealer} -{' '}
                                                {d.nama_dealer}
                                            </option>
                                        ))}
                                    </>
                                )}
                            </select>
                            <InputError message={createForm.errors.dealer_id} />
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
                                    : 'Simpan User'}
                            </Button>
                        </DialogFooter>
                    </form>
                </DialogContent>
            </Dialog>

            {/* Modal Edit User */}
            <Dialog open={isEditOpen} onOpenChange={setIsEditOpen}>
                <DialogContent className="sm:max-w-md">
                    <DialogHeader>
                        <DialogTitle>Edit Pengguna</DialogTitle>
                        <DialogDescription>
                            Perbarui informasi akun, role, atau dealer pengguna
                            terpilih.
                        </DialogDescription>
                    </DialogHeader>

                    <form
                        onSubmit={handleSubmitEdit}
                        className="space-y-4 py-2"
                    >
                        <div className="space-y-2">
                            <Label htmlFor="edit_user_name">Nama Lengkap</Label>
                            <Input
                                id="edit_user_name"
                                placeholder="Contoh: Budi Santoso"
                                value={editForm.data.name}
                                onChange={(e) =>
                                    editForm.setData('name', e.target.value)
                                }
                                className={
                                    editForm.errors.name
                                        ? 'border-destructive'
                                        : ''
                                }
                            />
                            <InputError message={editForm.errors.name} />
                        </div>

                        <div className="space-y-2">
                            <Label htmlFor="edit_user_email">Email</Label>
                            <Input
                                id="edit_user_email"
                                type="email"
                                placeholder="Contoh: budi@pantau.com"
                                value={editForm.data.email}
                                onChange={(e) =>
                                    editForm.setData('email', e.target.value)
                                }
                                className={
                                    editForm.errors.email
                                        ? 'border-destructive'
                                        : ''
                                }
                            />
                            <InputError message={editForm.errors.email} />
                        </div>

                        <div className="space-y-2">
                            <Label htmlFor="edit_user_password">
                                Password Baru{' '}
                                <span className="text-xs font-normal text-muted-foreground">
                                    (Opsional)
                                </span>
                            </Label>
                            <Input
                                id="edit_user_password"
                                type="password"
                                placeholder="Biarkan kosong jika tidak diubah"
                                value={editForm.data.password}
                                onChange={(e) =>
                                    editForm.setData('password', e.target.value)
                                }
                                className={
                                    editForm.errors.password
                                        ? 'border-destructive'
                                        : ''
                                }
                            />
                            <InputError message={editForm.errors.password} />
                        </div>

                        <div className="space-y-2">
                            <Label htmlFor="edit_user_role">Role (Peran)</Label>
                            <select
                                id="edit_user_role"
                                value={editForm.data.role}
                                onChange={(e) => {
                                    const nextRole = e.target.value as UserRole;
                                    editForm.setData((prev) => ({
                                        ...prev,
                                        role: nextRole,
                                        dealer_id:
                                            nextRole === 'super_admin'
                                                ? ''
                                                : prev.dealer_id ||
                                                  (dealers[0]?.id ?? ''),
                                    }));
                                }}
                                className={cn(
                                    selectClass,
                                    editForm.errors.role
                                        ? 'border-destructive'
                                        : '',
                                )}
                            >
                                {roles.map((r) => (
                                    <option key={r.value} value={r.value}>
                                        {r.label}
                                    </option>
                                ))}
                            </select>
                            <InputError message={editForm.errors.role} />
                        </div>

                        <div className="space-y-2">
                            <div className="flex items-center justify-between">
                                <Label htmlFor="edit_user_dealer">
                                    Dealer Terintegrasi
                                </Label>
                                {editForm.data.role === 'super_admin' && (
                                    <span className="text-[11px] text-muted-foreground italic">
                                        Opsional untuk Super Admin
                                    </span>
                                )}
                            </div>

                            <select
                                id="edit_user_dealer"
                                value={editForm.data.dealer_id}
                                disabled={editForm.data.role === 'super_admin'}
                                onChange={(e) =>
                                    editForm.setData(
                                        'dealer_id',
                                        e.target.value,
                                    )
                                }
                                className={cn(
                                    selectClass,
                                    editForm.errors.dealer_id
                                        ? 'border-destructive'
                                        : '',
                                    editForm.data.role === 'super_admin'
                                        ? 'cursor-not-allowed bg-muted/50 text-muted-foreground'
                                        : '',
                                )}
                            >
                                {editForm.data.role === 'super_admin' ? (
                                    <option value="">
                                        Akses Semua Dealer (Global)
                                    </option>
                                ) : (
                                    <>
                                        <option value="">
                                            -- Pilih Dealer --
                                        </option>
                                        {dealers.map((d) => (
                                            <option key={d.id} value={d.id}>
                                                {d.kode_dealer} -{' '}
                                                {d.nama_dealer}
                                            </option>
                                        ))}
                                    </>
                                )}
                            </select>
                            <InputError message={editForm.errors.dealer_id} />
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
                                    : 'Perbarui User'}
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
                            Hapus User
                        </DialogTitle>
                        <DialogDescription>
                            Apakah Anda yakin ingin menghapus akun pengguna{' '}
                            <span className="font-semibold text-foreground">
                                {selectedUser?.name} ({selectedUser?.email})
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
        </>
    );
}

UsersIndex.layout = {
    breadcrumbs: [
        {
            title: 'Dashboard',
            href: dashboard(),
        },
        {
            title: 'User',
            href: usersRoute.index(),
        },
    ],
};
