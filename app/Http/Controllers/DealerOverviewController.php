<?php

namespace App\Http\Controllers;

use App\Models\Dealer;
use App\Models\Review;
use Illuminate\Http\Request;
use Illuminate\Support\Carbon;
use Inertia\Inertia;
use Inertia\Response;

class DealerOverviewController extends Controller
{
    /**
     * Display the Dealer Overview page.
     */
    public function index(Request $request): Response
    {
        $user = $request->user();
        $isGlobal = $user?->hasGlobalAccess() ?? false;
        $dealerScopeId = ! $isGlobal ? $user?->dealer_id : ($request->filled('dealer_id') ? $request->integer('dealer_id') : null);

        $selectedMonth = $request->string('month')->trim()->value();

        $availableMonths = Review::query()
            ->selectRaw('substr(tanggal_publish_review, 1, 7) as ym')
            ->whereNotNull('tanggal_publish_review')
            ->groupBy('ym')
            ->orderByDesc('ym')
            ->pluck('ym')
            ->filter()
            ->values()
            ->all();

        $currentMonth = date('Y-m');

        if (! in_array($currentMonth, $availableMonths, true)) {
            array_unshift($availableMonths, $currentMonth);
        }

        $isAllTime = ($selectedMonth === 'all');

        if ($isAllTime) {
            $activeMonth = 'all';
            $monthlyReviewsQuery = Review::query();
        } else {
            $activeMonth = ($selectedMonth !== '' && in_array($selectedMonth, $availableMonths, true))
                ? $selectedMonth
                : (in_array($currentMonth, $availableMonths, true) ? $currentMonth : ($availableMonths[0] ?? $currentMonth));

            $monthCarbon = Carbon::parse($activeMonth.'-01');
            $startOfMonth = $monthCarbon->copy()->startOfMonth()->toDateString();
            $endOfMonth = $monthCarbon->copy()->endOfMonth()->toDateString().' 23:59:59';

            $monthlyReviewsQuery = Review::query()
                ->whereBetween('tanggal_publish_review', [$startOfMonth, $endOfMonth]);
        }

        $overviewDealersQuery = Dealer::query()
            ->withCount('reviews');

        if ($dealerScopeId) {
            $overviewDealersQuery->where('id', $dealerScopeId);
            $monthlyReviewsQuery->where('dealer_id', $dealerScopeId);
        }

        $allDealers = $overviewDealersQuery->get(['id', 'kode_dealer', 'nama_dealer', 'star_rate', 'total_review']);

        $monthlyReviews = $monthlyReviewsQuery->get([
            'id',
            'dealer_id',
            'star_rate',
            'respon_from_owner',
            'tanggal_publish_review',
            'tanggal_respon',
        ]);

        $monthlyByDealer = $monthlyReviews->groupBy('dealer_id');

        $dealerOverview = $allDealers->map(function (Dealer $dealer) use ($monthlyByDealer): array {
            $reviews = $monthlyByDealer->get($dealer->id, collect());
            $monthlyCount = $reviews->count();

            $r1 = 0;
            $r2 = 0;
            $r3 = 0;
            $r4 = 0;
            $r5 = 0;
            $jumlahFeedback = 0;
            $totalLtDays = 0;
            $ltCount = 0;

            foreach ($reviews as $rev) {
                $star = (int) round($rev->star_rate);
                if ($star === 1) {
                    $r1++;
                } elseif ($star === 2) {
                    $r2++;
                } elseif ($star === 3) {
                    $r3++;
                } elseif ($star === 4) {
                    $r4++;
                } elseif ($star === 5) {
                    $r5++;
                }

                if ($rev->respon_from_owner) {
                    $jumlahFeedback++;
                    if ($rev->tanggal_respon && $rev->tanggal_publish_review) {
                        $pub = Carbon::parse($rev->tanggal_publish_review);
                        $resp = Carbon::parse($rev->tanggal_respon);
                        $diff = $pub->diffInDays($resp, false);
                        $totalLtDays += max(0, $diff);
                        $ltCount++;
                    }
                }
            }

            $belumFeedback = $monthlyCount - $jumlahFeedback;
            $cont13 = $monthlyCount > 0 ? round((($r1 + $r2 + $r3) / $monthlyCount) * 100, 2) : 0.0;
            $cont45 = $monthlyCount > 0 ? round((($r4 + $r5) / $monthlyCount) * 100, 2) : 0.0;
            $achFeedback = $monthlyCount > 0 ? round(($jumlahFeedback / $monthlyCount) * 100, 2) : null;
            $ltDays = $ltCount > 0 ? round($totalLtDays / $ltCount, 1) : null;

            return [
                'id' => $dealer->id,
                'kode_dealer' => $dealer->kode_dealer,
                'nama_dealer' => $dealer->nama_dealer,
                'total_review_all' => (int) ($dealer->total_review ?? $dealer->reviews_count ?? 0),
                'review_monthly' => $monthlyCount,
                'gmb_score' => $dealer->star_rate !== null ? (float) $dealer->star_rate : null,
                'rating_1' => $r1,
                'rating_2' => $r2,
                'rating_3' => $r3,
                'rating_4' => $r4,
                'rating_5' => $r5,
                'cont_rating_1_3' => $cont13,
                'cont_rating_4_5' => $cont45,
                'jumlah_feedback' => $jumlahFeedback,
                'belum_feedback' => $belumFeedback,
                'ach_feedback' => $achFeedback,
                'lt_days' => $ltDays,
            ];
        })
            ->sort(function ($a, $b) {
                if ($a['review_monthly'] !== $b['review_monthly']) {
                    return $b['review_monthly'] <=> $a['review_monthly'];
                }
                if ($a['total_review_all'] !== $b['total_review_all']) {
                    return $b['total_review_all'] <=> $a['total_review_all'];
                }

                return strcasecmp($a['nama_dealer'], $b['nama_dealer']);
            })
            ->values()
            ->all();

        $overviewCollection = collect($dealerOverview);
        $totalReviewAll = (int) $overviewCollection->sum('total_review_all');
        $totalMonthly = (int) $overviewCollection->sum('review_monthly');
        $validScores = $overviewCollection->pluck('gmb_score')->filter(fn ($s) => $s !== null);
        $avgGmb = $validScores->count() > 0 ? round((float) $validScores->avg(), 2) : null;
        $totR1 = (int) $overviewCollection->sum('rating_1');
        $totR2 = (int) $overviewCollection->sum('rating_2');
        $totR3 = (int) $overviewCollection->sum('rating_3');
        $totR4 = (int) $overviewCollection->sum('rating_4');
        $totR5 = (int) $overviewCollection->sum('rating_5');
        $totJmlFeedback = (int) $overviewCollection->sum('jumlah_feedback');
        $totBelumFeedback = (int) $overviewCollection->sum('belum_feedback');
        $totCont13 = $totalMonthly > 0 ? round((($totR1 + $totR2 + $totR3) / $totalMonthly) * 100, 2) : 0.0;
        $totCont45 = $totalMonthly > 0 ? round((($totR4 + $totR5) / $totalMonthly) * 100, 2) : 0.0;
        $totAchFeedback = $totalMonthly > 0 ? round(($totJmlFeedback / $totalMonthly) * 100, 2) : 0.0;
        $validLts = $overviewCollection->pluck('lt_days')->filter(fn ($l) => $l !== null);
        $avgLt = $validLts->count() > 0 ? round((float) $validLts->avg(), 1) : null;

        $overviewSummary = [
            'total_review_all' => $totalReviewAll,
            'review_monthly' => $totalMonthly,
            'gmb_score' => $avgGmb,
            'rating_1' => $totR1,
            'rating_2' => $totR2,
            'rating_3' => $totR3,
            'rating_4' => $totR4,
            'rating_5' => $totR5,
            'cont_rating_1_3' => $totCont13,
            'cont_rating_4_5' => $totCont45,
            'jumlah_feedback' => $totJmlFeedback,
            'belum_feedback' => $totBelumFeedback,
            'ach_feedback' => $totAchFeedback,
            'lt_days' => $avgLt,
        ];

        return Inertia::render('dealer-overview', [
            'dealers' => $dealerOverview,
            'summary' => $overviewSummary,
            'availableMonths' => $availableMonths,
            'activeMonth' => $activeMonth,
            'selectedDealerId' => $dealerScopeId ? (string) $dealerScopeId : '',
            'isGlobal' => $isGlobal,
            'userRole' => $user?->role?->value ?? (string) ($user?->role ?? ''),
        ]);
    }
}
