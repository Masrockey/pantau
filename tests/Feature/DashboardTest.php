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
        );
});
