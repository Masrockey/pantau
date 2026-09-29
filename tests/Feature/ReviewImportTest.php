<?php

use App\Models\Dealer;
use App\Models\Review;
use App\Models\User;
use Illuminate\Http\UploadedFile;

test('authenticated user can download review template', function (): void {
    $user = User::factory()->create();

    $response = $this->actingAs($user)->get(route('reviews.template'));

    $response->assertOk();
    $response->assertHeader('content-disposition', 'attachment; filename="template_review.xlsx"');
});

test('can import reviews from csv file', function (): void {
    $user = User::factory()->create();
    $dealer = Dealer::factory()->create([
        'kode_dealer' => 'DLR001',
        'nama_dealer' => 'Dealer Nusantara Jakarta',
    ]);

    $csvContent = "Kode Dealer,Nama Reviewer,Tanggal Review,Star Rate,Review,Respon From Owner,Tanggal Respon,Respon,Google Review URL\n"
        ."DLR001,Budi Santoso,2026-09-15,5,\"Pelayanan sangat bagus dan cepat\",Ya,2026-09-16,\"Terima kasih Bapak Budi!\",https://maps.app.goo.gl/rev1\n"
        ."DLR001,Siti Aminah,2026-09-18,4,\"Ruang tunggu nyaman\",Tidak,,,https://maps.app.goo.gl/rev2\n";

    $file = UploadedFile::fake()->createWithContent('reviews.csv', $csvContent);

    $response = $this->actingAs($user)->post(route('reviews.import'), [
        'file' => $file,
        'update_existing' => true,
    ]);

    $response->assertRedirect(route('reviews.index'));

    $this->assertDatabaseHas('reviews', [
        'dealer_id' => $dealer->id,
        'nama_reviewer' => 'Budi Santoso',
        'star_rate' => 5.0,
        'review' => 'Pelayanan sangat bagus dan cepat',
        'respon_from_owner' => true,
        'respon' => 'Terima kasih Bapak Budi!',
        'google_review_url' => 'https://maps.app.goo.gl/rev1',
    ]);

    $this->assertDatabaseHas('reviews', [
        'dealer_id' => $dealer->id,
        'nama_reviewer' => 'Siti Aminah',
        'star_rate' => 4.0,
        'respon_from_owner' => false,
        'google_review_url' => 'https://maps.app.goo.gl/rev2',
    ]);

    // Check dealer stats update
    $dealer->refresh();
    expect($dealer->total_review)->toBe(2)
        ->and($dealer->star_rate)->toEqual(4.5);
});

test('import automatically updates existing reviews when matching url or reviewer name', function (): void {
    $user = User::factory()->create();
    $dealer = Dealer::factory()->create([
        'kode_dealer' => 'DLR100',
    ]);

    // Create an existing review
    $existingReview = Review::factory()->create([
        'dealer_id' => $dealer->id,
        'nama_reviewer' => 'Andi Wijaya',
        'tanggal_publish_review' => '2026-09-10',
        'star_rate' => 3.0,
        'review' => 'Ulasan lama sebelum diupdate',
        'respon_from_owner' => false,
        'respon' => null,
        'google_review_url' => 'https://maps.app.goo.gl/andi100',
    ]);

    $csvContent = "Kode Dealer,Nama Reviewer,Tanggal Review,Star Rate,Review,Respon From Owner,Tanggal Respon,Respon,Google Review URL\n"
        ."DLR100,Andi Wijaya,2026-09-10,5,\"Ulasan baru setelah revisi\",Ya,2026-09-11,\"Terima kasih atas revisi ulasannya!\",https://maps.app.goo.gl/andi100\n";

    $file = UploadedFile::fake()->createWithContent('reviews.csv', $csvContent);

    $response = $this->actingAs($user)->post(route('reviews.import'), [
        'file' => $file,
        'update_existing' => true,
    ]);

    $response->assertRedirect(route('reviews.index'));

    $existingReview->refresh();
    expect($existingReview->star_rate)->toEqual(5.0)
        ->and($existingReview->review)->toBe('Ulasan baru setelah revisi')
        ->and($existingReview->respon_from_owner)->toBeTrue()
        ->and($existingReview->respon)->toBe('Terima kasih atas revisi ulasannya!');

    // Total review in DB should still be 1 (not duplicated)
    expect(Review::where('dealer_id', $dealer->id)->count())->toBe(1);
});

test('import requires a valid file', function (): void {
    $user = User::factory()->create();

    $response = $this->actingAs($user)->post(route('reviews.import'), [
        'file' => null,
    ]);

    $response->assertSessionHasErrors(['file']);
});

test('dealer user import is automatically scoped to their own dealer', function (): void {
    $dealer1 = Dealer::factory()->create(['kode_dealer' => 'DLR111']);
    $dealer2 = Dealer::factory()->create(['kode_dealer' => 'DLR222']);

    $dealerUser = User::factory()->create([
        'role' => 'dealer',
        'dealer_id' => $dealer1->id,
    ]);

    // CSV has rows without dealer code or with another dealer code, but user is scoped to dealer1
    $csvContent = "Kode Dealer,Nama Reviewer,Tanggal Review,Star Rate,Review\n"
        ."DLR222,Konsumen Setia,2026-09-20,5,\"Bagus sekali\"\n";

    $file = UploadedFile::fake()->createWithContent('reviews.csv', $csvContent);

    $response = $this->actingAs($dealerUser)->post(route('reviews.import'), [
        'file' => $file,
        'update_existing' => true,
    ]);

    $response->assertRedirect(route('reviews.index'));

    // Should be saved under dealer1 because user is scoped to dealer1
    $this->assertDatabaseHas('reviews', [
        'dealer_id' => $dealer1->id,
        'nama_reviewer' => 'Konsumen Setia',
    ]);
});

test('can import review file larger than 2MB', function (): void {
    $user = User::factory()->create();
    $dealer = Dealer::factory()->create(['kode_dealer' => 'DLR888']);

    $header = "Kode Dealer,Nama Reviewer,Tanggal Review,Star Rate,Review\n";
    $row = "DLR888,Reviewer Besar,2026-09-20,5,\"Pelayanan bagus\"\n";
    // Pad content to ~3MB
    $padding = str_repeat("# komentar ekstra panjang\n", 100000);
    $content = $header.$row.$padding;

    $file = UploadedFile::fake()->createWithContent('reviews_large.csv', $content);

    $response = $this->actingAs($user)->post(route('reviews.import'), [
        'file' => $file,
        'update_existing' => true,
    ]);

    $response->assertRedirect(route('reviews.index'));
    $this->assertDatabaseHas('reviews', [
        'dealer_id' => $dealer->id,
        'nama_reviewer' => 'Reviewer Besar',
    ]);
});
