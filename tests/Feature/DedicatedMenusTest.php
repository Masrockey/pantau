<?php

use App\Models\Dealer;
use App\Models\Review;
use App\Models\User;
use Inertia\Testing\AssertableInertia;

test('guests are redirected to the login page when visiting dedicated menus', function () {
    $this->get(route('monitoring-feedback.index'))->assertRedirect(route('login'));
    $this->get(route('dealer-overview.index'))->assertRedirect(route('login'));
    $this->get(route('gmb-cluster.index'))->assertRedirect(route('login'));
});

test('authenticated user can visit monitoring feedback page', function () {
    $user = User::factory()->superAdmin()->create();
    $dealer = Dealer::factory()->create(['nama_dealer' => 'Dealer Test 1', 'star_rate' => 4.8, 'total_review' => 120]);

    Review::factory()->create([
        'dealer_id' => $dealer->id,
        'tanggal_publish_review' => now()->format('Y-m-d'),
        'star_rate' => 5,
        'respon_from_owner' => true,
        'tanggal_respon' => now()->format('Y-m-d'),
    ]);

    $response = $this->actingAs($user)->get(route('monitoring-feedback.index'));

    $response->assertOk()
        ->assertInertia(fn (AssertableInertia $page) => $page
            ->component('monitoring-feedback')
            ->has('dealers')
            ->has('summary')
            ->has('availableMonths')
            ->where('isGlobal', true)
        );
});

test('monitoring feedback handles all month filter', function () {
    $user = User::factory()->superAdmin()->create();
    $dealer = Dealer::factory()->create(['nama_dealer' => 'Dealer Test All', 'star_rate' => 4.9, 'total_review' => 50]);

    $response = $this->actingAs($user)->get(route('monitoring-feedback.index', ['month' => 'all']));

    $response->assertOk()
        ->assertInertia(fn (AssertableInertia $page) => $page
            ->component('monitoring-feedback')
            ->where('activeMonth', 'all')
        );
});

test('monitoring feedback handles custom date range filter', function () {
    $user = User::factory()->superAdmin()->create();
    $dealer = Dealer::factory()->create(['nama_dealer' => 'Dealer Date Range', 'star_rate' => 4.9, 'total_review' => 50]);

    Review::factory()->create([
        'dealer_id' => $dealer->id,
        'tanggal_publish_review' => '2026-08-10',
        'star_rate' => 5,
        'respon_from_owner' => true,
    ]);
    Review::factory()->create([
        'dealer_id' => $dealer->id,
        'tanggal_publish_review' => '2026-09-05',
        'star_rate' => 5,
        'respon_from_owner' => true,
    ]);

    $response = $this->actingAs($user)->get(route('monitoring-feedback.index', [
        'start_date' => '2026-09-01',
        'end_date' => '2026-09-15',
    ]));

    $response->assertOk()
        ->assertInertia(fn (AssertableInertia $page) => $page
            ->component('monitoring-feedback')
            ->where('startDate', '2026-09-01')
            ->where('endDate', '2026-09-15')
            ->has('prevStartDate')
            ->has('prevEndDate')
            ->has('activeRangeLabel')
            ->where('dealers.0.jumlah_review_m', 1)
        );
});

test('monitoring feedback includes type_dealer and availableTypeDealers props', function () {
    $user = User::factory()->superAdmin()->create();
    Dealer::factory()->create([
        'nama_dealer' => 'Dealer H123',
        'type_dealer' => 'H123',
        'star_rate' => 4.8,
    ]);
    Dealer::factory()->create([
        'nama_dealer' => 'Dealer H23',
        'type_dealer' => 'H23',
        'star_rate' => 4.6,
    ]);

    $response = $this->actingAs($user)->get(route('monitoring-feedback.index'));

    $response->assertOk()
        ->assertInertia(fn (AssertableInertia $page) => $page
            ->component('monitoring-feedback')
            ->where('selectedTypeDealers', [])
            ->where('availableTypeDealers', ['H123', 'H23'])
            ->has('dealers', 2)
            ->where('dealers.0.type_dealer', 'H123')
            ->where('dealers.1.type_dealer', 'H23')
        );
});

test('monitoring feedback filters dealers and summary by type_dealer', function () {
    $user = User::factory()->superAdmin()->create();
    $dealerH123 = Dealer::factory()->create([
        'nama_dealer' => 'Dealer H123',
        'type_dealer' => 'H123',
        'star_rate' => 5.0,
    ]);
    $dealerH23 = Dealer::factory()->create([
        'nama_dealer' => 'Dealer H23',
        'type_dealer' => 'H23',
        'star_rate' => 4.0,
    ]);

    Review::factory()->create([
        'dealer_id' => $dealerH123->id,
        'tanggal_publish_review' => '2026-09-05',
        'star_rate' => 5,
        'respon_from_owner' => true,
    ]);
    Review::factory()->count(2)->create([
        'dealer_id' => $dealerH23->id,
        'tanggal_publish_review' => '2026-09-06',
        'star_rate' => 5,
        'respon_from_owner' => false,
    ]);

    $response = $this->actingAs($user)->get(route('monitoring-feedback.index', [
        'start_date' => '2026-09-01',
        'end_date' => '2026-09-30',
        'type_dealer' => 'H123',
    ]));

    $response->assertOk()
        ->assertInertia(fn (AssertableInertia $page) => $page
            ->component('monitoring-feedback')
            ->where('selectedTypeDealers', ['H123'])
            ->where('availableTypeDealers', ['H123', 'H23'])
            ->has('dealers', 1)
            ->where('dealers.0.id', $dealerH123->id)
            ->where('dealers.0.type_dealer', 'H123')
            ->where('summary.rating_4_5', 1)
            ->where('summary.jumlah_review_m', 1)
        );
});

test('monitoring feedback filters dealers and summary with multiple type_dealer values', function () {
    $user = User::factory()->superAdmin()->create();
    $dealerH1 = Dealer::factory()->create([
        'nama_dealer' => 'Dealer H1',
        'type_dealer' => 'H1',
        'star_rate' => 5.0,
    ]);
    $dealerH23 = Dealer::factory()->create([
        'nama_dealer' => 'Dealer H23',
        'type_dealer' => 'H23',
        'star_rate' => 4.5,
    ]);
    Dealer::factory()->create([
        'nama_dealer' => 'Dealer H123',
        'type_dealer' => 'H123',
        'star_rate' => 4.0,
    ]);
    $dealerEmpty = Dealer::factory()->create([
        'nama_dealer' => 'Dealer Tanpa Type',
        'type_dealer' => null,
        'star_rate' => 4.2,
    ]);

    Review::factory()->create([
        'dealer_id' => $dealerH1->id,
        'tanggal_publish_review' => '2026-09-05',
        'star_rate' => 5,
        'respon_from_owner' => true,
    ]);
    Review::factory()->count(2)->create([
        'dealer_id' => $dealerH23->id,
        'tanggal_publish_review' => '2026-09-06',
        'star_rate' => 5,
        'respon_from_owner' => true,
    ]);

    $response = $this->actingAs($user)->get(route('monitoring-feedback.index', [
        'start_date' => '2026-09-01',
        'end_date' => '2026-09-30',
        'type_dealer' => ['H1', 'H23'],
    ]));

    $response->assertOk()
        ->assertInertia(fn (AssertableInertia $page) => $page
            ->component('monitoring-feedback')
            ->where('selectedTypeDealers', ['H1', 'H23'])
            ->where('availableTypeDealers', ['H1', 'H123', 'H23'])
            ->has('dealers', 2)
            ->where('dealers.0.id', $dealerH1->id)
            ->where('dealers.1.id', $dealerH23->id)
            ->where('summary.jumlah_review_m', 3)
        );

    $combinedResponse = $this->actingAs($user)->get(route('monitoring-feedback.index', [
        'type_dealer' => ['H1', '__empty__'],
    ]));

    $combinedResponse->assertOk()
        ->assertInertia(fn (AssertableInertia $page) => $page
            ->component('monitoring-feedback')
            ->where('selectedTypeDealers', ['H1', '__empty__'])
            ->has('dealers', 2)
            ->where('dealers.0.id', $dealerH1->id)
            ->where('dealers.1.id', $dealerEmpty->id)
        );
});

test('monitoring feedback filters dealers with empty type_dealer', function () {
    $user = User::factory()->superAdmin()->create();
    Dealer::factory()->create([
        'nama_dealer' => 'Dealer Filled',
        'type_dealer' => 'H123',
        'star_rate' => 4.8,
    ]);
    $emptyDealer = Dealer::factory()->create([
        'nama_dealer' => 'Dealer Null Type',
        'type_dealer' => null,
        'star_rate' => 4.5,
    ]);
    $blankDealer = Dealer::factory()->create([
        'nama_dealer' => 'Dealer Blank Type',
        'type_dealer' => '',
        'star_rate' => 4.4,
    ]);

    $response = $this->actingAs($user)->get(route('monitoring-feedback.index', [
        'type_dealer' => '__empty__',
    ]));

    $response->assertOk()
        ->assertInertia(fn (AssertableInertia $page) => $page
            ->component('monitoring-feedback')
            ->where('selectedTypeDealers', ['__empty__'])
            ->where('availableTypeDealers', ['H123'])
            ->has('dealers', 2)
            ->where('dealers.0.id', $emptyDealer->id)
            ->where('dealers.1.id', $blankDealer->id)
        );
});

test('authenticated user can visit dealer overview page', function () {
    $user = User::factory()->superAdmin()->create();
    $dealer = Dealer::factory()->create(['nama_dealer' => 'Dealer Test 2', 'star_rate' => 4.7, 'total_review' => 200]);

    Review::factory()->create([
        'dealer_id' => $dealer->id,
        'tanggal_publish_review' => now()->format('Y-m-d'),
        'star_rate' => 4,
    ]);

    $response = $this->actingAs($user)->get(route('dealer-overview.index'));

    $response->assertOk()
        ->assertInertia(fn (AssertableInertia $page) => $page
            ->component('dealer-overview')
            ->has('dealers')
            ->has('summary')
            ->has('availableMonths')
            ->where('isGlobal', true)
        );
});

test('dealer overview handles all month filter', function () {
    $user = User::factory()->superAdmin()->create();
    $dealer = Dealer::factory()->create(['nama_dealer' => 'Dealer Test All 2', 'star_rate' => 4.6, 'total_review' => 80]);

    $response = $this->actingAs($user)->get(route('dealer-overview.index', ['month' => 'all']));

    $response->assertOk()
        ->assertInertia(fn (AssertableInertia $page) => $page
            ->component('dealer-overview')
            ->where('activeMonth', 'all')
        );
});

test('dealer overview includes type_dealer and supports multi-select type_dealer filter', function () {
    $user = User::factory()->superAdmin()->create();
    $dealerH1 = Dealer::factory()->create([
        'nama_dealer' => 'Dealer H1',
        'type_dealer' => 'H1',
        'star_rate' => 5.0,
        'total_review' => 100,
    ]);
    $dealerH23 = Dealer::factory()->create([
        'nama_dealer' => 'Dealer H23',
        'type_dealer' => 'H23',
        'star_rate' => 4.7,
        'total_review' => 80,
    ]);
    Dealer::factory()->create([
        'nama_dealer' => 'Dealer H123',
        'type_dealer' => 'H123',
        'star_rate' => 4.3,
        'total_review' => 60,
    ]);
    $dealerEmpty = Dealer::factory()->create([
        'nama_dealer' => 'Dealer Tanpa Type',
        'type_dealer' => null,
        'star_rate' => 4.5,
        'total_review' => 40,
    ]);

    Review::factory()->create([
        'dealer_id' => $dealerH1->id,
        'tanggal_publish_review' => '2026-09-05',
        'star_rate' => 5,
        'respon_from_owner' => true,
    ]);
    Review::factory()->count(2)->create([
        'dealer_id' => $dealerH23->id,
        'tanggal_publish_review' => '2026-09-06',
        'star_rate' => 4,
        'respon_from_owner' => false,
    ]);

    $response = $this->actingAs($user)->get(route('dealer-overview.index', [
        'month' => '2026-09',
        'type_dealer' => ['H1', 'H23'],
    ]));

    $response->assertOk()
        ->assertInertia(fn (AssertableInertia $page) => $page
            ->component('dealer-overview')
            ->where('selectedTypeDealers', ['H1', 'H23'])
            ->where('availableTypeDealers', ['H1', 'H123', 'H23'])
            ->has('dealers', 2)
            ->where('dealers.0.id', $dealerH23->id)
            ->where('dealers.0.type_dealer', 'H23')
            ->where('dealers.1.id', $dealerH1->id)
            ->where('dealers.1.type_dealer', 'H1')
            ->where('summary.review_monthly', 3)
            ->where('summary.rating_5', 1)
            ->where('summary.rating_4', 2)
        );

    $emptyResponse = $this->actingAs($user)->get(route('dealer-overview.index', [
        'type_dealer' => ['H1', '__empty__'],
    ]));

    $emptyResponse->assertOk()
        ->assertInertia(fn (AssertableInertia $page) => $page
            ->component('dealer-overview')
            ->where('selectedTypeDealers', ['H1', '__empty__'])
            ->has('dealers', 2)
            ->where('dealers.0.id', $dealerH1->id)
            ->where('dealers.1.id', $dealerEmpty->id)
        );
});

test('authenticated user can visit gmb cluster page', function () {
    $user = User::factory()->superAdmin()->create();
    Dealer::factory()->create([
        'nama_dealer' => 'Dealer Excellent',
        'star_rate' => 4.9,
        'total_review' => 1500,
    ]);
    Dealer::factory()->create([
        'nama_dealer' => 'Dealer Volume',
        'star_rate' => 4.8,
        'total_review' => 200,
    ]);

    $response = $this->actingAs($user)->get(route('gmb-cluster.index'));

    $response->assertOk()
        ->assertInertia(fn (AssertableInertia $page) => $page
            ->component('gmb-cluster')
            ->has('dealers', 2)
            ->has('summary')
            ->where('summary.zones.EXCELLENT ZONE.count', 1)
            ->where('summary.zones.VOLUME ZONE.count', 1)
        );
});

test('dealer user is scoped to their own dealer on dedicated pages', function () {
    $dealerA = Dealer::factory()->create(['nama_dealer' => 'Dealer A', 'star_rate' => 4.8, 'total_review' => 100]);
    $dealerB = Dealer::factory()->create(['nama_dealer' => 'Dealer B', 'star_rate' => 4.2, 'total_review' => 50]);

    $dealerUser = User::factory()->dealer()->create([
        'dealer_id' => $dealerA->id,
    ]);

    $this->actingAs($dealerUser)->get(route('monitoring-feedback.index'))
        ->assertOk()
        ->assertInertia(fn (AssertableInertia $page) => $page
            ->component('monitoring-feedback')
            ->where('isGlobal', false)
            ->has('dealers', 1)
            ->where('dealers.0.id', $dealerA->id)
        );

    $this->actingAs($dealerUser)->get(route('dealer-overview.index'))
        ->assertOk()
        ->assertInertia(fn (AssertableInertia $page) => $page
            ->component('dealer-overview')
            ->where('isGlobal', false)
            ->has('dealers', 1)
            ->where('dealers.0.id', $dealerA->id)
        );

    $this->actingAs($dealerUser)->get(route('gmb-cluster.index'))
        ->assertOk()
        ->assertInertia(fn (AssertableInertia $page) => $page
            ->component('gmb-cluster')
            ->where('isGlobal', false)
            ->has('dealers', 1)
            ->where('dealers.0.id', $dealerA->id)
        );
});
