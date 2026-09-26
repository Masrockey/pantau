<?php

namespace App\Http\Controllers;

use App\Models\Dealer;
use App\Models\Review;
use Illuminate\Http\Request;
use Inertia\Inertia;
use Inertia\Response;

class DashboardController extends Controller
{
    /**
     * Display the application executive dashboard.
     */
    public function index(Request $request): Response
    {
        $user = $request->user();
        $isGlobal = $user?->hasGlobalAccess() ?? false;
        $userDealerId = $user?->dealer_id;

        $selectedDealerId = $request->string('dealer_id')->trim()->value();
        $dealerScopeId = null;

        if ($isGlobal) {
            if ($selectedDealerId !== '' && is_numeric($selectedDealerId)) {
                $dealerScopeId = (int) $selectedDealerId;
            }
        } else {
            $dealerScopeId = $userDealerId;
        }

        $reviewQuery = Review::query();

        if ($dealerScopeId) {
            $reviewQuery->where('dealer_id', $dealerScopeId);
        } elseif (! $isGlobal) {
            $reviewQuery->whereRaw('1 = 0');
        }

        $totalReviews = (int) (clone $reviewQuery)->count();
        $avgRating = round((float) ((clone $reviewQuery)->avg('star_rate') ?? 0), 2);
        $respondedCount = (int) (clone $reviewQuery)->where('respon_from_owner', true)->count();
        $unrespondedCount = (int) (clone $reviewQuery)->where('respon_from_owner', false)->count();
        $responseRate = $totalReviews > 0 ? round(($respondedCount / $totalReviews) * 100, 1) : 0;

        $ratingsRaw = (clone $reviewQuery)
            ->selectRaw('round(star_rate) as star, count(*) as count')
            ->groupByRaw('round(star_rate)')
            ->pluck('count', 'star')
            ->all();

        $ratingCounts = [
            5 => (int) ($ratingsRaw[5] ?? 0),
            4 => (int) ($ratingsRaw[4] ?? 0),
            3 => (int) ($ratingsRaw[3] ?? 0),
            2 => (int) ($ratingsRaw[2] ?? 0),
            1 => (int) ($ratingsRaw[1] ?? 0),
        ];

        $positiveReviews = $ratingCounts[5] + $ratingCounts[4];
        $neutralReviews = $ratingCounts[3];
        $criticalReviewsCount = $ratingCounts[2] + $ratingCounts[1];

        $topDealers = [];
        $needsAttentionDealers = [];
        $totalDealers = 0;
        $dealersWithMaps = 0;
        $currentDealer = null;

        if ($isGlobal && ! $dealerScopeId) {
            $totalDealers = Dealer::count();
            $dealersWithMaps = Dealer::whereNotNull('link_google_maps')
                ->where('link_google_maps', '!=', '')
                ->count();

            $topDealers = Dealer::query()
                ->withCount('reviews')
                ->whereNotNull('star_rate')
                ->orderByDesc('star_rate')
                ->orderByDesc('total_review')
                ->take(5)
                ->get(['id', 'kode_dealer', 'nama_dealer', 'star_rate', 'total_review', 'link_google_maps']);

            $needsAttentionDealers = Dealer::query()
                ->withCount([
                    'reviews',
                    'reviews as unresponded_count' => fn ($q) => $q->where('respon_from_owner', false),
                ])
                ->whereNotNull('link_google_maps')
                ->orderBy('star_rate', 'asc')
                ->orderByDesc('unresponded_count')
                ->take(5)
                ->get(['id', 'kode_dealer', 'nama_dealer', 'star_rate', 'total_review', 'link_google_maps']);
        } elseif ($dealerScopeId) {
            $currentDealer = Dealer::withCount([
                'reviews',
                'reviews as unresponded_count' => fn ($q) => $q->where('respon_from_owner', false),
            ])->find($dealerScopeId);
        }

        $latestReviews = (clone $reviewQuery)
            ->with(['dealer:id,kode_dealer,nama_dealer'])
            ->latest('tanggal_publish_review')
            ->take(6)
            ->get();

        $criticalUnresponded = (clone $reviewQuery)
            ->with(['dealer:id,kode_dealer,nama_dealer'])
            ->where('star_rate', '<=', 2)
            ->where('respon_from_owner', false)
            ->latest('tanggal_publish_review')
            ->take(5)
            ->get();

        $dealersList = $isGlobal
            ? Dealer::orderBy('nama_dealer')->get(['id', 'kode_dealer', 'nama_dealer'])
            : [];

        return Inertia::render('dashboard', [
            'metrics' => [
                'total_reviews' => $totalReviews,
                'avg_rating' => $avgRating,
                'responded_count' => $respondedCount,
                'unresponded_count' => $unrespondedCount,
                'response_rate' => $responseRate,
                'positive_reviews' => $positiveReviews,
                'neutral_reviews' => $neutralReviews,
                'critical_reviews' => $criticalReviewsCount,
                'total_dealers' => $totalDealers,
                'dealers_with_maps' => $dealersWithMaps,
            ],
            'ratingCounts' => $ratingCounts,
            'topDealers' => $topDealers,
            'needsAttentionDealers' => $needsAttentionDealers,
            'currentDealer' => $currentDealer,
            'latestReviews' => $latestReviews,
            'criticalUnresponded' => $criticalUnresponded,
            'dealersList' => $dealersList,
            'selectedDealerId' => $dealerScopeId ? (string) $dealerScopeId : '',
            'isGlobal' => $isGlobal,
            'userRole' => $user?->role?->value ?? (string) ($user?->role ?? ''),
        ]);
    }
}
