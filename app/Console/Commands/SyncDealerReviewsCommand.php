<?php

namespace App\Console\Commands;

use App\Models\Dealer;
use App\Services\GoogleReviewScraperService;
use Exception;
use Illuminate\Console\Command;
use Illuminate\Database\Eloquent\Collection;

class SyncDealerReviewsCommand extends Command
{
    /**
     * The name and signature of the console command.
     *
     * @var string
     */
    protected $signature = 'reviews:sync
                            {dealer? : ID atau Kode Dealer untuk disinkronisasi}
                            {--all : Sinkronisasi ulasan untuk semua dealer}
                            {--limit=20 : Jumlah maksimal review yang ditarik per dealer (1-100)}
                            {--sort=newest : Urutan review: newest, highest, lowest, relevant}';

    /**
     * The console command description.
     *
     * @var string
     */
    protected $description = 'Tarik dan sinkronkan Google Review dari API Scraper (port 3000) ke menu review';

    /**
     * Execute the console command.
     */
    public function handle(GoogleReviewScraperService $scraperService): int
    {
        $this->info('========================================================');
        $this->info('  Sinkronisasi Google Review Scraper (Pantau)');
        $this->info('========================================================');

        $this->line('Memeriksa status API Scraper...');
        if (! $scraperService->isHealthy()) {
            $this->error('Service Scraper API di http://localhost:3000 tidak dapat dihubungi.');
            $this->warn('Pastikan service node/scraper berjalan di port 3000 (contoh: npm run dev pada direktori gbpscrap).');

            return self::FAILURE;
        }

        $this->info('Service Scraper online dan siap.');

        $dealerArg = $this->argument('dealer');
        $syncAll = (bool) $this->option('all');
        $limit = max(1, min(100, (int) $this->option('limit')));
        $sort = (string) $this->option('sort');

        /** @var Collection<int, Dealer> $dealers */
        if ($dealerArg) {
            $dealers = Dealer::where('id', $dealerArg)
                ->orWhere('kode_dealer', $dealerArg)
                ->get();

            if ($dealers->isEmpty()) {
                $this->error("Dealer dengan ID atau Kode '{$dealerArg}' tidak ditemukan.");

                return self::FAILURE;
            }
        } elseif ($syncAll) {
            $dealers = Dealer::whereNotNull('link_google_maps')
                ->orWhereNotNull('nama_dealer')
                ->get();

            if ($dealers->isEmpty()) {
                $this->warn('Tidak ada data dealer untuk disinkronisasi.');

                return self::SUCCESS;
            }
        } else {
            $this->error('Harap tentukan ID/Kode Dealer atau gunakan flag --all.');
            $this->line('Contoh: php artisan reviews:sync 1 --limit=10');
            $this->line('Contoh: php artisan reviews:sync --all --limit=10');

            return self::INVALID;
        }

        $this->info("Menemukan {$dealers->count()} dealer untuk diproses (Limit: {$limit} reviews, Sort: {$sort}).");

        $results = [];

        foreach ($dealers as $index => $dealer) {
            $step = $index + 1;
            $this->line('');
            $this->comment("[{$step}/{$dealers->count()}] Memproses: {$dealer->nama_dealer} ({$dealer->kode_dealer})...");

            try {
                $syncResult = $scraperService->syncDealerDirect(
                    dealer: $dealer,
                    maxReviews: $limit,
                    sortBy: $sort,
                    maxWaitSeconds: 180,
                    onProgress: function (string $status): void {
                        $this->output->write("<fg=gray>Status Scraping: {$status}...</fg=gray>\r");
                    }
                );

                $this->info("\n  Berhasil: {$syncResult['imported']} ulasan baru diimpor, {$syncResult['updated']} ulasan diperbarui.");

                $results[] = [
                    'Kode' => $dealer->kode_dealer,
                    'Dealer' => $dealer->nama_dealer,
                    'Rating' => $syncResult['dealer_rating'] ?? '-',
                    'Total Review' => $syncResult['dealer_total_review'] ?? '-',
                    'Diimpor' => $syncResult['imported'],
                    'Diperbarui' => $syncResult['updated'],
                    'Status' => 'Sukses',
                ];
            } catch (Exception $e) {
                $this->error("\n  Gagal: ".$e->getMessage());

                $results[] = [
                    'Kode' => $dealer->kode_dealer,
                    'Dealer' => $dealer->nama_dealer,
                    'Rating' => $dealer->star_rate ?? '-',
                    'Total Review' => $dealer->total_review ?? '-',
                    'Diimpor' => 0,
                    'Diperbarui' => 0,
                    'Status' => 'Gagal: '.$e->getMessage(),
                ];
            }
        }

        $this->line('');
        $this->table(
            ['Kode', 'Nama Dealer', 'Rating', 'Total Review', 'Diimpor', 'Diperbarui', 'Status'],
            $results
        );

        $this->info('Sinkronisasi selesai.');

        return self::SUCCESS;
    }
}
