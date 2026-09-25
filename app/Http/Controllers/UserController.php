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
        $search = $request->string('search')->trim()->value();
        $roleFilter = $request->string('role')->trim()->value();
        $dealerFilter = $request->string('dealer_id')->trim()->value();

        $users = User::query()
            ->with('dealer')
            ->when($search !== '', function ($query) use ($search): void {
                $query->where(function ($q) use ($search): void {
                    $q->where('name', 'like', "%{$search}%")
                        ->orWhere('email', 'like', "%{$search}%");
                });
            })
            ->when($roleFilter !== '', function ($query) use ($roleFilter): void {
                $query->where('role', $roleFilter);
            })
            ->when($dealerFilter !== '', function ($query) use ($dealerFilter): void {
                $query->where('dealer_id', $dealerFilter);
            })
            ->latest('id')
            ->paginate(10)
            ->withQueryString();

        $dealers = Dealer::query()
            ->orderBy('nama_dealer')
            ->get(['id', 'kode_dealer', 'nama_dealer']);

        return Inertia::render('users/index', [
            'users' => $users,
            'dealers' => $dealers,
            'roles' => UserRole::options(),
            'filters' => [
                'search' => $search,
                'role' => $roleFilter,
                'dealer_id' => $dealerFilter,
            ],
        ]);
    }

    /**
     * Store a newly created user in storage.
     */
    public function store(StoreUserRequest $request): RedirectResponse
    {
        $data = $request->validated();
        $data['password'] = Hash::make($data['password']);

        if ($data['role'] === UserRole::SuperAdmin->value) {
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
        $data = $request->validated();

        if (! empty($data['password'])) {
            $data['password'] = Hash::make($data['password']);
        } else {
            unset($data['password']);
        }

        if ($data['role'] === UserRole::SuperAdmin->value) {
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
        if ($user->id === $request->user()?->id) {
            Inertia::flash('toast', [
                'type' => 'error',
                'message' => 'Anda tidak dapat menghapus akun Anda sendiri.',
            ]);

            return to_route('users.index');
        }

        $user->delete();

        Inertia::flash('toast', [
            'type' => 'success',
            'message' => 'User berhasil dihapus.',
        ]);

        return to_route('users.index');
    }
}
