<?php

namespace App\Console\Commands;

use App\Models\Dealer;
use App\Models\ScrapingSchedule;
use App\Services\GoogleReviewScraperService;
use App\Services\SyncReviewServerService;
use Illuminate\Console\Attributes\Description;
use Illuminate\Console\Attributes\Signature;
use Illuminate\Console\Command;

#[Signature('reviews:run-schedules')]
#[Description('Memeriksa dan menjalankan jadwal scraping ulasan Google Maps yang aktif dan telah jatuh tempo')]
class RunScrapingSchedulesCommand extends Command
{
    /**
     * Execute the console command.
     */
    public function handle(
        GoogleReviewScraperService $scraperService,
        SyncReviewServerService $syncService
    ): int {
        // Find the oldest due schedule
        $dueSchedule = ScrapingSchedule::query()
            ->where('is_active', true)
            ->where('next_run_at', '<=', now())
            ->orderBy('next_run_at')
            ->first();

        if (! $dueSchedule) {
            $this->info('Tidak ada jadwal scraping yang jatuh tempo saat ini.');

            return self::SUCCESS;
        }

        // Check scraper health
        if (! $scraperService->isHealthy()) {
            $dueSchedule->update([
                'last_status' => 'failed',
                'last_message' => 'Gagal: Service Scraper API di port 3000 tidak aktif.',
            ]);
            $this->warn('Scraper API di port 3000 tidak aktif. Melewati eksekusi jadwal.');

            return self::SUCCESS;
        }

        // Check if server sync is currently already in progress
        $status = $syncService->getStatus();
        if (in_array($status['status'] ?? 'idle', ['starting', 'running'], true)) {
            $this->info('Sinkronisasi server saat ini sedang berjalan. Menunggu hingga selesai sebelum jadwal berikutnya dieksekusi.');

            return self::SUCCESS;
        }

        // Validate dealer if targeted
        $target = $dueSchedule->dealer_id ? (string) $dueSchedule->dealer_id : 'all';
        if ($dueSchedule->dealer_id) {
            $dealer = Dealer::find($dueSchedule->dealer_id);
            if (! $dealer || empty($dealer->link_google_maps)) {
                $dueSchedule->update([
                    'last_run_at' => now(),
                    'next_run_at' => $dueSchedule->calculateNextRun(),
                    'last_status' => 'failed',
                    'last_message' => 'Dealer tidak ditemukan atau belum memiliki link Google Maps.',
                ]);
                $this->error("Jadwal #{$dueSchedule->id} gagal: showroom tidak ditemukan atau link maps kosong.");

                return self::SUCCESS;
            }
        }

        // Update schedule state
        $nextRun = $dueSchedule->calculateNextRun();
        $dueSchedule->update([
            'last_run_at' => now(),
            'next_run_at' => $nextRun,
            'last_status' => 'running',
            'last_message' => 'Auto scrap dimulai pada '.now()->format('d M Y H:i:s').'.',
        ]);

        $syncService->addLog("Jadwal auto scrap #{$dueSchedule->id} (Target: {$target}, Interval: {$dueSchedule->formatted_interval}) mulai dieksekusi.", 'info');

        // Launch background process
        $syncService->launchBackgroundProcess(
            target: $target,
            limit: $dueSchedule->max_reviews,
            sort: $dueSchedule->sort_by,
            useProxy: $dueSchedule->use_proxy
        );

        $this->info("Jadwal #{$dueSchedule->id} (Target: {$target}) berhasil diluncurkan.");

        return self::SUCCESS;
    }
}
