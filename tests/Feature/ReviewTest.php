<?php

use App\Models\Dealer;
use App\Models\Review;
use App\Models\User;

test('guests are redirected to the login page from reviews', function (): void {
    $response = $this->get(route('reviews.index'));

    $response->assertRedirect(route('login'));
});

test('authenticated users can view reviews list', function (): void {
    $user = User::factory()->create();
    $dealer = Dealer::factory()->create();
    Review::factory()->create([
        'dealer_id' => $dealer->id,
        'nama_reviewer' => 'Budi Santoso',
    ]);

    $response = $this->actingAs($user)->get(route('reviews.index'));

    $response->assertOk();
});

test('authenticated users can create a review with owner response', function (): void {
    $user = User::factory()->create();
    $dealer = Dealer::factory()->create();

    $response = $this->actingAs($user)->post(route('reviews.store'), [
        'dealer_id' => $dealer->id,
        'nama_reviewer' => 'Rina Wijaya',
        'tanggal_publish_review' => '2026-09-20',
        'star_rate' => 5.0,
        'review' => 'Pelayanan sangat memuaskan dan cepat!',
        'respon_from_owner' => true,
        'tanggal_respon' => '2026-09-21',
        'respon' => 'Terima kasih banyak atas kunjungannya!',
        'google_review_url' => 'https://maps.app.goo.gl/abc123xyz',
    ]);

    $response->assertRedirect(route('reviews.index'));
    $this->assertDatabaseHas('reviews', [
        'dealer_id' => $dealer->id,
        'nama_reviewer' => 'Rina Wijaya',
        'star_rate' => 5.0,
        'respon_from_owner' => true,
        'respon' => 'Terima kasih banyak atas kunjungannya!',
    ]);
});

test('creating a review without owner response nullifies response fields', function (): void {
    $user = User::factory()->create();
    $dealer = Dealer::factory()->create();

    $response = $this->actingAs($user)->post(route('reviews.store'), [
        'dealer_id' => $dealer->id,
        'nama_reviewer' => 'Doni Siregar',
        'tanggal_publish_review' => '2026-09-22',
        'star_rate' => 4.0,
        'review' => 'Bagus dan ramah.',
        'respon_from_owner' => false,
        'tanggal_respon' => '2026-09-23', // should be ignored/nullified
        'respon' => 'Some response', // should be ignored/nullified
    ]);

    $response->assertRedirect(route('reviews.index'));
    $this->assertDatabaseHas('reviews', [
        'dealer_id' => $dealer->id,
        'nama_reviewer' => 'Doni Siregar',
        'respon_from_owner' => false,
        'tanggal_respon' => null,
        'respon' => null,
    ]);
});

test('reviews validation rules reject invalid data', function (): void {
    $user = User::factory()->create();

    $response = $this->actingAs($user)->post(route('reviews.store'), [
        'dealer_id' => 999999, // non-existent
        'nama_reviewer' => '',
        'tanggal_publish_review' => 'not-a-date',
        'star_rate' => 10, // out of range
    ]);

    $response->assertSessionHasErrors([
        'dealer_id',
        'nama_reviewer',
        'tanggal_publish_review',
        'star_rate',
    ]);
});

test('authenticated users can update a review', function (): void {
    $user = User::factory()->create();
    $dealer = Dealer::factory()->create();
    $review = Review::factory()->unresponded()->create([
        'dealer_id' => $dealer->id,
    ]);

    $response = $this->actingAs($user)->put(route('reviews.update', $review), [
        'dealer_id' => $dealer->id,
        'nama_reviewer' => 'Updated Reviewer',
        'tanggal_publish_review' => '2026-09-15',
        'star_rate' => 4.5,
        'review' => 'Updated review text',
        'respon_from_owner' => true,
        'tanggal_respon' => '2026-09-16',
        'respon' => 'Owner response updated',
        'google_review_url' => 'https://maps.app.goo.gl/updated',
    ]);

    $response->assertRedirect(route('reviews.index'));
    $this->assertDatabaseHas('reviews', [
        'id' => $review->id,
        'nama_reviewer' => 'Updated Reviewer',
        'star_rate' => 4.5,
        'respon_from_owner' => true,
        'respon' => 'Owner response updated',
    ]);
});

test('authenticated users can delete a review', function (): void {
    $user = User::factory()->create();
    $review = Review::factory()->create();

    $response = $this->actingAs($user)->delete(route('reviews.destroy', $review));

    $response->assertRedirect(route('reviews.index'));
    $this->assertDatabaseMissing('reviews', [
        'id' => $review->id,
    ]);
});

test('reviews can be filtered by dealer, star_rate, and search keyword', function (): void {
    $user = User::factory()->create();
    $dealerA = Dealer::factory()->create(['nama_dealer' => 'Dealer Alpha']);
    $dealerB = Dealer::factory()->create(['nama_dealer' => 'Dealer Beta']);

    $reviewA = Review::factory()->create([
        'dealer_id' => $dealerA->id,
        'nama_reviewer' => 'Alex Handoko',
        'star_rate' => 5.0,
        'review' => 'Layanan nomor satu di kota',
    ]);
    $reviewB = Review::factory()->create([
        'dealer_id' => $dealerB->id,
        'nama_reviewer' => 'Bambang Sukses',
        'star_rate' => 2.0,
        'review' => 'Perlu ditingkatkan waktu tunggu',
    ]);

    // Search by reviewer name
    $searchResponse = $this->actingAs($user)->get(route('reviews.index', ['search' => 'Handoko']));
    $searchResponse->assertOk();

    // Filter by dealer
    $dealerResponse = $this->actingAs($user)->get(route('reviews.index', ['dealer_id' => $dealerA->id]));
    $dealerResponse->assertOk();

    // Filter by star rate
    $starResponse = $this->actingAs($user)->get(route('reviews.index', ['star_rate' => '5']));
    $starResponse->assertOk();
});

test('reviews can be filtered by date range', function (): void {
    $user = User::factory()->create();
    $dealer = Dealer::factory()->create();

    $reviewOld = Review::factory()->create([
        'dealer_id' => $dealer->id,
        'tanggal_publish_review' => '2026-08-01',
        'nama_reviewer' => 'Old Reviewer',
    ]);
    $reviewTarget = Review::factory()->create([
        'dealer_id' => $dealer->id,
        'tanggal_publish_review' => '2026-09-15',
        'nama_reviewer' => 'Target Reviewer',
    ]);
    $reviewFuture = Review::factory()->create([
        'dealer_id' => $dealer->id,
        'tanggal_publish_review' => '2026-10-20',
        'nama_reviewer' => 'Future Reviewer',
    ]);

    $response = $this->actingAs($user)->get(route('reviews.index', [
        'start_date' => '2026-09-01',
        'end_date' => '2026-09-30',
    ]));

    $response->assertOk();
    $response->assertInertia(function ($page): void {
        $page->component('reviews/index')
            ->has('reviews.data', 1)
            ->where('reviews.data.0.nama_reviewer', 'Target Reviewer')
            ->where('filters.start_date', '2026-09-01')
            ->where('filters.end_date', '2026-09-30');
    });
});

test('authenticated users can export filtered reviews to xlsx', function (): void {
    $user = User::factory()->create();
    $dealer = Dealer::factory()->create(['kode_dealer' => 'DLR099', 'nama_dealer' => 'Dealer Sukses']);

    Review::factory()->create([
        'dealer_id' => $dealer->id,
        'nama_reviewer' => 'Pelanggan Setia',
        'star_rate' => 5.0,
        'review' => 'Pelayanan sangat memuaskan!',
        'tanggal_publish_review' => '2026-09-10',
    ]);

    $response = $this->actingAs($user)->get(route('reviews.export', [
        'start_date' => '2026-09-01',
        'end_date' => '2026-09-30',
    ]));

    $response->assertOk();
    $response->assertHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    expect((string) $response->headers->get('Content-Disposition'))->toContain('reviews_export_');
    expect(strlen((string) $response->getContent()))->toBeGreaterThan(100);
});
