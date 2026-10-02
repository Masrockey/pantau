<?php

namespace App\Http\Controllers;

use App\Http\Requests\ImportDealerRequest;
use App\Http\Requests\StoreDealerRequest;
use App\Http\Requests\UpdateDealerRequest;
use App\Models\Dealer;
use App\Services\DealerExcelService;
use App\Services\DealerSyncService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\Http\UploadedFile;
use Inertia\Inertia;
use Inertia\Response;
use Symfony\Component\HttpFoundation\Response as SymfonyResponse;
use Throwable;

class DealerController extends Controller
{
    /**
     * Display a listing of dealers.
     */
    public function index(Request $request): Response
    {
        $user = $request->user();
        $isGlobal = $user?->hasGlobalAccess() ?? false;
        $userDealerId = $user?->dealer_id;

        $search = $request->string('search')->trim()->value();

        $dealers = Dealer::query()
            ->withCount('users')
            ->when(! $isGlobal, function ($query) use ($userDealerId): void {
                if ($userDealerId) {
                    $query->where('id', $userDealerId);
                } else {
                    $query->whereRaw('1 = 0');
                }
            })
            ->when($search !== '', function ($query) use ($search): void {
                $query->where(function ($q) use ($search): void {
                    $q->where('kode_dealer', 'like', "%{$search}%")
                        ->orWhere('nama_dealer', 'like', "%{$search}%")
                        ->orWhere('nama_dealer_gbp', 'like', "%{$search}%")
                        ->orWhere('alamat', 'like', "%{$search}%")
                        ->orWhere('kecamatan', 'like', "%{$search}%")
                        ->orWhere('kelurahan', 'like', "%{$search}%")
                        ->orWhere('no_telp_showroom', 'like', "%{$search}%");
                });
            })
            ->latest('id')
            ->paginate(10)
            ->withQueryString();

        $syncableCount = Dealer::query()
            ->when(! $isGlobal, function ($query) use ($userDealerId): void {
                if ($userDealerId) {
                    $query->where('id', $userDealerId);
                } else {
                    $query->whereRaw('1 = 0');
                }
            })
            ->whereNotNull('link_google_maps')
            ->where('link_google_maps', '!=', '')
            ->count();

        return Inertia::render('dealers/index', [
            'dealers' => $dealers,
            'filters' => [
                'search' => $search,
            ],
            'canManageAll' => $isGlobal,
            'syncableCount' => $syncableCount,
        ]);
    }

    /**
     * Store a newly created dealer in storage.
     */
    public function store(StoreDealerRequest $request): RedirectResponse
    {
        if (! $request->user()?->hasGlobalAccess()) {
            abort(403, 'Aksi ini hanya dapat dilakukan oleh Super Admin atau Main Dealer.');
        }

        Dealer::create($request->validated());

        Inertia::flash('toast', [
            'type' => 'success',
            'message' => 'Dealer berhasil ditambahkan.',
        ]);

        return to_route('dealers.index');
    }

    /**
     * Update the specified dealer in storage.
     */
    public function update(UpdateDealerRequest $request, Dealer $dealer): RedirectResponse
    {
        $user = $request->user();
        if (! $user?->hasGlobalAccess() && (int) $dealer->id !== (int) $user?->dealer_id) {
            abort(403, 'Anda hanya dapat memperbarui data dealer Anda sendiri.');
        }

        $dealer->update($request->validated());

        Inertia::flash('toast', [
            'type' => 'success',
            'message' => 'Dealer berhasil diperbarui.',
        ]);

        return to_route('dealers.index');
    }

    /**
     * Remove the specified dealer from storage.
     */
    public function destroy(Request $request, Dealer $dealer): RedirectResponse
    {
        if (! $request->user()?->hasGlobalAccess()) {
            abort(403, 'Aksi ini hanya dapat dilakukan oleh Super Admin atau Main Dealer.');
        }

        if ($dealer->users()->exists()) {
            Inertia::flash('toast', [
                'type' => 'error',
                'message' => 'Dealer tidak dapat dihapus karena masih memiliki user terhubung.',
            ]);

            return to_route('dealers.index');
        }

        $dealer->delete();

        Inertia::flash('toast', [
            'type' => 'success',
            'message' => 'Dealer berhasil dihapus.',
        ]);

        return to_route('dealers.index');
    }

    /**
     * Download the dealer Excel template.
     */
    public function template(Request $request, DealerExcelService $excelService): SymfonyResponse
    {
        if (! $request->user()?->hasGlobalAccess()) {
            abort(403, 'Aksi ini hanya dapat dilakukan oleh Super Admin atau Main Dealer.');
        }

        $content = $excelService->generateTemplateXlsx();

        return response($content, 200, [
            'Content-Type' => 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
            'Content-Disposition' => 'attachment; filename="template_dealer.xlsx"',
            'Content-Length' => (string) strlen($content),
        ]);
    }

    /**
     * Import dealers from an uploaded Excel or CSV file.
     */
    public function import(ImportDealerRequest $request, DealerExcelService $excelService): RedirectResponse
    {
        if (! $request->user()?->hasGlobalAccess()) {
            abort(403, 'Aksi ini hanya dapat dilakukan oleh Super Admin atau Main Dealer.');
        }

        /** @var UploadedFile $file */
        $file = $request->file('file');
        $updateExisting = $request->boolean('update_existing', true);

        try {
            $result = $excelService->import($file, $updateExisting);

            $message = "Import berhasil: {$result['imported']} dealer baru ditambahkan";
            if ($result['updated'] > 0) {
                $message .= ", {$result['updated']} data diperbarui";
            }
            $message .= '.';

            if (! empty($result['errors'])) {
                $message .= ' Catatan: '.implode(' ', array_slice($result['errors'], 0, 3));
            }

            Inertia::flash('toast', [
                'type' => 'success',
                'message' => $message,
            ]);
        } catch (Throwable $e) {
            Inertia::flash('toast', [
                'type' => 'error',
                'message' => 'Gagal mengimpor file: '.$e->getMessage(),
            ]);
        }

        return to_route('dealers.index');
    }

    /**
     * Synchronize a dealer's profile details from Google Maps.
     * Updates ONLY: star_rate, total_review, no_telp_showroom, alamat, kelurahan, kecamatan, pos_code, latitude, longitude.
     */
    public function sync(Request $request, Dealer $dealer, DealerSyncService $syncService): JsonResponse|RedirectResponse
    {
        $user = $request->user();
        if (! $user?->hasGlobalAccess() && (int) $dealer->id !== (int) $user?->dealer_id) {
            if ($request->wantsJson()) {
                return response()->json([
                    'success' => false,
                    'message' => 'Anda tidak memiliki hak akses untuk menyinkronkan dealer ini.',
                ], 403);
            }
            abort(403, 'Anda tidak memiliki hak akses untuk menyinkronkan dealer ini.');
        }

        if (empty($dealer->link_google_maps)) {
            $msg = "Dealer {$dealer->nama_dealer} belum memiliki link Google Maps.";
            if ($request->wantsJson()) {
                return response()->json([
                    'success' => false,
                    'message' => $msg,
                ], 422);
            }

            Inertia::flash('toast', [
                'type' => 'error',
                'message' => $msg,
            ]);

            return back();
        }

        @ini_set('max_execution_time', '120');
        @set_time_limit(120);

        try {
            $useProxy = $request->boolean('use_proxy', false);
            $result = $syncService->syncDealerProfileOnly($dealer, $useProxy);

            $updatedCount = count($result['updated_fields']);
            $msg = $updatedCount > 0
                ? "Profil {$dealer->nama_dealer} berhasil disinkronisasi ({$updatedCount} data diperbarui)."
                : "Profil {$dealer->nama_dealer} sudah sesuai dengan data terbaru di Google Maps.";

            if ($request->wantsJson()) {
                return response()->json([
                    'success' => true,
                    'message' => $msg,
                    'data' => $result,
                ]);
            }

            Inertia::flash('toast', [
                'type' => 'success',
                'message' => $msg,
            ]);

            return back();
        } catch (Throwable $e) {
            $errorMsg = 'Gagal menyinkronkan dealer: '.$e->getMessage();
            if ($request->wantsJson()) {
                return response()->json([
                    'success' => false,
                    'message' => $errorMsg,
                ], 500);
            }

            Inertia::flash('toast', [
                'type' => 'error',
                'message' => $errorMsg,
            ]);

            return back();
        }
    }

    /**
     * Get list of dealers with Google Maps link eligible for synchronization.
     */
    public function syncableList(Request $request): JsonResponse
    {
        $user = $request->user();
        $isGlobal = $user?->hasGlobalAccess() ?? false;
        $userDealerId = $user?->dealer_id;

        $dealers = Dealer::query()
            ->when(! $isGlobal, function ($query) use ($userDealerId): void {
                if ($userDealerId) {
                    $query->where('id', $userDealerId);
                } else {
                    $query->whereRaw('1 = 0');
                }
            })
            ->whereNotNull('link_google_maps')
            ->where('link_google_maps', '!=', '')
            ->orderBy('nama_dealer')
            ->get(['id', 'kode_dealer', 'nama_dealer', 'link_google_maps']);

        return response()->json([
            'success' => true,
            'dealers' => $dealers,
        ]);
    }

    /**
     * Synchronize all eligible dealers' profile details from Google Maps.
     */
    public function syncAll(Request $request, DealerSyncService $syncService): JsonResponse|RedirectResponse
    {
        @ini_set('max_execution_time', '0');
        @set_time_limit(0);

        $user = $request->user();
        if (! $user?->hasGlobalAccess()) {
            if ($request->wantsJson()) {
                return response()->json([
                    'success' => false,
                    'message' => 'Aksi ini hanya dapat dilakukan oleh Super Admin atau Main Dealer.',
                ], 403);
            }
            abort(403, 'Aksi ini hanya dapat dilakukan oleh Super Admin atau Main Dealer.');
        }

        $dealerIds = $request->input('dealer_ids');
        $dealersQuery = Dealer::query()->whereNotNull('link_google_maps')->where('link_google_maps', '!=', '');
        if (is_array($dealerIds) && ! empty($dealerIds)) {
            $dealersQuery->whereIn('id', $dealerIds);
        }

        $dealers = $dealersQuery->get();
        if ($dealers->isEmpty()) {
            $msg = 'Tidak ada dealer dengan link Google Maps yang dapat disinkronkan.';
            if ($request->wantsJson()) {
                return response()->json([
                    'success' => false,
                    'message' => $msg,
                ], 422);
            }

            Inertia::flash('toast', [
                'type' => 'warning',
                'message' => $msg,
            ]);

            return back();
        }

        try {
            $useProxy = $request->boolean('use_proxy', false);
            $summary = $syncService->syncAllDealers($dealers, $useProxy);

            $msg = "Sinkronisasi selesai: {$summary['success']} berhasil, {$summary['failed']} gagal, {$summary['skipped']} dilewati.";

            if ($request->wantsJson()) {
                return response()->json([
                    'success' => true,
                    'message' => $msg,
                    'summary' => $summary,
                ]);
            }

            Inertia::flash('toast', [
                'type' => 'success',
                'message' => $msg,
            ]);

            return back();
        } catch (Throwable $e) {
            $errorMsg = 'Gagal menyinkronkan data dealer: '.$e->getMessage();
            if ($request->wantsJson()) {
                return response()->json([
                    'success' => false,
                    'message' => $errorMsg,
                ], 500);
            }

            Inertia::flash('toast', [
                'type' => 'error',
                'message' => $errorMsg,
            ]);

            return back();
        }
    }
}
