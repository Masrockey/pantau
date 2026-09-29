<?php

namespace App\Http\Controllers;

use App\Models\Dealer;
use App\Models\ScrapingSchedule;
use App\Services\GoogleReviewScraperService;
use App\Services\SyncReviewServerService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\Validation\ValidationException;

class ScrapingScheduleController extends Controller
{
    /**
     * Store a newly created scraping schedule.
     */
    public function store(Request $request): RedirectResponse|JsonResponse
    {
        $this->authorizeSuperAdmin($request);

        $validated = $this->validateSchedule($request);

        $schedule = new ScrapingSchedule;
        $schedule->dealer_id = $validated['dealer_id'];
        $schedule->max_reviews = $validated['max_reviews'];
        $schedule->sort_by = $validated['sort_by'];
        $schedule->interval_value = $validated['interval_value'];
        $schedule->interval_unit = $validated['interval_unit'];
        $schedule->use_proxy = $validated['use_proxy'] ?? true;
        $schedule->is_active = $validated['is_active'] ?? true;
        $schedule->next_run_at = $schedule->calculateNextRun();
        $schedule->last_status = 'idle';
        $schedule->save();

        if ($request->wantsJson()) {
            return response()->json([
                'success' => true,
                'message' => 'Jadwal auto scrap berhasil dibuat.',
                'schedule' => $schedule->load('dealer:id,kode_dealer,nama_dealer'),
            ]);
        }

        return back()->with('success', 'Jadwal auto scrap berhasil dibuat.');
    }

    /**
     * Update the specified scraping schedule.
     */
    public function update(Request $request, ScrapingSchedule $schedule): RedirectResponse|JsonResponse
    {
        $this->authorizeSuperAdmin($request);

        $validated = $this->validateSchedule($request);

        $schedule->dealer_id = $validated['dealer_id'];
        $schedule->max_reviews = $validated['max_reviews'];
        $schedule->sort_by = $validated['sort_by'];
        $schedule->interval_value = $validated['interval_value'];
        $schedule->interval_unit = $validated['interval_unit'];
        $schedule->use_proxy = $validated['use_proxy'] ?? true;
        if (isset($validated['is_active'])) {
            $schedule->is_active = $validated['is_active'];
        }
        $schedule->next_run_at = $schedule->calculateNextRun();
        $schedule->save();

        if ($request->wantsJson()) {
            return response()->json([
                'success' => true,
                'message' => 'Jadwal auto scrap berhasil diperbarui.',
                'schedule' => $schedule->load('dealer:id,kode_dealer,nama_dealer'),
            ]);
        }

        return back()->with('success', 'Jadwal auto scrap berhasil diperbarui.');
    }

    /**
     * Remove the specified scraping schedule.
     */
    public function destroy(Request $request, ScrapingSchedule $schedule): RedirectResponse|JsonResponse
    {
        $this->authorizeSuperAdmin($request);

        $schedule->delete();

        if ($request->wantsJson()) {
            return response()->json([
                'success' => true,
                'message' => 'Jadwal auto scrap berhasil dihapus.',
            ]);
        }

        return back()->with('success', 'Jadwal auto scrap berhasil dihapus.');
    }

    /**
     * Toggle active state of the schedule.
     */
    public function toggle(Request $request, ScrapingSchedule $schedule): RedirectResponse|JsonResponse
    {
        $this->authorizeSuperAdmin($request);

        $schedule->is_active = ! $schedule->is_active;
        if ($schedule->is_active) {
            $schedule->next_run_at = $schedule->calculateNextRun();
        }
        $schedule->save();

        $statusMsg = $schedule->is_active ? 'diaktifkan' : 'dinonaktifkan';

        if ($request->wantsJson()) {
            return response()->json([
                'success' => true,
                'message' => "Jadwal auto scrap berhasil {$statusMsg}.",
                'schedule' => $schedule->load('dealer:id,kode_dealer,nama_dealer'),
            ]);
        }

        return back()->with('success', "Jadwal auto scrap berhasil {$statusMsg}.");
    }

    /**
     * Manually trigger immediate execution of a schedule.
     */
    public function run(
        Request $request,
        ScrapingSchedule $schedule,
        GoogleReviewScraperService $scraperService,
        SyncReviewServerService $syncService
    ): JsonResponse|RedirectResponse {
        $this->authorizeSuperAdmin($request);

        if (! $scraperService->isHealthy()) {
            $message = 'Service Scraper API di port 3000 tidak aktif. Pastikan service scraper berjalan.';
            if ($request->wantsJson()) {
                return response()->json(['success' => false, 'message' => $message], 503);
            }

            return back()->with('error', $message);
        }

        $currentStatus = $syncService->getStatus();
        if (in_array($currentStatus['status'] ?? 'idle', ['starting', 'running'], true)) {
            $message = 'Proses sinkronisasi di server sedang berjalan. Harap tunggu hingga selesai.';
            if ($request->wantsJson()) {
                return response()->json(['success' => false, 'message' => $message], 409);
            }

            return back()->with('error', $message);
        }

        $target = $schedule->dealer_id ? (string) $schedule->dealer_id : 'all';
        if ($schedule->dealer_id) {
            $dealer = Dealer::find($schedule->dealer_id);
            if (! $dealer || empty($dealer->link_google_maps)) {
                $message = 'Showroom belum memiliki link Google Maps yang valid.';
                if ($request->wantsJson()) {
                    return response()->json(['success' => false, 'message' => $message], 422);
                }

                return back()->with('error', $message);
            }
        }

        $nextRun = $schedule->calculateNextRun();
        $schedule->update([
            'last_run_at' => now(),
            'next_run_at' => $nextRun,
            'last_status' => 'running',
            'last_message' => 'Dijalankan secara manual oleh admin.',
        ]);

        $syncService->launchBackgroundProcess(
            target: $target,
            limit: $schedule->max_reviews,
            sort: $schedule->sort_by,
            useProxy: $schedule->use_proxy
        );

        $message = "Proses auto scrap untuk jadwal #{$schedule->id} berhasil diluncurkan di server.";
        if ($request->wantsJson()) {
            return response()->json([
                'success' => true,
                'message' => $message,
                'schedule' => $schedule->load('dealer:id,kode_dealer,nama_dealer'),
                'serverStatus' => $syncService->getStatus(),
            ]);
        }

        return back()->with('success', $message);
    }

    /**
     * Validate schedule input data.
     *
     * @return array<string, mixed>
     */
    protected function validateSchedule(Request $request): array
    {
        $rawDealerId = $request->input('dealer_id');
        $dealerId = ($rawDealerId === 'all' || $rawDealerId === '' || $rawDealerId === null) ? null : (int) $rawDealerId;

        if ($dealerId !== null) {
            $exists = Dealer::where('id', $dealerId)->exists();
            if (! $exists) {
                throw ValidationException::withMessages([
                    'dealer_id' => 'Showroom yang dipilih tidak ditemukan.',
                ]);
            }
        }

        $validated = $request->validate([
            'max_reviews' => ['required', 'integer', 'min:1', 'max:5000'],
            'sort_by' => ['required', 'string', 'in:newest,highest,lowest,relevant'],
            'interval_value' => ['required', 'integer', 'min:1'],
            'interval_unit' => ['required', 'string', 'in:minute,hour,day,week'],
            'use_proxy' => ['nullable', 'boolean'],
            'is_active' => ['nullable', 'boolean'],
        ]);

        // Enforcement: minimal 5 menit, tidak boleh di bawah 5 menit
        if ($validated['interval_unit'] === 'minute' && (int) $validated['interval_value'] < 5) {
            throw ValidationException::withMessages([
                'interval_value' => 'Waktu update minimal adalah 5 menit (tidak boleh di bawah 5 menit).',
            ]);
        }

        $validated['dealer_id'] = $dealerId;

        return $validated;
    }

    /**
     * Check if user is super admin.
     */
    protected function authorizeSuperAdmin(Request $request): void
    {
        if (! $request->user()?->isSuperAdmin()) {
            abort(403, 'Hanya Super Admin yang dapat mengelola jadwal scraping.');
        }
    }
}
