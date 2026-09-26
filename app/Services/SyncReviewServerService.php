<?php

namespace App\Services;

use App\Models\Dealer;
use Exception;
use Illuminate\Support\Carbon;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Str;

class SyncReviewServerService
{
    public const CACHE_STATUS_KEY = 'sync_reviews_server_status';

    public const CACHE_LOGS_KEY = 'sync_reviews_server_logs';

    public const CACHE_CANCEL_KEY = 'sync_reviews_server_cancel_signal';

    public const CACHE_TTL_DAYS = 7;

    public function __construct(
        protected GoogleReviewScraperService $scraperService
    ) {}

    /**
     * Get the current sync session status from server cache.
     *
     * @return array<string, mixed>
     */
    public function getStatus(): array
    {
        $default = [
            'status' => 'idle', // 'idle' | 'starting' | 'running' | 'completed' | 'failed' | 'cancelled'
            'syncMessage' => '',
            'syncError' => null,
            'progressPercent' => 0,
            'bulkProgress' => null,
            'syncResult' => null,
            'startedAt' => null,
            'target' => null,
        ];

        return Cache::get(self::CACHE_STATUS_KEY, $default);
    }

    /**
     * Get the log entries from server cache.
     *
     * @return array<int, array{id: string, time: string, type: string, message: string}>
     */
    public function getLogs(): array
    {
        return Cache::get(self::CACHE_LOGS_KEY, []);
    }

    /**
     * Append a log entry to server cache.
     */
    public function addLog(string $message, string $type = 'info'): void
    {
        $entry = [
            'id' => (string) Str::uuid(),
            'time' => Carbon::now()->format('H:i:s'),
            'type' => $type,
            'message' => $message,
        ];

        $logs = $this->getLogs();
        $logs[] = $entry;

        // Keep last 300 logs
        if (count($logs) > 300) {
            $logs = array_slice($logs, -300);
        }

        Cache::put(self::CACHE_LOGS_KEY, $logs, now()->addDays(self::CACHE_TTL_DAYS));
    }

    /**
     * Clear all logs in server cache.
     */
    public function clearLogs(): void
    {
        Cache::forget(self::CACHE_LOGS_KEY);
        $this->addLog('Log aktivitas server dibersihkan.', 'info');
    }

    /**
     * Update the server sync session status in cache.
     *
     * @param  array<string, mixed>  $data
     */
    public function updateStatus(array $data): void
    {
        $current = $this->getStatus();
        $merged = array_merge($current, $data);

        Cache::put(self::CACHE_STATUS_KEY, $merged, now()->addDays(self::CACHE_TTL_DAYS));
    }

    /**
     * Reset the server sync status back to idle.
     */
    public function resetStatus(): void
    {
        Cache::forget(self::CACHE_CANCEL_KEY);
        Cache::put(self::CACHE_STATUS_KEY, [
            'status' => 'idle',
            'syncMessage' => '',
            'syncError' => null,
            'progressPercent' => 0,
            'bulkProgress' => null,
            'syncResult' => null,
            'startedAt' => null,
            'target' => null,
        ], now()->addDays(self::CACHE_TTL_DAYS));
    }

    /**
     * Check if a cancel request was signaled from any client.
     */
    public function isCancelRequested(): bool
    {
        return (bool) Cache::get(self::CACHE_CANCEL_KEY, false);
    }

    /**
     * Signal a cancel request from a client.
     */
    public function requestCancel(): void
    {
        Cache::put(self::CACHE_CANCEL_KEY, true, now()->addHours(2));
        $this->addLog('Permintaan pembatalan diterima. Menunggu proses saat ini berhenti...', 'warn');
        $this->updateStatus([
            'syncMessage' => 'Menghentikan sinkronisasi setelah proses saat ini selesai...',
        ]);
    }

    /**
     * Launch the server-side sync background process.
     */
    public function launchBackgroundProcess(string $target, int $limit, string $sort, bool $useProxy): void
    {
        // Reset cancel signal & initialize state
        Cache::forget(self::CACHE_CANCEL_KEY);

        $initialMessage = $target === 'all'
            ? 'Memulai background job sinkronisasi semua showroom di server...'
            : 'Memulai background job sinkronisasi showroom di server...';

        $this->updateStatus([
            'status' => 'starting',
            'syncMessage' => $initialMessage,
            'syncError' => null,
            'progressPercent' => 5,
            'bulkProgress' => null,
            'syncResult' => null,
            'startedAt' => time(),
            'target' => $target,
        ]);

        $this->addLog($initialMessage, 'info');

        $phpBinary = PHP_BINARY;
        $artisanPath = base_path('artisan');

        $proxyFlag = $useProxy ? '--proxy' : '--no-proxy';
        $targetArg = escapeshellarg($target);
        $sortArg = escapeshellarg($sort);

        if (strtoupper(substr(PHP_OS, 0, 3)) === 'WIN') {
            $cmd = sprintf(
                'start /B "" %s %s reviews:sync-server --target=%s --limit=%d --sort=%s %s',
                escapeshellarg($phpBinary),
                escapeshellarg($artisanPath),
                $targetArg,
                $limit,
                $sortArg,
                $proxyFlag
            );
            pclose(popen($cmd, 'r'));
        } else {
            $cmd = sprintf(
                '%s %s reviews:sync-server --target=%s --limit=%d --sort=%s %s > /dev/null 2>&1 &',
                escapeshellarg($phpBinary),
                escapeshellarg($artisanPath),
                $targetArg,
                $limit,
                $sortArg,
                $proxyFlag
            );
            exec($cmd);
        }
    }

    /**
     * Execute the full sync process directly on the server.
     * This method is called by the Artisan command running in background on the server.
     */
    public function executeServerSync(string $target, int $limit, string $sort, bool $useProxy): void
    {
        $limit = max(1, min(5000, $limit));

        if (! $this->scraperService->isHealthy()) {
            $errMsg = 'Service Scraper API di port 3000 tidak aktif atau tidak dapat dihubungi.';
            $this->addLog("[Error] {$errMsg}", 'error');
            $this->updateStatus([
                'status' => 'failed',
                'syncError' => $errMsg,
                'syncMessage' => $errMsg,
            ]);

            return;
        }

        $this->updateStatus([
            'status' => 'running',
            'progressPercent' => 10,
        ]);

        if ($target === 'all') {
            $this->executeBulkSync($limit, $sort, $useProxy);
        } else {
            $this->executeSingleSync((int) $target, $limit, $sort, $useProxy);
        }
    }

    /**
     * Execute single dealer sync on server.
     */
    protected function executeSingleSync(int $dealerId, int $limit, string $sort, bool $useProxy): void
    {
        $dealer = Dealer::find($dealerId);

        if (! $dealer) {
            $errMsg = 'Showroom tidak ditemukan.';
            $this->addLog("[Error] {$errMsg}", 'error');
            $this->updateStatus([
                'status' => 'failed',
                'syncError' => $errMsg,
                'syncMessage' => $errMsg,
            ]);

            return;
        }

        if (empty($dealer->link_google_maps)) {
            $errMsg = "Dealer {$dealer->nama_dealer} belum memiliki link Google Maps.";
            $this->addLog("[Error] {$errMsg}", 'error');
            $this->updateStatus([
                'status' => 'failed',
                'syncError' => $errMsg,
                'syncMessage' => $errMsg,
            ]);

            return;
        }

        $startMsg = "Scraper server memulai ekstraksi ulasan Google Maps untuk {$dealer->kode_dealer} - {$dealer->nama_dealer} (Limit: {$limit} ulasan)...";
        $this->addLog($startMsg, 'info');
        $this->updateStatus([
            'syncMessage' => $startMsg,
            'progressPercent' => 20,
        ]);

        try {
            $jobData = $this->scraperService->startScrapingJob(
                dealer: $dealer,
                maxReviews: $limit,
                sortBy: $sort,
                useProxy: $useProxy
            );

            $jobId = $jobData['jobId'];
            $runMsg = "Scraping job #{$jobId} aktif. Browser Playwright sedang mengambil data...";
            $this->addLog($runMsg, 'info');
            $this->updateStatus([
                'syncMessage' => $runMsg,
                'progressPercent' => 35,
            ]);

            $startTime = time();
            $maxWait = 300; // 5 menit
            $completed = false;

            while (! $completed && (time() - $startTime) < $maxWait) {
                if ($this->isCancelRequested()) {
                    $this->addLog("Sinkronisasi untuk {$dealer->nama_dealer} dibatalkan oleh pengguna.", 'warn');
                    $this->updateStatus([
                        'status' => 'cancelled',
                        'syncMessage' => 'Sinkronisasi dibatalkan oleh pengguna.',
                    ]);

                    return;
                }

                sleep(2);
                $elapsed = time() - $startTime;
                $pct = min(90, 35 + (int) ($elapsed / 3));
                $this->updateStatus(['progressPercent' => $pct]);

                $statusData = $this->scraperService->getJobStatus($jobId);
                $status = $statusData['status'] ?? 'unknown';

                if ($status === 'completed') {
                    $completed = true;
                    $result = $statusData['result'] ?? null;
                    if (! is_array($result)) {
                        throw new Exception('Data hasil scraping tidak valid dari scraper service.');
                    }

                    $syncResult = $this->scraperService->syncDealerReviewsFromJobResult($dealer, $result);
                    $doneMsg = "Selesai! Berhasil mengimpor {$syncResult['imported']} ulasan baru dan memperbarui {$syncResult['updated']} ulasan.";

                    $this->addLog(
                        "[Selesai] {$dealer->nama_dealer}: +{$syncResult['imported']} baru, {$syncResult['updated']} terupdate. Rating Google: ★ ".($syncResult['dealer_rating'] ?? '-').' ('.($syncResult['dealer_total_review'] ?? '-').' ulasan)',
                        'success'
                    );

                    $this->updateStatus([
                        'status' => 'completed',
                        'progressPercent' => 100,
                        'syncMessage' => $doneMsg,
                        'syncResult' => $syncResult,
                    ]);

                    return;
                }

                if ($status === 'failed') {
                    $errMsg = $statusData['error'] ?? 'Scraper API melaporkan kegagalan job.';
                    throw new Exception($errMsg);
                }
            }

            throw new Exception("Scraping timeout melebihi batas {$maxWait} detik.");
        } catch (Exception $e) {
            $errMsg = $e->getMessage();
            $this->addLog("[Error] {$errMsg}", 'error');
            $this->updateStatus([
                'status' => 'failed',
                'syncError' => $errMsg,
                'syncMessage' => $errMsg,
            ]);
        }
    }

    /**
     * Execute bulk sync for all ready dealers on server.
     */
    protected function executeBulkSync(int $limit, string $sort, bool $useProxy): void
    {
        $dealers = Dealer::whereNotNull('link_google_maps')
            ->where('link_google_maps', '!=', '')
            ->orderBy('nama_dealer')
            ->get();

        if ($dealers->isEmpty()) {
            $errMsg = 'Tidak ada showroom dengan link Google Maps yang siap disinkronkan.';
            $this->addLog("[Error] {$errMsg}", 'error');
            $this->updateStatus([
                'status' => 'failed',
                'syncError' => $errMsg,
                'syncMessage' => $errMsg,
            ]);

            return;
        }

        $totalDealers = $dealers->count();
        $this->addLog(
            "Memulai sinkronisasi server untuk {$totalDealers} showroom (Limit: {$limit} ulasan per showroom, Urutan: {$sort})...",
            'info'
        );

        $totalImported = 0;
        $totalUpdated = 0;
        $processedCount = 0;

        foreach ($dealers as $index => $dealer) {
            if ($this->isCancelRequested()) {
                $this->addLog('Sinkronisasi massal dihentikan oleh pengguna.', 'warn');
                $finalMsg = "Sinkronisasi dihentikan. Berhasil memproses {$processedCount} dari {$totalDealers} showroom.";
                $this->updateStatus([
                    'status' => 'cancelled',
                    'syncMessage' => $finalMsg,
                    'progressPercent' => 100,
                    'syncResult' => [
                        'imported' => $totalImported,
                        'updated' => $totalUpdated,
                        'total_scraped' => $totalImported + $totalUpdated,
                        'dealer_nama' => "Semua Showroom ({$processedCount} selesai)",
                    ],
                ]);

                return;
            }

            $currentStep = $index + 1;
            $currentPct = (int) round(($index / $totalDealers) * 100);

            $bulkData = [
                'current' => $currentStep,
                'total' => $totalDealers,
                'currentDealerName' => "{$dealer->kode_dealer} - {$dealer->nama_dealer}",
                'currentImported' => $totalImported,
                'currentUpdated' => $totalUpdated,
            ];

            $stepMsg = "[{$currentStep}/{$totalDealers}] Sedang mengekstrak: {$dealer->nama_dealer}...";
            $this->addLog($stepMsg, 'info');

            $this->updateStatus([
                'progressPercent' => $currentPct,
                'syncMessage' => $stepMsg,
                'bulkProgress' => $bulkData,
            ]);

            try {
                $jobData = $this->scraperService->startScrapingJob(
                    dealer: $dealer,
                    maxReviews: $limit,
                    sortBy: $sort,
                    useProxy: $useProxy
                );

                $jobId = $jobData['jobId'];
                $completed = false;
                $startTime = time();
                $maxWait = 180;

                while (! $completed && (time() - $startTime) < $maxWait) {
                    if ($this->isCancelRequested()) {
                        break;
                    }

                    sleep(2);
                    $statusData = $this->scraperService->getJobStatus($jobId);
                    $status = $statusData['status'] ?? 'unknown';

                    if ($status === 'completed') {
                        $completed = true;
                        $result = $statusData['result'] ?? null;
                        if (is_array($result)) {
                            $syncResult = $this->scraperService->syncDealerReviewsFromJobResult($dealer, $result);
                            $imp = $syncResult['imported'] ?? 0;
                            $upd = $syncResult['updated'] ?? 0;
                            $totalImported += $imp;
                            $totalUpdated += $upd;
                            $processedCount++;

                            $bulkData['currentImported'] = $totalImported;
                            $bulkData['currentUpdated'] = $totalUpdated;
                            $this->updateStatus(['bulkProgress' => $bulkData]);

                            $this->addLog(
                                "[Berhasil] {$dealer->nama_dealer}: +{$imp} baru, {$upd} terupdate.",
                                'success'
                            );
                        }
                    } elseif ($status === 'failed') {
                        $completed = true;
                        $this->addLog("[Gagal] {$dealer->nama_dealer}: ".($statusData['error'] ?? 'Scraper gagal'), 'warn');
                    }
                }
            } catch (Exception $e) {
                $this->addLog("[Kendala] {$dealer->nama_dealer}: ".$e->getMessage(), 'warn');
            }
        }

        $finalMsg = "Selesai seluruhnya! Berhasil memproses {$processedCount} dari {$totalDealers} showroom. Total +{$totalImported} ulasan baru, {$totalUpdated} ulasan terupdate.";
        $this->addLog($finalMsg, 'success');

        $this->updateStatus([
            'status' => 'completed',
            'progressPercent' => 100,
            'syncMessage' => $finalMsg,
            'syncResult' => [
                'imported' => $totalImported,
                'updated' => $totalUpdated,
                'total_scraped' => $totalImported + $totalUpdated,
                'dealer_nama' => "Semua Showroom ({$processedCount} selesai)",
            ],
            'bulkProgress' => [
                'current' => $totalDealers,
                'total' => $totalDealers,
                'currentDealerName' => 'Selesai',
                'currentImported' => $totalImported,
                'currentUpdated' => $totalUpdated,
            ],
        ]);
    }
}
