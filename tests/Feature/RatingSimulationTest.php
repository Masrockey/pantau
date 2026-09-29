<?php

use App\Models\Dealer;
use App\Models\User;
use Inertia\Testing\AssertableInertia;

test('guests are redirected to the login page when visiting rating simulasi', function () {
    $response = $this->get(route('rating-simulasi.index'));
    $response->assertRedirect(route('login'));
});

test('authenticated super admin can visit rating simulasi page and receives dealers and current dealer', function () {
    $superAdmin = User::factory()->superAdmin()->create();
    $dealerA = Dealer::factory()->create([
        'nama_dealer' => 'Arbi Motor 2',
        'star_rate' => 4.60,
        'total_review' => 17,
        'link_google_maps' => 'https://maps.google.com/?cid=123',
    ]);
    $dealerB = Dealer::factory()->create([
        'nama_dealer' => 'Astra Motor Ampenan',
        'star_rate' => 4.90,
        'total_review' => 2800,
    ]);

    $response = $this->actingAs($superAdmin)->get(route('rating-simulasi.index'));

    $response->assertOk()
        ->assertInertia(fn (AssertableInertia $page) => $page
            ->component('rating-simulasi')
            ->where('isGlobal', true)
            ->has('dealers', 2)
            ->has('currentDealer')
            ->where('currentDealer.id', $dealerA->id)
            ->where('currentDealer.nama_dealer', 'Arbi Motor 2')
            ->where('currentDealer.star_rate', 4.6)
            ->where('currentDealer.total_review', 17)
            ->where('currentDealer.current_zone', 'IMPROVEMENT ZONE')
            ->where('initialTargetRating', 4.8)
        );
});

test('super admin can select a specific dealer by dealer_id', function () {
    $superAdmin = User::factory()->superAdmin()->create();
    $dealerA = Dealer::factory()->create(['nama_dealer' => 'Dealer Alpha', 'star_rate' => 4.5, 'total_review' => 50]);
    $dealerB = Dealer::factory()->create(['nama_dealer' => 'Dealer Beta', 'star_rate' => 4.9, 'total_review' => 1500]);

    $response = $this->actingAs($superAdmin)->get(route('rating-simulasi.index', ['dealer_id' => $dealerB->id]));

    $response->assertOk()
        ->assertInertia(fn (AssertableInertia $page) => $page
            ->component('rating-simulasi')
            ->where('currentDealer.id', $dealerB->id)
            ->where('currentDealer.current_zone', 'EXCELLENT ZONE')
        );
});

test('dealer user is locked to their own dealership in rating simulasi', function () {
    $dealerA = Dealer::factory()->create(['nama_dealer' => 'My Dealership', 'star_rate' => 4.8, 'total_review' => 500]);
    $dealerB = Dealer::factory()->create(['nama_dealer' => 'Other Dealership', 'star_rate' => 4.2, 'total_review' => 100]);

    $dealerUser = User::factory()->dealer()->create([
        'dealer_id' => $dealerA->id,
    ]);

    $response = $this->actingAs($dealerUser)->get(route('rating-simulasi.index', ['dealer_id' => $dealerB->id]));

    $response->assertOk()
        ->assertInertia(fn (AssertableInertia $page) => $page
            ->component('rating-simulasi')
            ->where('isGlobal', false)
            ->has('dealers', 1)
            ->where('currentDealer.id', $dealerA->id)
            ->where('currentDealer.current_zone', 'VOLUME ZONE')
        );
});
