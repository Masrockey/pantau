<?php

use App\Models\Dealer;
use App\Models\ScrapingSchedule;
use App\Models\User;
use App\Services\GoogleReviewScraperService;
use App\Services\SyncReviewServerService;
use Inertia\Testing\AssertableInertia;

test('guests cannot manage scraping schedules', function () {
    $this->post(route('reviews.sync.schedules.store'))->assertRedirect(route('login'));
});

test('regular dealer user cannot manage scraping schedules', function () {
    $user = User::factory()->dealer()->create();

    $this->actingAs($user)
        ->post(route('reviews.sync.schedules.store'), [
            'dealer_id' => 'all',
            'max_reviews' => 50,
            'sort_by' => 'newest',
            'interval_value' => 30,
            'interval_unit' => 'minute',
        ])
        ->assertForbidden();
});

test('super admin can create a schedule for all dealers', function () {
    $superAdmin = User::factory()->superAdmin()->create();

    $response = $this->actingAs($superAdmin)
        ->post(route('reviews.sync.schedules.store'), [
            'dealer_id' => 'all',
            'max_reviews' => 100,
            'sort_by' => 'newest',
            'interval_value' => 30,
            'interval_unit' => 'minute',
            'use_proxy' => true,
            'is_active' => true,
        ]);

    $response->assertSessionHasNoErrors();

    $this->assertDatabaseHas('scraping_schedules', [
        'dealer_id' => null,
        'max_reviews' => 100,
        'sort_by' => 'newest',
        'interval_value' => 30,
        'interval_unit' => 'minute',
        'use_proxy' => true,
        'is_active' => true,
    ]);
});

test('super admin can create a schedule for a specific dealer', function () {
    $superAdmin = User::factory()->superAdmin()->create();
    $dealer = Dealer::factory()->create(['link_google_maps' => 'https://maps.google.com/?cid=123']);

    $response = $this->actingAs($superAdmin)
        ->post(route('reviews.sync.schedules.store'), [
            'dealer_id' => (string) $dealer->id,
            'max_reviews' => 50,
            'sort_by' => 'highest',
            'interval_value' => 2,
            'interval_unit' => 'hour',
            'use_proxy' => true,
            'is_active' => true,
        ]);

    $response->assertSessionHasNoErrors();

    $this->assertDatabaseHas('scraping_schedules', [
        'dealer_id' => $dealer->id,
        'max_reviews' => 50,
        'sort_by' => 'highest',
        'interval_value' => 2,
        'interval_unit' => 'hour',
    ]);
});

test('schedule validation rejects interval less than 5 minutes', function () {
    $superAdmin = User::factory()->superAdmin()->create();

    $response = $this->actingAs($superAdmin)
        ->post(route('reviews.sync.schedules.store'), [
            'dealer_id' => 'all',
            'max_reviews' => 50,
            'sort_by' => 'newest',
            'interval_value' => 4, // Less than 5 minutes!
            'interval_unit' => 'minute',
        ]);

    $response->assertSessionHasErrors('interval_value');
});

test('super admin can update an existing schedule', function () {
    $superAdmin = User::factory()->superAdmin()->create();
    $schedule = ScrapingSchedule::factory()->create([
        'max_reviews' => 50,
        'interval_value' => 30,
        'interval_unit' => 'minute',
    ]);

    $response = $this->actingAs($superAdmin)
        ->put(route('reviews.sync.schedules.update', $schedule), [
            'dealer_id' => 'all',
            'max_reviews' => 200,
            'sort_by' => 'relevant',
            'interval_value' => 1,
            'interval_unit' => 'day',
            'use_proxy' => true,
            'is_active' => true,
        ]);

    $response->assertSessionHasNoErrors();

    $this->assertDatabaseHas('scraping_schedules', [
        'id' => $schedule->id,
        'max_reviews' => 200,
        'sort_by' => 'relevant',
        'interval_value' => 1,
        'interval_unit' => 'day',
    ]);
});

test('super admin can toggle schedule active state', function () {
    $superAdmin = User::factory()->superAdmin()->create();
    $schedule = ScrapingSchedule::factory()->create(['is_active' => true]);

    $this->actingAs($superAdmin)
        ->post(route('reviews.sync.schedules.toggle', $schedule))
        ->assertSessionHasNoErrors();

    expect($schedule->fresh()->is_active)->toBeFalse();

    $this->actingAs($superAdmin)
        ->post(route('reviews.sync.schedules.toggle', $schedule))
        ->assertSessionHasNoErrors();

    expect($schedule->fresh()->is_active)->toBeTrue();
});

test('super admin can delete a schedule', function () {
    $superAdmin = User::factory()->superAdmin()->create();
    $schedule = ScrapingSchedule::factory()->create();

    $this->actingAs($superAdmin)
        ->delete(route('reviews.sync.schedules.destroy', $schedule))
        ->assertSessionHasNoErrors();

    $this->assertDatabaseMissing('scraping_schedules', [
        'id' => $schedule->id,
    ]);
});

test('console command reviews:run-schedules processes due schedule', function () {
    $schedule = ScrapingSchedule::factory()->create([
        'dealer_id' => null,
        'is_active' => true,
        'next_run_at' => now()->subMinute(),
        'interval_value' => 30,
        'interval_unit' => 'minute',
    ]);

    $this->mock(GoogleReviewScraperService::class, function ($mock) {
        $mock->shouldReceive('isHealthy')->andReturn(true);
    });

    $this->mock(SyncReviewServerService::class, function ($mock) {
        $mock->shouldReceive('getStatus')->andReturn(['status' => 'idle']);
        $mock->shouldReceive('addLog');
        $mock->shouldReceive('launchBackgroundProcess')->once();
    });

    $this->artisan('reviews:run-schedules')
        ->assertSuccessful();

    $schedule->refresh();
    expect($schedule->last_run_at)->not->toBeNull()
        ->and($schedule->next_run_at)->toBeGreaterThan(now());
});

test('super admin can trigger immediate execution of a schedule', function () {
    $superAdmin = User::factory()->superAdmin()->create();
    $schedule = ScrapingSchedule::factory()->create([
        'dealer_id' => null,
        'is_active' => true,
        'interval_value' => 30,
        'interval_unit' => 'minute',
    ]);

    $this->mock(GoogleReviewScraperService::class, function ($mock) {
        $mock->shouldReceive('isHealthy')->andReturn(true);
    });

    $this->mock(SyncReviewServerService::class, function ($mock) {
        $mock->shouldReceive('getStatus')->andReturn(['status' => 'idle']);
        $mock->shouldReceive('launchBackgroundProcess')->once();
    });

    $response = $this->actingAs($superAdmin)
        ->post(route('reviews.sync.schedules.run', $schedule));

    $response->assertSessionHasNoErrors();
    $schedule->refresh();
    expect($schedule->last_status)->toBe('running');
});

test('sync page passes schedules list to frontend', function () {
    $superAdmin = User::factory()->superAdmin()->create();
    ScrapingSchedule::factory()->count(2)->create();

    $this->actingAs($superAdmin)
        ->get(route('reviews.sync.index'))
        ->assertOk()
        ->assertInertia(fn (AssertableInertia $page) => $page
            ->component('reviews/sync')
            ->has('schedules', 2)
        );
});
