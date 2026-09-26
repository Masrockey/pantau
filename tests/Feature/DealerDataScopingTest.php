<?php

use App\Enums\UserRole;
use App\Models\Dealer;
use App\Models\Review;
use App\Models\User;
use Inertia\Testing\AssertableInertia as Assert;

test('dealer user only sees their own dealer on dealers index', function (): void {
    $dealerA = Dealer::factory()->create(['nama_dealer' => 'Dealer Alpha']);
    $dealerB = Dealer::factory()->create(['nama_dealer' => 'Dealer Beta']);

    $userA = User::factory()->dealer()->forDealer($dealerA)->create();

    $response = $this->actingAs($userA)->get(route('dealers.index'));

    $response->assertOk()
        ->assertInertia(fn (Assert $page) => $page
            ->component('dealers/index')
            ->where('canManageAll', false)
            ->has('dealers.data', 1)
            ->where('dealers.data.0.id', $dealerA->id)
        );
});

test('dealer user cannot create or delete dealer', function (): void {
    $dealer = Dealer::factory()->create();
    $user = User::factory()->dealer()->forDealer($dealer)->create();

    $this->actingAs($user)
        ->post(route('dealers.store'), [
            'kode_dealer' => 'DLR999',
            'nama_dealer' => 'New Dealer',
        ])
        ->assertForbidden();

    $this->actingAs($user)
        ->delete(route('dealers.destroy', $dealer))
        ->assertForbidden();

    $this->actingAs($user)
        ->get(route('dealers.template'))
        ->assertForbidden();
});

test('dealer user can update their own dealer but not another dealer', function (): void {
    $dealerA = Dealer::factory()->create(['nama_dealer' => 'Dealer Alpha']);
    $dealerB = Dealer::factory()->create(['nama_dealer' => 'Dealer Beta']);
    $userA = User::factory()->dealer()->forDealer($dealerA)->create();

    // Updating their own dealer is allowed
    $response = $this->actingAs($userA)->put(route('dealers.update', $dealerA), [
        'kode_dealer' => $dealerA->kode_dealer,
        'nama_dealer' => 'Dealer Alpha Updated',
        'no_telp_showroom' => '08123456789',
    ]);
    $response->assertRedirect(route('dealers.index'));
    $this->assertDatabaseHas('dealers', [
        'id' => $dealerA->id,
        'nama_dealer' => 'Dealer Alpha Updated',
    ]);

    // Updating another dealer is forbidden
    $this->actingAs($userA)
        ->put(route('dealers.update', $dealerB), [
            'kode_dealer' => $dealerB->kode_dealer,
            'nama_dealer' => 'Hacked Dealer Beta',
        ])
        ->assertForbidden();
});

test('dealer user only sees reviews from their own dealer', function (): void {
    $dealerA = Dealer::factory()->create();
    $dealerB = Dealer::factory()->create();

    Review::factory()->forDealer($dealerA)->count(3)->create();
    Review::factory()->forDealer($dealerB)->count(5)->create();

    $userA = User::factory()->dealer()->forDealer($dealerA)->create();

    $response = $this->actingAs($userA)->get(route('reviews.index'));

    $response->assertOk()
        ->assertInertia(fn (Assert $page) => $page
            ->component('reviews/index')
            ->where('canManageAll', false)
            ->has('reviews.data', 3)
            ->where('stats.total', 3)
        );
});

test('dealer user creating review automatically binds to their dealer', function (): void {
    $dealerA = Dealer::factory()->create();
    $dealerB = Dealer::factory()->create();
    $userA = User::factory()->dealer()->forDealer($dealerA)->create();

    $response = $this->actingAs($userA)->post(route('reviews.store'), [
        'dealer_id' => $dealerB->id, // Attempting to use dealerB
        'nama_reviewer' => 'Pelanggan Alpha',
        'tanggal_publish_review' => '2026-09-26',
        'star_rate' => 5,
        'review' => 'Pelayanan ramah dan cepat!',
    ]);

    $response->assertRedirect(route('reviews.index'));
    $this->assertDatabaseHas('reviews', [
        'nama_reviewer' => 'Pelanggan Alpha',
        'dealer_id' => $dealerA->id, // Forced to dealerA
    ]);
});

test('dealer user cannot update or delete any review', function (): void {
    $dealerA = Dealer::factory()->create();
    $dealerB = Dealer::factory()->create();

    $reviewA = Review::factory()->forDealer($dealerA)->create();
    $reviewB = Review::factory()->forDealer($dealerB)->create();

    $userA = User::factory()->dealer()->forDealer($dealerA)->create();

    // Cannot update review of their own dealer
    $this->actingAs($userA)
        ->put(route('reviews.update', $reviewA), [
            'dealer_id' => $dealerA->id,
            'nama_reviewer' => 'Reviewer A Updated',
            'tanggal_publish_review' => '2026-09-26',
            'star_rate' => 5,
        ])
        ->assertForbidden();

    // Cannot update review of another dealer
    $this->actingAs($userA)
        ->put(route('reviews.update', $reviewB), [
            'dealer_id' => $dealerA->id,
            'nama_reviewer' => 'Hacked Reviewer',
            'tanggal_publish_review' => '2026-09-26',
            'star_rate' => 1,
        ])
        ->assertForbidden();

    // Cannot delete review of their own dealer
    $this->actingAs($userA)
        ->delete(route('reviews.destroy', $reviewA))
        ->assertForbidden();

    // Cannot delete review of another dealer
    $this->actingAs($userA)
        ->delete(route('reviews.destroy', $reviewB))
        ->assertForbidden();

    // Global user (Super Admin) CAN update and delete reviews
    $superAdmin = User::factory()->superAdmin()->create();
    $this->actingAs($superAdmin)
        ->put(route('reviews.update', $reviewA), [
            'dealer_id' => $dealerA->id,
            'nama_reviewer' => 'Reviewer A Updated by Admin',
            'tanggal_publish_review' => '2026-09-26',
            'star_rate' => 5,
        ])
        ->assertRedirect(route('reviews.index'));

    $this->assertDatabaseHas('reviews', [
        'id' => $reviewA->id,
        'nama_reviewer' => 'Reviewer A Updated by Admin',
    ]);

    $this->actingAs($superAdmin)
        ->delete(route('reviews.destroy', $reviewA))
        ->assertRedirect(route('reviews.index'));

    $this->assertDatabaseMissing('reviews', [
        'id' => $reviewA->id,
    ]);
});

test('dealer user cannot trigger scraper sync for another dealer or all', function (): void {
    $dealerA = Dealer::factory()->create(['link_google_maps' => 'https://maps.google.com/?cid=123']);
    $dealerB = Dealer::factory()->create(['link_google_maps' => 'https://maps.google.com/?cid=456']);

    $userA = User::factory()->dealer()->forDealer($dealerA)->create();

    // Cannot sync 'all'
    $this->actingAs($userA)
        ->postJson(route('reviews.sync.start'), [
            'dealer_id' => 'all',
        ])
        ->assertForbidden();

    // Cannot sync dealerB
    $this->actingAs($userA)
        ->postJson(route('reviews.sync.start'), [
            'dealer_id' => $dealerB->id,
        ])
        ->assertForbidden();
});

test('dealer user only sees users from their own dealer', function (): void {
    $dealerA = Dealer::factory()->create();
    $dealerB = Dealer::factory()->create();

    $userA1 = User::factory()->dealer()->forDealer($dealerA)->create(['name' => 'User A1']);
    $userA2 = User::factory()->dealer()->forDealer($dealerA)->create(['name' => 'User A2']);
    $userB1 = User::factory()->dealer()->forDealer($dealerB)->create(['name' => 'User B1']);

    $response = $this->actingAs($userA1)->get(route('users.index'));

    $response->assertOk()
        ->assertInertia(fn (Assert $page) => $page
            ->component('users/index')
            ->where('canManageAll', false)
            ->has('users.data', 2)
            ->has('dealers', 1)
            ->where('dealers.0.id', $dealerA->id)
        );
});

test('dealer user creating user forces dealer role and their own dealer id', function (): void {
    $dealerA = Dealer::factory()->create();
    $dealerB = Dealer::factory()->create();

    $userA = User::factory()->dealer()->forDealer($dealerA)->create();

    $response = $this->actingAs($userA)->post(route('users.store'), [
        'name' => 'Staff Baru Alpha',
        'email' => 'staff.alpha@example.com',
        'password' => 'Password123@',
        'role' => UserRole::SuperAdmin->value, // Trying to escalate to super_admin
        'dealer_id' => $dealerB->id,           // Trying to bind to dealerB
    ]);

    $response->assertRedirect(route('users.index'));
    $this->assertDatabaseHas('users', [
        'email' => 'staff.alpha@example.com',
        'role' => UserRole::Dealer->value, // Forced to dealer
        'dealer_id' => $dealerA->id,       // Forced to dealerA
    ]);
});

test('dealer user cannot delete user belonging to another dealer', function (): void {
    $dealerA = Dealer::factory()->create();
    $dealerB = Dealer::factory()->create();

    $userA = User::factory()->dealer()->forDealer($dealerA)->create();
    $userB = User::factory()->dealer()->forDealer($dealerB)->create();

    $this->actingAs($userA)
        ->delete(route('users.destroy', $userB))
        ->assertForbidden();
});

test('super admin and main dealer have global access across all dealers and reviews', function (): void {
    $dealerA = Dealer::factory()->create();
    $dealerB = Dealer::factory()->create();

    Review::factory()->forDealer($dealerA)->create();
    Review::factory()->forDealer($dealerB)->create();

    $superAdmin = User::factory()->superAdmin()->create();
    $mainDealer = User::factory()->mainDealer()->create();

    // Super Admin check
    $this->actingAs($superAdmin)->get(route('dealers.index'))
        ->assertOk()
        ->assertInertia(fn (Assert $page) => $page
            ->where('canManageAll', true)
            ->has('dealers.data', 2)
        );

    $this->actingAs($superAdmin)->get(route('reviews.index'))
        ->assertOk()
        ->assertInertia(fn (Assert $page) => $page
            ->where('canManageAll', true)
            ->has('reviews.data', 2)
        );

    // Main Dealer check
    $this->actingAs($mainDealer)->get(route('dealers.index'))
        ->assertOk()
        ->assertInertia(fn (Assert $page) => $page
            ->where('canManageAll', true)
            ->has('dealers.data', 2)
        );

    $this->actingAs($mainDealer)->get(route('reviews.index'))
        ->assertOk()
        ->assertInertia(fn (Assert $page) => $page
            ->where('canManageAll', true)
            ->has('reviews.data', 2)
        );
});
