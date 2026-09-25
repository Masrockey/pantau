<?php

use App\Enums\UserRole;
use App\Models\Dealer;
use App\Models\User;

test('guests are redirected to the login page from users', function (): void {
    $response = $this->get(route('users.index'));

    $response->assertRedirect(route('login'));
});

test('authenticated users can view user list', function (): void {
    $user = User::factory()->create();

    $response = $this->actingAs($user)->get(route('users.index'));

    $response->assertOk();
});

test('users can be created with role and dealer', function (): void {
    $admin = User::factory()->superAdmin()->create();
    $dealer = Dealer::factory()->create();

    $response = $this->actingAs($admin)->post(route('users.store'), [
        'name' => 'Budi Santoso',
        'email' => 'budi.santoso@example.com',
        'password' => 'Password123@',
        'role' => UserRole::AdminDealer->value,
        'dealer_id' => $dealer->id,
    ]);

    $response->assertRedirect(route('users.index'));
    $this->assertDatabaseHas('users', [
        'name' => 'Budi Santoso',
        'email' => 'budi.santoso@example.com',
        'role' => UserRole::AdminDealer->value,
        'dealer_id' => $dealer->id,
    ]);
});

test('super admin can be created without dealer', function (): void {
    $admin = User::factory()->superAdmin()->create();

    $response = $this->actingAs($admin)->post(route('users.store'), [
        'name' => 'New Super Admin',
        'email' => 'newsuperadmin@example.com',
        'password' => 'Password123@',
        'role' => UserRole::SuperAdmin->value,
        'dealer_id' => '',
    ]);

    $response->assertRedirect(route('users.index'));
    $this->assertDatabaseHas('users', [
        'email' => 'newsuperadmin@example.com',
        'role' => UserRole::SuperAdmin->value,
        'dealer_id' => null,
    ]);
});

test('dealer is required when role is not super admin', function (): void {
    $admin = User::factory()->superAdmin()->create();

    $response = $this->actingAs($admin)->post(route('users.store'), [
        'name' => 'Staff Test',
        'email' => 'staff.test@example.com',
        'password' => 'Password123@',
        'role' => UserRole::User->value,
        'dealer_id' => '',
    ]);

    $response->assertSessionHasErrors(['dealer_id']);
});

test('users can be updated', function (): void {
    $admin = User::factory()->superAdmin()->create();
    $dealer = Dealer::factory()->create();
    $user = User::factory()->forDealer($dealer)->create();

    $newDealer = Dealer::factory()->create();

    $response = $this->actingAs($admin)->put(route('users.update', $user), [
        'name' => 'Nama Baru',
        'email' => $user->email,
        'role' => UserRole::AdminDealer->value,
        'dealer_id' => $newDealer->id,
    ]);

    $response->assertRedirect(route('users.index'));
    $this->assertDatabaseHas('users', [
        'id' => $user->id,
        'name' => 'Nama Baru',
        'role' => UserRole::AdminDealer->value,
        'dealer_id' => $newDealer->id,
    ]);
});

test('users cannot delete their own account from user management', function (): void {
    $user = User::factory()->create();

    $response = $this->actingAs($user)->delete(route('users.destroy', $user));

    $response->assertRedirect(route('users.index'));
    $this->assertDatabaseHas('users', [
        'id' => $user->id,
    ]);
});

test('users can delete other accounts', function (): void {
    $admin = User::factory()->superAdmin()->create();
    $otherUser = User::factory()->create();

    $response = $this->actingAs($admin)->delete(route('users.destroy', $otherUser));

    $response->assertRedirect(route('users.index'));
    $this->assertDatabaseMissing('users', [
        'id' => $otherUser->id,
    ]);
});
