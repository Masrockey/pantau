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
use Illuminate\Support\Str;

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

            $profileRating = $profile['rating'] ?? $profile['totalScore'] ?? null;
            if ($profileRating !== null && is_numeric($profileRating)) {
                $dealer->star_rate = (float) $profileRating;
                $updatedDealerFields = true;
            }

            $profileReviewCount = $profile['reviewCount'] ?? $profile['reviewsCount'] ?? null;
            if ($profileReviewCount !== null && is_numeric($profileReviewCount)) {
                $dealer->total_review = (int) $profileReviewCount;
                $updatedDealerFields = true;
            }

            $profileLat = $profile['latitude'] ?? $profile['location']['lat'] ?? null;
            if ($dealer->latitude === null && $profileLat !== null && is_numeric($profileLat)) {
                $dealer->latitude = (float) $profileLat;
                $updatedDealerFields = true;
            }

            $profileLng = $profile['longitude'] ?? $profile['location']['lng'] ?? null;
            if ($dealer->longitude === null && $profileLng !== null && is_numeric($profileLng)) {
                $dealer->longitude = (float) $profileLng;
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
            $rawAuthor = $rev['author'] ?? $rev['name'] ?? null;
            $author = ! empty($rawAuthor) ? trim((string) $rawAuthor) : 'Pengguna Google';
            $starRate = isset($rev['rating']) ? (float) $rev['rating'] : (isset($rev['stars']) ? (float) $rev['stars'] : 5.0);
            $reviewText = ! empty($rev['text']) ? trim((string) $rev['text']) : null;

            // Parse publish date
            $publishedDate = null;
            if (! empty($rev['publishedAtDate'])) {
                $publishedDate = $this->parseRelativeOrIsoDate((string) $rev['publishedAtDate']);
            }
            $rawRelativeTime = $rev['relativeTime'] ?? $rev['publishAt'] ?? null;
            if (! $publishedDate && ! empty($rawRelativeTime)) {
                $publishedDate = $this->parseRelativeOrIsoDate((string) $rawRelativeTime);
            }
            if (! $publishedDate) {
                $publishedDate = now()->format('Y-m-d');
            }

            // Owner response (supports both nested ownerResponse and Apify flat responseFromOwnerText/Date)
            $ownerResp = $rev['ownerResponse'] ?? null;
            $flatOwnerText = $rev['responseFromOwnerText'] ?? null;
            $flatOwnerDate = $rev['responseFromOwnerDate'] ?? null;
            $hasOwnerResponse = (is_array($ownerResp) && ! empty($ownerResp['text'])) || ! empty($flatOwnerText);
            $ownerText = is_array($ownerResp) && ! empty($ownerResp['text'])
                ? trim((string) $ownerResp['text'])
                : (! empty($flatOwnerText) ? trim((string) $flatOwnerText) : null);
            $ownerDate = null;
            if ($hasOwnerResponse) {
                $rawOwnerDate = is_array($ownerResp) && ! empty($ownerResp['date'])
                    ? (string) $ownerResp['date']
                    : (! empty($flatOwnerDate) ? (string) $flatOwnerDate : null);
                $ownerDate = $this->parseRelativeOrIsoDate($rawOwnerDate, $publishedDate);
            }

            // Review URL
            $reviewId = $rev['reviewId'] ?? null;
            $reviewUrl = $rev['reviewUrl'] ?? null;
            if (! $reviewUrl && $reviewId) {
                $reviewUrl = $this->buildGoogleReviewUrl($reviewId, $dealer, is_array($profile) ? $profile : null);
            }

            $authorUrl = $rev['authorProfileUrl'] ?? $rev['reviewerUrl'] ?? null;
            $placeUrl = $profile['placeUrl'] ?? $profile['url'] ?? null;
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
                    'tanggal_respon' => $ownerDate ?? ($hasOwnerResponse ? ($existing->tanggal_respon ?: $publishedDate) : null),
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
     * Parse and prepare staged reviews from scraping job result without saving to database.
     *
     * @param  array<string, mixed>  $jobResult
     * @return array{
     *     dealer_id: int,
     *     kode_dealer: string,
     *     nama_dealer: string,
     *     dealer_profile: ?array<string, mixed>,
     *     reviews: array<int, array<string, mixed>>,
     *     total: int,
     *     new_count: int,
     *     update_count: int
     * }
     */
    public function prepareStagedReviewsFromJobResult(Dealer $dealer, array $jobResult): array
    {
        // Extract data wrapper
        $data = $jobResult['data'] ?? $jobResult['results'][0] ?? $jobResult;
        $profile = $data['profile'] ?? null;
        $reviewsList = $data['reviews'] ?? [];

        $dealerProfile = null;
        if (is_array($profile)) {
            $dealerProfile = [
                'star_rate' => isset($profile['rating']) ? (float) $profile['rating'] : (isset($profile['totalScore']) ? (float) $profile['totalScore'] : null),
                'total_review' => isset($profile['reviewCount']) ? (int) $profile['reviewCount'] : (isset($profile['reviewsCount']) ? (int) $profile['reviewsCount'] : null),
                'latitude' => $profile['latitude'] ?? $profile['location']['lat'] ?? null,
                'longitude' => $profile['longitude'] ?? $profile['location']['lng'] ?? null,
                'address' => ! empty($profile['address']) ? trim(preg_replace('/^[\p{Co}\p{So}\s]+/u', '', (string) $profile['address'])) : null,
                'phone' => ! empty($profile['phone']) ? trim(preg_replace('/^[\p{Co}\p{So}\s]+/u', '', (string) $profile['phone'])) : null,
                'place_url' => $profile['placeUrl'] ?? $profile['url'] ?? null,
            ];
        }

        $stagedReviews = [];
        $newCount = 0;
        $updateCount = 0;

        foreach ($reviewsList as $rev) {
            $rawAuthor = $rev['author'] ?? $rev['name'] ?? null;
            $author = ! empty($rawAuthor) ? trim((string) $rawAuthor) : 'Pengguna Google';
            $starRate = isset($rev['rating']) ? (float) $rev['rating'] : (isset($rev['stars']) ? (float) $rev['stars'] : 5.0);
            $reviewText = ! empty($rev['text']) ? trim((string) $rev['text']) : null;

            // Parse publish date
            $publishedDate = null;
            if (! empty($rev['publishedAtDate'])) {
                $publishedDate = $this->parseRelativeOrIsoDate((string) $rev['publishedAtDate']);
            }
            $rawRelativeTime = $rev['relativeTime'] ?? $rev['publishAt'] ?? null;
            if (! $publishedDate && ! empty($rawRelativeTime)) {
                $publishedDate = $this->parseRelativeOrIsoDate((string) $rawRelativeTime);
            }
            if (! $publishedDate) {
                $publishedDate = now()->format('Y-m-d');
            }

            // Owner response
            $ownerResp = $rev['ownerResponse'] ?? null;
            $flatOwnerText = $rev['responseFromOwnerText'] ?? null;
            $flatOwnerDate = $rev['responseFromOwnerDate'] ?? null;
            $hasOwnerResponse = (is_array($ownerResp) && ! empty($ownerResp['text'])) || ! empty($flatOwnerText);
            $ownerText = is_array($ownerResp) && ! empty($ownerResp['text'])
                ? trim((string) $ownerResp['text'])
                : (! empty($flatOwnerText) ? trim((string) $flatOwnerText) : null);
            $ownerDate = null;
            if ($hasOwnerResponse) {
                $rawOwnerDate = is_array($ownerResp) && ! empty($ownerResp['date'])
                    ? (string) $ownerResp['date']
                    : (! empty($flatOwnerDate) ? (string) $flatOwnerDate : null);
                $ownerDate = $this->parseRelativeOrIsoDate($rawOwnerDate, $publishedDate);
            }

            // Review URL
            $reviewId = $rev['reviewId'] ?? null;
            $reviewUrl = $rev['reviewUrl'] ?? null;
            if (! $reviewUrl && $reviewId) {
                $reviewUrl = $this->buildGoogleReviewUrl($reviewId, $dealer, is_array($profile) ? $profile : null);
            }

            $authorUrl = $rev['authorProfileUrl'] ?? $rev['reviewerUrl'] ?? null;
            $placeUrl = $profile['placeUrl'] ?? $profile['url'] ?? null;
            $googleReviewUrl = $reviewUrl ?: ($authorUrl ?: ($placeUrl ?: $dealer->link_google_maps));

            // Find existing review for deduplication
            $isAnonymous = in_array(
                mb_strtolower(trim($author)),
                ['pengguna google', 'google user', 'a google user', 'anonymous', 'google customer', 'pelanggan google'],
                true
            );

            $existing = null;
            if (! $isAnonymous) {
                $existing = Review::where('dealer_id', $dealer->id)
                    ->where('nama_reviewer', $author)
                    ->first();
            }

            if (! $existing && $reviewText !== null && $reviewText !== '') {
                $existing = Review::where('dealer_id', $dealer->id)
                    ->where('review', $reviewText)
                    ->first();
            }

            if (! $existing && $publishedDate !== null && $reviewText !== null && $reviewText !== '') {
                $existing = Review::where('dealer_id', $dealer->id)
                    ->where('tanggal_publish_review', $publishedDate)
                    ->where('review', $reviewText)
                    ->first();
            }

            $statusAction = $existing ? 'update' : 'new';
            if ($statusAction === 'new') {
                $newCount++;
            } else {
                $updateCount++;
            }

            $stagedReviews[] = [
                'id' => (string) Str::uuid(),
                'dealer_id' => $dealer->id,
                'kode_dealer' => $dealer->kode_dealer,
                'nama_dealer' => $dealer->nama_dealer,
                'nama_reviewer' => $author,
                'author_profile_url' => $authorUrl,
                'star_rate' => $starRate,
                'tanggal_publish_review' => $publishedDate,
                'relative_time' => $rawRelativeTime,
                'review' => $reviewText,
                'respon_from_owner' => $hasOwnerResponse,
                'tanggal_respon' => $ownerDate,
                'respon' => $ownerText,
                'google_review_url' => $googleReviewUrl,
                'status_action' => $statusAction,
                'existing_id' => $existing?->id,
                'scraped_at' => now()->toIso8601String(),
                'dealer_profile' => $dealerProfile,
            ];
        }

        return [
            'dealer_id' => $dealer->id,
            'kode_dealer' => $dealer->kode_dealer,
            'nama_dealer' => $dealer->nama_dealer,
            'dealer_profile' => $dealerProfile,
            'reviews' => $stagedReviews,
            'total' => count($stagedReviews),
            'new_count' => $newCount,
            'update_count' => $updateCount,
        ];
    }

    /**
     * Commit a list of staged review items directly into the database.
     *
     * @param  array<int, array<string, mixed>>  $stagedReviews
     * @return array{imported: int, updated: int, total: int}
     */
    public function commitStagedReviews(array $stagedReviews): array
    {
        $importedCount = 0;
        $updatedCount = 0;

        // Group by dealer_id to update dealer metadata once per dealer
        $dealersUpdated = [];

        foreach ($stagedReviews as $item) {
            $dealerId = (int) ($item['dealer_id'] ?? 0);
            if (! $dealerId) {
                continue;
            }

            // Update dealer profile if available
            if (! isset($dealersUpdated[$dealerId]) && ! empty($item['dealer_profile']) && is_array($item['dealer_profile'])) {
                $dealer = Dealer::find($dealerId);
                if ($dealer) {
                    $prof = $item['dealer_profile'];
                    $changed = false;
                    if (isset($prof['star_rate']) && is_numeric($prof['star_rate'])) {
                        $dealer->star_rate = (float) $prof['star_rate'];
                        $changed = true;
                    }
                    if (isset($prof['total_review']) && is_numeric($prof['total_review'])) {
                        $dealer->total_review = (int) $prof['total_review'];
                        $changed = true;
                    }
                    if ($dealer->latitude === null && isset($prof['latitude']) && is_numeric($prof['latitude'])) {
                        $dealer->latitude = (float) $prof['latitude'];
                        $changed = true;
                    }
                    if ($dealer->longitude === null && isset($prof['longitude']) && is_numeric($prof['longitude'])) {
                        $dealer->longitude = (float) $prof['longitude'];
                        $changed = true;
                    }
                    if (empty($dealer->alamat) && ! empty($prof['address'])) {
                        $dealer->alamat = trim((string) $prof['address']);
                        $changed = true;
                    }
                    if (empty($dealer->no_telp_showroom) && ! empty($prof['phone'])) {
                        $dealer->no_telp_showroom = trim((string) $prof['phone']);
                        $changed = true;
                    }
                    if ($changed) {
                        $dealer->save();
                    }
                    $dealersUpdated[$dealerId] = true;
                }
            }

            $author = ! empty($item['nama_reviewer']) ? trim((string) $item['nama_reviewer']) : 'Pengguna Google';
            $starRate = isset($item['star_rate']) ? (float) $item['star_rate'] : 5.0;
            $reviewText = ! empty($item['review']) ? trim((string) $item['review']) : null;
            $publishedDate = ! empty($item['tanggal_publish_review']) ? (string) $item['tanggal_publish_review'] : now()->format('Y-m-d');
            $hasOwnerResponse = (bool) ($item['respon_from_owner'] ?? false);
            $ownerDate = ! empty($item['tanggal_respon']) ? (string) $item['tanggal_respon'] : null;
            $ownerText = $hasOwnerResponse && ! empty($item['respon']) ? trim((string) $item['respon']) : null;
            $googleReviewUrl = ! empty($item['google_review_url']) ? (string) $item['google_review_url'] : null;

            // Check if existing record
            $existing = null;
            if (! empty($item['existing_id'])) {
                $existing = Review::find($item['existing_id']);
            }

            $isAnonymous = in_array(
                mb_strtolower(trim($author)),
                ['pengguna google', 'google user', 'a google user', 'anonymous', 'google customer', 'pelanggan google'],
                true
            );

            if (! $existing && ! $isAnonymous) {
                $existing = Review::where('dealer_id', $dealerId)
                    ->where('nama_reviewer', $author)
                    ->first();
            }

            if (! $existing && $reviewText !== null && $reviewText !== '') {
                $existing = Review::where('dealer_id', $dealerId)
                    ->where('review', $reviewText)
                    ->first();
            }

            if (! $existing && $publishedDate !== null && $reviewText !== null && $reviewText !== '') {
                $existing = Review::where('dealer_id', $dealerId)
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
                    'tanggal_respon' => $ownerDate ?? ($hasOwnerResponse ? ($existing->tanggal_respon ?: $publishedDate) : null),
                    'respon' => $ownerText ?? ($hasOwnerResponse ? $existing->respon : null),
                    'google_review_url' => $googleReviewUrl ?: $existing->google_review_url,
                ]);
                $updatedCount++;
            } else {
                Review::create([
                    'dealer_id' => $dealerId,
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
            'total' => count($stagedReviews),
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

    /**
     * Parse relative or ISO date string (supporting Indonesian & English relative terms) to Y-m-d format.
     */
    public function parseRelativeOrIsoDate(?string $rawDate, ?string $fallbackDate = null): ?string
    {
        if (empty($rawDate)) {
            return $fallbackDate;
        }

        $trimmed = trim($rawDate);

        // 1. Try direct Carbon parse first (e.g. ISO 8601 "2024-05-12T...", or "2024-05-12")
        try {
            return Carbon::parse($trimmed)->format('Y-m-d');
        } catch (\Throwable) {
            // Proceed to relative parser
        }

        // Clean up text
        $text = mb_strtolower($trimmed);
        $text = (string) preg_replace('/^(respon|respons|tanggapan)\s+(dari\s+)?pemilik\s*:\s*/i', '', $text);
        $text = (string) preg_replace('/^(diedit|edited|bearbeitet|gewijzigd)\s*/i', '', $text);
        $text = trim($text);

        $now = Carbon::now();

        // Yesterday / Kemarin
        if (str_contains($text, 'kemarin') || str_contains($text, 'yesterday')) {
            return $now->subDay()->format('Y-m-d');
        }

        // Just now / Hours / Minutes
        if (
            str_contains($text, 'jam lalu') || str_contains($text, 'jam yang lalu') ||
            str_contains($text, 'hour ago') || str_contains($text, 'hours ago') ||
            str_contains($text, 'menit lalu') || str_contains($text, 'menit yang lalu') ||
            str_contains($text, 'minute ago') || str_contains($text, 'minutes ago') ||
            str_contains($text, 'baru saja') || str_contains($text, 'just now')
        ) {
            return $now->format('Y-m-d');
        }

        // Days / Hari
        if (
            str_contains($text, 'hari lalu') || str_contains($text, 'hari yang lalu') ||
            str_contains($text, 'day ago') || str_contains($text, 'days ago')
        ) {
            preg_match('/(\d+)/', $text, $matches);
            $days = ! empty($matches[1]) ? (int) $matches[1] : 1;

            return $now->subDays($days)->format('Y-m-d');
        }

        // Weeks / Minggu
        if (
            str_contains($text, 'minggu lalu') || str_contains($text, 'minggu yang lalu') ||
            str_contains($text, 'seminggu') ||
            str_contains($text, 'week ago') || str_contains($text, 'weeks ago') ||
            str_contains($text, 'a week ago')
        ) {
            preg_match('/(\d+)/', $text, $matches);
            $weeks = ! empty($matches[1]) ? (int) $matches[1] : 1;

            return $now->subWeeks($weeks)->format('Y-m-d');
        }

        // Months / Bulan
        if (
            str_contains($text, 'bulan lalu') || str_contains($text, 'bulan yang lalu') ||
            str_contains($text, 'sebulan') ||
            str_contains($text, 'month ago') || str_contains($text, 'months ago') ||
            str_contains($text, 'a month ago')
        ) {
            preg_match('/(\d+)/', $text, $matches);
            $months = ! empty($matches[1]) ? (int) $matches[1] : 1;

            return $now->subMonths($months)->format('Y-m-d');
        }

        // Years / Tahun
        if (
            str_contains($text, 'tahun lalu') || str_contains($text, 'tahun yang lalu') ||
            str_contains($text, 'setahun') ||
            str_contains($text, 'year ago') || str_contains($text, 'years ago') ||
            str_contains($text, 'a year ago')
        ) {
            preg_match('/(\d+)/', $text, $matches);
            $years = ! empty($matches[1]) ? (int) $matches[1] : 1;

            return $now->subYears($years)->format('Y-m-d');
        }

        return $fallbackDate;
    }
}
