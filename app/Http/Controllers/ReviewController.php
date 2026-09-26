<?php

namespace App\Http\Controllers;

use App\Http\Requests\StoreReviewRequest;
use App\Http\Requests\UpdateReviewRequest;
use App\Models\Dealer;
use App\Models\Review;
use App\Services\GoogleReviewScraperService;
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
        $data = $request->validated();

        if (! $user->hasGlobalAccess()) {
            if (! $user->dealer_id) {
                abort(403, 'Akun Anda belum terhubung dengan dealer.');
            }
            $data['dealer_id'] = $user->dealer_id;
        }

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
     * Check if the Google Review scraper API service is online.
     */
    public function checkHealth(GoogleReviewScraperService $scraperService): JsonResponse
    {
        return response()->json([
            'online' => $scraperService->isHealthy(),
            'proxy' => $scraperService->getProxyStats(),
        ]);
    }

    /**
     * Start a background scraping job for a dealer via the Scraper API.
     */
    public function startSync(Request $request, GoogleReviewScraperService $scraperService): JsonResponse
    {
        $validated = $request->validate([
            'dealer_id' => ['required'],
            'max_reviews' => ['nullable', 'integer', 'min:1', 'max:1000'],
            'sort_by' => ['nullable', 'string', 'in:newest,highest,lowest,relevant'],
            'use_proxy' => ['nullable', 'boolean'],
        ]);

        if (! $scraperService->isHealthy()) {
            return response()->json([
                'success' => false,
                'message' => 'Service Scraper API di port 3000 tidak aktif atau tidak dapat dihubungi. Pastikan service scraper berjalan.',
            ], 503);
        }

        $user = $request->user();
        $isGlobal = $user?->hasGlobalAccess() ?? false;

        if (! $isGlobal && $request->input('dealer_id') === 'all') {
            return response()->json([
                'success' => false,
                'message' => 'Anda tidak memiliki izin untuk menarik review semua dealer.',
            ], 403);
        }

        if (! $isGlobal && (int) $request->input('dealer_id') !== (int) $user?->dealer_id) {
            return response()->json([
                'success' => false,
                'message' => 'Anda hanya dapat menarik review untuk dealer Anda sendiri.',
            ], 403);
        }

        if ($request->input('dealer_id') === 'all') {
            $allDealers = Dealer::orderBy('nama_dealer')->get(['id', 'kode_dealer', 'nama_dealer']);

            return response()->json([
                'success' => true,
                'isBulk' => true,
                'dealers' => $allDealers,
                'total' => $allDealers->count(),
            ]);
        }

        $dealer = Dealer::findOrFail($validated['dealer_id']);

        try {
            $jobData = $scraperService->startScrapingJob(
                dealer: $dealer,
                maxReviews: (int) ($validated['max_reviews'] ?? 20),
                sortBy: (string) ($validated['sort_by'] ?? 'newest'),
                useProxy: (bool) ($validated['use_proxy'] ?? true),
            );

            return response()->json([
                'success' => true,
                'jobId' => $jobData['jobId'],
                'status' => $jobData['status'],
                'dealerId' => $dealer->id,
                'dealerName' => $dealer->nama_dealer,
            ]);
        } catch (Exception $e) {
            return response()->json([
                'success' => false,
                'message' => $e->getMessage(),
            ], 422);
        }
    }

    /**
     * Check the status of a scraping job and sync results when completed.
     */
    public function checkSyncStatus(Request $request, string $jobId, GoogleReviewScraperService $scraperService): JsonResponse
    {
        $validated = $request->validate([
            'dealer_id' => ['required', 'exists:dealers,id'],
        ]);

        $user = $request->user();
        if (! $user?->hasGlobalAccess() && (int) $validated['dealer_id'] !== (int) $user?->dealer_id) {
            return response()->json([
                'status' => 'failed',
                'message' => 'Anda tidak memiliki akses ke dealer ini.',
            ], 403);
        }

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
