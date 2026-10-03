<?php

use App\Models\Dealer;
use App\Models\Review;
use App\Models\User;
use Inertia\Testing\AssertableInertia;

test('guests are redirected to the login page', function () {
    $response = $this->get(route('dashboard'));
    $response->assertRedirect(route('login'));
});

test('authenticated users can visit the dashboard', function () {
    $user = User::factory()->create();
    $this->actingAs($user);

    $response = $this->get(route('dashboard'));
    $response->assertOk();
});

test('unverified users can visit the dashboard without email verification prompt', function () {
    $user = User::factory()->unverified()->create();

    $response = $this->actingAs($user)->get(route('dashboard'));
    $response->assertOk();
});

test('super admin sees global dashboard metrics and top dealers', function () {
    $superAdmin = User::factory()->superAdmin()->create();
    $dealerA = Dealer::factory()->create(['nama_dealer' => 'Dealer Alpha', 'star_rate' => 4.9, 'total_review' => 100]);
    $dealerB = Dealer::factory()->create(['nama_dealer' => 'Dealer Beta', 'star_rate' => 4.2, 'total_review' => 50]);

    Review::factory()->create([
        'dealer_id' => $dealerA->id,
        'star_rate' => 5,
        'respon_from_owner' => true,
    ]);
    Review::factory()->create([
        'dealer_id' => $dealerB->id,
        'star_rate' => 2,
        'respon_from_owner' => false,
    ]);

    $response = $this->actingAs($superAdmin)->get(route('dashboard'));

    $response->assertOk()
        ->assertInertia(fn (AssertableInertia $page) => $page
            ->component('dashboard')
            ->where('isGlobal', true)
            ->where('metrics.total_reviews', 2)
            ->where('metrics.responded_count', 1)
            ->where('metrics.unresponded_count', 1)
            ->has('topDealers')
            ->has('needsAttentionDealers', 1)
            ->where('needsAttentionDealers.0.id', $dealerB->id)
            ->where('needsAttentionDealers.0.star_rate', 4.2)
        );
});

test('dealer user only sees their own dealer metrics on dashboard', function () {
    $dealerA = Dealer::factory()->create(['nama_dealer' => 'Dealer Alpha']);
    $dealerB = Dealer::factory()->create(['nama_dealer' => 'Dealer Beta']);

    $dealerUser = User::factory()->dealer()->create([
        'dealer_id' => $dealerA->id,
    ]);

    Review::factory()->create([
        'dealer_id' => $dealerA->id,
        'star_rate' => 5,
        'respon_from_owner' => true,
    ]);
    Review::factory()->count(3)->create([
        'dealer_id' => $dealerB->id,
        'star_rate' => 1,
        'respon_from_owner' => false,
    ]);

    $response = $this->actingAs($dealerUser)->get(route('dashboard'));

    $response->assertOk()
        ->assertInertia(fn (AssertableInertia $page) => $page
            ->component('dashboard')
            ->where('isGlobal', false)
            ->where('metrics.total_reviews', 1)
            ->where('metrics.responded_count', 1)
            ->where('metrics.unresponded_count', 0)
            ->where('currentDealer.id', $dealerA->id)
        );
});

test('dashboard provides mapDealers with coordinates, address, and star review recap', function () {
    $superAdmin = User::factory()->superAdmin()->create();
    $dealer = Dealer::factory()->create([
        'nama_dealer' => 'Dealer Lombok Sakti',
        'latitude' => -8.58,
        'longitude' => 116.12,
        'alamat' => 'Jl. Merdeka No. 10',
        'kelurahan' => 'Cakranegara Barat',
        'kecamatan' => 'Cakranegara',
        'pos_code' => '83239',
        'no_telp_showroom' => '08123456789',
        'star_rate' => 4.8,
    ]);

    Review::factory()->create([
        'dealer_id' => $dealer->id,
        'star_rate' => 5,
        'respon_from_owner' => true,
    ]);
    Review::factory()->create([
        'dealer_id' => $dealer->id,
        'star_rate' => 4,
        'respon_from_owner' => false,
    ]);

    $response = $this->actingAs($superAdmin)->get(route('dashboard'));

    $response->assertOk()
        ->assertInertia(fn (AssertableInertia $page) => $page
            ->component('dashboard')
            ->has('mapDealers')
            ->where('mapDealers.0.nama_dealer', 'Dealer Lombok Sakti')
            ->where('mapDealers.0.latitude', -8.58)
            ->where('mapDealers.0.longitude', 116.12)
            ->where('mapDealers.0.kelurahan', 'Cakranegara Barat')
            ->where('mapDealers.0.kecamatan', 'Cakranegara')
            ->where('mapDealers.0.pos_code', '83239')
            ->where('mapDealers.0.no_telp_showroom', '08123456789')
            ->where('mapDealers.0.recap.stars.5', 1)
            ->where('mapDealers.0.recap.stars.4', 1)
            ->where('mapDealers.0.recap.total_system_reviews', 2)
            ->where('mapDealers.0.recap.responded_count', 1)
        );
});

test('super admin and main dealer receive dealer overview matrix with monthly review breakdown and feedback achievement', function () {
    $mainDealer = User::factory()->mainDealer()->create();
    $dealer = Dealer::factory()->create([
        'kode_dealer' => '10062',
        'nama_dealer' => 'NSS SUMBAWA',
        'star_rate' => 5.0,
        'total_review' => 1303,
    ]);

    // Create reviews in current month
    Review::factory()->create([
        'dealer_id' => $dealer->id,
        'star_rate' => 5,
        'respon_from_owner' => true,
        'tanggal_publish_review' => now()->toDateString(),
        'tanggal_respon' => now()->toDateString(),
    ]);

    Review::factory()->create([
        'dealer_id' => $dealer->id,
        'star_rate' => 1,
        'respon_from_owner' => false,
        'tanggal_publish_review' => now()->toDateString(),
        'tanggal_respon' => null,
    ]);

    $response = $this->actingAs($mainDealer)->get(route('dashboard'));

    $response->assertOk()
        ->assertInertia(fn (AssertableInertia $page) => $page
            ->component('dashboard')
            ->where('isGlobal', true)
            ->has('dealerOverview', 1)
            ->where('dealerOverview.0.kode_dealer', '10062')
            ->where('dealerOverview.0.nama_dealer', 'NSS SUMBAWA')
            ->where('dealerOverview.0.total_review_all', 1303)
            ->where('dealerOverview.0.review_monthly', 2)
            ->where('dealerOverview.0.gmb_score', fn ($val) => (float) $val === 5.0)
            ->where('dealerOverview.0.rating_5', 1)
            ->where('dealerOverview.0.rating_1', 1)
            ->where('dealerOverview.0.cont_rating_1_3', fn ($val) => (float) $val === 50.0)
            ->where('dealerOverview.0.cont_rating_4_5', fn ($val) => (float) $val === 50.0)
            ->where('dealerOverview.0.jumlah_feedback', 1)
            ->where('dealerOverview.0.belum_feedback', 1)
            ->where('dealerOverview.0.ach_feedback', fn ($val) => (float) $val === 50.0)
            ->has('overviewSummary')
            ->where('overviewSummary.review_monthly', 2)
            ->where('overviewSummary.jumlah_feedback', 1)
            ->has('monitoringFeedback', 1)
            ->where('monitoringFeedback.0.nama_dealer', 'NSS SUMBAWA')
            ->where('monitoringFeedback.0.gmb_score', fn ($val) => (float) $val === 5.0)
            ->where('monitoringFeedback.0.rating_1_3', 1)
            ->where('monitoringFeedback.0.rating_4_5', 1)
            ->where('monitoringFeedback.0.feedback_done', 1)
            ->where('monitoringFeedback.0.not_yet_feedback', 1)
            ->where('monitoringFeedback.0.ach_feedback', fn ($val) => (float) $val === 50.0)
            ->where('monitoringFeedback.0.jumlah_review_m', 2)
            ->has('monitoringSummary')
            ->where('monitoringSummary.jumlah_review_m', 2)
            ->where('monitoringSummary.feedback_done', 1)
        );
});

test('dealer user does not receive dealer overview matrix', function () {
    $dealer = Dealer::factory()->create(['nama_dealer' => 'Dealer Alpha']);
    $dealerUser = User::factory()->dealer()->create([
        'dealer_id' => $dealer->id,
    ]);

    $response = $this->actingAs($dealerUser)->get(route('dashboard'));

    $response->assertOk()
        ->assertInertia(fn (AssertableInertia $page) => $page
            ->component('dashboard')
            ->where('isGlobal', false)
            ->where('dealerOverview', [])
            ->where('overviewSummary', null)
            ->where('monitoringFeedback', [])
            ->where('monitoringSummary', null)
        );
});

test('dashboard returns word cloud frequency data extracted from reviews', function () {
    $superAdmin = User::factory()->superAdmin()->create();
    $dealer = Dealer::factory()->create();

    Review::factory()->create([
        'dealer_id' => $dealer->id,
        'tanggal_publish_review' => now()->toDateString(),
        'review' => 'Pelayanan ramah dan cepat, motor Honda sangat bagus',
    ]);
    Review::factory()->create([
        'dealer_id' => $dealer->id,
        'tanggal_publish_review' => now()->toDateString(),
        'review' => 'Beli motor Honda disini sangat puas, pelayanan ramah',
    ]);

    $response = $this->actingAs($superAdmin)->get(route('dashboard'));

    $response->assertOk()
        ->assertInertia(fn (AssertableInertia $page) => $page
            ->component('dashboard')
            ->has('wordCloudData')
            ->has('wordCloudAllTime')
            ->where('wordCloudData', fn ($words) => collect($words)->pluck('text')->contains('motor')
                && collect($words)->pluck('text')->contains('Pelayanan')
                && collect($words)->firstWhere('text', 'motor')['value'] === 2
            )
        );
});

test('dealer user word cloud only contains words from their own reviews', function () {
    $dealerA = Dealer::factory()->create(['nama_dealer' => 'Dealer A']);
    $dealerB = Dealer::factory()->create(['nama_dealer' => 'Dealer B']);

    $dealerUser = User::factory()->dealer()->create([
        'dealer_id' => $dealerA->id,
    ]);

    Review::factory()->create([
        'dealer_id' => $dealerA->id,
        'review' => 'Pelayanan sangat ramah di dealer A',
    ]);
    Review::factory()->create([
        'dealer_id' => $dealerB->id,
        'review' => 'Keluhan rusak parah di dealer B',
    ]);

    $response = $this->actingAs($dealerUser)->get(route('dashboard'));

    $response->assertOk()
        ->assertInertia(fn (AssertableInertia $page) => $page
            ->component('dashboard')
            ->where('wordCloudData', fn ($words) => collect($words)->pluck('text')->contains('Pelayanan')
                && ! collect($words)->pluck('text')->contains('Keluhan')
            )
        );
});

test('dashboard provides gmbClusterDealers and gmbClusterSummary with accurate 4-quadrant classification', function () {
    $superAdmin = User::factory()->superAdmin()->create();

    // 1. Excellent: star_rate >= 4.7, total_review >= 1000
    $d1 = Dealer::factory()->create([
        'nama_dealer' => 'Astra Motor Ampenan',
        'star_rate' => 4.9,
        'total_review' => 2800,
    ]);
    // 2. Volume: star_rate >= 4.7, total_review < 1000
    $d2 = Dealer::factory()->create([
        'nama_dealer' => 'Bina Motor',
        'star_rate' => 4.8,
        'total_review' => 500,
    ]);
    // 3. Quality: star_rate < 4.7, total_review >= 1000
    $d3 = Dealer::factory()->create([
        'nama_dealer' => 'Krida Mataram',
        'star_rate' => 4.6,
        'total_review' => 1200,
    ]);
    // 4. Improvement: star_rate < 4.7, total_review < 1000
    $d4 = Dealer::factory()->create([
        'nama_dealer' => 'Arbi Motor',
        'star_rate' => 4.4,
        'total_review' => 150,
    ]);

    $response = $this->actingAs($superAdmin)->get(route('dashboard'));

    $response->assertOk()
        ->assertInertia(fn (AssertableInertia $page) => $page
            ->component('dashboard')
            ->has('gmbClusterDealers')
            ->has('gmbClusterSummary')
            ->where('gmbClusterSummary.zones.EXCELLENT ZONE.count', fn ($val) => $val >= 1)
            ->where('gmbClusterSummary.zones.VOLUME ZONE.count', fn ($val) => $val >= 1)
            ->where('gmbClusterSummary.zones.QUALITY ZONE.count', fn ($val) => $val >= 1)
            ->where('gmbClusterSummary.zones.IMPROVEMENT ZONE.count', fn ($val) => $val >= 1)
            ->where('gmbClusterDealers', fn ($dealers) => collect($dealers)->firstWhere('id', $d1->id)['cluster_zone'] === 'EXCELLENT ZONE'
                && collect($dealers)->firstWhere('id', $d2->id)['cluster_zone'] === 'VOLUME ZONE'
                && collect($dealers)->firstWhere('id', $d3->id)['cluster_zone'] === 'QUALITY ZONE'
                && collect($dealers)->firstWhere('id', $d4->id)['cluster_zone'] === 'IMPROVEMENT ZONE'
            )
        );
});

test('dealer user only receives their own dealer in gmbClusterDealers', function () {
    $dealerA = Dealer::factory()->create(['nama_dealer' => 'Dealer A', 'star_rate' => 4.9, 'total_review' => 1500]);
    $dealerB = Dealer::factory()->create(['nama_dealer' => 'Dealer B', 'star_rate' => 4.2, 'total_review' => 100]);

    $dealerUser = User::factory()->dealer()->create([
        'dealer_id' => $dealerA->id,
    ]);

    $response = $this->actingAs($dealerUser)->get(route('dashboard'));

    $response->assertOk()
        ->assertInertia(fn (AssertableInertia $page) => $page
            ->component('dashboard')
            ->has('gmbClusterDealers', 1)
            ->where('gmbClusterDealers.0.id', $dealerA->id)
            ->where('gmbClusterDealers.0.cluster_zone', 'EXCELLENT ZONE')
        );
});

test('global user can filter dashboard with month=all for all-time review metrics', function () {
    $admin = User::factory()->superAdmin()->create();
    $dealer = Dealer::factory()->create([
        'kode_dealer' => 'DLR999',
        'nama_dealer' => 'Dealer Bintang Lima',
        'star_rate' => 5.0,
        'total_review' => 50,
    ]);

    // Review from 6 months ago
    Review::factory()->create([
        'dealer_id' => $dealer->id,
        'star_rate' => 5,
        'respon_from_owner' => true,
        'tanggal_publish_review' => '2025-01-10',
    ]);

    // Review from this month
    Review::factory()->create([
        'dealer_id' => $dealer->id,
        'star_rate' => 4,
        'respon_from_owner' => false,
        'tanggal_publish_review' => now()->toDateString(),
    ]);

    $response = $this->actingAs($admin)->get(route('dashboard', ['month' => 'all']));

    $response->assertOk()
        ->assertInertia(fn (AssertableInertia $page) => $page
            ->component('dashboard')
            ->where('activeMonth', 'all')
            ->where('prevMonth', null)
            ->has('dealerOverview')
            ->where('dealerOverview.0.review_monthly', 2)
            ->where('dealerOverview.0.rating_5', 1)
            ->where('dealerOverview.0.rating_4', 1)
        );
});

test('global user can filter dashboard with custom start_date and end_date range', function () {
    $admin = User::factory()->superAdmin()->create();
    $dealer = Dealer::factory()->create([
        'kode_dealer' => 'DLR001',
        'nama_dealer' => 'Dealer Bintang Mataram',
    ]);

    // Review within date range (2025-06-10)
    Review::factory()->create([
        'dealer_id' => $dealer->id,
        'star_rate' => 5,
        'respon_from_owner' => true,
        'tanggal_publish_review' => '2025-06-10 10:00:00',
    ]);

    // Review outside date range (2025-05-20)
    Review::factory()->create([
        'dealer_id' => $dealer->id,
        'star_rate' => 2,
        'respon_from_owner' => false,
        'tanggal_publish_review' => '2025-05-20 10:00:00',
    ]);

    $response = $this->actingAs($admin)->get(route('dashboard', [
        'start_date' => '2025-06-01',
        'end_date' => '2025-06-30',
    ]));

    $response->assertOk()
        ->assertInertia(fn (AssertableInertia $page) => $page
            ->component('dashboard')
            ->where('startDate', '2025-06-01')
            ->where('endDate', '2025-06-30')
            ->has('activeRangeLabel')
            ->where('metrics.total_reviews', 1)
            ->where('metrics.responded_count', 1)
            ->where('metrics.unresponded_count', 0)
        );
});

test('dashboard respects both dealer_id and date range filters combined', function () {
    $admin = User::factory()->superAdmin()->create();
    $dealerA = Dealer::factory()->create(['nama_dealer' => 'Dealer A']);
    $dealerB = Dealer::factory()->create(['nama_dealer' => 'Dealer B']);

    // Dealer A review inside date range
    Review::factory()->create([
        'dealer_id' => $dealerA->id,
        'star_rate' => 5,
        'respon_from_owner' => true,
        'tanggal_publish_review' => '2025-07-15 09:00:00',
    ]);

    // Dealer A review outside date range
    Review::factory()->create([
        'dealer_id' => $dealerA->id,
        'star_rate' => 4,
        'respon_from_owner' => true,
        'tanggal_publish_review' => '2025-04-10 09:00:00',
    ]);

    // Dealer B review inside date range
    Review::factory()->create([
        'dealer_id' => $dealerB->id,
        'star_rate' => 1,
        'respon_from_owner' => false,
        'tanggal_publish_review' => '2025-07-15 09:00:00',
    ]);

    $response = $this->actingAs($admin)->get(route('dashboard', [
        'dealer_id' => (string) $dealerA->id,
        'start_date' => '2025-07-01',
        'end_date' => '2025-07-31',
    ]));

    $response->assertOk()
        ->assertInertia(fn (AssertableInertia $page) => $page
            ->component('dashboard')
            ->where('selectedDealerId', (string) $dealerA->id)
            ->where('startDate', '2025-07-01')
            ->where('endDate', '2025-07-31')
            ->where('metrics.total_reviews', 1)
            ->where('metrics.responded_count', 1)
            ->where('metrics.unresponded_count', 0)
        );
});
