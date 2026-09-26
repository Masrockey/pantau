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
