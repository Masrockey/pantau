<?php

namespace App\Http\Controllers;

use App\Http\Requests\StoreReviewRequest;
use App\Http\Requests\UpdateReviewRequest;
use App\Models\Dealer;
use App\Models\Review;
use App\Services\GoogleReviewScraperService;
use App\Services\SyncReviewServerService;
use Exception;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Inertia\Inertia;
use Inertia\Response;

class ReviewController extends Controller
{
    /**
     * Display a listing of reviews.
     */
    public function index(Request $request): Response
    {
        $user = $request->user();
        $isGlobal = $user?->hasGlobalAccess() ?? false;
        $userDealerId = $user?->dealer_id;

        $search = $request->string('search')->trim()->value();
        $dealerFilter = $isGlobal
            ? $request->string('dealer_id')->trim()->value()
            : (string) ($userDealerId ?? '');
        $starFilter = $request->string('star_rate')->trim()->value();
        $responFilter = $request->string('respon_from_owner')->trim()->value();

        $reviews = Review::query()
            ->with(['dealer:id,kode_dealer,nama_dealer'])
            ->when(! $isGlobal, function ($query) use ($userDealerId): void {
                if ($userDealerId) {
                    $query->where('dealer_id', $userDealerId);
                } else {
                    $query->whereRaw('1 = 0');
                }
            })
            ->when($isGlobal && $dealerFilter !== '', function ($query) use ($dealerFilter): void {
                $query->where('dealer_id', $dealerFilter);
            })
            ->when($search !== '', function ($query) use ($search): void {
                $query->where(function ($q) use ($search): void {
                    $q->where('nama_reviewer', 'like', "%{$search}%")
                        ->orWhere('review', 'like', "%{$search}%")
                        ->orWhere('respon', 'like', "%{$search}%")
                        ->orWhereHas('dealer', function ($dealerQuery) use ($search): void {
                            $dealerQuery->where('kode_dealer', 'like', "%{$search}%")
                                ->orWhere('nama_dealer', 'like', "%{$search}%");
                        });
                });
            })
            ->when($starFilter !== '', function ($query) use ($starFilter): void {
                $query->where('star_rate', '>=', (float) $starFilter)
                    ->where('star_rate', '<', (float) $starFilter + 1);
            })
            ->when($responFilter !== '', function ($query) use ($responFilter): void {
                if ($responFilter === 'true' || $responFilter === '1') {
                    $query->where('respon_from_owner', true);
                } elseif ($responFilter === 'false' || $responFilter === '0') {
                    $query->where('respon_from_owner', false);
                }
            })
            ->latest('tanggal_publish_review')
            ->latest('id')
            ->paginate(10)
            ->withQueryString();

        $baseStatsQuery = Review::query()
            ->when(! $isGlobal, function ($query) use ($userDealerId): void {
                if ($userDealerId) {
                    $query->where('dealer_id', $userDealerId);
                } else {
                    $query->whereRaw('1 = 0');
                }
            })
            ->when($isGlobal && $dealerFilter !== '', fn ($q) => $q->where('dealer_id', $dealerFilter));

        $stats = [
            'total' => (clone $baseStatsQuery)->count(),
            'average_rating' => (float) round((clone $baseStatsQuery)->avg('star_rate') ?? 0, 1),
            'responded' => (clone $baseStatsQuery)->where('respon_from_owner', true)->count(),
            'unresponded' => (clone $baseStatsQuery)->where('respon_from_owner', false)->count(),
        ];

        $dealersQuery = Dealer::query()->orderBy('nama_dealer');
        if (! $isGlobal) {
            if ($userDealerId) {
                $dealersQuery->where('id', $userDealerId);
            } else {
                $dealersQuery->whereRaw('1 = 0');
            }
        }
        $dealers = $dealersQuery->get(['id', 'kode_dealer', 'nama_dealer']);

        return Inertia::render('reviews/index', [
            'reviews' => $reviews,
            'dealers' => $dealers,
            'stats' => $stats,
            'filters' => [
                'search' => $search,
                'dealer_id' => $isGlobal ? $dealerFilter : '',
                'star_rate' => $starFilter,
                'respon_from_owner' => $responFilter,
            ],
            'canManageAll' => $isGlobal,
        ]);
    }

    /**
     * Store a newly created review in storage.
     */
    public function store(StoreReviewRequest $request): RedirectResponse
    {
        $user = $request->user();
        if (! $user->hasGlobalAccess()) {
            abort(403, 'Role dealer tidak diizinkan untuk menambah review manual.');
        }

        $data = $request->validated();

        if (! ($data['respon_from_owner'] ?? false)) {
            $data['respon_from_owner'] = false;
            $data['tanggal_respon'] = null;
            $data['respon'] = null;
        }

        Review::create($data);

        Inertia::flash('toast', [
            'type' => 'success',
            'message' => 'Review berhasil ditambahkan.',
        ]);

        return to_route('reviews.index');
    }

    /**
     * Update the specified review in storage.
     */
    public function update(UpdateReviewRequest $request, Review $review): RedirectResponse
    {
        $user = $request->user();
        if (! $user->hasGlobalAccess()) {
            abort(403, 'Role dealer tidak diizinkan untuk mengubah data review.');
        }

        $data = $request->validated();

        if (! ($data['respon_from_owner'] ?? false)) {
            $data['respon_from_owner'] = false;
            $data['tanggal_respon'] = null;
            $data['respon'] = null;
        }

        $review->update($data);

        Inertia::flash('toast', [
            'type' => 'success',
            'message' => 'Review berhasil diperbarui.',
        ]);

        return to_route('reviews.index');
    }

    /**
     * Remove the specified review from storage.
     */
    public function destroy(Request $request, Review $review): RedirectResponse
    {
        $user = $request->user();
        if (! $user->hasGlobalAccess()) {
            abort(403, 'Role dealer tidak diizinkan untuk menghapus review.');
        }

        $review->delete();

        Inertia::flash('toast', [
            'type' => 'success',
            'message' => 'Review berhasil dihapus.',
        ]);

        return to_route('reviews.index');
    }

    /**
     * Display the sync reviews page.
     */
    public function syncPage(Request $request, SyncReviewServerService $syncService): Response
    {
        $user = $request->user();
        if (! $user?->isSuperAdmin()) {
            abort(403, 'Hanya Super Admin yang dapat mengakses halaman Sync Review.');
        }

        $dealers = Dealer::query()
            ->withCount('reviews')
            ->orderBy('nama_dealer')
            ->get([
                'id',
                'kode_dealer',
                'nama_dealer',
                'link_google_maps',
                'star_rate',
                'total_review',
            ]);

        $dealersWithMaps = $dealers->filter(fn ($d): bool => ! empty($d->link_google_maps))->count();
        $dealersWithoutMaps = $dealers->count() - $dealersWithMaps;
        $totalReviewsInDb = (int) $dealers->sum('reviews_count');

        return Inertia::render('reviews/sync', [
            'dealers' => $dealers,
            'stats' => [
                'total_dealers' => $dealers->count(),
                'dealers_with_maps' => $dealersWithMaps,
                'dealers_without_maps' => $dealersWithoutMaps,
                'total_reviews_db' => $totalReviewsInDb,
            ],
            'serverStatus' => $syncService->getStatus(),
            'serverLogs' => $syncService->getLogs(),
            'canManageAll' => true,
        ]);
    }

    /**
     * Check if the Google Review scraper API service is online.
     */
    public function checkHealth(Request $request, GoogleReviewScraperService $scraperService): JsonResponse
    {
        if (! $request->user()?->isSuperAdmin()) {
            return response()->json([
                'online' => false,
                'message' => 'Hanya Super Admin yang dapat mengakses service ini.',
            ], 403);
        }

        return response()->json([
            'online' => $scraperService->isHealthy(),
            'proxy' => $scraperService->getProxyStats(),
        ]);
    }

    /**
     * Start a background scraping job on the server.
     */
    public function startSync(Request $request, GoogleReviewScraperService $scraperService, SyncReviewServerService $syncService): JsonResponse
    {
        $user = $request->user();
        if (! $user?->isSuperAdmin()) {
            return response()->json([
                'success' => false,
                'message' => 'Hanya Super Admin yang dapat melakukan sinkronisasi ulasan Google Maps.',
            ], 403);
        }

        $validated = $request->validate([
            'dealer_id' => ['required'],
            'max_reviews' => ['nullable', 'integer', 'min:1', 'max:5000'],
            'sort_by' => ['nullable', 'string', 'in:newest,highest,lowest,relevant'],
            'use_proxy' => ['nullable', 'boolean'],
        ]);

        if (! $scraperService->isHealthy()) {
            return response()->json([
                'success' => false,
                'message' => 'Service Scraper API di port 3000 tidak aktif atau tidak dapat dihubungi. Pastikan service scraper berjalan.',
            ], 503);
        }

        $target = (string) $validated['dealer_id'];
        $limit = (int) ($validated['max_reviews'] ?? 50);
        $sort = (string) ($validated['sort_by'] ?? 'newest');
        $useProxy = (bool) ($validated['use_proxy'] ?? true);

        $currentStatus = $syncService->getStatus();
        if (in_array($currentStatus['status'] ?? 'idle', ['starting', 'running'], true)) {
            return response()->json([
                'success' => false,
                'message' => 'Proses sinkronisasi di server sedang berjalan. Harap tunggu hingga selesai atau batalkan terlebih dahulu.',
            ], 409);
        }

        if ($target !== 'all') {
            $dealer = Dealer::find($target);
            if (! $dealer) {
                return response()->json([
                    'success' => false,
                    'message' => 'Showroom tidak ditemukan.',
                ], 404);
            }
            if (empty($dealer->link_google_maps)) {
                return response()->json([
                    'success' => false,
                    'message' => "Dealer {$dealer->nama_dealer} belum memiliki link Google Maps.",
                ], 422);
            }
        }

        $syncService->launchBackgroundProcess($target, $limit, $sort, $useProxy);

        return response()->json([
            'success' => true,
            'message' => 'Proses sinkronisasi di background server berhasil dimulai.',
            'status' => $syncService->getStatus(),
        ]);
    }

    /**
     * Get the latest progress and logs from the server cache.
     */
    public function syncProgress(Request $request, SyncReviewServerService $syncService): JsonResponse
    {
        if (! $request->user()?->isSuperAdmin()) {
            return response()->json([
                'message' => 'Hanya Super Admin yang dapat mengakses progres sinkronisasi.',
            ], 403);
        }

        return response()->json([
            'status' => $syncService->getStatus(),
            'logs' => $syncService->getLogs(),
        ]);
    }

    /**
     * Request cancellation of the server sync process.
     */
    public function cancelSync(Request $request, SyncReviewServerService $syncService): JsonResponse
    {
        if (! $request->user()?->isSuperAdmin()) {
            return response()->json([
                'message' => 'Hanya Super Admin yang dapat membatalkan sinkronisasi.',
            ], 403);
        }

        $syncService->requestCancel();

        return response()->json([
            'success' => true,
            'message' => 'Permintaan pembatalan sinkronisasi server telah dikirim.',
            'status' => $syncService->getStatus(),
        ]);
    }

    /**
     * Reset the server sync status back to idle.
     */
    public function resetSync(Request $request, SyncReviewServerService $syncService): JsonResponse
    {
        if (! $request->user()?->isSuperAdmin()) {
            return response()->json([
                'message' => 'Hanya Super Admin yang dapat mereset status sinkronisasi.',
            ], 403);
        }

        $syncService->resetStatus();

        return response()->json([
            'success' => true,
            'message' => 'Status monitoring sinkronisasi server berhasil direset.',
            'status' => $syncService->getStatus(),
        ]);
    }

    /**
     * Clear all activity logs in server cache.
     */
    public function clearSyncLogs(Request $request, SyncReviewServerService $syncService): JsonResponse
    {
        if (! $request->user()?->isSuperAdmin()) {
            return response()->json([
                'message' => 'Hanya Super Admin yang dapat membersihkan log sinkronisasi.',
            ], 403);
        }

        $syncService->clearLogs();

        return response()->json([
            'success' => true,
            'message' => 'Log aktivitas sinkronisasi di server berhasil dibersihkan.',
            'logs' => $syncService->getLogs(),
        ]);
    }

    /**
     * Check the status of a scraping job and sync results when completed.
     */
    public function checkSyncStatus(Request $request, string $jobId, GoogleReviewScraperService $scraperService): JsonResponse
    {
        $user = $request->user();
        if (! $user?->isSuperAdmin()) {
            return response()->json([
                'status' => 'failed',
                'message' => 'Hanya Super Admin yang dapat mengecek status sinkronisasi.',
            ], 403);
        }

        $validated = $request->validate([
            'dealer_id' => ['required', 'exists:dealers,id'],
        ]);

        try {
            $statusData = $scraperService->getJobStatus($jobId);
            $status = $statusData['status'] ?? 'unknown';

            if ($status === 'completed') {
                $result = $statusData['result'] ?? null;
                if (! is_array($result)) {
                    return response()->json([
                        'status' => 'failed',
                        'message' => 'Job scraping selesai tetapi tidak ada data ulasan yang dikembalikan.',
                    ], 422);
                }

                $dealer = Dealer::findOrFail($validated['dealer_id']);
                $syncResult = $scraperService->syncDealerReviewsFromJobResult($dealer, $result);

                return response()->json([
                    'status' => 'completed',
                    'message' => "Berhasil menarik {$syncResult['imported']} review baru dan memperbarui {$syncResult['updated']} review.",
                    'data' => $syncResult,
                ]);
            }

            if ($status === 'failed') {
                return response()->json([
                    'status' => 'failed',
                    'message' => $statusData['error'] ?? 'Scraping job gagal dijalankan oleh scraper service.',
                ], 422);
            }

            return response()->json([
                'status' => $status,
                'message' => 'Sedang mengambil data Google Review dari Google Maps...',
            ]);
        } catch (Exception $e) {
            return response()->json([
                'status' => 'failed',
                'message' => $e->getMessage(),
            ], 500);
        }
    }
}
