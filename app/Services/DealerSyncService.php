<?php

namespace App\Services;

use App\Models\Dealer;
use Exception;
use Illuminate\Support\Collection;
use Illuminate\Support\Facades\Config;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Log;

class DealerSyncService
{
    protected string $baseUrl;

    protected int $timeout;

    protected ?bool $scraperHealthy = null;

    public function __construct(?string $baseUrl = null, ?int $timeout = null)
    {
        $this->baseUrl = $baseUrl ?: (string) (Config::get('services.google_review_scraper.url') ?: env('GBP_API_BASE_URL', 'http://localhost:3000'));
        $this->baseUrl = rtrim($this->baseUrl, '/');
        $this->timeout = $timeout ?: 30;
    }

    /**
     * Check if scraper API service is online and healthy.
     */
    public function isHealthy(bool $forceCheck = false): bool
    {
        if ($this->scraperHealthy !== null && ! $forceCheck) {
            return $this->scraperHealthy;
        }

        try {
            $response = Http::timeout(2)->get("{$this->baseUrl}/health");

            return $this->scraperHealthy = ($response->successful() && ($response->json('status') === 'ok'));
        } catch (\Throwable) {
            return $this->scraperHealthy = false;
        }
    }

    /**
     * Clean Google Maps Unicode icons and leading/trailing whitespace.
     */
    public function cleanText(?string $text): ?string
    {
        if ($text === null || trim($text) === '') {
            return null;
        }

        // Replace non-breaking spaces
        $text = str_replace(["\xc2\xa0", "\u{00A0}"], ' ', $text);

        // Strip Google Maps custom icons (Unicode Private Use Area \x{E000}-\x{F8FF}, \p{Co}, Symbols/Pictographs \p{So})
        $cleaned = preg_replace('/[\x{E000}-\x{F8FF}\p{Co}\p{So}]+/u', '', $text);
        $cleaned = preg_replace('/\s+/u', ' ', (string) $cleaned);

        $trimmed = trim((string) $cleaned);

        return $trimmed !== '' ? $trimmed : null;
    }

    /**
     * Clean phone number string from Google Maps.
     */
    public function cleanPhoneNumber(?string $rawPhone): ?string
    {
        $text = $this->cleanText($rawPhone);
        if ($text === null) {
            return null;
        }

        // Remove non-digit characters except +, - and space
        $cleanPhone = preg_replace('/[^\d\+\-\s]/', '', $text);
        $cleanPhone = trim((string) $cleanPhone);

        return $cleanPhone !== '' ? $cleanPhone : null;
    }

    /**
     * Extract geographic coordinates from a Google Maps URL.
     *
     * @return array{latitude: ?float, longitude: ?float}
     */
    public function extractCoordinatesFromUrl(?string $url): array
    {
        if (empty($url)) {
            return ['latitude' => null, 'longitude' => null];
        }

        // Pattern 1: /@-8.5387744,118.4620428
        if (preg_match('/@(-?\d+\.\d+),(-?\d+\.\d+)/', $url, $m)) {
            return [
                'latitude' => (float) $m[1],
                'longitude' => (float) $m[2],
            ];
        }

        // Pattern 2: !3d-8.5387744!4d118.4620428
        if (preg_match('/!3d(-?\d+\.\d+)!4d(-?\d+\.\d+)/', $url, $m)) {
            return [
                'latitude' => (float) $m[1],
                'longitude' => (float) $m[2],
            ];
        }

        // Pattern 3: ?q=-8.5387744,118.4620428 or &ll=-8.5387744,118.4620428
        if (preg_match('/(?:[?&](?:q|ll)=(-?\d+\.\d+),(-?\d+\.\d+))/', $url, $m)) {
            return [
                'latitude' => (float) $m[1],
                'longitude' => (float) $m[2],
            ];
        }

        return ['latitude' => null, 'longitude' => null];
    }

    /**
     * Parse Indonesian address into alamat, kelurahan, kecamatan, and pos_code.
     *
     * @return array{alamat: ?string, kelurahan: ?string, kecamatan: ?string, pos_code: ?string}
     */
    public function parseAddressDetails(?string $rawAddress): array
    {
        $alamat = $this->cleanText($rawAddress);
        if ($alamat === null) {
            return [
                'alamat' => null,
                'kelurahan' => null,
                'kecamatan' => null,
                'pos_code' => null,
            ];
        }

        $posCode = null;
        $kecamatan = null;
        $kelurahan = null;

        // 1. Extract 5-digit Indonesian postal code
        if (preg_match('/\b(\d{5})\b/', $alamat, $m)) {
            $posCode = $m[1];
        }

        // 2. Extract Kecamatan with abbreviation expansion
        if (preg_match('/\b(?:Kec\.|Kecamatan)\s+([^,]+)/iu', $alamat, $m)) {
            $rawKec = trim($m[1]);
            // Expand common Indonesian cardinal direction abbreviations e.g. "Bar." -> "Barat"
            $expandedKec = preg_replace('/\bBar\.?$/iu', 'Barat', $rawKec);
            $expandedKec = preg_replace('/\bSel\.?$/iu', 'Selatan', (string) $expandedKec);
            $expandedKec = preg_replace('/\bUt\.?$/iu', 'Utara', (string) $expandedKec);
            $expandedKec = preg_replace('/\bTim\.?$/iu', 'Timur', (string) $expandedKec);
            $kecamatan = trim((string) $expandedKec);
        }

        // 3. Extract Kelurahan:
        // Priority A: Explicit "Kel." / "Kelurahan" / "Desa"
        if (preg_match('/\b(?:Kel\.|Kelurahan|Desa)\s+([^,]+)/iu', $alamat, $m)) {
            $kelurahan = trim($m[1]);
        } else {
            // Priority B: In Indonesian Google Maps address syntax:
            // "[Street], [Kelurahan], Kec. [Kecamatan], [Kab/Kota], [Provinsi] [KodePos]"
            // The segment immediately preceding the "Kec." segment is typically the Kelurahan/Desa.
            $segments = array_map('trim', explode(',', $alamat));
            $kecIndex = -1;
            foreach ($segments as $idx => $segment) {
                if (preg_match('/\b(?:Kec|Kecamatan)\b/iu', $segment)) {
                    $kecIndex = $idx;
                    break;
                }
            }

            if ($kecIndex > 0) {
                $candidate = $segments[$kecIndex - 1];
                // Ensure candidate does not look like a street address
                if (! preg_match('/(?:^|\s)(?:Jl\.?|Jalan|Gg\.?|Gang|No\.?|Nomor|Komplek|Blok)\b/iu', $candidate)) {
                    $kelurahan = $candidate;
                }
            }
        }

        return [
            'alamat' => $alamat,
            'kelurahan' => $kelurahan,
            'kecamatan' => $kecamatan,
            'pos_code' => $posCode,
        ];
    }

    /**
     * Normalize a time range string into standard Indonesian format (e.g. 08.00–16.00, Tutup, 24 Jam).
     */
    public function normalizeTimeString(string $timeString): ?string
    {
        $timeString = trim($timeString);
        if ($timeString === '') {
            return null;
        }

        if (preg_match('/^(?:Closed|Tutup)$/i', $timeString)) {
            return 'Tutup';
        }

        if (preg_match('/^(?:Open 24 hours|Buka 24 jam|24 Jam)$/i', $timeString)) {
            return '24 Jam';
        }

        // Match time range separated by dash, en-dash, em-dash, 'to', or 'sampai'
        if (preg_match('/^(.+?)\s*(?:[-–—]|to|sampai)\s*(.+)$/iu', $timeString, $matches)) {
            $start = $this->parseSingleTime($matches[1]);
            $end = $this->parseSingleTime($matches[2]);

            if ($start !== null && $end !== null) {
                return "{$start}–{$end}";
            }
        }

        return $this->cleanText($timeString);
    }

    /**
     * Parse a single time token (e.g. "8 AM", "8.00 am", "14:00", "08.30") into standard "HH.MM".
     */
    private function parseSingleTime(string $token): ?string
    {
        $token = trim($token);
        if ($token === '') {
            return null;
        }

        // Match 12-hour format with AM/PM: e.g. "8 AM", "8:30 PM", "8.00 am", "12 PM"
        if (preg_match('/^(\d{1,2})(?:[:.](\d{2}))?\s*(am|pm)$/i', $token, $m)) {
            $hour = (int) $m[1];
            $minute = isset($m[2]) && $m[2] !== '' ? (int) $m[2] : 0;
            $meridiem = strtolower($m[3]);

            if ($meridiem === 'pm' && $hour < 12) {
                $hour += 12;
            } elseif ($meridiem === 'am' && $hour === 12) {
                $hour = 0;
            }

            return sprintf('%02d.%02d', $hour, $minute);
        }

        // Match 24-hour format: e.g. "08.00", "08:30", "8.00", "16:00"
        if (preg_match('/^(\d{1,2})[:.](\d{2})$/', $token, $m)) {
            $hour = (int) $m[1];
            $minute = (int) $m[2];

            if ($hour >= 0 && $hour <= 24 && $minute >= 0 && $minute < 60) {
                return sprintf('%02d.%02d', $hour, $minute);
            }
        }

        return null;
    }

    /**
     * Parse opening hours array into weekday, saturday, and sunday strings.
     *
     * @param  array<string>  $openingHours
     * @return array{weekday: ?string, saturday: ?string, sunday: ?string}
     */
    public function parseOpeningHours(array $openingHours): array
    {
        $weekday = null;
        $saturday = null;
        $sunday = null;
        $weekdayIsMonday = false;

        foreach ($openingHours as $rawRow) {
            $row = $this->cleanText((string) $rawRow);
            if ($row === null || $row === '') {
                continue;
            }

            // Match Saturday (e.g. "Sabtu: 08.00–14.00", "Sabtu08.00–14.00", "Saturday 8.00 am–2.00 pm")
            if (preg_match('/^(?:Sabtu|Saturday)\s*[:,-]?\s*(.+)$/iu', $row, $m)) {
                $cleanedTime = $this->normalizeTimeString($m[1]);
                if ($cleanedTime !== null) {
                    $saturday = $cleanedTime;
                }

                continue;
            }

            // Match Sunday (e.g. "Minggu: Tutup", "MingguTutup", "Sunday Closed", "Sunday 8.00 am–2.00 pm")
            if (preg_match('/^(?:Minggu|Sunday)\s*[:,-]?\s*(.+)$/iu', $row, $m)) {
                $cleanedTime = $this->normalizeTimeString($m[1]);
                if ($cleanedTime !== null) {
                    $sunday = $cleanedTime;
                }

                continue;
            }

            // Match Monday-Friday range if present (e.g. "Senin–Jumat: 08.00–17.00", "Monday–Friday: 8.00 am–4.00 pm")
            if (preg_match('/^(?:Senin\s*[-–]\s*Jumat|Mon\s*[-–]\s*Fri|Monday\s*[-–]\s*Friday)\s*[:,-]?\s*(.+)$/iu', $row, $m)) {
                $cleanedTime = $this->normalizeTimeString($m[1]);
                if ($cleanedTime !== null) {
                    $weekday = $cleanedTime;
                    $weekdayIsMonday = true;
                }

                continue;
            }

            // Match Monday specifically (preferred representative for weekday)
            if (preg_match('/^(?:Senin|Monday)\s*[:,-]?\s*(.+)$/iu', $row, $m)) {
                $cleanedTime = $this->normalizeTimeString($m[1]);
                if ($cleanedTime !== null) {
                    $weekday = $cleanedTime;
                    $weekdayIsMonday = true;
                }

                continue;
            }

            // Match other individual weekdays (Selasa, Rabu, Kamis, Jumat, etc.) if weekday not yet set by Monday
            if (! $weekdayIsMonday && preg_match('/^(?:Selasa|Rabu|Kamis|Jumat|Tuesday|Wednesday|Thursday|Friday)\s*[:,-]?\s*(.+)$/iu', $row, $m)) {
                $cleanedTime = $this->normalizeTimeString($m[1]);
                if ($cleanedTime !== null) {
                    $weekday = $cleanedTime;
                }
            }
        }

        return [
            'weekday' => $weekday,
            'saturday' => $saturday,
            'sunday' => $sunday,
        ];
    }

    /**
     * Resolve a short or redirect URL (e.g. maps.app.goo.gl) to its canonical Google Maps destination URL.
     */
    public function resolveRedirectUrl(string $url): string
    {
        if (! str_contains($url, 'goo.gl') && ! str_contains($url, 'maps.app')) {
            return $url;
        }

        // In test environment, skip curl so Http::fake() can intercept the request
        if (! app()->runningUnitTests()) {
            try {
                $ch = curl_init($url);
                curl_setopt($ch, CURLOPT_NOBODY, true);
                curl_setopt($ch, CURLOPT_FOLLOWLOCATION, true);
                curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);
                curl_setopt($ch, CURLOPT_TIMEOUT, 6);
                curl_setopt($ch, CURLOPT_SSL_VERIFYPEER, false);
                curl_setopt($ch, CURLOPT_USERAGENT, 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36');
                curl_exec($ch);
                $effective = curl_getinfo($ch, CURLINFO_EFFECTIVE_URL);
                curl_close($ch);

                if (! empty($effective) && is_string($effective) && $effective !== $url) {
                    return $effective;
                }
            } catch (\Throwable) {
                // Fall back to Guzzle if curl encounters an issue
            }
        }

        try {
            $redirectResponse = Http::withoutVerifying()
                ->timeout(8)
                ->withHeaders([
                    'User-Agent' => 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
                    'Accept-Language' => 'id-ID,id;q=0.9',
                ])
                ->get($url);

            $effective = (string) $redirectResponse->effectiveUri();
            if (! empty($effective) && $effective !== $url) {
                return $effective;
            }
        } catch (\Throwable) {
            // Ignore resolution failure and return raw $url
        }

        return $url;
    }

    /**
     * Fetch Google Maps profile details for a dealer.
     *
     * @return array{name: ?string, rating: ?float, reviewCount: ?int, address: ?string, phone: ?string, openingHours: array<string>, placeUrl: ?string, latitude: ?float, longitude: ?float}
     *
     * @throws Exception
     */
    public function fetchProfile(Dealer $dealer, bool $useProxy = false): array
    {
        $url = $dealer->link_google_maps;
        if (empty($url)) {
            throw new Exception("Dealer {$dealer->nama_dealer} tidak memiliki link Google Maps.");
        }

        // Pre-resolve short redirect URLs (e.g. maps.app.goo.gl) to ensure canonical Google Maps URL with language parameter
        $resolvedUrl = $this->resolveRedirectUrl($url);
        $cleanBaseUrl = preg_replace('/([?&])hl=[^&]+/', '', $resolvedUrl);
        $targetUrlId = $cleanBaseUrl.(str_contains($cleanBaseUrl, '?') ? '&hl=id' : '?hl=id');
        $targetUrlEn = $cleanBaseUrl.(str_contains($cleanBaseUrl, '?') ? '&hl=en' : '?hl=en');

        // 1. If scraper API is healthy, use its Playwright profile scraper
        if ($this->isHealthy()) {
            try {
                $response = Http::timeout($this->timeout)->post("{$this->baseUrl}/api/scrape/profile", [
                    'url' => $targetUrlId,
                    'language' => 'id',
                    'useProxy' => $useProxy,
                ]);

                if ($response->successful()) {
                    $data = $response->json('data') ?? [];

                    // Fallback to English if openingHours is missing or incomplete (<= 1 day)
                    if (empty($data['openingHours']) || count($data['openingHours']) <= 1) {
                        try {
                            $resEn = Http::timeout($this->timeout)->post("{$this->baseUrl}/api/scrape/profile", [
                                'url' => $targetUrlEn,
                                'language' => 'en',
                                'useProxy' => $useProxy,
                            ]);
                            if ($resEn->successful()) {
                                $enHours = $resEn->json('data.openingHours');
                                if (is_array($enHours) && count($enHours) > count($data['openingHours'] ?? [])) {
                                    $data['openingHours'] = $enHours;
                                }
                            }
                        } catch (\Throwable) {
                            // Non-critical fallback failure
                        }
                    }

                    return [
                        'name' => $data['name'] ?? null,
                        'rating' => isset($data['rating']) && is_numeric($data['rating']) ? (float) $data['rating'] : null,
                        'reviewCount' => isset($data['reviewCount']) && is_numeric($data['reviewCount']) ? (int) $data['reviewCount'] : null,
                        'address' => $data['address'] ?? null,
                        'phone' => $data['phone'] ?? null,
                        'openingHours' => isset($data['openingHours']) && is_array($data['openingHours']) ? $data['openingHours'] : [],
                        'placeUrl' => $data['placeUrl'] ?? null,
                        'latitude' => isset($data['latitude']) && is_numeric($data['latitude']) ? (float) $data['latitude'] : null,
                        'longitude' => isset($data['longitude']) && is_numeric($data['longitude']) ? (float) $data['longitude'] : null,
                    ];
                }
            } catch (\Throwable $e) {
                Log::warning("DealerSyncService: Scraper call at {$this->baseUrl} failed ({$e->getMessage()}), falling back to direct URL resolution.");
            }
        }

        // 2. Fallback: Direct Google Maps URL redirect resolution
        try {
            $redirectResponse = Http::withoutVerifying()
                ->timeout(10)
                ->withHeaders([
                    'User-Agent' => 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
                    'Accept-Language' => 'id-ID,id;q=0.9',
                ])
                ->get($url);

            $finalUrl = (string) $redirectResponse->effectiveUri();
            $coords = $this->extractCoordinatesFromUrl($finalUrl);

            $name = null;
            // Attempt to extract place name from redirected Google Maps URL (/maps/place/Place+Name/@...)
            if (preg_match('#/maps/place/([^/@?]+)#', $finalUrl, $m)) {
                $nameCandidate = urldecode(str_replace('+', ' ', $m[1]));
                $name = $this->cleanText($nameCandidate);
            }

            // Fallback to og:title or title in HTML if URL didn't contain place name
            if ($name === null && $redirectResponse->successful()) {
                $body = $redirectResponse->body();
                if (preg_match('/<meta\s+property="og:title"\s+content="([^"]+)"/i', $body, $m)) {
                    $titleCandidate = html_entity_decode($m[1], ENT_QUOTES | ENT_HTML5, 'UTF-8');
                    $titleCandidate = preg_replace('/\s*[-·]\s*Google Maps.*$/i', '', $titleCandidate);
                    $name = $this->cleanText($titleCandidate);
                } elseif (preg_match('/<title>([^<]+)<\/title>/i', $body, $m)) {
                    $titleCandidate = html_entity_decode($m[1], ENT_QUOTES | ENT_HTML5, 'UTF-8');
                    $titleCandidate = preg_replace('/\s*[-·]\s*Google Maps.*$/i', '', $titleCandidate);
                    $name = $this->cleanText($titleCandidate);
                }
            }

            return [
                'name' => $name,
                'rating' => null,
                'reviewCount' => null,
                'address' => null,
                'phone' => null,
                'openingHours' => [],
                'placeUrl' => $finalUrl,
                'latitude' => $coords['latitude'],
                'longitude' => $coords['longitude'],
            ];
        } catch (\Throwable $e) {
            throw new Exception("Gagal mengambil data dari Google Maps: {$e->getMessage()}");
        }
    }

    /**
     * Sync dealer GBP profile fields:
     * - nama_dealer_gbp
     * - star_rate
     * - total_review
     * - no_telp_showroom
     * - jam_buka_weekday
     * - jam_buka_sabtu
     * - jam_buka_minggu
     * - alamat
     * - kelurahan
     * - kecamatan
     * - pos_code
     * - latitude
     * - longitude
     *
     * @return array{
     *     dealer_id: int,
     *     nama_dealer: string,
     *     kode_dealer: string,
     *     updated_fields: array<string>,
     *     old_values: array<string, mixed>,
     *     new_values: array<string, mixed>
     * }
     */
    public function syncDealerProfileOnly(Dealer $dealer, bool $useProxy = false): array
    {
        $profile = $this->fetchProfile($dealer, $useProxy);

        // Store old values
        $oldValues = [
            'nama_dealer_gbp' => $dealer->nama_dealer_gbp,
            'star_rate' => $dealer->star_rate,
            'total_review' => $dealer->total_review,
            'no_telp_showroom' => $dealer->no_telp_showroom,
            'jam_buka_weekday' => $dealer->jam_buka_weekday,
            'jam_buka_sabtu' => $dealer->jam_buka_sabtu,
            'jam_buka_minggu' => $dealer->jam_buka_minggu,
            'alamat' => $dealer->alamat,
            'kelurahan' => $dealer->kelurahan,
            'kecamatan' => $dealer->kecamatan,
            'pos_code' => $dealer->pos_code,
            'latitude' => $dealer->latitude,
            'longitude' => $dealer->longitude,
        ];

        $newValues = $oldValues;
        $updatedFields = [];

        // 1. Nama Dealer di GBP
        if (! empty($profile['name'])) {
            $cleanedName = $this->cleanText($profile['name']);
            if ($cleanedName !== null) {
                $newValues['nama_dealer_gbp'] = $cleanedName;
                if ($newValues['nama_dealer_gbp'] !== $oldValues['nama_dealer_gbp']) {
                    $updatedFields[] = 'nama_dealer_gbp';
                }
            }
        }

        // 2. Star Rate
        if ($profile['rating'] !== null) {
            $newValues['star_rate'] = (float) $profile['rating'];
            if ($newValues['star_rate'] !== $oldValues['star_rate']) {
                $updatedFields[] = 'star_rate';
            }
        }

        // 3. Total Review
        if ($profile['reviewCount'] !== null) {
            $newValues['total_review'] = (int) $profile['reviewCount'];
            if ($newValues['total_review'] !== $oldValues['total_review']) {
                $updatedFields[] = 'total_review';
            }
        }

        // 4. No Telp Showroom
        if ($profile['phone'] !== null) {
            $cleanPhone = $this->cleanPhoneNumber($profile['phone']);
            if ($cleanPhone !== null) {
                $newValues['no_telp_showroom'] = $cleanPhone;
                if ($newValues['no_telp_showroom'] !== $oldValues['no_telp_showroom']) {
                    $updatedFields[] = 'no_telp_showroom';
                }
            }
        }

        // 5. Opening Hours (Weekday, Sabtu, Minggu)
        if (! empty($profile['openingHours']) && is_array($profile['openingHours'])) {
            $parsedHours = $this->parseOpeningHours($profile['openingHours']);

            if ($parsedHours['weekday'] !== null) {
                $newValues['jam_buka_weekday'] = $parsedHours['weekday'];
                if ($newValues['jam_buka_weekday'] !== $oldValues['jam_buka_weekday']) {
                    $updatedFields[] = 'jam_buka_weekday';
                }
            }

            if ($parsedHours['saturday'] !== null) {
                $newValues['jam_buka_sabtu'] = $parsedHours['saturday'];
                if ($newValues['jam_buka_sabtu'] !== $oldValues['jam_buka_sabtu']) {
                    $updatedFields[] = 'jam_buka_sabtu';
                }
            }

            if ($parsedHours['sunday'] !== null) {
                $newValues['jam_buka_minggu'] = $parsedHours['sunday'];
                if ($newValues['jam_buka_minggu'] !== $oldValues['jam_buka_minggu']) {
                    $updatedFields[] = 'jam_buka_minggu';
                }
            }
        }

        // 6, 7, 8, 9. Address parsing: alamat, kelurahan, kecamatan, pos_code
        if (! empty($profile['address'])) {
            $parsedAddress = $this->parseAddressDetails($profile['address']);

            if ($parsedAddress['alamat'] !== null) {
                $newValues['alamat'] = $parsedAddress['alamat'];
                if ($newValues['alamat'] !== $oldValues['alamat']) {
                    $updatedFields[] = 'alamat';
                }
            }

            if ($parsedAddress['kelurahan'] !== null) {
                $newValues['kelurahan'] = $parsedAddress['kelurahan'];
                if ($newValues['kelurahan'] !== $oldValues['kelurahan']) {
                    $updatedFields[] = 'kelurahan';
                }
            }

            if ($parsedAddress['kecamatan'] !== null) {
                $newValues['kecamatan'] = $parsedAddress['kecamatan'];
                if ($newValues['kecamatan'] !== $oldValues['kecamatan']) {
                    $updatedFields[] = 'kecamatan';
                }
            }

            if ($parsedAddress['pos_code'] !== null) {
                $newValues['pos_code'] = $parsedAddress['pos_code'];
                if ($newValues['pos_code'] !== $oldValues['pos_code']) {
                    $updatedFields[] = 'pos_code';
                }
            }
        }

        // 10, 11. Latitude & Longitude
        $lat = $profile['latitude'];
        $lng = $profile['longitude'];

        // Fallback coordinate extraction from placeUrl or existing link
        if (($lat === null || $lng === null) && ! empty($profile['placeUrl'])) {
            $coords = $this->extractCoordinatesFromUrl($profile['placeUrl']);
            $lat = $lat ?? $coords['latitude'];
            $lng = $lng ?? $coords['longitude'];
        }
        if (($lat === null || $lng === null) && ! empty($dealer->link_google_maps)) {
            $coords = $this->extractCoordinatesFromUrl($dealer->link_google_maps);
            $lat = $lat ?? $coords['latitude'];
            $lng = $lng ?? $coords['longitude'];
        }

        if ($lat !== null) {
            $newValues['latitude'] = (float) $lat;
            if ($newValues['latitude'] !== $oldValues['latitude']) {
                $updatedFields[] = 'latitude';
            }
        }

        if ($lng !== null) {
            $newValues['longitude'] = (float) $lng;
            if ($newValues['longitude'] !== $oldValues['longitude']) {
                $updatedFields[] = 'longitude';
            }
        }

        // Persist fields to the dealer record
        if (! empty($updatedFields)) {
            $dealer->update([
                'nama_dealer_gbp' => $newValues['nama_dealer_gbp'],
                'star_rate' => $newValues['star_rate'],
                'total_review' => $newValues['total_review'],
                'no_telp_showroom' => $newValues['no_telp_showroom'],
                'jam_buka_weekday' => $newValues['jam_buka_weekday'],
                'jam_buka_sabtu' => $newValues['jam_buka_sabtu'],
                'jam_buka_minggu' => $newValues['jam_buka_minggu'],
                'alamat' => $newValues['alamat'],
                'kelurahan' => $newValues['kelurahan'],
                'kecamatan' => $newValues['kecamatan'],
                'pos_code' => $newValues['pos_code'],
                'latitude' => $newValues['latitude'],
                'longitude' => $newValues['longitude'],
            ]);
        }

        return [
            'dealer_id' => $dealer->id,
            'nama_dealer' => $dealer->nama_dealer,
            'kode_dealer' => $dealer->kode_dealer,
            'updated_fields' => array_values(array_unique($updatedFields)),
            'old_values' => $oldValues,
            'new_values' => $newValues,
        ];
    }

    /**
     * Sync multiple dealers sequentially.
     *
     * @param  Collection<int, Dealer>|null  $dealers
     * @return array{
     *     total: int,
     *     success: int,
     *     failed: int,
     *     skipped: int,
     *     results: array<int, array<string, mixed>>
     * }
     */
    public function syncAllDealers(?Collection $dealers = null, bool $useProxy = false): array
    {
        @ini_set('max_execution_time', '0');
        @set_time_limit(0);

        $dealers = $dealers ?? Dealer::query()
            ->whereNotNull('link_google_maps')
            ->where('link_google_maps', '!=', '')
            ->get();

        $total = $dealers->count();
        $success = 0;
        $failed = 0;
        $skipped = 0;
        $results = [];

        foreach ($dealers as $dealer) {
            @set_time_limit(60);
            if (empty($dealer->link_google_maps)) {
                $skipped++;
                $results[] = [
                    'dealer_id' => $dealer->id,
                    'nama_dealer' => $dealer->nama_dealer,
                    'status' => 'skipped',
                    'message' => 'Dealer tidak memiliki link Google Maps.',
                ];

                continue;
            }

            try {
                $result = $this->syncDealerProfileOnly($dealer, $useProxy);
                $success++;
                $results[] = array_merge($result, [
                    'status' => 'success',
                ]);
            } catch (\Throwable $e) {
                $failed++;
                $results[] = [
                    'dealer_id' => $dealer->id,
                    'nama_dealer' => $dealer->nama_dealer,
                    'status' => 'failed',
                    'message' => $e->getMessage(),
                ];
            }
        }

        return [
            'total' => $total,
            'success' => $success,
            'failed' => $failed,
            'skipped' => $skipped,
            'results' => $results,
        ];
    }
}
