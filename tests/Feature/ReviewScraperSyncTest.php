<?php

use App\Models\Dealer;
use App\Models\Review;
use App\Models\User;
use App\Services\GoogleReviewScraperService;
use Illuminate\Support\Facades\Http;

test('scraper service correctly detects healthy service', function (): void {
    Http::fake([
        'http://localhost:3000/health' => Http::response(['status' => 'ok', 'timestamp' => '2026-09-25T00:00:00Z'], 200),
    ]);

    $service = new GoogleReviewScraperService('http://localhost:3000');
    expect($service->isHealthy())->toBeTrue();
});

test('scraper service correctly detects offline service', function (): void {
    Http::fake([
        'http://localhost:3000/health' => Http::response(['status' => 'error'], 500),
    ]);

    $service = new GoogleReviewScraperService('http://localhost:3000');
    expect($service->isHealthy())->toBeFalse();
});

test('scraper service starts scraping job with dealer url or query', function (): void {
    Http::fake([
        'http://localhost:3000/api/scrape/jobs' => Http::response([
            'success' => true,
            'jobId' => 'job-test-1234',
            'status' => 'queued',
            'checkUrl' => '/api/scrape/jobs/job-test-1234',
        ], 202),
    ]);

    $dealer = Dealer::factory()->create([
        'link_google_maps' => 'https://maps.app.goo.gl/example123',
    ]);

    $service = new GoogleReviewScraperService('http://localhost:3000');
    $result = $service->startScrapingJob($dealer, 10, 'newest');

    expect($result['jobId'])->toBe('job-test-1234');
    expect($result['status'])->toBe('queued');

    Http::assertSent(function ($request) use ($dealer): bool {
        return $request->url() === 'http://localhost:3000/api/scrape/jobs'
            && $request['url'] === $dealer->link_google_maps
            && $request['maxReviews'] === 10
            && $request['personalData'] === true
            && $request['useProxy'] === true;
    });
});

test('scraper service syncs reviews and dealer metadata from job result without duplicates', function (): void {
    $dealer = Dealer::factory()->create([
        'nama_dealer' => 'Dealer Sukses Sejahtera',
        'star_rate' => 3.5,
        'total_review' => 10,
    ]);

    $fakeJobResult = [
        'data' => [
            'profile' => [
                'name' => 'Dealer Sukses Sejahtera',
                'rating' => 4.8,
                'reviewCount' => 150,
                'category' => 'Dealer Motor',
                'address' => 'Jl. Merdeka No. 45',
                'phone' => '08123456789',
                'placeUrl' => 'https://maps.google.com/place/dealersukses',
                'latitude' => -8.55,
                'longitude' => 118.45,
            ],
            'totalReviewsScraped' => 2,
            'reviews' => [
                [
                    'author' => 'Budi Santoso',
                    'authorProfileUrl' => 'https://maps.google.com/user/budi',
                    'rating' => 5,
                    'publishedAtDate' => '2026-09-20T10:00:00.000Z',
                    'text' => 'Pelayanan ramah dan memuaskan sekali!',
                    'ownerResponse' => [
                        'text' => 'Terima kasih atas kunjungannya Pak Budi!',
                        'date' => '2026-09-21T08:00:00.000Z',
                    ],
                ],
                [
                    'author' => 'Siti Aminah',
                    'authorProfileUrl' => null,
                    'rating' => 4,
                    'publishedAtDate' => '2026-09-19T14:30:00.000Z',
                    'text' => 'Tempat bersih dan nyaman menunggu servis.',
                    'ownerResponse' => null,
                ],
            ],
        ],
    ];

    $service = new GoogleReviewScraperService;
    $syncResult = $service->syncDealerReviewsFromJobResult($dealer, $fakeJobResult);

    expect($syncResult['imported'])->toBe(2);
    expect($syncResult['updated'])->toBe(0);

    // Verify dealer metadata updated
    $dealer->refresh();
    expect((float) $dealer->star_rate)->toBe(4.8);
    expect((int) $dealer->total_review)->toBe(150);

    // Verify reviews created in database
    $this->assertDatabaseHas('reviews', [
        'dealer_id' => $dealer->id,
        'nama_reviewer' => 'Budi Santoso',
        'star_rate' => 5.0,
        'respon_from_owner' => true,
        'respon' => 'Terima kasih atas kunjungannya Pak Budi!',
    ]);

    $this->assertDatabaseHas('reviews', [
        'dealer_id' => $dealer->id,
        'nama_reviewer' => 'Siti Aminah',
        'star_rate' => 4.0,
        'respon_from_owner' => false,
        'respon' => null,
    ]);

    // Re-syncing same data should update instead of duplicating
    $secondSync = $service->syncDealerReviewsFromJobResult($dealer, $fakeJobResult);
    expect($secondSync['imported'])->toBe(0);
    expect($secondSync['updated'])->toBe(2);

    expect(Review::where('dealer_id', $dealer->id)->count())->toBe(2);
});

test('review controller checkHealth endpoint returns scraper online status', function (): void {
    $user = User::factory()->create();

    Http::fake([
        'http://localhost:3000/health' => Http::response(['status' => 'ok'], 200),
    ]);

    $response = $this->actingAs($user)->getJson(route('reviews.scraper-health'));

    $response->assertOk()
        ->assertJson(['online' => true]);
});

test('review controller startSync initiates scraping job', function (): void {
    $user = User::factory()->create();
    $dealer = Dealer::factory()->create([
        'link_google_maps' => 'https://maps.app.goo.gl/example999',
    ]);

    Http::fake([
        'http://localhost:3000/health' => Http::response(['status' => 'ok'], 200),
        'http://localhost:3000/api/scrape/jobs' => Http::response([
            'success' => true,
            'jobId' => 'job-test-abc-999',
            'status' => 'queued',
        ], 202),
    ]);

    $response = $this->actingAs($user)->postJson(route('reviews.sync.start'), [
        'dealer_id' => $dealer->id,
        'max_reviews' => 10,
        'sort_by' => 'newest',
    ]);

    $response->assertOk()
        ->assertJson([
            'success' => true,
            'jobId' => 'job-test-abc-999',
            'status' => 'queued',
            'dealerId' => $dealer->id,
        ]);
});

test('review controller checkSyncStatus syncs results when job is completed', function (): void {
    $user = User::factory()->create();
    $dealer = Dealer::factory()->create();

    Http::fake([
        'http://localhost:3000/api/scrape/jobs/job-xyz-completed' => Http::response([
            'jobId' => 'job-xyz-completed',
            'status' => 'completed',
            'result' => [
                'data' => [
                    'profile' => [
                        'name' => $dealer->nama_dealer,
                        'rating' => 4.9,
                        'reviewCount' => 88,
                    ],
                    'reviews' => [
                        [
                            'author' => 'Ahmad Syahrir',
                            'rating' => 5,
                            'publishedAtDate' => '2026-09-24T12:00:00Z',
                            'text' => 'Pelayanan cepat dan transparan.',
                        ],
                    ],
                ],
            ],
        ], 200),
    ]);

    $response = $this->actingAs($user)->getJson(
        route('reviews.sync.status', ['jobId' => 'job-xyz-completed', 'dealer_id' => $dealer->id])
    );

    $response->assertOk()
        ->assertJson([
            'status' => 'completed',
            'data' => [
                'imported' => 1,
                'dealer_id' => $dealer->id,
            ],
        ]);

    $this->assertDatabaseHas('reviews', [
        'dealer_id' => $dealer->id,
        'nama_reviewer' => 'Ahmad Syahrir',
        'star_rate' => 5.0,
    ]);
});

test('reviews sync artisan command successfully executes and syncs reviews', function (): void {
    $dealer = Dealer::factory()->create([
        'kode_dealer' => 'DL-777',
        'nama_dealer' => 'Dealer Bintang Tujuh',
        'link_google_maps' => 'https://maps.app.goo.gl/bintang7',
    ]);

    Http::fake([
        'http://localhost:3000/health' => Http::response(['status' => 'ok'], 200),
        'http://localhost:3000/api/scrape/jobs' => Http::response([
            'success' => true,
            'jobId' => 'job-artisan-1',
            'status' => 'queued',
        ], 202),
        'http://localhost:3000/api/scrape/jobs/job-artisan-1' => Http::response([
            'jobId' => 'job-artisan-1',
            'status' => 'completed',
            'result' => [
                'data' => [
                    'profile' => [
                        'name' => 'Dealer Bintang Tujuh',
                        'rating' => 4.9,
                        'reviewCount' => 200,
                    ],
                    'reviews' => [
                        [
                            'author' => 'Dewi Anggraini',
                            'rating' => 5,
                            'publishedAtDate' => '2026-09-22T08:00:00Z',
                            'text' => 'Sangat puas dengan pelayanan servisnya.',
                        ],
                    ],
                ],
            ],
        ], 200),
    ]);

    $this->artisan('reviews:sync', ['dealer' => 'DL-777', '--limit' => 5])
        ->expectsOutputToContain('Service Scraper online dan siap.')
        ->expectsOutputToContain('1 ulasan baru diimpor')
        ->assertSuccessful();

    $this->assertDatabaseHas('reviews', [
        'dealer_id' => $dealer->id,
        'nama_reviewer' => 'Dewi Anggraini',
    ]);
});

test('scraper service properly constructs and saves direct Google Maps review url with reviewId and cid', function (): void {
    $dealer = Dealer::factory()->create([
        'nama_dealer' => 'Padolo Jaya Motor',
        'latitude' => -8.5387744,
        'longitude' => 118.4620428,
        'link_google_maps' => 'https://www.google.com/maps/place/Padolo+Jaya+Motor/@-8.5387744,118.4620428,584m/data=!3m2!1e3!4b1!4m6!3m5!1s0x2dca6fb861e8adfd:0xa9e9fd5b7699d37f!8m2!3d-8.5387744!4d118.4620428!16s%2Fg%2F11c5xvd__0',
    ]);

    $fakeJobResult = [
        'data' => [
            'profile' => [
                'name' => 'Padolo Jaya Motor',
                'placeUrl' => 'https://www.google.com/maps/place/Padolo+Jaya+Motor/@-8.5387744,118.4620428,584m/data=!3m2!1e3!4b1!4m6!3m5!1s0x2dca6fb861e8adfd:0xa9e9fd5b7699d37f!8m2!3d-8.5387744!4d118.4620428',
                'latitude' => -8.5387744,
                'longitude' => 118.4620428,
            ],
            'reviews' => [
                [
                    'reviewId' => 'ChdDSUhNMG9nS0VJQ0FnTUR3OTVXbHJ3RRAB',
                    'author' => 'Agus Supriyanto',
                    'rating' => 2,
                    'text' => 'Pelayanan kurang cepat.',
                ],
            ],
        ],
    ];

    $service = new GoogleReviewScraperService;
    $service->syncDealerReviewsFromJobResult($dealer, $fakeJobResult);

    $review = Review::where('dealer_id', $dealer->id)->where('nama_reviewer', 'Agus Supriyanto')->first();
    expect($review)->not->toBeNull();
    expect($review->google_review_url)->toBe('https://www.google.com/maps/reviews/@-8.5387744,118.4620428,785m/data=!3m2!1e3!4b1!4m6!14m5!1m4!2m3!1sChdDSUhNMG9nS0VJQ0FnTUR3OTVXbHJ3RRAB!2m1!1s0x0:0xa9e9fd5b7699d37f?entry=ttu');
});
