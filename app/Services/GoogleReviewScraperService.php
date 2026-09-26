<?php

namespace App\Services;

use App\Models\Dealer;
use App\Models\Review;
use Exception;
use Illuminate\Http\Client\ConnectionException;
use Illuminate\Support\Carbon;
use Illuminate\Support\Facades\Config;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Log;

class GoogleReviewScraperService
{
    protected string $baseUrl;

    protected int $timeout;

    public function __construct(?string $baseUrl = null, ?int $timeout = null)
    {
        $this->baseUrl = $baseUrl ?: (string) (Config::get('services.google_review_scraper.url') ?: env('GBP_API_BASE_URL', 'http://localhost:3000'));
        $this->baseUrl = rtrim($this->baseUrl, '/');
        $this->timeout = $timeout ?: (int) Config::get('services.google_review_scraper.timeout', 180);
    }

    /**
     * Check if scraper API service is online and healthy.
     */
    public function isHealthy(): bool
    {
        try {
            $response = Http::timeout(5)->get("{$this->baseUrl}/health");

            return $response->successful() && ($response->json('status') === 'ok');
        } catch (ConnectionException) {
            return false;
        } catch (\Throwable $e) {
            Log::warning('GoogleReviewScraper health check failed: '.$e->getMessage());

            return false;
        }
    }

    /**
     * Get current proxy pool statistics and health status.
     *
     * @return array{enabled: bool, totalLoaded: int, deadCount: int, activePoolSize?: int, lastFetchedAt: ?string, sourceUrl: string}|null
     */
    public function getProxyStats(): ?array
    {
        try {
            $response = Http::timeout(5)->get("{$this->baseUrl}/api/proxy/stats");

            if ($response->successful() && $response->json('success')) {
                return $response->json('data');
            }

            return null;
        } catch (\Throwable) {
            return null;
        }
    }

    /**
     * Start an asynchronous background scraping job for a dealer.
     *
     * @return array{jobId: string, status: string, checkUrl: string}
     *
     * @throws Exception
     */
    public function startScrapingJob(Dealer $dealer, int $maxReviews = 20, string $sortBy = 'newest', bool $useProxy = true): array
    {
        $payload = [
            'type' => 'full',
            'maxReviews' => max(1, min(5000, $maxReviews)),
            'personalData' => true,
            'language' => 'id',
            'sortBy' => in_array($sortBy, ['newest', 'highest', 'lowest', 'relevant'], true) ? $sortBy : 'newest',
            'useProxy' => $useProxy,
        ];

        if (! empty($dealer->link_google_maps)) {
            $payload['url'] = $dealer->link_google_maps;
        } else {
            $query = trim($dealer->nama_dealer.' '.($dealer->alamat ?? ''));
            if ($query === '') {
                throw new Exception("Dealer {$dealer->nama_dealer} tidak memiliki URL Google Maps maupun alamat untuk dicari.");
            }
            $payload['query'] = $query;
        }

        try {
            $response = Http::timeout(15)
                ->post("{$this->baseUrl}/api/scrape/jobs", $payload);

            if (! $response->successful()) {
                $errorMsg = $response->json('error') ?? 'Gagal membuat scraping job di scraper API.';
                throw new Exception($errorMsg);
            }

            $data = $response->json();

            return [
                'jobId' => (string) $data['jobId'],
                'status' => (string) ($data['status'] ?? 'queued'),
                'checkUrl' => (string) ($data['checkUrl'] ?? "/api/scrape/jobs/{$data['jobId']}"),
            ];
        } catch (ConnectionException $e) {
            throw new Exception("Gagal terhubung ke service scraper di {$this->baseUrl}. Pastikan service scraper aktif.");
        }
    }

    /**
     * Get the status and result of a scraping job.
     *
     * @return array{jobId: string, status: string, error: ?string, result: ?array, createdAt?: string, updatedAt?: string}
     *
     * @throws Exception
     */
    public function getJobStatus(string $jobId): array
    {
        try {
            $response = Http::timeout(10)->get("{$this->baseUrl}/api/scrape/jobs/{$jobId}");

            if ($response->status() === 404) {
                throw new Exception("Scraping job {$jobId} tidak ditemukan.");
            }

            if (! $response->successful()) {
                throw new Exception('Gagal memeriksa status scraping job.');
            }

            return $response->json();
        } catch (ConnectionException $e) {
            throw new Exception("Gagal terhubung ke service scraper di {$this->baseUrl}.");
        }
    }

    /**
     * Build direct Google Maps review URL from review ID and dealer context.
     */
    public function buildGoogleReviewUrl(?string $reviewId, Dealer $dealer, ?array $profile = null): ?string
    {
        if (empty($reviewId)) {
            return null;
        }

        $lat = $dealer->latitude ?? ($profile['latitude'] ?? null);
        $lng = $dealer->longitude ?? ($profile['longitude'] ?? null);

        $placeUrl = $profile['placeUrl'] ?? $dealer->link_google_maps ?? '';
        $cidHex = null;
        if (preg_match('/:(0x[0-9a-fA-F]+)/', (string) $placeUrl, $matches)) {
            $cidHex = $matches[1];
        }

        $latPart = ($lat !== null && $lng !== null) ? "@{$lat},{$lng},785m/" : '';
        $cidPart = $cidHex ? "!2m1!1s0x0:{$cidHex}" : '';

        return "https://www.google.com/maps/reviews/{$latPart}data=!3m2!1e3!4b1!4m6!14m5!1m4!2m3!1s{$reviewId}{$cidPart}?entry=ttu";
    }

    /**
     * Parse and sync dealer reviews from scraping job result payload into database.
     *
     * @param  array<string, mixed>  $jobResult
     * @return array{imported: int, updated: int, total_scraped: int, dealer_id: int, dealer_nama: string, dealer_rating: ?float, dealer_total_review: ?int}
     */
    public function syncDealerReviewsFromJobResult(Dealer $dealer, array $jobResult): array
    {
        // Extract data wrapper
        $data = $jobResult['data'] ?? $jobResult['results'][0] ?? $jobResult;
        $profile = $data['profile'] ?? null;
        $reviewsList = $data['reviews'] ?? [];

        // 1. Update dealer profile metadata if available
        if (is_array($profile)) {
            $updatedDealerFields = false;

            if (isset($profile['rating']) && is_numeric($profile['rating'])) {
                $dealer->star_rate = (float) $profile['rating'];
                $updatedDealerFields = true;
            }

            if (isset($profile['reviewCount']) && is_numeric($profile['reviewCount'])) {
                $dealer->total_review = (int) $profile['reviewCount'];
                $updatedDealerFields = true;
            }

            if ($dealer->latitude === null && isset($profile['latitude']) && is_numeric($profile['latitude'])) {
                $dealer->latitude = (float) $profile['latitude'];
                $updatedDealerFields = true;
            }

            if ($dealer->longitude === null && isset($profile['longitude']) && is_numeric($profile['longitude'])) {
                $dealer->longitude = (float) $profile['longitude'];
                $updatedDealerFields = true;
            }

            if (empty($dealer->alamat) && ! empty($profile['address'])) {
                // Clean leading special Unicode icons if any (e.g. Google Maps map-pin \x{e0c8})
                $cleanAddress = preg_replace('/^[\p{Co}\p{So}\s]+/u', '', (string) $profile['address']);
                $dealer->alamat = trim((string) $cleanAddress);
                $updatedDealerFields = true;
            }

            if (empty($dealer->no_telp_showroom) && ! empty($profile['phone'])) {
                // Clean leading phone icon
                $cleanPhone = preg_replace('/^[\p{Co}\p{So}\s]+/u', '', (string) $profile['phone']);
                $dealer->no_telp_showroom = trim((string) $cleanPhone);
                $updatedDealerFields = true;
            }

            if ($updatedDealerFields) {
                $dealer->save();
            }
        }

        // 2. Iterate and sync reviews
        $importedCount = 0;
        $updatedCount = 0;

        foreach ($reviewsList as $rev) {
            $rawAuthor = $rev['author'] ?? null;
            $author = ! empty($rawAuthor) ? trim((string) $rawAuthor) : 'Pengguna Google';
            $starRate = isset($rev['rating']) ? (float) $rev['rating'] : 5.0;
            $reviewText = ! empty($rev['text']) ? trim((string) $rev['text']) : null;

            // Parse publish date
            $publishedDate = null;
            if (! empty($rev['publishedAtDate'])) {
                try {
                    $publishedDate = Carbon::parse($rev['publishedAtDate'])->format('Y-m-d');
                } catch (\Throwable) {
                    $publishedDate = null;
                }
            }
            if (! $publishedDate) {
                $publishedDate = now()->format('Y-m-d');
            }

            // Owner response
            $ownerResp = $rev['ownerResponse'] ?? null;
            $hasOwnerResponse = is_array($ownerResp) && ! empty($ownerResp['text']);
            $ownerText = $hasOwnerResponse ? trim((string) $ownerResp['text']) : null;
            $ownerDate = null;
            if ($hasOwnerResponse && ! empty($ownerResp['date'])) {
                try {
                    $ownerDate = Carbon::parse($ownerResp['date'])->format('Y-m-d');
                } catch (\Throwable) {
                    $ownerDate = null;
                }
            }

            // Review URL
            $reviewId = $rev['reviewId'] ?? null;
            $reviewUrl = $rev['reviewUrl'] ?? null;
            if (! $reviewUrl && $reviewId) {
                $reviewUrl = $this->buildGoogleReviewUrl($reviewId, $dealer, is_array($profile) ? $profile : null);
            }

            $authorUrl = $rev['authorProfileUrl'] ?? null;
            $placeUrl = $profile['placeUrl'] ?? null;
            $googleReviewUrl = $reviewUrl ?: ($authorUrl ?: ($placeUrl ?: $dealer->link_google_maps));

            // Find existing review for deduplication
            $isAnonymous = in_array(
                mb_strtolower(trim($author)),
                ['pengguna google', 'google user', 'a google user', 'anonymous', 'google customer', 'pelanggan google'],
                true
            );

            $existing = null;

            if (! $isAnonymous) {
                // A named reviewer only has one review per dealer on Google Maps
                $existing = Review::where('dealer_id', $dealer->id)
                    ->where('nama_reviewer', $author)
                    ->first();
            }

            if (! $existing && $reviewText !== null && $reviewText !== '') {
                // If anonymous or name differed, match by review text
                $existing = Review::where('dealer_id', $dealer->id)
                    ->where('review', $reviewText)
                    ->first();
            }

            if (! $existing && $publishedDate !== null && $reviewText !== null && $reviewText !== '') {
                // Fallback: match by publish date and review text
                $existing = Review::where('dealer_id', $dealer->id)
                    ->where('tanggal_publish_review', $publishedDate)
                    ->where('review', $reviewText)
                    ->first();
            }

            if ($existing) {
                $existing->update([
                    'star_rate' => $starRate,
                    'review' => $reviewText ?? $existing->review,
                    'tanggal_publish_review' => $publishedDate ?: $existing->tanggal_publish_review,
                    'respon_from_owner' => $hasOwnerResponse,
                    'tanggal_respon' => $ownerDate ?? ($hasOwnerResponse ? $existing->tanggal_respon : null),
                    'respon' => $ownerText ?? ($hasOwnerResponse ? $existing->respon : null),
                    'google_review_url' => $googleReviewUrl ?: $existing->google_review_url,
                ]);
                $updatedCount++;
            } else {
                Review::create([
                    'dealer_id' => $dealer->id,
                    'nama_reviewer' => $author,
                    'tanggal_publish_review' => $publishedDate,
                    'star_rate' => $starRate,
                    'review' => $reviewText,
                    'respon_from_owner' => $hasOwnerResponse,
                    'tanggal_respon' => $ownerDate,
                    'respon' => $ownerText,
                    'google_review_url' => $googleReviewUrl,
                ]);
                $importedCount++;
            }
        }

        return [
            'imported' => $importedCount,
            'updated' => $updatedCount,
            'total_scraped' => count($reviewsList),
            'dealer_id' => $dealer->id,
            'dealer_nama' => $dealer->nama_dealer,
            'dealer_rating' => $dealer->fresh()->star_rate,
            'dealer_total_review' => $dealer->fresh()->total_review,
        ];
    }

    /**
     * Synchronously execute scraping and review synchronization for a dealer by polling background job.
     *
     * @param  callable(?string, ?array): void|null  $onProgress
     * @return array{imported: int, updated: int, total_scraped: int, dealer_id: int, dealer_nama: string, dealer_rating: ?float, dealer_total_review: ?int}
     *
     * @throws Exception
     */
    public function syncDealerDirect(
        Dealer $dealer,
        int $maxReviews = 20,
        string $sortBy = 'newest',
        int $maxWaitSeconds = 180,
        ?callable $onProgress = null
    ): array {
        $job = $this->startScrapingJob($dealer, $maxReviews, $sortBy);
        $jobId = $job['jobId'];

        $startTime = time();

        while ((time() - $startTime) < $maxWaitSeconds) {
            sleep(2);

            $statusData = $this->getJobStatus($jobId);
            $status = $statusData['status'] ?? 'unknown';

            if ($onProgress) {
                $onProgress($status, $statusData);
            }

            if ($status === 'completed') {
                $result = $statusData['result'] ?? null;
                if (! is_array($result)) {
                    throw new Exception('Scraping selesai tetapi tidak menghasilkan data.');
                }

                return $this->syncDealerReviewsFromJobResult($dealer, $result);
            }

            if ($status === 'failed') {
                $errMsg = $statusData['error'] ?? 'Scraping job gagal dijalankan oleh scraper service.';
                throw new Exception($errMsg);
            }
        }

        throw new Exception("Scraping timeout melebihi batas {$maxWaitSeconds} detik.");
    }
}
