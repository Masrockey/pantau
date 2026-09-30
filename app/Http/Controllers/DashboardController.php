<?php

namespace App\Http\Controllers;

use App\Models\Dealer;
use App\Models\Review;
use Illuminate\Http\Request;
use Illuminate\Support\Carbon;
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
                ->whereNotNull('star_rate')
                ->where('star_rate', '<', 4.8)
                ->orderBy('star_rate', 'asc')
                ->orderByDesc('unresponded_count')
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

        $mapDealersQuery = Dealer::query()
            ->whereNotNull('latitude')
            ->whereNotNull('longitude');

        if (! $isGlobal && $dealerScopeId) {
            $mapDealersQuery->where('id', $dealerScopeId);
        }

        $dealersForMap = $mapDealersQuery->get([
            'id',
            'kode_dealer',
            'nama_dealer',
            'latitude',
            'longitude',
            'alamat',
            'kelurahan',
            'kecamatan',
            'pos_code',
            'no_telp_showroom',
            'star_rate',
            'total_review',
            'link_google_maps',
        ]);

        $dealerIdsForMap = $dealersForMap->pluck('id')->all();

        $reviewsByDealer = Review::query()
            ->selectRaw('dealer_id, round(star_rate) as star, count(*) as count, sum(case when respon_from_owner = 1 then 1 else 0 end) as responded_count')
            ->whereIn('dealer_id', $dealerIdsForMap)
            ->whereNotNull('star_rate')
            ->groupByRaw('dealer_id, round(star_rate)')
            ->get()
            ->groupBy('dealer_id');

        $mapDealers = $dealersForMap->map(function (Dealer $dealer) use ($reviewsByDealer): array {
            $dealerReviews = $reviewsByDealer->get($dealer->id, collect());

            $stars = [5 => 0, 4 => 0, 3 => 0, 2 => 0, 1 => 0];
            $systemTotalReviews = 0;
            $systemRespondedCount = 0;

            foreach ($dealerReviews as $row) {
                $star = (int) $row->star;
                $count = (int) $row->count;
                if ($star >= 1 && $star <= 5) {
                    $stars[$star] = $count;
                }
                $systemTotalReviews += $count;
                $systemRespondedCount += (int) $row->responded_count;
            }

            $responseRate = $systemTotalReviews > 0
                ? round(($systemRespondedCount / $systemTotalReviews) * 100, 1)
                : 0;

            return [
                'id' => $dealer->id,
                'kode_dealer' => $dealer->kode_dealer,
                'nama_dealer' => $dealer->nama_dealer,
                'latitude' => (float) $dealer->latitude,
                'longitude' => (float) $dealer->longitude,
                'alamat' => $dealer->alamat,
                'kelurahan' => $dealer->kelurahan,
                'kecamatan' => $dealer->kecamatan,
                'pos_code' => $dealer->pos_code,
                'no_telp_showroom' => $dealer->no_telp_showroom,
                'star_rate' => $dealer->star_rate !== null ? (float) $dealer->star_rate : null,
                'total_review' => (int) ($dealer->total_review ?? 0),
                'link_google_maps' => $dealer->link_google_maps,
                'recap' => [
                    'stars' => $stars,
                    'total_system_reviews' => $systemTotalReviews,
                    'total_maps_reviews' => (int) ($dealer->total_review ?? $systemTotalReviews),
                    'responded_count' => $systemRespondedCount,
                    'response_rate' => $responseRate,
                    'positive_reviews' => $stars[5] + $stars[4],
                    'neutral_reviews' => $stars[3],
                    'critical_reviews' => $stars[2] + $stars[1],
                ],
            ];
        })->values();

        $dealerOverview = [];
        $overviewSummary = null;
        $availableMonths = [];
        $activeMonth = null;
        $monitoringFeedback = [];
        $monitoringSummary = null;
        $prevMonth = null;

        if ($isGlobal) {
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
                $prevMonth = null;
                $monthlyReviewsQuery = Review::query();
                $prevMonthlyReviewsQuery = null;
            } else {
                $activeMonth = ($selectedMonth !== '' && in_array($selectedMonth, $availableMonths, true))
                    ? $selectedMonth
                    : (in_array($currentMonth, $availableMonths, true) ? $currentMonth : ($availableMonths[0] ?? $currentMonth));

                $monthCarbon = Carbon::parse($activeMonth.'-01');
                $startOfMonth = $monthCarbon->copy()->startOfMonth()->toDateString();
                $endOfMonth = $monthCarbon->copy()->endOfMonth()->toDateString().' 23:59:59';

                $prevMonthCarbon = $monthCarbon->copy()->subMonth();
                $prevMonth = $prevMonthCarbon->format('Y-m');
                $startOfPrevMonth = $prevMonthCarbon->copy()->startOfMonth()->toDateString();
                $endOfPrevMonth = $prevMonthCarbon->copy()->endOfMonth()->toDateString().' 23:59:59';

                $monthlyReviewsQuery = Review::query()
                    ->whereBetween('tanggal_publish_review', [$startOfMonth, $endOfMonth]);

                $prevMonthlyReviewsQuery = Review::query()
                    ->whereBetween('tanggal_publish_review', [$startOfPrevMonth, $endOfPrevMonth]);
            }

            $overviewDealersQuery = Dealer::query()
                ->withCount('reviews');

            if ($dealerScopeId) {
                $overviewDealersQuery->where('id', $dealerScopeId);
            }

            $allDealers = $overviewDealersQuery->get(['id', 'kode_dealer', 'nama_dealer', 'star_rate', 'total_review']);

            if ($dealerScopeId) {
                $monthlyReviewsQuery->where('dealer_id', $dealerScopeId);
                if ($prevMonthlyReviewsQuery) {
                    $prevMonthlyReviewsQuery->where('dealer_id', $dealerScopeId);
                }
            }

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
            $totCont13 = $totalMonthly > 0 ? round((($totR1 + $totR2 + $totR3) / $totalMonthly) * 100, 2) : 0.0;
            $totCont45 = $totalMonthly > 0 ? round((($totR4 + $totR5) / $totalMonthly) * 100, 2) : 0.0;
            $totJmlFeedback = (int) $overviewCollection->sum('jumlah_feedback');
            $totBelumFeedback = (int) $overviewCollection->sum('belum_feedback');
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
        }

        // Word Cloud Analysis
        $wordReviewsQuery = (clone $reviewQuery)
            ->whereNotNull('review')
            ->where('review', '!=', '');

        $allTimeReviews = (clone $wordReviewsQuery)->pluck('review');
        $wordCloudAllTime = $this->extractWordCloud($allTimeReviews, 140);

        $wordCloudData = $wordCloudAllTime;
        if ($isGlobal && $activeMonth && $activeMonth !== 'all') {
            $monthCarbon = Carbon::parse($activeMonth.'-01');
            $startOfMonth = $monthCarbon->copy()->startOfMonth()->toDateString();
            $endOfMonth = $monthCarbon->copy()->endOfMonth()->toDateString().' 23:59:59';

            $monthlyReviews = (clone $wordReviewsQuery)
                ->whereBetween('tanggal_publish_review', [$startOfMonth, $endOfMonth])
                ->pluck('review');

            $monthlyWords = $this->extractWordCloud($monthlyReviews, 140);
            if (! empty($monthlyWords)) {
                $wordCloudData = $monthlyWords;
            }
        }

        // GMB Cluster Quadrant Analysis
        $clusterDealersQuery = Dealer::query()
            ->orderByDesc('total_review');

        if ($dealerScopeId) {
            $clusterDealersQuery->where('id', $dealerScopeId);
        }

        $clusterDealers = $clusterDealersQuery->get(['id', 'kode_dealer', 'nama_dealer', 'star_rate', 'total_review']);

        $gmbClusterDealers = [];
        $zoneCounts = [
            'IMPROVEMENT ZONE' => 0,
            'VOLUME ZONE' => 0,
            'EXCELLENT ZONE' => 0,
            'QUALITY ZONE' => 0,
        ];

        $totalScoreSum = 0;
        $totalReviewSum = 0;
        $validScoreCount = 0;

        foreach ($clusterDealers as $d) {
            $starRate = $d->star_rate !== null ? (float) $d->star_rate : 0.0;
            $totalRev = (int) ($d->total_review ?? 0);

            if ($starRate >= 4.7 && $totalRev >= 1000) {
                $zone = 'EXCELLENT ZONE';
            } elseif ($starRate >= 4.7 && $totalRev < 1000) {
                $zone = 'VOLUME ZONE';
            } elseif ($starRate < 4.7 && $totalRev >= 1000) {
                $zone = 'QUALITY ZONE';
            } else {
                $zone = 'IMPROVEMENT ZONE';
            }

            $zoneCounts[$zone]++;
            if ($d->star_rate !== null) {
                $totalScoreSum += $starRate;
                $validScoreCount++;
            }
            $totalReviewSum += $totalRev;

            $gmbClusterDealers[] = [
                'id' => $d->id,
                'kode_dealer' => $d->kode_dealer,
                'nama_dealer' => $d->nama_dealer,
                'region' => 'NTB',
                'gmb_score' => $d->star_rate !== null ? (float) $d->star_rate : null,
                'total_review' => $totalRev,
                'cluster_zone' => $zone,
            ];
        }

        $dealerTotalCount = count($gmbClusterDealers);
        $gmbClusterSummary = [
            'total_dealers' => $dealerTotalCount,
            'avg_gmb_score' => $validScoreCount > 0 ? round($totalScoreSum / $validScoreCount, 2) : 0,
            'total_review_sum' => $totalReviewSum,
            'zones' => [
                'IMPROVEMENT ZONE' => [
                    'count' => $zoneCounts['IMPROVEMENT ZONE'],
                    'percentage' => $dealerTotalCount > 0 ? round(($zoneCounts['IMPROVEMENT ZONE'] / $dealerTotalCount) * 100, 2) : 0,
                ],
                'VOLUME ZONE' => [
                    'count' => $zoneCounts['VOLUME ZONE'],
                    'percentage' => $dealerTotalCount > 0 ? round(($zoneCounts['VOLUME ZONE'] / $dealerTotalCount) * 100, 2) : 0,
                ],
                'EXCELLENT ZONE' => [
                    'count' => $zoneCounts['EXCELLENT ZONE'],
                    'percentage' => $dealerTotalCount > 0 ? round(($zoneCounts['EXCELLENT ZONE'] / $dealerTotalCount) * 100, 2) : 0,
                ],
                'QUALITY ZONE' => [
                    'count' => $zoneCounts['QUALITY ZONE'],
                    'percentage' => $dealerTotalCount > 0 ? round(($zoneCounts['QUALITY ZONE'] / $dealerTotalCount) * 100, 2) : 0,
                ],
            ],
        ];

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
            'mapDealers' => $mapDealers,
            'dealerOverview' => $dealerOverview,
            'overviewSummary' => $overviewSummary,
            'monitoringFeedback' => $monitoringFeedback,
            'monitoringSummary' => $monitoringSummary,
            'wordCloudData' => $wordCloudData,
            'wordCloudAllTime' => $wordCloudAllTime,
            'gmbClusterDealers' => $gmbClusterDealers,
            'gmbClusterSummary' => $gmbClusterSummary,
            'availableMonths' => $availableMonths,
            'activeMonth' => $activeMonth,
            'prevMonth' => $prevMonth,
            'selectedDealerId' => $dealerScopeId ? (string) $dealerScopeId : '',
            'isGlobal' => $isGlobal,
            'userRole' => $user?->role?->value ?? (string) ($user?->role ?? ''),
        ]);
    }

    /**
     * Extract word frequency tokens from a list of review texts.
     *
     * @param  iterable<int, mixed>  $reviews
     * @return array<int, array{text: string, value: int}>
     */
    protected function extractWordCloud(iterable $reviews, int $limit = 140): array
    {
        $wordCounts = [];

        foreach ($reviews as $text) {
            if (! is_string($text) || trim($text) === '') {
                continue;
            }

            // Replace linebreaks and non-alphanumeric/hyphen characters with spaces
            $cleaned = preg_replace('/[^\p{L}\p{N}\-]/u', ' ', $text) ?? '';
            $tokens = preg_split('/\s+/u', $cleaned, -1, PREG_SPLIT_NO_EMPTY) ?: [];

            foreach ($tokens as $token) {
                // Trim trailing hyphens if any
                $trimmed = trim($token, '-');
                if ($trimmed === '' || mb_strlen($trimmed) < 1) {
                    continue;
                }

                $lower = mb_strtolower($trimmed);
                if (! isset($wordCounts[$lower])) {
                    $wordCounts[$lower] = [
                        'count' => 0,
                        'forms' => [],
                    ];
                }

                $wordCounts[$lower]['count']++;
                $wordCounts[$lower]['forms'][$trimmed] = ($wordCounts[$lower]['forms'][$trimmed] ?? 0) + 1;
            }
        }

        if (empty($wordCounts)) {
            return [];
        }

        uasort($wordCounts, fn ($a, $b) => $b['count'] <=> $a['count']);

        $result = [];
        $topSlice = array_slice($wordCounts, 0, $limit, true);

        foreach ($topSlice as $lower => $data) {
            arsort($data['forms']);
            $preferredForm = (string) array_key_first($data['forms']);
            $result[] = [
                'text' => $preferredForm,
                'value' => (int) $data['count'],
            ];
        }

        return $result;
    }
}
