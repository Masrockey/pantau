<?php

namespace App\Http\Controllers;

use App\Models\Dealer;
use App\Models\Review;
use Illuminate\Http\Request;
use Illuminate\Support\Carbon;
use Inertia\Inertia;
use Inertia\Response;

class MonitoringFeedbackController extends Controller
{
    /**
     * Display the Monitoring Feedback page.
     */
    public function index(Request $request): Response
    {
        $user = $request->user();
        $isGlobal = $user?->hasGlobalAccess() ?? false;
        $dealerScopeId = ! $isGlobal ? $user?->dealer_id : ($request->filled('dealer_id') ? $request->integer('dealer_id') : null);

        $selectedMonth = $request->string('month')->trim()->value();
        $startDateParam = $request->string('start_date')->trim()->value();
        $endDateParam = $request->string('end_date')->trim()->value();

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

        $isAllTime = ($selectedMonth === 'all' || $startDateParam === 'all');

        if ($isAllTime) {
            $startDate = null;
            $endDate = null;
            $activeRangeLabel = 'All Tanggal';
            $activeMonth = 'all';
            $prevMonth = null;
            $prevStartDate = null;
            $prevEndDate = null;
            $monthlyReviewsQuery = Review::query();
            $prevMonthlyReviewsQuery = null;
        } elseif ($startDateParam !== '' || $endDateParam !== '') {
            try {
                $rawStart = $startDateParam !== '' ? $startDateParam : $endDateParam;
                $rawEnd = $endDateParam !== '' ? $endDateParam : $startDateParam;
                $startDate = Carbon::parse($rawStart)->toDateString();
                $endDate = Carbon::parse($rawEnd)->toDateString();

                if ($startDate > $endDate) {
                    [$startDate, $endDate] = [$endDate, $startDate];
                }

                $diffDays = Carbon::parse($startDate)->diffInDays(Carbon::parse($endDate)) + 1;
                $prevEndDate = Carbon::parse($startDate)->subDay()->toDateString();
                $prevStartDate = Carbon::parse($prevEndDate)->subDays($diffDays - 1)->toDateString();

                $activeRangeLabel = Carbon::parse($startDate)->translatedFormat('d M Y').' - '.Carbon::parse($endDate)->translatedFormat('d M Y');
                $activeMonth = substr($startDate, 0, 7);
                $prevMonth = substr($prevStartDate, 0, 7);

                $monthlyReviewsQuery = Review::query()
                    ->whereBetween('tanggal_publish_review', [$startDate, $endDate.' 23:59:59']);

                $prevMonthlyReviewsQuery = Review::query()
                    ->whereBetween('tanggal_publish_review', [$prevStartDate, $prevEndDate.' 23:59:59']);
            } catch (\Throwable) {
                // If parsing fails, fall back to month view
                $startDateParam = '';
                $endDateParam = '';
            }
        }

        if ($startDateParam === '' && $endDateParam === '' && ! $isAllTime) {
            $activeMonth = ($selectedMonth !== '' && in_array($selectedMonth, $availableMonths, true))
                ? $selectedMonth
                : (in_array($currentMonth, $availableMonths, true) ? $currentMonth : ($availableMonths[0] ?? $currentMonth));

            $monthCarbon = Carbon::parse($activeMonth.'-01');
            $startDate = $monthCarbon->copy()->startOfMonth()->toDateString();
            $endDate = $monthCarbon->copy()->endOfMonth()->toDateString();

            $prevMonthCarbon = $monthCarbon->copy()->subMonth();
            $prevMonth = $prevMonthCarbon->format('Y-m');
            $prevStartDate = $prevMonthCarbon->copy()->startOfMonth()->toDateString();
            $prevEndDate = $prevMonthCarbon->copy()->endOfMonth()->toDateString();

            $activeRangeLabel = $monthCarbon->translatedFormat('F Y');

            $monthlyReviewsQuery = Review::query()
                ->whereBetween('tanggal_publish_review', [$startDate, $endDate.' 23:59:59']);

            $prevMonthlyReviewsQuery = Review::query()
                ->whereBetween('tanggal_publish_review', [$prevStartDate, $prevEndDate.' 23:59:59']);
        }

        $overviewDealersQuery = Dealer::query()
            ->withCount('reviews');

        if ($dealerScopeId) {
            $overviewDealersQuery->where('id', $dealerScopeId);
            $monthlyReviewsQuery->where('dealer_id', $dealerScopeId);
            if ($prevMonthlyReviewsQuery) {
                $prevMonthlyReviewsQuery->where('dealer_id', $dealerScopeId);
            }
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

        if ($prevMonthlyReviewsQuery) {
            $prevMonthlyReviews = $prevMonthlyReviewsQuery->get(['id', 'dealer_id']);
            $prevMonthlyByDealer = $prevMonthlyReviews->groupBy('dealer_id')->map->count();
        } else {
            $prevMonthlyByDealer = collect();
        }

        $monitoringFeedback = $allDealers->map(function (Dealer $dealer) use ($monthlyByDealer, $prevMonthlyByDealer): array {
            $reviews = $monthlyByDealer->get($dealer->id, collect());
            $mCount = $reviews->count();
            $m1Count = (int) ($prevMonthlyByDealer->get($dealer->id, 0));

            $r13 = 0;
            $r45 = 0;
            $feedbackDone = 0;
            $totalLtDays = 0;
            $ltCount = 0;

            foreach ($reviews as $rev) {
                $star = (int) round($rev->star_rate);
                if ($star <= 3) {
                    $r13++;
                } else {
                    $r45++;
                }

                if ($rev->respon_from_owner) {
                    $feedbackDone++;
                    if ($rev->tanggal_respon && $rev->tanggal_publish_review) {
                        $pub = Carbon::parse($rev->tanggal_publish_review);
                        $resp = Carbon::parse($rev->tanggal_respon);
                        $diff = $pub->diffInDays($resp, false);
                        $totalLtDays += max(0, $diff);
                        $ltCount++;
                    }
                }
            }

            $notYetFeedback = $mCount - $feedbackDone;
            $achFeedback = $mCount > 0 && $feedbackDone > 0
                ? round(($feedbackDone / $mCount) * 100, 2)
                : ($mCount > 0 ? 0.0 : null);
            $ltDays = $ltCount > 0 ? round($totalLtDays / $ltCount, 1) : null;

            $growthReview = null;
            if ($m1Count > 0) {
                $growthReview = (int) round((($mCount - $m1Count) / $m1Count) * 100);
            } elseif ($m1Count === 0 && $mCount > 0) {
                $growthReview = 100;
            }

            return [
                'id' => $dealer->id,
                'kode_dealer' => $dealer->kode_dealer,
                'nama_dealer' => $dealer->nama_dealer,
                'gmb_score' => $dealer->star_rate !== null ? (float) $dealer->star_rate : null,
                'rating_1_3' => $r13,
                'rating_4_5' => $r45,
                'feedback_done' => $feedbackDone,
                'not_yet_feedback' => $notYetFeedback,
                'ach_feedback' => $achFeedback,
                'lt_day' => $ltDays,
                'jumlah_review_m' => $mCount,
                'jumlah_review_m1' => $m1Count,
                'growth_review' => $growthReview,
            ];
        })
            ->sort(function ($a, $b) {
                $scoreA = $a['gmb_score'] ?? -1;
                $scoreB = $b['gmb_score'] ?? -1;
                if ($scoreA !== $scoreB) {
                    return $scoreB <=> $scoreA;
                }

                return strcasecmp($a['nama_dealer'], $b['nama_dealer']);
            })
            ->values()
            ->all();

        $mfCollection = collect($monitoringFeedback);
        $totRating13 = (int) $mfCollection->sum('rating_1_3');
        $totRating45 = (int) $mfCollection->sum('rating_4_5');
        $totFeedbackDone = (int) $mfCollection->sum('feedback_done');
        $totNotYetFeedback = (int) $mfCollection->sum('not_yet_feedback');
        $totM = (int) $mfCollection->sum('jumlah_review_m');
        $totM1 = (int) $mfCollection->sum('jumlah_review_m1');
        $totAch = $totM > 0 ? round(($totFeedbackDone / $totM) * 100, 2) : 0.0;

        $totGrowth = null;
        if (! $isAllTime) {
            if ($totM1 > 0) {
                $totGrowth = (int) round((($totM - $totM1) / $totM1) * 100);
            } elseif ($totM1 === 0 && $totM > 0) {
                $totGrowth = 100;
            }
        }

        $validScores = $mfCollection->pluck('gmb_score')->filter(fn ($s) => $s !== null);
        $avgGmbScore = $validScores->count() > 0 ? round((float) $validScores->avg(), 2) : null;
        $validLts = $mfCollection->pluck('lt_day')->filter(fn ($l) => $l !== null);
        $avgLt = $validLts->count() > 0 ? round((float) $validLts->avg(), 1) : null;

        $monitoringSummary = [
            'gmb_score' => $avgGmbScore,
            'rating_1_3' => $totRating13,
            'rating_4_5' => $totRating45,
            'feedback_done' => $totFeedbackDone,
            'not_yet_feedback' => $totNotYetFeedback,
            'ach_feedback' => $totAch,
            'lt_day' => $avgLt,
            'jumlah_review_m' => $totM,
            'jumlah_review_m1' => $totM1,
            'growth_review' => $totGrowth,
        ];

        return Inertia::render('monitoring-feedback', [
            'dealers' => $monitoringFeedback,
            'summary' => $monitoringSummary,
            'availableMonths' => $availableMonths,
            'activeMonth' => $activeMonth,
            'prevMonth' => $prevMonth,
            'startDate' => $startDate,
            'endDate' => $endDate,
            'prevStartDate' => $prevStartDate,
            'prevEndDate' => $prevEndDate,
            'activeRangeLabel' => $activeRangeLabel,
            'selectedDealerId' => $dealerScopeId ? (string) $dealerScopeId : '',
            'isGlobal' => $isGlobal,
            'userRole' => $user?->role?->value ?? (string) ($user?->role ?? ''),
        ]);
    }
}
