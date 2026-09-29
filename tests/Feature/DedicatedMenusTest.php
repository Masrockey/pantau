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
