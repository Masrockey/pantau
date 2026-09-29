<?php

namespace App\Http\Controllers;

use App\Models\Dealer;
use Illuminate\Http\Request;
use Inertia\Inertia;
use Inertia\Response;

class RatingSimulationController extends Controller
{
    /**
     * Display the rating simulation page.
     */
    public function index(Request $request): Response
    {
        $user = $request->user();
        $isGlobal = $user?->hasGlobalAccess() ?? false;
        $userDealerId = $user?->dealer_id;

        $dealersQuery = Dealer::query()
            ->orderBy('nama_dealer');

        if (! $isGlobal) {
            $dealersQuery->where('id', $userDealerId);
        }

        $dealers = $dealersQuery->get([
            'id',
            'kode_dealer',
            'nama_dealer',
            'star_rate',
            'total_review',
            'link_google_maps',
            'pos_code',
        ]);

        $selectedDealerId = $request->string('dealer_id')->trim()->value();
        $currentDealer = null;

        if ($selectedDealerId !== '' && is_numeric($selectedDealerId)) {
            $currentDealer = $dealers->firstWhere('id', (int) $selectedDealerId);
        }

        if (! $currentDealer) {
            // Default to Arbi Motor 2 if exists (matching reference image), or first dealer
            $currentDealer = $dealers->first(function (Dealer $d) {
                return str_contains(strtolower($d->nama_dealer), 'arbi motor');
            }) ?? $dealers->first();
        }

        $currentZone = 'IMPROVEMENT ZONE';
        if ($currentDealer) {
            $star = (float) ($currentDealer->star_rate ?? 0);
            $rev = (int) ($currentDealer->total_review ?? 0);

            if ($star >= 4.7 && $rev >= 1000) {
                $currentZone = 'EXCELLENT ZONE';
            } elseif ($star >= 4.7 && $rev < 1000) {
                $currentZone = 'VOLUME ZONE';
            } elseif ($star < 4.7 && $rev >= 1000) {
                $currentZone = 'QUALITY ZONE';
            } else {
                $currentZone = 'IMPROVEMENT ZONE';
            }
        }

        $targetRating = (float) ($request->input('target_rating') ?? 4.80);
        if ($targetRating < 1.0 || $targetRating > 5.0) {
            $targetRating = 4.80;
        }

        return Inertia::render('rating-simulasi', [
            'dealers' => $dealers->map(fn (Dealer $d) => [
                'id' => $d->id,
                'kode_dealer' => $d->kode_dealer,
                'nama_dealer' => $d->nama_dealer,
                'star_rate' => $d->star_rate !== null ? (float) $d->star_rate : null,
                'total_review' => (int) ($d->total_review ?? 0),
                'link_google_maps' => $d->link_google_maps,
                'pos_code' => $d->pos_code,
            ]),
            'currentDealer' => $currentDealer ? [
                'id' => $currentDealer->id,
                'kode_dealer' => $currentDealer->kode_dealer,
                'nama_dealer' => $currentDealer->nama_dealer,
                'star_rate' => $currentDealer->star_rate !== null ? (float) $currentDealer->star_rate : null,
                'total_review' => (int) ($currentDealer->total_review ?? 0),
                'link_google_maps' => $currentDealer->link_google_maps,
                'pos_code' => $currentDealer->pos_code,
                'current_zone' => $currentZone,
            ] : null,
            'initialTargetRating' => $targetRating,
            'isGlobal' => $isGlobal,
        ]);
    }
}
