<?php

namespace App\Http\Controllers;

use App\Models\Dealer;
use Illuminate\Http\Request;
use Inertia\Inertia;
use Inertia\Response;

class GmbClusterController extends Controller
{
    /**
     * Display the GMB Cluster page.
     */
    public function index(Request $request): Response
    {
        $user = $request->user();
        $isGlobal = $user?->hasGlobalAccess() ?? false;
        $dealerScopeId = ! $isGlobal ? $user?->dealer_id : null;

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

        return Inertia::render('gmb-cluster', [
            'dealers' => $gmbClusterDealers,
            'summary' => $gmbClusterSummary,
            'isGlobal' => $isGlobal,
            'userRole' => $user?->role?->value ?? (string) ($user?->role ?? ''),
        ]);
    }
}
