<?php

namespace App\Console\Commands;

use App\Services\SyncReviewServerService;
use Illuminate\Console\Attributes\Description;
use Illuminate\Console\Attributes\Signature;
use Illuminate\Console\Command;

#[Signature('reviews:sync-server {--target=all} {--limit=50} {--sort=newest} {--proxy} {--no-proxy}')]
#[Description('Menjalankan proses sinkronisasi ulasan Google Maps di background server')]
class SyncReviewsServerCommand extends Command
{
    /**
     * Execute the console command.
     */
    public function handle(SyncReviewServerService $serverService): int
    {
        $target = (string) ($this->option('target') ?? 'all');
        $limit = (int) ($this->option('limit') ?? 50);
        $sort = (string) ($this->option('sort') ?? 'newest');
        $useProxy = $this->option('no-proxy') ? false : true;

        $this->info("Menjalankan sinkronisasi ulasan Google Maps di server (Target: {$target}, Limit: {$limit}, Sort: {$sort}, Proxy: ".($useProxy ? 'Ya' : 'Tidak').')...');

        $serverService->executeServerSync(
            target: $target,
            limit: $limit,
            sort: $sort,
            useProxy: $useProxy
        );

        $this->info('Proses sinkronisasi server selesai.');

        return self::SUCCESS;
    }
}
