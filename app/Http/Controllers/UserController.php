<?php

namespace App\Http\Controllers;

use App\Enums\UserRole;
use App\Http\Requests\StoreUserRequest;
use App\Http\Requests\UpdateUserRequest;
use App\Models\Dealer;
use App\Models\User;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Hash;
use Inertia\Inertia;
use Inertia\Response;

class UserController extends Controller
{
    /**
     * Display a listing of users.
     */
    public function index(Request $request): Response
    {
        $user = $request->user();
        $isGlobal = $user?->hasGlobalAccess() ?? false;
        $userDealerId = $user?->dealer_id;

        $search = $request->string('search')->trim()->value();
        $roleFilter = $request->string('role')->trim()->value();
        $dealerFilter = $isGlobal
            ? $request->string('dealer_id')->trim()->value()
            : (string) ($userDealerId ?? '');

        $users = User::query()
            ->with('dealer')
            ->when(! $isGlobal, function ($query) use ($userDealerId): void {
                if ($userDealerId) {
                    $query->where('dealer_id', $userDealerId);
                } else {
                    $query->whereRaw('1 = 0');
                }
            })
            ->when($search !== '', function ($query) use ($search): void {
                $query->where(function ($q) use ($search): void {
                    $q->where('name', 'like', "%{$search}%")
                        ->orWhere('email', 'like', "%{$search}%");
                });
            })
            ->when($roleFilter !== '', function ($query) use ($roleFilter): void {
                $query->where('role', $roleFilter);
            })
            ->when($isGlobal && $dealerFilter !== '', function ($query) use ($dealerFilter): void {
                $query->where('dealer_id', $dealerFilter);
            })
            ->latest('id')
            ->paginate(10)
            ->withQueryString();

        $dealersQuery = Dealer::query()->orderBy('nama_dealer');
        if (! $isGlobal) {
            if ($userDealerId) {
                $dealersQuery->where('id', $userDealerId);
            } else {
                $dealersQuery->whereRaw('1 = 0');
            }
        }
        $dealers = $dealersQuery->get(['id', 'kode_dealer', 'nama_dealer']);

        $roles = $isGlobal
            ? UserRole::options()
            : [
                ['value' => UserRole::Dealer->value, 'label' => UserRole::Dealer->label()],
            ];

        return Inertia::render('users/index', [
            'users' => $users,
            'dealers' => $dealers,
            'roles' => $roles,
            'filters' => [
                'search' => $search,
                'role' => $roleFilter,
                'dealer_id' => $isGlobal ? $dealerFilter : '',
            ],
            'canManageAll' => $isGlobal,
        ]);
    }

    /**
     * Store a newly created user in storage.
     */
    public function store(StoreUserRequest $request): RedirectResponse
    {
        $currentUser = $request->user();
        $data = $request->validated();
        $data['password'] = Hash::make($data['password']);

        if (! $currentUser?->hasGlobalAccess()) {
            if (! $currentUser?->dealer_id) {
                abort(403, 'Akun Anda belum terhubung dengan dealer.');
            }
            $data['role'] = UserRole::Dealer->value;
            $data['dealer_id'] = $currentUser->dealer_id;
        } elseif (in_array($data['role'], [UserRole::SuperAdmin->value, UserRole::MainDealer->value], true)) {
            $data['dealer_id'] = null;
        }

        User::create($data);

        Inertia::flash('toast', [
            'type' => 'success',
            'message' => 'User berhasil ditambahkan.',
        ]);

        return to_route('users.index');
    }

    /**
     * Update the specified user in storage.
     */
    public function update(UpdateUserRequest $request, User $user): RedirectResponse
    {
        $currentUser = $request->user();
        if (! $currentUser?->hasGlobalAccess() && (int) $user->dealer_id !== (int) $currentUser?->dealer_id) {
            abort(403, 'Anda tidak memiliki akses untuk mengubah user dealer lain.');
        }

        $data = $request->validated();

        if (! empty($data['password'])) {
            $data['password'] = Hash::make($data['password']);
        } else {
            unset($data['password']);
        }

        if (! $currentUser?->hasGlobalAccess()) {
            $data['role'] = UserRole::Dealer->value;
            $data['dealer_id'] = $currentUser?->dealer_id;
        } elseif (in_array($data['role'], [UserRole::SuperAdmin->value, UserRole::MainDealer->value], true)) {
            $data['dealer_id'] = null;
        }

        $user->update($data);

        Inertia::flash('toast', [
            'type' => 'success',
            'message' => 'User berhasil diperbarui.',
        ]);

        return to_route('users.index');
    }

    /**
     * Remove the specified user from storage.
     */
    public function destroy(Request $request, User $user): RedirectResponse
    {
        $currentUser = $request->user();
        if ($user->id === $currentUser?->id) {
            Inertia::flash('toast', [
                'type' => 'error',
                'message' => 'Anda tidak dapat menghapus akun Anda sendiri.',
            ]);

            return to_route('users.index');
        }

        if (! $currentUser?->hasGlobalAccess() && (int) $user->dealer_id !== (int) $currentUser?->dealer_id) {
            abort(403, 'Anda tidak memiliki akses untuk menghapus user dealer lain.');
        }

        $user->delete();

        Inertia::flash('toast', [
            'type' => 'success',
            'message' => 'User berhasil dihapus.',
        ]);

        return to_route('users.index');
    }
}
